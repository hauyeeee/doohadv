const { schedule } = require('@netlify/functions');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 1. 初始化 Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

// 2. EmailJS Config (Server-Side)
// 🔥 FIXED: 根據你的 Netlify 變數截圖設定
const EMAIL_CFG = {
    // 優先讀取後端專用變數，如果沒有則讀取 VITE_ 前綴的變數
    service_id: process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID,
    
    // 🔥 這裡是重點：改為讀取 VITE_EMAILJS_PUBLIC_KEY
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY, 
    
    // 後端發信必須要有 Private Key (Access Token)
    private_key: process.env.EMAILJS_PRIVATE_KEY, 
    
    templates: {
        WON_BID: "template_3n90m3u", // 中標 Template ID
        LOST_BID: "template_1v8p3y8"  // 落選 Template ID
    }
};

// 3. Helper: 發送 Email (Node.js fetch版)
const sendEmail = async (templateId, params) => {
    console.log(`📧 [Settlement] Sending email to ${params.to_email} (${templateId})...`);
    
    // Debugging: 檢查變數是否讀取成功
    console.log(`🔑 Config Check: 
      - ServiceID: ${EMAIL_CFG.service_id ? 'OK' : 'MISSING'}
      - UserID (Public): ${EMAIL_CFG.user_id ? 'OK' : 'MISSING'}
      - PrivateKey: ${EMAIL_CFG.private_key ? 'OK' : 'MISSING'}`);

    // 檢查 Key 是否齊全
    if (!EMAIL_CFG.service_id || !EMAIL_CFG.user_id || !EMAIL_CFG.private_key) {
        console.error("❌ EmailJS Config Missing in Backend! Check Netlify Env Vars.");
        return;
    }

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAIL_CFG.service_id,
                template_id: templateId,
                user_id: EMAIL_CFG.user_id,
                accessToken: EMAIL_CFG.private_key, // 後端認證必須用這個
                template_params: params
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ Email Error: ${errText}`);
        } else {
            console.log("✅ Email Sent Successfully");
        }
    } catch (e) { 
        console.error("❌ Network Error sending email:", e); 
    }
};

// 4. Helper: 更新市場統計數據 (Stats)
const updateMarketStats = async (slotDate, slotHour, amount) => {
    try {
        const dateObj = new Date(slotDate);
        const dayOfWeek = dateObj.getDay(); // 0-6
        const statsId = `${dayOfWeek}_${slotHour}`; 
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
            
            const newAverage = Math.round(newTotalAmount / newTotalBids);

            t.set(statsRef, {
                dayOfWeek, 
                hour: slotHour,
                totalBids: newTotalBids,
                totalAmount: newTotalAmount,
                averagePrice: newAverage,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
        console.log(`📊 Stats Updated: Week${dayOfWeek} ${slotHour}:00 -> Avg $${Math.round(amount)}`);
    } catch (e) { console.error("Stats Update Failed:", e); }
};

// 5. Main Settlement Handler
const settlementHandler = async (event, context) => {
    console.log("⏰ Hourly Settlement Started...");
    const now = new Date();

    try {
        // 找出所有狀態為「等待結算」的訂單
        const ordersRef = db.collection('orders');
        const snapshot = await ordersRef.where('status', '==', 'paid_pending_selection').get();

        if (snapshot.empty) {
            console.log("No pending orders found.");
            return { statusCode: 200, body: "No pending orders." };
        }

        const slotsMap = {}; 

        // 將訂單按時段分組 (Grouping)
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;
            
            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    const hourStr = String(slot.hour).padStart(2, '0');
                    // 假設香港時間 UTC+8
                    const playbackTime = new Date(`${slot.date}T${hourStr}:00:00+08:00`);
                    // 截止時間 = 播放前 24 小時
                    const deadline = new Date(playbackTime.getTime() - (24 * 60 * 60 * 1000));

                    // 如果現在已經過了截止時間 (即係要結算了)
                    if (now >= deadline) {
                        const key = `${slot.date}-${slot.hour}-${slot.screenId}`;
                        if (!slotsMap[key]) slotsMap[key] = [];
                        
                        slotsMap[key].push({ 
                            orderId, 
                            amount: slot.bidPrice || 0,
                            ...data 
                        });
                    }
                });
            }
        });

        // 逐個時段進行競價結算
        for (const [slotKey, bids] of Object.entries(slotsMap)) {
            // 按出價高低排序
            bids.sort((a, b) => b.amount - a.amount);
            
            const winner = bids[0];
            const losers = bids.slice(1);

            console.log(`🏆 Winner for ${slotKey}: ${winner.userName} ($${winner.amount})`);

            // A. 贏家處理 (Winner Logic)
            try {
                const winnerDocRef = db.collection('orders').doc(winner.orderId);
                const winnerDoc = await winnerDocRef.get();

                // 雙重檢查：確保訂單未被處理過
                if (winnerDoc.exists && winnerDoc.data().status === 'paid_pending_selection') {
                    
                    // 1. Capture Payment (扣款)
                    if (winner.paymentIntentId) {
                        await stripe.paymentIntents.capture(winner.paymentIntentId);
                    }

                    // 2. Update Firestore Status
                    await winnerDocRef.update({ 
                        status: 'won', 
                        wonAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 3. Update Market Stats
                    const [y, m, d, h] = slotKey.split('-');
                    await updateMarketStats(`${y}-${m}-${d}`, parseInt(h), winner.amount);

                    // 4. Send Email (WON)
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_name: winner.userName, 
                        to_email: winner.userEmail,
                        amount: winner.amount, 
                        order_id: winner.orderId, 
                        slot_info: slotKey,
                        price_label: '成交價'
                    });
                }
            } catch (err) { 
                console.error(`❌ Winner Error (${winner.orderId}):`, err);
            }

            // B. 輸家處理 (Loser Logic)
            for (const loser of losers) {
                try {
                    const loserDocRef = db.collection('orders').doc(loser.orderId);
                    const loserDoc = await loserDocRef.get();

                    if (loserDoc.exists && loserDoc.data().status === 'paid_pending_selection') {
                        
                        // 1. Cancel Payment Authorization (釋放額度)
                        if (loser.paymentIntentId) {
                            await stripe.paymentIntents.cancel(loser.paymentIntentId);
                        }

                        // 2. Update Firestore Status
                        await loserDocRef.update({ 
                            status: 'lost', 
                            lostAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        // 3. Send Email (LOST)
                        await sendEmail(EMAIL_CFG.templates.LOST_BID, {
                            to_name: loser.userName, 
                            to_email: loser.userEmail,
                            amount: loser.amount, 
                            order_id: loser.orderId, 
                            slot_info: slotKey
                        });
                    }
                } catch (err) { 
                    console.error(`❌ Loser Error (${loser.orderId}):`, err);
                }
            }
        }

        return { statusCode: 200, body: "Settlement Complete" };

    } catch (error) {
        console.error("❌ Fatal Settlement Error:", error);
        return { statusCode: 500, body: error.toString() };
    }
};

// Schedule: Run every hour
module.exports.handler = schedule('0 * * * *', settlementHandler);