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
    console.log("⏰ Settlement Run (Deep Slot Status Fix)...");
    try {
        // 🔥 1. 擴大抓取範圍，包含 'won' 和 'partially_won' 以便重新計算那些被誤判的訂單
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'outbid_needs_action', 'partially_outbid', 'partially_won', 'won', 'paid']).get();
        if (snapshot.empty) return { statusCode: 200, body: "No orders" };

        const slotsMap = {};      
        const orderResults = {};

        // B. 準備數據
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
                    originalSlots: data.detailedSlots || [], // 🔥 保存原始 Slots 以便更新
                    
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    
                    wonSlotsList: [], 
                    lostSlotsList: [], 
                    slotStatuses: {}, // 🔥 用來記錄每個 Slot Index 的最終狀態 (won/lost)
                    
                    status: data.status,
                    screenNames: new Set()
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach((slot, index) => {
                    orderResults[orderId].totalSlots++; 
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    // Key: Date-Hour-ScreenId (確保唯一性)
                    const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                    
                    if (!slotsMap[key]) slotsMap[key] = [];
                    
                    slotsMap[key].push({
                        orderId: orderId,
                        slotIndex: index, // 🔥 記住這個 Slot 在原本 Array 的位置
                        bidPrice: parseInt(slot.bidPrice) || 0,
                        slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                    });
                    
                    orderResults[orderId].screenNames.add(slot.screenName || slot.screenId);
                });
            }
        });

        // C. 比武大會 (決定每個 Slot 的命運)
        for (const [key, bids] of Object.entries(slotsMap)) {
            // 高價者得
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            
            const winner = bids[0]; 
            const losers = bids.slice(1); 

            // 1. 贏家處理
            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice;
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} (HK$ ${winner.bidPrice})`);
                // 🔥 標記這個 Slot Index 為 'won'
                orderResults[winner.orderId].slotStatuses[winner.slotIndex] = 'won';
            }

            // 2. 輸家處理
            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: HK$ ${loser.bidPrice})`);
                    // 🔥 標記這個 Slot Index 為 'lost' (前端會顯示為 LOST)
                    orderResults[loser.orderId].slotStatuses[loser.slotIndex] = 'lost'; 
                }
            });
        }

        // D. 執行結算、更新 DB (包含 Slot 狀態)
        for (const [orderId, res] of Object.entries(orderResults)) {
            const orderRef = db.collection('orders').doc(orderId);
            
            // 🔥🔥🔥 核心修復：更新 detailedSlots 的狀態 🔥🔥🔥
            // 複製原始 Slots，並根據剛才的計算結果更新 status
            const updatedDetailedSlots = res.originalSlots.map((slot, idx) => {
                if (res.slotStatuses[idx]) {
                    return { ...slot, slotStatus: res.slotStatuses[idx] };
                }
                return slot;
            });

            // 情況 1: 全輸
            if (res.winCount === 0) {
                if (res.status !== 'lost') {
                    if (res.paymentIntentId) { try { await stripe.paymentIntents.cancel(res.paymentIntentId); } catch(e) {} }
                    
                    await orderRef.update({ 
                        status: 'lost', 
                        detailedSlots: updatedDetailedSlots, // 更新 Slot 狀態
                        lostAt: admin.firestore.FieldValue.serverTimestamp() 
                    });
                    
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { to_email: res.userEmail, to_name: res.userName, order_id: orderId });
                }
            }
            
            // 情況 2: 有贏 (全贏或部分贏)
            else if (res.winCount > 0) {
                // 即使狀態已經是 won/partially_won，我們也要檢查金額和 Slot 狀態是否需要更新 (因為可能有競爭者新加入導致變動)
                // 為了避免無限重複 Capture，我們只在狀態改變或尚未 Capture 時執行 Capture
                
                // 判斷最終大狀態
                const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';
                
                // 只有當「未結算」或者「結算狀態有變 (e.g. won -> partially_won)」時才處理 Capture
                // 但為了修復你現在的數據，我們允許再次更新 slotStatus
                
                let shouldCapture = false;
                if (res.status !== 'won' && res.status !== 'paid' && res.status !== 'partially_won') {
                    shouldCapture = true; // 從未結算變成已結算
                } else {
                    // 如果已經是 won/partially_won，這裡通常不需再 Capture (假設 Stripe 不能多次 Capture 同一個 PI)
                    // 但我們需要確保 DB 裡的 amount 是正確的 wonAmount
                }

                if (shouldCapture && res.paymentIntentId) {
                    try {
                        const amountToCaptureCents = Math.round(res.wonAmount * 100);
                        if (amountToCaptureCents > 0) {
                            await stripe.paymentIntents.capture(res.paymentIntentId, {
                                amount_to_capture: amountToCaptureCents
                            });
                            console.log(`💰 Captured $${res.wonAmount} for ${orderId}`);
                        }
                    } catch (e) { 
                        console.error(`Capture warning for ${orderId} (might be already captured):`, e.message);
                        // 這裡不 continue，因為即使 capture 報錯 (e.g. already captured)，我們仍需更新 DB 的 slot 狀態
                    }
                }

                // 更新 DB (包含正確的 Amount 和 Slot Status)
                await orderRef.update({ 
                    status: finalStatus, 
                    amount: res.wonAmount, // 確保金額是贏得的總額
                    detailedSlots: updatedDetailedSlots, // 🔥 關鍵：寫入 Slot 狀態
                    wonAt: admin.firestore.FieldValue.serverTimestamp(),
                    finalWinCount: res.winCount,
                    finalLostCount: res.loseCount
                });

                // 發送 Email (只在狀態發生實質變化時發送，避免重複轟炸? 
                // 為簡單起見，如果是新結算 (shouldCapture = true) 才發)
                if (shouldCapture) {
                    let slotSummaryHtml = `
                        <b>✅ 成功競投 (Won):</b><br>${res.wonSlotsList.join('<br>')}<br><br>
                        ${res.loseCount > 0 ? `<b>❌ 未能中標 (Lost - 已退款):</b><br>${res.lostSlotsList.join('<br>')}` : ''}
                    `;
                    let screenNamesStr = Array.from(res.screenNames).join(', ');
                    const emailTemplate = finalStatus === 'partially_won' ? EMAIL_CFG.templates.PARTIAL_WIN : EMAIL_CFG.templates.WON_BID;

                    await sendEmail(emailTemplate, {
                        to_email: res.userEmail,
                        to_name: res.userName,
                        amount: res.wonAmount,
                        order_id: orderId,
                        screen_names: screenNamesStr,
                        slot_summary: slotSummaryHtml,
                        order_link: "https://dooh-adv-pro.netlify.app" 
                    });
                }
            }
        }

        return { statusCode: 200, body: "Settlement V3 Done" };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);