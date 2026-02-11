// netlify/functions/stripe-webhook.cjs
console.log("🚀 [DEBUG] Stripe Webhook v7.0 - Ultimate Buyout Fix");

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const https = require('https');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
    } catch (error) { console.error("❌ Firebase Init Error:", error.message); }
}
const db = admin.firestore();

const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID,
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY,
    private_key: process.env.EMAILJS_PRIVATE_KEY,
    templates: {
        BID_RECEIVED: "template_biprpck",
        BUYOUT_SUCCESS: "template_99moneg",
        OUTBID_ALERT: "template_34bea2p",
        OUTBID_BY_BUYOUT: "template_9vthu4n"
    }
};

const sendEmail = (templateId, params) => {
    return new Promise((resolve) => {
        if (!EMAIL_CFG.private_key) return resolve("No Private Key");
        const postData = JSON.stringify({
            service_id: EMAIL_CFG.service_id, template_id: templateId, user_id: EMAIL_CFG.user_id, accessToken: EMAIL_CFG.private_key, template_params: params
        });
        const req = https.request({
            hostname: 'api.emailjs.com', port: 443, path: '/api/v1.0/email/send', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        }, (res) => resolve(res.statusCode));
        req.on('error', (e) => resolve("Error")); req.write(postData); req.end();
    });
};

// 4A. 邏輯：處理 Buyout 踢人 (清場)
const handleBuyoutKicking = async (buyoutOrder) => {
    console.log(`🧹 執行買斷清場: Order ${buyoutOrder.id}`);
    
    // 🔥 修改 1: 擴大抓取範圍，包含 'won', 'partially_won', 'pending_auth'
    const q = await db.collection('orders').where('status', 'in', [
        'paid_pending_selection', 
        'partially_outbid', 
        'outbid_needs_action', 
        'pending_reauth', 
        'pending_auth',   
        'won',            
        'partially_won'
    ]).get();
    
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

            if (match) {
                // 只要撞期，直接判死刑
                // 🔥 修改 2: 狀態改為 'outbid_by_buyout'
                if (oldSlot.slotStatus !== 'outbid_by_buyout') {
                    outbidInfo.push(`${oldSlot.date} ${String(oldSlot.hour).padStart(2,'0')}:00 (已被買斷)`);
                    hasChanged = true;
                    return { ...oldSlot, slotStatus: 'outbid_by_buyout' };
                }
            }
            return oldSlot;
        });

        if (hasChanged) {
            kickedCount++;
            const allOutbid = updatedOldSlots.every(s => s.slotStatus === 'outbid' || s.slotStatus === 'outbid_by_buyout');
            
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
                
                await db.collection('orders').doc(orderId).update({
                    status: newStatus,
                    paymentStatus: 'paid_verified_webhook',
                    stripeSessionId: session.id,
                    paymentIntentId: session.payment_intent,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                const orderSnap = await db.collection('orders').doc(orderId).get();
                const orderData = { id: orderId, ...orderSnap.data() };

                const confirmTemplate = orderType === 'buyout' ? EMAIL_CFG.templates.BUYOUT_SUCCESS : EMAIL_CFG.templates.BID_RECEIVED;
                await sendEmail(confirmTemplate, {
                    to_name: orderData.userName || 'Customer',
                    to_email: orderData.userEmail,
                    order_id: orderId,
                    amount: orderData.amount,
                    slot_summary: orderData.timeSlotSummary || 'Selected Slots'
                });

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