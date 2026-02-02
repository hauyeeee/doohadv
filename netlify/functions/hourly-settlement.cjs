const { schedule } = require('@netlify/functions');
const https = require('https');
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
const EMAIL_CFG = {
    // 優先讀取 Netlify 專用變數
    service_id: process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID,
    
    // Public Key (User ID)
    user_id: process.env.EMAIL_USER_ID || process.env.VITE_EMAILJS_PUBLIC_KEY, 
    
    // Private Key (Access Token) - 這是後端發信的關鍵
    private_key: process.env.EMAILJS_PRIVATE_KEY, 
    
    admin_email: "hauyeeee@gmail.com",

    templates: {
        WON_BID: "template_3n90m3u", 
        LOST_BID: "template_1v8p3y8" 
    }
};

// 3. Helper: 強制 Promise 發送 Email (Debug Mode)
const sendEmail = (templateId, params, label = "User") => {
    return new Promise((resolve, reject) => {
        console.log(`📧 [${label}] Preparing email to: ${params.to_email}`);

        // 1. 檢查變數是否存在 (Debug Log)
        if (!EMAIL_CFG.service_id || !EMAIL_CFG.user_id || !EMAIL_CFG.private_key) {
            console.error(`❌ [${label}] Config Error! Missing Keys.`);
            console.log(`   Service: ${EMAIL_CFG.service_id ? 'OK' : 'MISSING'}`);
            console.log(`   User(Public): ${EMAIL_CFG.user_id ? 'OK' : 'MISSING'}`);
            console.log(`   PrivKey: ${EMAIL_CFG.private_key ? 'OK' : 'MISSING'}`);
            return resolve("Config Missing"); // 不拋出錯誤，避免中斷流程
        }

        // 2. 構建 Payload
        const postData = JSON.stringify({
            service_id: EMAIL_CFG.service_id,
            template_id: templateId,
            user_id: EMAIL_CFG.user_id,      // Public Key
            accessToken: EMAIL_CFG.private_key, // Private Key (必須)
            template_params: params
        });

        // 3. 設定 Request
        const options = {
            hostname: 'api.emailjs.com',
            port: 443,
            path: '/api/v1.0/email/send',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData) // 確保長度準確
            }
        };

        // 4. 發送 Request
        const req = https.request(options, (res) => {
            let responseBody = '';
            
            res.setEncoding('utf8');
            res.on('data', (chunk) => { responseBody += chunk; });
            
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    console.log(`✅ [${label}] Email Sent! (Status: ${res.statusCode})`);
                    resolve("Success");
                } else {
                    // 🔥 這是重點：印出 EmailJS 回傳的錯誤原因
                    console.error(`❌ [${label}] EmailJS API Error: ${res.statusCode} - ${responseBody}`);
                    resolve("Failed"); // Resolve to keep going
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ [${label}] Network Request Failed:`, e.message);
            resolve("Network Error");
        });

        // 寫入數據並結束請求
        req.write(postData);
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
        console.log(`📊 Stats Updated`);
    } catch (e) { console.error("Stats Update Failed:", e); }
};

// 5. Main Handler
const settlementHandler = async (event, context) => {
    console.log("⏰ Settlement Started...");
    const now = new Date();

    try {
        const ordersRef = db.collection('orders');
        // 抓取所有競價中的訂單
        const snapshot = await ordersRef.where('status', '==', 'paid_pending_selection').get();

        if (snapshot.empty) {
            console.log("No pending orders.");
            return { statusCode: 200, body: "No orders" };
        }

        const slotsMap = {}; 

        // 分組邏輯
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;
            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    const hourStr = String(slot.hour).padStart(2, '0');
                    const playbackTime = new Date(`${slot.date}T${hourStr}:00:00+08:00`);
                    const deadline = new Date(playbackTime.getTime() - (24 * 60 * 60 * 1000));

                    // 🔥 DEBUG: 為了測試，暫時移除時間限制，或者你可以改回去
                    // if (now >= deadline) { 
                    if (true) { // ⚠️ 測試用：強制所有單都結算 (正式上線請改回上方邏輯)
                        const key = `${slot.date}-${slot.hour}-${slot.screenId}`;
                        if (!slotsMap[key]) slotsMap[key] = [];
                        slotsMap[key].push({ orderId, amount: slot.bidPrice || 0, ...data });
                    }
                });
            }
        });

        // 結算邏輯
        for (const [slotKey, bids] of Object.entries(slotsMap)) {
            bids.sort((a, b) => b.amount - a.amount);
            
            const winner = bids[0];
            const losers = bids.slice(1);

            console.log(`🏆 Resolving ${slotKey}: Winner is ${winner.userEmail}`);

            // --- A. Winner ---
            try {
                const winnerRef = db.collection('orders').doc(winner.orderId);
                const winnerDoc = await winnerRef.get();

                if (winnerDoc.exists && winnerDoc.data().status === 'paid_pending_selection') {
                    // 1. Stripe Capture
                    if (winner.paymentIntentId) {
                        try { await stripe.paymentIntents.capture(winner.paymentIntentId); } 
                        catch(e) { console.error("Stripe Capture Error:", e.message); }
                    }
                    
                    // 2. DB Update
                    await winnerRef.update({ status: 'won', wonAt: admin.firestore.FieldValue.serverTimestamp() });
                    
                    // 3. Stats
                    const [y, m, d, h] = slotKey.split('-');
                    await updateMarketStats(`${y}-${m}-${d}`, parseInt(h), winner.amount);

                    // 4. Email (Winner) - 強制等待
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_name: winner.userName, 
                        to_email: winner.userEmail,
                        amount: winner.amount, 
                        order_id: winner.orderId, 
                        slot_info: slotKey,
                        price_label: '成交價',
                        order_link: `https://doohadv.com/my-orders`
                    }, "Winner");

                    // 5. Email (Admin) - 強制等待
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
            } catch (err) { console.error(`Winner Logic Error:`, err); }

            // --- B. Losers ---
            for (const loser of losers) {
                try {
                    const loserRef = db.collection('orders').doc(loser.orderId);
                    const loserDoc = await loserRef.get();

                    if (loserDoc.exists && loserDoc.data().status === 'paid_pending_selection') {
                        if (loser.paymentIntentId) {
                            try { await stripe.paymentIntents.cancel(loser.paymentIntentId); }
                            catch(e) { console.error("Stripe Cancel Error:", e.message); }
                        }
                        
                        await loserRef.update({ status: 'lost', lostAt: admin.firestore.FieldValue.serverTimestamp() });

                        // Email (Loser) - 強制等待
                        await sendEmail(EMAIL_CFG.templates.LOST_BID, {
                            to_name: loser.userName, 
                            to_email: loser.userEmail,
                            amount: loser.amount, 
                            order_id: loser.orderId, 
                            slot_info: slotKey,
                            price_label: '出價金額'
                        }, "Loser");
                    }
                } catch (err) { console.error(`Loser Logic Error:`, err); }
            }
        }

        return { statusCode: 200, body: "Done" };

    } catch (error) {
        console.error("Handler Error:", error);
        return { statusCode: 500, body: error.toString() };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);