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
    console.log("⏰ Settlement Run (Capture Fix V3 - Strict Math)...");
    try {
        // 🔥 1. 抓取範圍：包含所有未最終結算的狀態，甚至包含已標記 won 但未 capture 的
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'outbid_needs_action', 'partially_outbid', 'partially_won', 'won', 'paid']).get();
        if (snapshot.empty) return { statusCode: 200, body: "No orders" };

        const slotsMap = {};      
        const orderResults = {};

        // B. 準備數據 & 初始化
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
                    originalSlots: data.detailedSlots || [], // 保存原始數據以便更新狀態
                    
                    // 🔥 關鍵：歸零重新計算
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    
                    wonSlotsList: [], 
                    lostSlotsList: [], 
                    slotStatuses: {}, // Map: index -> 'won'/'lost'
                    
                    status: data.status,
                    screenNames: new Set()
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach((slot, index) => {
                    orderResults[orderId].totalSlots++; 
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    // Key 必須唯一：日期-小時-屏幕ID
                    const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                    
                    if (!slotsMap[key]) slotsMap[key] = [];
                    
                    slotsMap[key].push({
                        orderId: orderId,
                        slotIndex: index, // 記住它在 array 的位置
                        bidPrice: parseInt(slot.bidPrice) || 0,
                        slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                    });
                    
                    orderResults[orderId].screenNames.add(slot.screenName || slot.screenId);
                });
            }
        });

        // C. 比武大會 (決定生死 & 計算金額)
        for (const [key, bids] of Object.entries(slotsMap)) {
            // 價格高者得
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            
            const winner = bids[0]; 
            const losers = bids.slice(1); 

            // 1. 贏家：加錢，標記 Win
            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice; // 🔥 只有這裡加錢！
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} (HK$ ${winner.bidPrice})`);
                orderResults[winner.orderId].slotStatuses[winner.slotIndex] = 'won';
            }

            // 2. 輸家：不加錢，標記 Lost
            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    // 🔥 輸家金額絕對不加進 wonAmount
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: HK$ ${loser.bidPrice})`);
                    orderResults[loser.orderId].slotStatuses[loser.slotIndex] = 'lost';
                }
            });
        }

        // D. 執行 Capture & Update DB
        for (const [orderId, res] of Object.entries(orderResults)) {
            const orderRef = db.collection('orders').doc(orderId);
            
            // 構建更新後的 slots array
            const updatedDetailedSlots = res.originalSlots.map((slot, idx) => {
                if (res.slotStatuses[idx]) {
                    return { ...slot, slotStatus: res.slotStatuses[idx] };
                }
                return slot;
            });

            // 情況 1: 全輸
            if (res.winCount === 0) {
                if (res.status !== 'lost') {
                    if (res.paymentIntentId) { 
                        try { await stripe.paymentIntents.cancel(res.paymentIntentId); console.log(`🛑 Released hold for ${orderId}`); } 
                        catch(e) {} 
                    }
                    await orderRef.update({ 
                        status: 'lost', 
                        detailedSlots: updatedDetailedSlots,
                        lostAt: admin.firestore.FieldValue.serverTimestamp() 
                    });
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { to_email: res.userEmail, to_name: res.userName, order_id: orderId });
                }
            }
            
            // 情況 2: 有贏 (全贏 或 贏一半)
            else if (res.winCount > 0) {
                // 只有當「未Capture」或者「金額有變動」時才執行 Capture
                // 但 Stripe Capture 只能做一次，如果之前做過 partial capture，再做會失敗
                // 這裡假設我們只在最終結算時做一次 Capture
                
                // 判斷是否需要執行 Capture (如果狀態還不是最終狀態，或者我們想強制修正)
                let shouldCapture = true;
                // 注意：如果之前已經 Capture 過，這裡再 Capture 會報錯，我們會 catch 住它
                
                if (res.paymentIntentId) {
                    try {
                        const amountToCaptureCents = Math.round(res.wonAmount * 100);
                        
                        // 🔥 關鍵：Stripe Capture Partial
                        // Stripe 會自動退還 (Auth Amount - Capture Amount)
                        await stripe.paymentIntents.capture(res.paymentIntentId, {
                            amount_to_capture: amountToCaptureCents
                        });
                        console.log(`💰 Captured CORRECT amount $${res.wonAmount} for ${orderId}`);
                    } catch (e) { 
                        // 如果錯誤是 "PaymentIntent ... has already been captured"，我們忽略它，繼續更新 DB
                        if (!e.message.includes("already been captured")) {
                            console.error(`❌ Capture failed for ${orderId}:`, e.message);
                        } else {
                            console.log(`ℹ️ Order ${orderId} already captured, updating DB only.`);
                        }
                    }
                }

                const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';

                // 更新 DB
                await orderRef.update({ 
                    status: finalStatus, 
                    amount: res.wonAmount, // 🔥 寫入正確的成交額
                    detailedSlots: updatedDetailedSlots, // 🔥 寫入正確的 Win/Lost 狀態
                    wonAt: admin.firestore.FieldValue.serverTimestamp(),
                    finalWinCount: res.winCount,
                    finalLostCount: res.loseCount
                });

                // 發送 Email (只在狀態改變或金額確認時發)
                // 為了避免重複發信，可以檢查之前的 status
                if (res.status !== 'won' && res.status !== 'partially_won') {
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