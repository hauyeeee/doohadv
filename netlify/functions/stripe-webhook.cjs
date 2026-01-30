// netlify/functions/stripe-webhook.cjs
console.log("🚀 [DEBUG] Stripe Webhook v3.0 - Buyout Logic Added");

// 1. 引入依賴
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 2. 初始化 Firebase Admin (上帝模式)
if (!admin.apps.length) {
    try {
        const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountRaw) throw new Error("❌ 缺少環境變數 FIREBASE_SERVICE_ACCOUNT");
        
        const serviceAccount = JSON.parse(serviceAccountRaw);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin 初始化成功");
    } catch (error) {
        console.error("❌ Firebase Admin 初始化失敗:", error.message);
        throw error; 
    }
}

const db = admin.firestore();

exports.handler = async (event) => {
    // 只接受 POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
        console.error(`⚠️ Stripe 簽名驗證失敗: ${err.message}`);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    // 處理付款成功事件
    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        
        // 🔥 獲取 metadata 裡的資料
        const orderId = session.metadata.orderId;
        const orderType = session.metadata.orderType; // 'buyout' or 'bid'

        console.log(`💰 收到付款: Order=${orderId}, Type=${orderType}`);

        if (orderId) {
            try {
                // 🔥 核心修改：根據類型決定狀態 🔥
                let newStatus = 'paid_pending_selection'; // 預設是競價中
                
                if (orderType === 'buyout') {
                    newStatus = 'paid'; // 如果是買斷，直接變成「已付款/成功」
                }

                // 使用 Admin SDK 寫入
                await db.collection('orders').doc(orderId).update({
                    status: newStatus, 
                    paymentStatus: 'paid_verified_webhook',
                    stripeSessionId: session.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`✅ 訂單 ${orderId} 狀態已更新為: ${newStatus}`);
                return { statusCode: 200, body: JSON.stringify({ received: true }) };

            } catch (error) {
                console.error("❌ 資料庫更新失敗:", error);
                return { statusCode: 500, body: `DB Error: ${error.message}` };
            }
        }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};