const { schedule } = require('@netlify/functions');
const https = require('https');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 1. 初始化 Firebase
if (!admin.apps.length) {
  try {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  } catch (e) { console.error("❌ Firebase Init Error:", e); }
}
const db = admin.firestore();

// 2. Email Config
const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID,
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY,
    private_key: process.env.EMAILJS_PRIVATE_KEY,
    templates: {
        WON_BID: "template_3n90m3u", 
        PARTIAL_WIN: "template_vphbdyp", 
        LOST_BID: "template_1v8p3y8",
    }
};

const sendEmail = (templateId, params) => {
    return new Promise((resolve) => {
        if (!EMAIL_CFG.service_id) return resolve("No Config");
        const postData = JSON.stringify({
            service_id: EMAIL_CFG.service_id,
            template_id: templateId,
            user_id: EMAIL_CFG.user_id,
            accessToken: EMAIL_CFG.private_key,
            template_params: params
        });
        const req = https.request({
            hostname: 'api.emailjs.com', port: 443, path: '/api/v1.0/email/send', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        }, (res) => resolve(res.statusCode));
        req.on('error', () => resolve("Error"));
        req.write(postData);
        req.end();
    });
};

const settlementHandler = async (event, context) => {
    console.log("⏰ Settlement Run (Time-Aware V4)...");
    try {
        // 1. 抓取所有潛在需要結算的訂單 (狀態還未完全定案的)
        // 注意：這裡還是抓所有，因為我們需要在內存中過濾時間
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'partially_outbid', 'partially_won']).get();
        
        if (snapshot.empty) return { statusCode: 200, body: "No pending orders" };

        const slotsMap = {};      
        const orderResults = {};
        const now = new Date(); // 當前伺服器時間 (UTC)
        
        // B. 準備數據 & 檢查時間
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;

            if (!orderResults[orderId]) {
                orderResults[orderId] = {
                    id: orderId,
                    userEmail: data.userEmail,
                    userName: data.userName,
                    paymentIntentId: data.paymentIntentId,
                    originalAmount: data.amount || 0,
                    originalSlots: data.detailedSlots || [],
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    wonSlotsList: [], 
                    lostSlotsList: [], 
                    slotStatuses: {}, 
                    status: data.status,
                    screenNames: new Set(),
                    shouldSettleAny: false // 標記：這張單是否有任何部分到期了
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach((slot, index) => {
                    orderResults[orderId].totalSlots++; 
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                    
                    // 🔥 核心時間檢查 🔥
                    // 計算截標時間：播放時間 - 24小時
                    // 這裡假設 slot.date 是 YYYY-MM-DD 格式
                    // 注意：簡單起見，我們將 slot 時間轉為時間戳比較
                    // 如果 slotDateStr 是 "2026-02-12 02:00:00"
                    const slotPlayTime = new Date(slotDateTimeStr);
                    // 減去 24 小時
                    const revealTime = new Date(slotPlayTime.getTime() - 24 * 60 * 60 * 1000);
                    
                    // 判斷是否已到截標時間
                    const isRevealed = now >= revealTime;

                    if (isRevealed) {
                        // 只有到了時間的 slot 才加入競爭隊列
                        if (!slotsMap[key]) slotsMap[key] = [];
                        
                        slotsMap[key].push({
                            orderId: orderId,
                            slotIndex: index,
                            bidPrice: parseInt(slot.bidPrice) || 0,
                            slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                        });
                        
                        // 標記這張單至少有一個 slot 要被處理
                        orderResults[orderId].shouldSettleAny = true;
                    } else {
                        // 未到時間，跳過處理
                        // console.log(`⏳ Slot not yet revealed: ${key}`);
                    }
                    
                    orderResults[orderId].screenNames.add(slot.screenName || slot.screenId);
                });
            }
        });

        // C. 比武大會 (只處理 slotsMap 裡有的，也就是時間已到的)
        for (const [key, bids] of Object.entries(slotsMap)) {
            // 價格高者得
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            const winner = bids[0]; 
            const losers = bids.slice(1); 

            // 1. 贏家
            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice;
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} (HK$ ${winner.bidPrice})`);
                orderResults[winner.orderId].slotStatuses[winner.slotIndex] = 'won';
            }

            // 2. 輸家
            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: HK$ ${loser.bidPrice})`);
                    orderResults[loser.orderId].slotStatuses[loser.slotIndex] = 'lost';
                }
            });
        }

        // D. 執行 Capture & Update DB (只處理有變動的訂單)
        for (const [orderId, res] of Object.entries(orderResults)) {
            // 🔥 如果這張單沒有任何 slot 到期，直接跳過，不要動它
            if (!res.shouldSettleAny) continue;

            const orderRef = db.collection('orders').doc(orderId);
            
            // 構建更新後的 slots array
            // 注意：我們只更新那些狀態有變 (won/lost) 的 slot，其他的保持原樣
            const updatedDetailedSlots = res.originalSlots.map((slot, idx) => {
                if (res.slotStatuses[idx]) {
                    return { ...slot, slotStatus: res.slotStatuses[idx] };
                }
                return slot; // 保持原狀 (例如還沒到期的 slot)
            });

            // 情況 1: 處理完之後發現全部都輸了 (或者是輸光了所有已到期的 slot)
            // 這裡邏輯比較複雜：因為可能有部分 slot 還沒到期。
            // 簡單起見，我們先只處理 "確定輸贏" 的金額。
            
            // 如果這張單的所有 slot 都已經處理完了 (totalSlots === win + lose + 其他已處理狀態)
            // 為了安全起見，我們主要依賴 winCount > 0 來決定是否收錢
            
            if (res.winCount === 0 && res.loseCount > 0) {
                // 如果這次結算只有輸，沒有贏 (且沒有其他未結算的 slot ? 這裡簡化處理)
                // 如果這張單之前的狀態是 pending，現在變成 lost，我們可以更新
                // 但因為可能有未到期的 slot，我們暫時只更新 detailedSlots，不改主狀態為 lost，除非所有 slot 都處理完了
                
                // 檢查是否還有未處理的 slot
                const pendingSlots = updatedDetailedSlots.filter(s => !['won', 'lost', 'outbid'].includes(s.slotStatus));
                const isFullySettled = pendingSlots.length === 0;

                if (isFullySettled) {
                    if (res.paymentIntentId) { 
                        try { await stripe.paymentIntents.cancel(res.paymentIntentId); } catch(e) {} 
                    }
                    await orderRef.update({ 
                        status: 'lost', 
                        detailedSlots: updatedDetailedSlots,
                        lostAt: admin.firestore.FieldValue.serverTimestamp() 
                    });
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { to_email: res.userEmail, to_name: res.userName, order_id: orderId });
                } else {
                    // 還有 slot 未揭曉，只更新 slot 狀態，主狀態變成 partially_outbid (暫時)
                    await orderRef.update({ 
                        status: 'partially_outbid',
                        detailedSlots: updatedDetailedSlots 
                    });
                }
            }
            
            // 情況 2: 有贏 (Capture 贏的部分)
            else if (res.winCount > 0) {
                if (res.paymentIntentId) {
                    try {
                        const amountToCaptureCents = Math.round(res.wonAmount * 100);
                        // 注意：Stripe Capture 只能做一次。如果這是 partial capture，後續再 capture 會失敗。
                        // 這裡是一個潛在限制。如果一張單分開兩天結算，第一次 capture 後，第二次就無法再 capture 了。
                        // 解決方案：通常建議 bid 單同一天結算，或者這裡假設只在最後一次全部 capture。
                        // **但在這個 V4 版本，為了防止提前結算，我們假設到了時間才 capture。**
                        // 如果你允許一張單跨越多天，這裡可能會出錯 (因為多次 capture)。
                        // 暫時假設：一張單的所有 slot 都是同一天，所以會一起到期，一起 capture。
                        
                        await stripe.paymentIntents.capture(res.paymentIntentId, {
                            amount_to_capture: amountToCaptureCents
                        });
                        console.log(`💰 Captured ${res.wonAmount} for ${orderId}`);
                    } catch (e) { 
                        if (!e.message.includes("already been captured")) console.error(`Capture Error: ${e.message}`);
                    }
                }

                const isFullySettled = updatedDetailedSlots.every(s => ['won', 'lost', 'outbid'].includes(s.slotStatus));
                const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';

                // 只有當全部 slot 都結算完，或者我們決定現在就結算，才更新狀態
                // 這裡我們直接更新，因為 capture 已經發生了
                await orderRef.update({ 
                    status: finalStatus, 
                    amount: res.wonAmount, 
                    detailedSlots: updatedDetailedSlots, 
                    wonAt: admin.firestore.FieldValue.serverTimestamp(),
                    finalWinCount: res.winCount,
                    finalLostCount: res.loseCount
                });

                if (res.status !== 'won' && res.status !== 'partially_won') {
                    let slotSummaryHtml = `
                        <b>✅ 成功競投 (Won):</b><br>${res.wonSlotsList.join('<br>')}<br><br>
                        ${res.loseCount > 0 ? `<b>❌ 未能中標 (Lost):</b><br>${res.lostSlotsList.join('<br>')}` : ''}
                    `;
                    let screenNamesStr = Array.from(res.screenNames).join(', ');
                    const emailTemplate = finalStatus === 'partially_won' ? EMAIL_CFG.templates.PARTIAL_WIN : EMAIL_CFG.templates.WON_BID;
                    await sendEmail(emailTemplate, {
                        to_email: res.userEmail, to_name: res.userName, amount: res.wonAmount,
                        order_id: orderId, screen_names: screenNamesStr, slot_summary: slotSummaryHtml,
                        order_link: "https://dooh-adv-pro.netlify.app" 
                    });
                }
            }
        }

        return { statusCode: 200, body: "Settlement V4 Done" };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);