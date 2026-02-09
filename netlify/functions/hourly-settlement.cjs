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
        WON_BID: "template_3n90m3u", // 通用結算通知 (包含贏/輸詳情)
        LOST_BID: "template_1v8p3y8",
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
    console.log("⏰ Settlement Run (Detailed Email Version)...");
    
    try {
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'outbid_needs_action', 'partially_outbid']).get();
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
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    wonSlotsList: [], // 儲存贏的詳情
                    lostSlotsList: [], // 儲存輸的詳情
                    status: data.status
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    orderResults[orderId].totalSlots++; 
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    
                    // 這裡暫時全部結算 (正式版應檢查 cutOffTime)
                    if (true) { 
                        const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                        if (!slotsMap[key]) slotsMap[key] = [];
                        
                        slotsMap[key].push({
                            orderId: orderId,
                            bidPrice: parseInt(slot.bidPrice) || 0,
                            slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                        });
                    }
                });
            }
        });

        // C. 比武大會
        for (const [key, bids] of Object.entries(slotsMap)) {
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            
            const winner = bids[0]; 
            const losers = bids.slice(1); 

            // 贏家
            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice; 
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} ($${winner.bidPrice})`);
            }

            // 輸家
            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: $${loser.bidPrice})`);
                }
            });
        }

        // D. 最終結算 & 發送詳細 Email
        for (const [orderId, res] of Object.entries(orderResults)) {
            const orderRef = db.collection('orders').doc(orderId);
            
            // 情況 1: 全輸
            if (res.winCount === 0) {
                if (res.status !== 'lost') {
                    if (res.paymentIntentId) {
                        try { await stripe.paymentIntents.cancel(res.paymentIntentId); } catch(e) {}
                    }
                    
                    // 更新 DB
                    await orderRef.update({ 
                        status: 'lost', 
                        lostAt: admin.firestore.FieldValue.serverTimestamp(),
                        // 將詳細輸贏寫入 DB 方便前端顯示 (Optional)
                    });

                    // 🔥 詳細的 Lost Email
                    const lostDetails = res.lostSlotsList.join('\n');
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { 
                        to_email: res.userEmail, 
                        to_name: res.userName,
                        order_id: orderId,
                        lost_details: lostDetails // 確保你的 Email Template 有這個變數 {{lost_details}}
                    });
                }
            }
            
            // 情況 2: 贏 (部分或全部)
            else if (res.winCount > 0) {
                if (res.status !== 'won' && res.status !== 'paid' && res.status !== 'partially_won') {
                    
                    if (res.paymentIntentId) {
                        try {
                            await stripe.paymentIntents.capture(res.paymentIntentId, {
                                amount_to_capture: res.wonAmount * 100 
                            });
                        } catch (e) { continue; }
                    }

                    const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';

                    await orderRef.update({ 
                        status: finalStatus, 
                        amount: res.wonAmount, 
                        wonAt: admin.firestore.FieldValue.serverTimestamp(),
                        finalWinCount: res.winCount,
                        finalLostCount: res.loseCount
                    });

                    // 🔥 生成詳細的 Win/Lost 報告字串
                    let emailBody = "🎉 恭喜！你已成功投得以下時段：\n";
                    emailBody += res.wonSlotsList.join('\n');
                    
                    if (res.loseCount > 0) {
                        emailBody += "\n\n⚠️ 以下時段因出價被超越而未能中標 (不會收費)：\n";
                        emailBody += res.lostSlotsList.join('\n');
                    }

                    // 發送中標 Email (使用 WON_BID 模板，將詳情塞入 slot_info 變數)
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_email: res.userEmail,
                        to_name: res.userName,
                        amount: res.wonAmount,
                        order_id: orderId,
                        slot_info: emailBody // 🔥 這裡包含了贏和輸的所有細節
                    });
                }
            }
        }

        return { statusCode: 200, body: "Settlement Done" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);