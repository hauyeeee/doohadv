const { schedule } = require('@netlify/functions');
const https = require('https'); // 🔥 改用原生 https，保證在任何 Node 版本都能跑
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 1. 初始化 Firebase Admin
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

// 2. EmailJS Config (Server-Side)
// 🔥 FIXED: 根據你的截圖，後端應該讀取這些變數
const EMAIL_CFG = {
    service_id: process.env.EMAILJS_SERVICE_ID, // 你的截圖有這個
    user_id: process.env.EMAIL_USER_ID,         // 你的截圖有這個 (即 Public Key)
    private_key: process.env.EMAILJS_PRIVATE_KEY, // 你的截圖有這個 (即 Access Token)
    
    // Admin Email
    admin_email: "hauyeeee@gmail.com",

    templates: {
        WON_BID: "template_3n90m3u", 
        LOST_BID: "template_1v8p3y8" 
    }
};

// 3. Helper: 發送 Email (使用原生 https，不依賴 fetch)
const sendEmail = (templateId, params, label = "User") => {
    return new Promise((resolve, reject) => {
        console.log(`📧 [Email/${label}] Preparing to send to ${params.to_email}...`);

        // 檢查 Key
        if (!EMAIL_CFG.service_id || !EMAIL_CFG.user_id || !EMAIL_CFG.private_key) {
            const msg = `❌ [Email/${label}] Missing Config! Service: ${!!EMAIL_CFG.service_id}, User: ${!!EMAIL_CFG.user_id}, PrivKey: ${!!EMAIL_CFG.private_key}`;
            console.error(msg);
            // 即使設定缺失，我們也不要讓整個程式崩潰 (resolve)
            return resolve(msg); 
        }

        const data = JSON.stringify({
            service_id: EMAIL_CFG.service_id,
            template_id: templateId,
            user_id: EMAIL_CFG.user_id,
            accessToken: EMAIL_CFG.private_key,
            template_params: params
        });

        const options = {
            hostname: 'api.emailjs.com',
            port: 443,
            path: '/api/v1.0/email/send',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    console.log(`✅ [Email/${label}] Sent OK!`);
                    resolve("OK");
                } else {
                    console.error(`❌ [Email/${label}] Failed (Status ${res.statusCode}): ${responseBody}`);
                    resolve("Failed"); // Resolve to avoid blocking logic
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ [Email/${label}] Network Error:`, error);
            resolve("Error");
        });

        req.write(data);
        req.end();
    });
};

// 4. Helper: 更新市場統計
const updateMarketStats = async (slotDate, slotHour, amount) => {
    try {
        const dateObj = new Date(slotDate);
        const dayOfWeek = dateObj.getDay(); 
        const statsId = `${dayOfWeek}_${slotHour}`;
        const statsRef = db.collection('market_stats').doc(statsId);

        await db.runTransaction(async (t) => {
            const doc = await t.get(statsRef);
            let newTotalBids = 1, newTotalAmount = amount;
            if (doc.exists) {
                const d = doc.data();
                newTotalBids = (d.totalBids || 0) + 1;
                newTotalAmount = (d.totalAmount || 0) + amount;
            }
            const newAverage = Math.round(newTotalAmount / newTotalBids);
            t.set(statsRef, { dayOfWeek, hour: slotHour, totalBids: newTotalBids, totalAmount: newTotalAmount, averagePrice: newAverage, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });
        console.log(`📊 Stats Updated: Week${dayOfWeek} ${slotHour}:00 -> Avg $${Math.round(amount)}`);
    } catch (e) { console.error("Stats Update Failed:", e); }
};

// 5. Main Handler
const settlementHandler = async (event, context) => {
    console.log("⏰ Hourly Settlement Started...");
    const now = new Date();

    try {
        const ordersRef = db.collection('orders');
        const snapshot = await ordersRef.where('status', '==', 'paid_pending_selection').get();

        if (snapshot.empty) {
            console.log("No pending orders found.");
            return { statusCode: 200, body: "No pending orders." };
        }

        const slotsMap = {}; 

        // Grouping
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;
            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    const hourStr = String(slot.hour).padStart(2, '0');
                    const playbackTime = new Date(`${slot.date}T${hourStr}:00:00+08:00`);
                    const deadline = new Date(playbackTime.getTime() - (24 * 60 * 60 * 1000));

                    if (now >= deadline) {
                        const key = `${slot.date}-${slot.hour}-${slot.screenId}`;
                        if (!slotsMap[key]) slotsMap[key] = [];
                        slotsMap[key].push({ orderId, amount: slot.bidPrice || 0, ...data });
                    }
                });
            }
        });

        // Settlement
        for (const [slotKey, bids] of Object.entries(slotsMap)) {
            bids.sort((a, b) => b.amount - a.amount);
            
            const winner = bids[0];
            const losers = bids.slice(1);

            console.log(`🏆 Winner for ${slotKey}: ${winner.userName} ($${winner.amount})`);

            // --- A. 贏家處理 ---
            try {
                const winnerDocRef = db.collection('orders').doc(winner.orderId);
                const winnerDoc = await winnerDocRef.get();

                if (winnerDoc.exists && winnerDoc.data().status === 'paid_pending_selection') {
                    if (winner.paymentIntentId) await stripe.paymentIntents.capture(winner.paymentIntentId);
                    await winnerDocRef.update({ status: 'won', wonAt: admin.firestore.FieldValue.serverTimestamp() });
                    
                    const [y, m, d, h] = slotKey.split('-');
                    await updateMarketStats(`${y}-${m}-${d}`, parseInt(h), winner.amount);

                    // 🔥 Send Email to Winner
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_name: winner.userName, 
                        to_email: winner.userEmail,
                        amount: winner.amount, 
                        order_id: winner.orderId, 
                        slot_info: slotKey,
                        price_label: '成交價',
                        order_link: `https://doohadv.com/my-orders`
                    }, "Winner");

                    // 🔥 Send Email to Admin (新增)
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_name: "Admin", 
                        to_email: EMAIL_CFG.admin_email,
                        amount: winner.amount, 
                        order_id: winner.orderId, 
                        slot_info: `${slotKey} (Winner: ${winner.userEmail})`,
                        price_label: '成交價',
                        order_link: `https://doohadv.com/admin`
                    }, "Admin");
                }
            } catch (err) { console.error(`❌ Winner Logic Error (${winner.orderId}):`, err); }

            // --- B. 輸家處理 ---
            for (const loser of losers) {
                try {
                    const loserDocRef = db.collection('orders').doc(loser.orderId);
                    const loserDoc = await loserDocRef.get();

                    if (loserDoc.exists && loserDoc.data().status === 'paid_pending_selection') {
                        if (loser.paymentIntentId) await stripe.paymentIntents.cancel(loser.paymentIntentId);
                        await loserDocRef.update({ status: 'lost', lostAt: admin.firestore.FieldValue.serverTimestamp() });

                        // 🔥 Send Email to Loser
                        await sendEmail(EMAIL_CFG.templates.LOST_BID, {
                            to_name: loser.userName, 
                            to_email: loser.userEmail,
                            amount: loser.amount, 
                            order_id: loser.orderId, 
                            slot_info: slotKey,
                            price_label: '出價金額'
                        }, "Loser");
                    }
                } catch (err) { console.error(`❌ Loser Logic Error (${loser.orderId}):`, err); }
            }
        }

        return { statusCode: 200, body: "Settlement Complete" };

    } catch (error) {
        console.error("❌ Fatal Settlement Error:", error);
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);