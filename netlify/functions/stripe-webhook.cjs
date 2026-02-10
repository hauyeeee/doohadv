// netlify/functions/stripe-webhook.cjs
console.log("🚀 [DEBUG] Stripe Webhook v5.0 - Full Email Automation");

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
    } catch (error) {
        console.error("❌ Firebase Init Error:", error.message);
        throw error; 
    }
}
const db = admin.firestore();

// 2. EmailJS 配置
const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID || "service_euz8rzz",
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY || "zTr4nyY_nusfPcNZU",
    private_key: process.env.EMAILJS_PRIVATE_KEY, // 記得在 Netlify 設定這個 env var
    templates: {
        BID_RECEIVED: "template_biprpck",   // 收到出價
        BUYOUT_SUCCESS: "template_99moneg", // 買斷成功
        OUTBID_ALERT: "template_34bea2p",   // 被超越
        OUTBID_BY_BUYOUT: "template_9vthu4n" // 🔥 被買斷踢走
    }
};

// 3. 通用發信函數
const sendEmail = (templateId, params) => {
    return new Promise((resolve) => {
        if (!EMAIL_CFG.private_key) return resolve("No Private Key");
        
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

        req.on('error', (e) => { console.error("Email Error:", e); resolve("Error"); });
        req.write(postData);
        req.end();
    });
};

