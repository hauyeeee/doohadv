const { schedule } = require('@netlify/functions');
const https = require('https');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 1. 初始化 Firebase (保持不變)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  } catch (e) {
    console.error("❌ Firebase Init Error:", e);
  }
}
const db = admin.firestore();

// 2. Email Config
const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID,
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY,
    private_key: process.env.EMAILJS_PRIVATE_KEY,
    admin_email: "hauyeeee@gmail.com",
    templates: {
        WON_BID: "template_3n90m3u",
        LOST_BID: "template_1v8p3y8",
        PARTIAL_BID: "template_3n90m3u" // 可選：專門的 Partial Email Template
    }
};

// 3. Send Email Helper
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

// 4. Main Logic
const settlementHandler = async (event, context) => {
    console.log("⏰ Settlement Run (Partial Win Logic)...");
    const now = new Date();

    try {
        // A. 抓取所有潛在訂單
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'outbid_needs_action', 'partially_outbid']).get();
        if (snapshot.empty) return { statusCode: 200, body: "No orders" };

        const slotsMap = {};      // 用來比武的戰場: { "date-hour-screen": [bids...] }
        const orderResults = {};  // 用來記帳: { "orderId": { totalWon: 0, originalAmount: 0, winCount: 0, totalCount: 0, ... } }

        // B. 準備數據 (Grouping)
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;

            // 初始化記帳本
            if (!orderResults[orderId]) {
                orderResults[orderId] = {
                    id: orderId,
                    userEmail: data.userEmail,
                    userName: data.userName,
                    paymentIntentId: data.paymentIntentId,
                    originalAmount: data.amount || 0, // 這是整張單的預授權金額 (e.g. 3000)
                    wonAmount: 0,                     // 這是最後贏的金額 (e.g. 1000)
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    wonSlotsList: [],
                    status: data.status
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    orderResults[orderId].totalSlots++; // 統計這張單共有幾個 Slot

                    // 判斷是否到期 (播放前 1 小時)
                    const slotTime = new Date(`${slot.date}T${String(slot.hour).padStart(2,'0')}:00:00`);
                    const cutOffTime = new Date(slotTime.getTime() - (60 * 60 * 1000)); 

                    // if (now >= cutOffTime) { // 正式上線用這行
                    if (true) { // 測試用
                        // 🔥 關鍵修正：確保 Key 統一為 String
                        const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                        
                        if (!slotsMap[key]) slotsMap[key] = [];
                        
                        slotsMap[key].push({
                            orderId: orderId,
                            bidPrice: parseInt(slot.bidPrice) || 0,
                            slotInfo: `${slot.date} ${slot.hour}:00 @ ${slot.screenId}`
                        });
                    }
                });
            }
        });

        // C. 比武大會 (Resolving Winners)
        for (const [key, bids] of Object.entries(slotsMap)) {
            // 排序：價高者得
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            
            const winner = bids[0]; // 第一名
            const losers = bids.slice(1); // 其他人

            // 1. 贏家記帳
            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice; // 累加贏得的金額
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(winner.slotInfo);
            }

            // 2. 輸家記帳
            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    orderResults[loser.orderId].loseCount++;
                }
            });
        }

        // D. 最終結算 (Stripe Capture & DB Update)
        for (const [orderId, res] of Object.entries(orderResults)) {
            const orderRef = db.collection('orders').doc(orderId);
            
            // 情況 1: 全輸 (Lost)
            if (res.winCount === 0) {
                if (res.status !== 'lost') {
                    console.log(`❌ Order ${orderId} Lost All. Releasing ${res.originalAmount}...`);
                    if (res.paymentIntentId) {
                        try { await stripe.paymentIntents.cancel(res.paymentIntentId); } catch(e) { console.log("Cancel Error", e.message); }
                    }
                    await orderRef.update({ status: 'lost', lostAt: admin.firestore.FieldValue.serverTimestamp() });
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { to_email: res.userEmail, order_id: orderId });
                }
            }
            
            // 情況 2: 贏 (包含 Partial Win 和 Full Win)
            else if (res.winCount > 0) {
                // 檢查是否已經 Capture 過 (防止重複扣款)
                if (res.status !== 'won' && res.status !== 'paid' && res.status !== 'partially_won') {
                    
                    console.log(`🎉 Order ${orderId} Won ${res.winCount}/${res.totalSlots} slots. Capture: $${res.wonAmount} (Auth: $${res.originalAmount})`);
                    
                    if (res.paymentIntentId) {
                        try {
                            // 🔥 關鍵核心：Capture Amount (部分扣款)
                            // Stripe 允許 capture 的金額 < authorized 金額。
                            // 剩餘的金額 ($3000 - $1000 = $2000) 會自動退還 (Release)。
                            await stripe.paymentIntents.capture(res.paymentIntentId, {
                                amount_to_capture: res.wonAmount * 100 // 轉成 cents
                            });
                        } catch (e) {
                            console.error(`⚠️ Capture Failed for ${orderId}:`, e.message);
                            // 如果 Capture 失敗 (例如過期)，可能需要人工介入，這裡暫不更新狀態
                            continue; 
                        }
                    }

                    // 判斷最終狀態
                    const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';

                    await orderRef.update({ 
                        status: finalStatus, 
                        amount: res.wonAmount, // 更新為實際成交金額
                        wonAt: admin.firestore.FieldValue.serverTimestamp(),
                        finalWinCount: res.winCount,
                        finalLostCount: res.loseCount
                    });

                    // 發送中標 Email
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_email: res.userEmail,
                        to_name: res.userName,
                        amount: res.wonAmount,
                        order_id: orderId,
                        slot_info: res.wonSlotsList.join('\n') // 列出贏得的時段
                    });
                }
            }
        }

        return { statusCode: 200, body: "Settlement Done" };

    } catch (e) {
        console.error("Settlement Error:", e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);