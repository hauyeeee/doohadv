// netlify/functions/stripe-webhook.cjs
console.log("🚀 [DEBUG] Stripe Webhook v4.0 - Auto Outbid & Email Notification");

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const https = require('https');

// 1. 初始化 Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountRaw) throw new Error("❌ 缺少環境變數 FIREBASE_SERVICE_ACCOUNT");
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountRaw))
        });
        console.log("✅ Firebase Admin 初始化成功");
    } catch (error) {
        console.error("❌ Firebase Admin 初始化失敗:", error.message);
        throw error; 
    }
}
const db = admin.firestore();

// 2. EmailJS 配置 (從環境變數讀取)
// 確保你在 Netlify 後台有設定這些 Environment Variables
const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID || "service_euz8rzz", // 你的 Service ID
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY || "zTr4nyY_nusfPcNZU",  // 你的 Public Key
    private_key: process.env.EMAILJS_PRIVATE_KEY, // 🔥 必須在 Netlify 設定 Private Key
    template_outbid: "template_34bea2p" // 你的出價被超越 Template ID
};

// 3. 通用發信函數 (Node.js 原生 HTTPS)
const sendEmail = (templateId, params) => {
    return new Promise((resolve) => {
        if (!EMAIL_CFG.private_key) {
            console.error("❌ 缺少 EMAILJS_PRIVATE_KEY，無法發信");
            return resolve("No Private Key");
        }
        const postData = JSON.stringify({
            service_id: EMAIL_CFG.service_id,
            template_id: templateId,
            user_id: EMAIL_CFG.user_id,
            accessToken: EMAIL_CFG.private_key, // 後端發信需要 Private Key
            template_params: params
        });

        const req = https.request({
            hostname: 'api.emailjs.com', port: 443, path: '/api/v1.0/email/send', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        }, (res) => {
            console.log(`📧 Email API Response: ${res.statusCode}`);
            resolve(res.statusCode);
        });

        req.on('error', (e) => {
            console.error("❌ Email 發送錯誤:", e);
            resolve("Error");
        });
        req.write(postData);
        req.end();
    });
};

// 4. 核心邏輯：檢查並踢走輸家
const checkAndNotifyOutbid = async (newOrder) => {
    console.log(`🔍 開始檢查衝突: Order ${newOrder.id} (${newOrder.userName})`);
    
    // 只檢查有效的競爭對手
    const q = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'partially_outbid', 'outbid_needs_action', 'pending_reauth']).get();
    
    if (q.empty) return;

    const batch = db.batch();
    let isBatchUsed = false;
    const newSlots = newOrder.detailedSlots || [];

    // 遍歷所有舊訂單
    for (const doc of q.docs) {
        const oldOrder = doc.data();
        if (oldOrder.userId === newOrder.userId) continue; // 自己不踢自己

        let outbidInfo = [];
        let hasChanged = false;
        let maxNewPrice = 0;

        // 檢查每一個 Slot
        const updatedOldSlots = oldOrder.detailedSlots.map(oldSlot => {
            // 找出同一時間、同一屏幕的 Slot
            const matchNewSlot = newSlots.find(ns => 
                ns.date === oldSlot.date && 
                parseInt(ns.hour) === parseInt(oldSlot.hour) && 
                String(ns.screenId) === String(oldSlot.screenId)
            );

            // 如果撞期，且新價錢 > 舊價錢
            if (matchNewSlot) {
                const oldPrice = parseInt(oldSlot.bidPrice) || 0;
                const newPrice = parseInt(matchNewSlot.bidPrice) || 0;

                if (newPrice > oldPrice && oldSlot.slotStatus !== 'outbid') {
                    console.log(`⚡ 被超越: 舊單(${oldOrder.userName} $${oldPrice}) vs 新單(${newOrder.userName} $${newPrice})`);
                    outbidInfo.push(`${oldSlot.date} ${String(oldSlot.hour).padStart(2,'0')}:00 (Bid: $${oldPrice})`);
                    if (newPrice > maxNewPrice) maxNewPrice = newPrice;
                    hasChanged = true;
                    return { ...oldSlot, slotStatus: 'outbid' }; // 標記為輸
                }
            }
            return oldSlot;
        });

        // 如果這張舊單有變動
        if (hasChanged) {
            isBatchUsed = true;
            const totalSlots = updatedOldSlots.length;
            const outbidCount = updatedOldSlots.filter(s => s.slotStatus === 'outbid').length;
            
            // 判斷新狀態
            let newStatus = 'partially_outbid';
            if (outbidCount === totalSlots) newStatus = 'outbid_needs_action';

            // 1. 更新 DB
            const oldOrderRef = db.collection('orders').doc(doc.id);
            batch.update(oldOrderRef, { 
                detailedSlots: updatedOldSlots, 
                status: newStatus,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. 發送 Email (後端直接發)
            if (outbidInfo.length > 0) {
                const slotInfoStr = outbidInfo.join('\n'); // Email 換行
                await sendEmail(EMAIL_CFG.template_outbid, {
                    to_name: oldOrder.userName || 'Customer',
                    to_email: oldOrder.userEmail,
                    slot_info: slotInfoStr,
                    new_price: maxNewPrice
                });
                console.log(`📧 已發送 Outbid 通知給 ${oldOrder.userEmail}`);
            }
        }
    }

    if (isBatchUsed) {
        await batch.commit();
        console.log("✅ 所有衝突處理完畢，DB 已更新");
    }
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
        console.error(`⚠️ Stripe 簽名錯誤: ${err.message}`);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const orderId = session.metadata.orderId;
        const orderType = session.metadata.orderType;

        console.log(`💰 收到付款: Order=${orderId}, Type=${orderType}`);

        if (orderId) {
            try {
                let newStatus = 'paid_pending_selection';
                if (orderType === 'buyout') newStatus = 'paid';

                // 1. 更新自己這張單的狀態
                await db.collection('orders').doc(orderId).update({
                    status: newStatus, 
                    paymentStatus: 'paid_verified_webhook',
                    stripeSessionId: session.id,
                    paymentIntentId: session.payment_intent,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // 🔥 2. (新功能) 觸發踢人邏輯 & 發信
                // 先獲取這張新單的完整資料
                if (orderType !== 'buyout') {
                    const newOrderSnap = await db.collection('orders').doc(orderId).get();
                    if (newOrderSnap.exists) {
                        const newOrderData = { id: orderId, ...newOrderSnap.data() };
                        await checkAndNotifyOutbid(newOrderData);
                    }
                }

                return { statusCode: 200, body: JSON.stringify({ received: true }) };
            } catch (error) {
                console.error("❌ 處理失敗:", error);
                return { statusCode: 500, body: `Server Error: ${error.message}` };
            }
        }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};