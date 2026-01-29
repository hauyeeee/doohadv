// netlify/functions/stripe-webhook.cjs
console.log("🚀 [DEBUG] 我是正確的 CJS 版本 v2.0 - Admin SDK 啟動中...");
// 1. 引入依賴
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 2. 初始化 Firebase Admin (上帝模式)
// 只有這段能讓你無視 Security Rules
if (!admin.apps.length) {
    try {
        const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (!serviceAccountRaw) {
            throw new Error("❌ 缺少環境變數 FIREBASE_SERVICE_ACCOUNT");
        }

        // 嘗試解析 JSON (處理可能的格式問題)
        const serviceAccount = JSON.parse(serviceAccountRaw);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        console.log("✅ Firebase Admin 初始化成功");
    } catch (error) {
        console.error("❌ Firebase Admin 初始化失敗:", error.message);
        // 如果初始化失敗，我們不應該繼續，否則就會發生 PERMISSION_DENIED
        throw error; 
    }
}

// 🔥 關鍵點：必須使用 admin.firestore()，不能用 getFirestore()
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
        // 驗證 Stripe 簽名
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
        console.error(`⚠️ Stripe 簽名驗證失敗: ${err.message}`);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    // 處理付款成功事件
    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const orderId = session.metadata.orderId;

        console.log(`💰 收到 Stripe 事件，Order ID: ${orderId}`);

        if (orderId) {
            try {
                // 使用 Admin SDK 寫入 (無視 Rules)
                await db.collection('orders').doc(orderId).update({
                    status: 'paid_pending_selection', 
                    paymentStatus: 'paid_verified_webhook',
                    stripeSessionId: session.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`✅ 訂單 ${orderId} 狀態已更新為 paid_pending_selection`);
                return { statusCode: 200, body: JSON.stringify({ received: true }) };

            } catch (error) {
                console.error("❌ 資料庫更新失敗:", error);
                // 這裡會顯示具體錯誤，如果是 Permission Denied，代表 Admin Init 還是有問題
                return { statusCode: 500, body: `DB Error: ${error.message}` };
            }
        }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};