const { schedule } = require('@netlify/functions');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 初始化 Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

// EmailJS Config (從環境變數讀取更安全，這裡為了方便直接寫)
const EMAIL_CFG = {
    service_id: process.env.EMAILJS_SERVICE_ID || 'service_xxxx', 
    user_id: process.env.EMAILJS_PUBLIC_KEY || 'user_xxxx',       
    private_key: process.env.EMAILJS_PRIVATE_KEY,                 
    templates: {
        WON_BID: "template_3n90m3u",
        LOST_BID: "template_1v8p3y8"
    }
};

// Helper: 發送 Email (Node.js fetch版)
const sendEmail = async (templateId, params) => {
    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAIL_CFG.service_id,
                template_id: templateId,
                user_id: EMAIL_CFG.user_id,
                accessToken: EMAIL_CFG.private_key,
                template_params: params
            })
        });
        if (!response.ok) console.error(`Email Error: ${await response.text()}`);
    } catch (e) { console.error("Network Error:", e); }
};

// 🔥 Helper: 更新市場統計數據 (核心邏輯)
const updateMarketStats = async (slotDate, slotHour, amount) => {
    try {
        const dateObj = new Date(slotDate);
        const dayOfWeek = dateObj.getDay(); // 0-6
        const statsId = `${dayOfWeek}_${slotHour}`; // e.g. "1_18"
        const statsRef = db.collection('market_stats').doc(statsId);

        await db.runTransaction(async (t) => {
            const doc = await t.get(statsRef);
            let newTotalBids = 1;
            let newTotalAmount = amount;

            if (doc.exists) {
                const data = doc.data();
                newTotalBids = (data.totalBids || 0) + 1;
                newTotalAmount = (data.totalAmount || 0) + amount;
            }
            
            // 計算新平均價
            const newAverage = Math.round(newTotalAmount / newTotalBids);

            t.set(statsRef, {
                dayOfWeek, hour: slotHour,
                totalBids: newTotalBids,
                totalAmount: newTotalAmount,
                averagePrice: newAverage,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        console.log(`📊 Stats Updated: Week${dayOfWeek} ${slotHour}:00 -> Avg $${Math.round(amount)}`);
    } catch (e) { console.error("Stats Update Failed:", e); }
};

const settlementHandler = async (event, context) => {
    console.log("⏰ Hourly Settlement Started...");
    const now = new Date();

    try {
        const ordersRef = db.collection('orders');
        const snapshot = await ordersRef.where('status', '==', 'paid_pending_selection').get();

        if (snapshot.empty) return { statusCode: 200, body: "No pending orders." };

        const slotsMap = {}; 

        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;
            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    const hourStr = String(slot.hour).padStart(2, '0');
                    // 構建播放時間 (假設香港時間 UTC+8)
                    const playbackTime = new Date(`${slot.date}T${hourStr}:00:00+08:00`);
                    // 截止時間 = 播放前 24 小時
                    const deadline = new Date(playbackTime.getTime() - (24 * 60 * 60 * 1000));

                    // 如果現在已經過了截止時間
                    if (now >= deadline) {
                        const key = `${slot.date}-${slot.hour}-${slot.screenId}`;
                        if (!slotsMap[key]) slotsMap[key] = [];
                        slotsMap[key].push({ orderId, ...data });
                    }
                });
            }
        });

        // 逐個時段結算
        for (const [slotKey, bids] of Object.entries(slotsMap)) {
            bids.sort((a, b) => b.amount - a.amount);
            const winner = bids[0];
            const losers = bids.slice(1);

            console.log(`🏆 Winner for ${slotKey}: ${winner.userName} ($${winner.amount})`);

            // A. 贏家處理
            try {
                const winnerDoc = await db.collection('orders').doc(winner.orderId).get();
                if (winnerDoc.data().status === 'paid_pending_selection') {
                    if (winner.paymentIntentId) await stripe.paymentIntents.capture(winner.paymentIntentId);
                    
                    await db.collection('orders').doc(winner.orderId).update({ 
                        status: 'won', wonAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 🔥 更新統計數據
                    const [y, m, d, h] = slotKey.split('-');
                    await updateMarketStats(`${y}-${m}-${d}`, parseInt(h), winner.amount);

                    // 發送 Email
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_name: winner.userName, to_email: winner.userEmail,
                        amount: winner.amount, order_id: winner.orderId, slot_info: slotKey
                    });
                }
            } catch (err) { console.error(`Winner Error (${winner.orderId}):`, err); }

            // B. 輸家處理
            for (const loser of losers) {
                try {
                    const loserDoc = await db.collection('orders').doc(loser.orderId).get();
                    if (loserDoc.data().status === 'paid_pending_selection') {
                        if (loser.paymentIntentId) await stripe.paymentIntents.cancel(loser.paymentIntentId);
                        
                        await db.collection('orders').doc(loser.orderId).update({ 
                            status: 'lost', lostAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        await sendEmail(EMAIL_CFG.templates.LOST_BID, {
                            to_name: loser.userName, to_email: loser.userEmail,
                            amount: loser.amount, order_id: loser.orderId, slot_info: slotKey
                        });
                    }
                } catch (err) { console.error(`Loser Error (${loser.orderId}):`, err); }
            }
        }
        return { statusCode: 200 };
    } catch (error) {
        console.error("Settlement Error:", error);
        return { statusCode: 500 };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);