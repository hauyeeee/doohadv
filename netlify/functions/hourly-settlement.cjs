const { schedule } = require('@netlify/functions');
const https = require('https');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 1. 初始化 Firebase Admin (保持不變)
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

// 2. EmailJS Config (根據你的截圖更新 ID)
const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID || "service_xxxxxxxx", // 請確保 Env Var 存在
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY || "user_xxxxxxxx",
    private_key: process.env.EMAILJS_PRIVATE_KEY, // 必須在 Netlify Env 設定
    
    admin_email: "hauyeeee@gmail.com",

    templates: {
        WON_BID: "template_3n90m3u", // Congrats, 你已中標
        LOST_BID: "template_1v8p3y8"  // Bid Lost / 競投失敗
    }
};

// 3. Helper: 發送 Email (保持不變，略作精簡)
const sendEmail = (templateId, params, label = "User") => {
    return new Promise((resolve, reject) => {
        if (!EMAIL_CFG.service_id || !EMAIL_CFG.user_id || !EMAIL_CFG.private_key) {
            console.log("⚠️ Email Config Missing - Skipping Email");
            return resolve("Config Missing");
        }
        const postData = JSON.stringify({
            service_id: EMAIL_CFG.service_id,
            template_id: templateId,
            user_id: EMAIL_CFG.user_id,
            accessToken: EMAIL_CFG.private_key,
            template_params: params
        });
        const options = {
            hostname: 'api.emailjs.com', port: 443, path: '/api/v1.0/email/send', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = https.request(options, (res) => {
            if (res.statusCode === 200 || res.statusCode === 201) resolve("Success");
            else resolve("Failed"); // 不拋錯，避免中斷 Loop
        });
        req.on('error', () => resolve("Network Error"));
        req.write(postData);
        req.end();
    });
};

// 4. Main Handler
const settlementHandler = async (event, context) => {
    console.log("⏰ Auto Settlement Started... (v2.0)");
    const now = new Date();

    try {
        const ordersRef = db.collection('orders');
        
        // 🔥 關鍵修正 1: 抓取所有「未完結」的狀態
        // 包含：競價中、被超越(輸家)、部分被超越
        const snapshot = await ordersRef.where('status', 'in', ['paid_pending_selection', 'outbid_needs_action', 'partially_outbid']).get();

        if (snapshot.empty) {
            console.log("😴 No active orders to settle.");
            return { statusCode: 200, body: "No orders" };
        }

        const slotsMap = {};
        
        // --- 步驟 A: 篩選出「即將播放」的時段 ---
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;

            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    // 組合播放時間 (假設 slot.date 係 "2024-02-05", slot.hour 係 14)
                    const hourStr = String(slot.hour).padStart(2, '0');
                    // 注意：這裡假設 Server 是 UTC，需要根據香港時間 (+8) 調整，或者直接比較 Timestamp
                    // 簡單做法：將 date 和 hour 轉成 Date Object
                    const slotDateTimeStr = `${slot.date}T${hourStr}:00:00`; 
                    const playbackTime = new Date(slotDateTimeStr);
                    
                    // 🔥 關鍵修正 2: 設定截標時間 (例如：播放前 1 小時截標)
                    // 如果現在時間 (now) 已經過了 (playbackTime - 1 hour)，代表這張單要結算了
                    const cutOffTime = new Date(playbackTime.getTime() - (60 * 60 * 1000)); // 1小時前截標

                    // 如果現在已經過了截標時間 (或者你想測試，暫時用 true)
                    // if (now >= cutOffTime) { 
                    if (true) { // ⚠️ DEV MODE: 強制全部結算 (上線前記得改回上面那行！)
                        const key = `${slot.date}-${slot.hour}-${slot.screenId}`;
                        
                        // 初始化
                        if (!slotsMap[key]) slotsMap[key] = [];
                        
                        // 將這個 Bid 加入戰場
                        slotsMap[key].push({ 
                            orderId, 
                            amount: parseInt(slot.bidPrice) || 0, // 確保係數字
                            userEmail: data.userEmail,
                            userName: data.userName,
                            paymentIntentId: data.paymentIntentId, // 假設你有存這個
                            type: data.type, // bid or buyout
                            ...data 
                        });
                    }
                });
            }
        });

        // --- 步驟 B: 逐個時段判定輸贏 ---
        for (const [slotKey, bids] of Object.entries(slotsMap)) {
            // 排序：價高者得 (Desc) -> 時間早者得 (Asc)
            // 這裡簡化用價錢排，如果同價，原本的 Array 順序通常係讀取順序
            bids.sort((a, b) => b.amount - a.amount);

            const winner = bids[0];
            const losers = bids.slice(1);

            console.log(`⚔️ Resolving ${slotKey}: Winner -> ${winner.userEmail} ($${winner.amount})`);

            // --- 處理贏家 (Winner) ---
            try {
                const winnerRef = db.collection('orders').doc(winner.orderId);
                // 只有當狀態未變成 won/paid 時才執行 (防止重複扣款)
                const wDoc = await winnerRef.get();
                if (wDoc.exists && wDoc.data().status !== 'won' && wDoc.data().status !== 'paid') {
                    
                    // 1. Stripe Capture (正式收錢)
                    // 注意：如果是 Buyout (automatic capture)，這裡會報錯，所以要 try-catch
                    if (winner.type !== 'buyout' && winner.paymentIntentId) {
                        try {
                            await stripe.paymentIntents.capture(winner.paymentIntentId);
                            console.log(`💰 Captured payment for ${winner.orderId}`);
                        } catch (e) {
                            console.log(`⚠️ Capture skipped/failed (Order might be buyout or already captured): ${e.message}`);
                        }
                    }

                    // 2. Update DB
                    await winnerRef.update({ 
                        status: 'won', 
                        wonAt: admin.firestore.FieldValue.serverTimestamp() 
                    });

                    // 3. Send Email
                    await sendEmail(EMAIL_CFG.templates.WON_BID, {
                        to_name: winner.userName,
                        to_email: winner.userEmail,
                        amount: winner.amount,
                        order_id: winner.orderId,
                        final_slots: slotKey // 簡單顯示
                    }, "Winner");
                }
            } catch (e) { console.error("Winner Error:", e); }

            // --- 處理輸家 (Losers) ---
            for (const loser of losers) {
                try {
                    const loserRef = db.collection('orders').doc(loser.orderId);
                    const lDoc = await loserRef.get();
                    
                    // 只有未 Lost 的才處理
                    if (lDoc.exists && lDoc.data().status !== 'lost') {
                        
                        // 1. Stripe Cancel (退款/釋放額度)
                        if (loser.paymentIntentId) {
                            try {
                                await stripe.paymentIntents.cancel(loser.paymentIntentId);
                                console.log(`💸 Released funds for ${loser.orderId}`);
                            } catch (e) {
                                console.log(`⚠️ Refund skipped (Might differ for partial loss): ${e.message}`);
                            }
                        }

                        // 2. Update DB
                        await loserRef.update({ 
                            status: 'lost', 
                            lostAt: admin.firestore.FieldValue.serverTimestamp() 
                        });

                        // 3. Send Email
                        await sendEmail(EMAIL_CFG.templates.LOST_BID, {
                            to_name: loser.userName,
                            to_email: loser.userEmail,
                            order_id: loser.orderId
                        }, "Loser");
                    }
                } catch (e) { console.error("Loser Error:", e); }
            }
        }

        return { statusCode: 200, body: "Auto Settlement Complete" };

    } catch (error) {
        console.error("Handler Error:", error);
        return { statusCode: 500, body: error.toString() };
    }
};

// 設定排程：每小時的第 0 分鐘執行 (e.g. 14:00, 15:00)
module.exports.handler = schedule('0 * * * *', settlementHandler);