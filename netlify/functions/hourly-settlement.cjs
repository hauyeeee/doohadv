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
        WON_BID: "template_3n90m3u", 
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
    console.log("⏰ Settlement Run (Fixed Slot Summary)...");
    
    try {
// 🔥 Fix: 加入 'won', 'paid', 'partially_won' 確保能看見「贏家」，從而正確判定其他人「輸了」
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
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    wonSlotsList: [], 
                    lostSlotsList: [], 
                    status: data.status,
                    screenNames: new Set()
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    orderResults[orderId].totalSlots++; 
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    
                    if (true) { 
                        const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                        if (!slotsMap[key]) slotsMap[key] = [];
                        
                        slotsMap[key].push({
                            orderId: orderId,
                            bidPrice: parseInt(slot.bidPrice) || 0,
                            slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                        });
                        orderResults[orderId].screenNames.add(slot.screenName || slot.screenId);
                    }
                });
            }
        });

        // C. 比武大會
        for (const [key, bids] of Object.entries(slotsMap)) {
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            const winner = bids[0]; 
            const losers = bids.slice(1); 

            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice; 
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} (HK$ ${winner.bidPrice})`);
            }

            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: HK$ ${loser.bidPrice})`);
                }
            });
        }

        // D. 最終結算
        for (const [orderId, res] of Object.entries(orderResults)) {
            const orderRef = db.collection('orders').doc(orderId);
            
            // 情況 1: 全輸
            if (res.winCount === 0) {
                if (res.status !== 'lost') {
                    if (res.paymentIntentId) {
                        try { await stripe.paymentIntents.cancel(res.paymentIntentId); } catch(e) {}
                    }
                    await orderRef.update({ 
                        status: 'lost', 
                        lostAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    // LOST Email: 暫時不傳送詳細 list，因 template 不支援
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { 
                        to_email: res.userEmail, 
                        to_name: res.userName,
                        order_id: orderId
                    });
                }
            }
            
            // 情況 2: 贏
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

                    // 🔥🔥 格式化時段摘要 (HTML Break) 🔥🔥
                    let slotSummaryHtml = res.wonSlotsList.join('<br>');
                    let screenNamesStr = Array.from(res.screenNames).join(', ');

                    // 🔥🔥 使用正確的變數名 {{slot_summary}} 🔥🔥
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
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

        return { statusCode: 200, body: "Settlement Done" };

    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);