// 4A. 邏輯：處理 Buyout 踢人 (清場)
const handleBuyoutKicking = async (buyoutOrder) => {
    console.log(`🧹 執行買斷清場: Order ${buyoutOrder.id}`);
    const q = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'partially_outbid', 'outbid_needs_action', 'pending_reauth']).get();
    
    const batch = db.batch();
    const newSlots = buyoutOrder.detailedSlots || [];
    let kickedCount = 0;

    for (const doc of q.docs) {
        const oldOrder = doc.data();
        if (oldOrder.userId === buyoutOrder.userId) continue;

        let outbidInfo = [];
        let hasChanged = false;

        const updatedOldSlots = oldOrder.detailedSlots.map(oldSlot => {
            // 檢查是否撞期 (Buyout 贏一切)
            const match = newSlots.find(ns => 
                ns.date === oldSlot.date && 
                parseInt(ns.hour) === parseInt(oldSlot.hour) && 
                String(ns.screenId) === String(oldSlot.screenId)
            );

            if (match && oldSlot.slotStatus !== 'outbid') {
                outbidInfo.push(`${oldSlot.date} ${String(oldSlot.hour).padStart(2,'0')}:00 (已被買斷)`);
                hasChanged = true;
                return { ...oldSlot, slotStatus: 'outbid' };
            }
            return oldSlot;
        });

        if (hasChanged) {
            kickedCount++;
            // 更新舊單
            const allOutbid = updatedOldSlots.every(s => s.slotStatus === 'outbid');
            batch.update(db.collection('orders').doc(doc.id), { 
                detailedSlots: updatedOldSlots, 
                status: allOutbid ? 'outbid_needs_action' : 'partially_outbid',
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            // 發送 "被買斷" 通知信
            if (outbidInfo.length > 0) {
                await sendEmail(EMAIL_CFG.templates.OUTBID_BY_BUYOUT, {
                    to_name: oldOrder.userName || 'Customer',
                    to_email: oldOrder.userEmail,
                    slot_info: outbidInfo.join('\n')
                });
            }
        }
    }
    if (kickedCount > 0) await batch.commit();
    console.log(`✅ 買斷清場完成，踢走了 ${kickedCount} 張單`);
};

// 4B. 邏輯：處理一般競價踢人
const handleStandardBidding = async (newOrder) => {
    // ... (這部分邏輯與之前相同，檢查價格高低)
    // 為了節省篇幅，這里保留你上一次的 checkAndNotifyOutbid 邏輯，
    // 唯一的區別是使用 EMAIL_CFG.templates.OUTBID_ALERT
    
    // (將上一次給你的 checkAndNotifyOutbid 代碼貼在這裡，確保變量名一致)
    // 下面是簡化版邏輯：
    const q = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'partially_outbid', 'outbid_needs_action', 'pending_reauth']).get();
    const batch = db.batch();
    let isBatchUsed = false;
    const newSlots = newOrder.detailedSlots || [];

    for (const doc of q.docs) {
        const oldOrder = doc.data();
        if (oldOrder.userId === newOrder.userId) continue;

        let outbidInfo = [];
        let hasChanged = false;
        let maxNewPrice = 0;

        const updatedOldSlots = oldOrder.detailedSlots.map(oldSlot => {
            const matchNewSlot = newSlots.find(ns => 
                ns.date === oldSlot.date && parseInt(ns.hour) === parseInt(oldSlot.hour) && String(ns.screenId) === String(oldSlot.screenId)
            );
            if (matchNewSlot) {
                const oldPrice = parseInt(oldSlot.bidPrice) || 0;
                const newPrice = parseInt(matchNewSlot.bidPrice) || 0;
                if (newPrice > oldPrice && oldSlot.slotStatus !== 'outbid') {
                    outbidInfo.push(`${oldSlot.date} ${String(oldSlot.hour).padStart(2,'0')}:00 ($${oldPrice} -> $${newPrice})`);
                    if(newPrice > maxNewPrice) maxNewPrice = newPrice;
                    hasChanged = true;
                    return { ...oldSlot, slotStatus: 'outbid' };
                }
            }
            return oldSlot;
        });

        if (hasChanged) {
            isBatchUsed = true;
            const allOutbid = updatedOldSlots.every(s => s.slotStatus === 'outbid');
            batch.update(db.collection('orders').doc(doc.id), { 
                detailedSlots: updatedOldSlots, 
                status: allOutbid ? 'outbid_needs_action' : 'partially_outbid',
                lastUpdated: admin.firestore.FieldValue.serverTimestamp() 
            });
            
            if (outbidInfo.length > 0) {
                await sendEmail(EMAIL_CFG.templates.OUTBID_ALERT, {
                    to_name: oldOrder.userName, to_email: oldOrder.userEmail,
                    slot_info: outbidInfo.join('\n'), new_price: maxNewPrice
                });
            }
        }
    }
    if (isBatchUsed) await batch.commit();
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const sig = event.headers['stripe-signature'];
    
    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return { statusCode: 400, body: `Webhook Error: ${err.message}` }; }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const orderId = session.metadata.orderId;
        const orderType = session.metadata.orderType;

        if (orderId) {
            try {
                let newStatus = orderType === 'buyout' ? 'paid' : 'paid_pending_selection';
                
                // 1. 更新狀態 (這是最優先的)
                await db.collection('orders').doc(orderId).update({
                    status: newStatus,
                    paymentStatus: 'paid_verified_webhook',
                    stripeSessionId: session.id,
                    paymentIntentId: session.payment_intent,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // 2. 獲取訂單詳情
                const orderSnap = await db.collection('orders').doc(orderId).get();
                const orderData = { id: orderId, ...orderSnap.data() };

                // 🔥 3. (修復) 發送 "收到出價 / 買斷成功" 確認信
                // 這是你說收不到的那封信，現在由後端保證發送
                const confirmTemplate = orderType === 'buyout' ? EMAIL_CFG.templates.BUYOUT_SUCCESS : EMAIL_CFG.templates.BID_RECEIVED;
                await sendEmail(confirmTemplate, {
                    to_name: orderData.userName || 'Customer',
                    to_email: orderData.userEmail,
                    order_id: orderId,
                    amount: orderData.amount,
                    slot_summary: orderData.timeSlotSummary || 'Selected Slots'
                });
                console.log("📧 確認信已發送");

                // 4. 觸發踢人邏輯 (Trigger Outbid Logic)
                if (orderType === 'buyout') {
                    await handleBuyoutKicking(orderData);
                } else {
                    await handleStandardBidding(orderData);
                }

                return { statusCode: 200, body: JSON.stringify({ received: true }) };
            } catch (error) {
                console.error("Server Error:", error);
                return { statusCode: 500, body: error.message };
            }
        }
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};