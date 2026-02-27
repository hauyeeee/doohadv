const { schedule } = require('@netlify/functions');
const https = require('https');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// 1. 初始化 Firebase
if (!admin.apps.length) {
  try {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  } catch (e) { console.error("❌ Firebase Init Error:", e); }
}
const db = admin.firestore();

// 2. Email Config
const EMAIL_CFG = {
    service_id: process.env.VITE_EMAILJS_SERVICE_ID,
    user_id: process.env.VITE_EMAILJS_PUBLIC_KEY,
    private_key: process.env.EMAILJS_PRIVATE_KEY,
    templates: {
        WON_BID: "template_3n90m3u", 
        PARTIAL_WIN: "template_vphbdyp", 
        LOST_BID: "template_1v8p3y8",
    }
};

const sendEmail = (templateId, params) => {
    return new Promise((resolve) => {
        if (!EMAIL_CFG.service_id) return resolve("No Config");
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
        req.on('error', () => resolve("Error"));
        req.write(postData);
        req.end();
    });
};

const settlementHandler = async (event, context) => {
    console.log("⏰ Settlement Run (Transaction Safe V5)...");
    try {
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'partially_outbid', 'partially_won']).get();
        if (snapshot.empty) return { statusCode: 200, body: "No pending orders" };

        const slotsMap = {};      
        const orderResults = {};
        const now = new Date(); 
        
        // B. 準備數據 & 檢查時間
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;

            if (!orderResults[orderId]) {
                orderResults[orderId] = {
                    id: orderId,
                    userEmail: data.userEmail,
                    userName: data.userName,
                    paymentIntentId: data.paymentIntentId,
                    originalAmount: data.amount || 0,
                    originalSlots: data.detailedSlots || [],
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    wonSlotsList: [], 
                    lostSlotsList: [], 
                    slotStatuses: {}, 
                    status: data.status,
                    screenNames: new Set(),
                    shouldSettleAny: false 
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach((slot, index) => {
                    orderResults[orderId].totalSlots++;
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                    
                    const slotPlayTime = new Date(slotDateTimeStr);
                    const revealTime = new Date(slotPlayTime.getTime() - 24 * 60 * 60 * 1000);
                    const isRevealed = now >= revealTime;

                    if (isRevealed) {
                        if (!slotsMap[key]) slotsMap[key] = [];
                        slotsMap[key].push({
                            orderId: orderId,
                            slotIndex: index,
                            bidPrice: parseInt(slot.bidPrice) || 0,
                            slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                        });
                        orderResults[orderId].shouldSettleAny = true;
                    }
                    
                    orderResults[orderId].screenNames.add(slot.screenName || slot.screenId);
                });
            }
        });

        // C. 比武大會 
        for (const [key, bids] of Object.entries(slotsMap)) {
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            const winner = bids[0]; 
            const losers = bids.slice(1); 

            if (orderResults[winner.orderId]) {
                orderResults[winner.orderId].wonAmount += winner.bidPrice;
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} (HK$ ${winner.bidPrice})`);
                orderResults[winner.orderId].slotStatuses[winner.slotIndex] = 'won';
            }

            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: HK$ ${loser.bidPrice})`);
                    orderResults[loser.orderId].slotStatuses[loser.slotIndex] = 'lost';
                }
            });
        }

        // D. 執行 Capture & Update DB (🔥 加入 Transaction 防衝突機制 🔥)
        for (const [orderId, res] of Object.entries(orderResults)) {
            if (!res.shouldSettleAny) continue;
            const orderRef = db.collection('orders').doc(orderId);

            try {
                await db.runTransaction(async (transaction) => {
                    // 1. 每次 Transaction 重新讀取最新狀態
                    const orderDoc = await transaction.get(orderRef);
                    if (!orderDoc.exists) return;
                    
                    const currentData = orderDoc.data();
                    
                    // 🚨 防撞機制：如果喺清算前一秒，剛好被 Buyout 踢走或者取消咗，直接放棄結算
                    if (['lost', 'cancelled', 'outbid_needs_action'].includes(currentData.status)) {
                        console.log(`⚠️ 訂單 ${orderId} 狀態已變更為 ${currentData.status} (可能剛被買斷)，跳過結算。`);
                        return; 
                    }

                    // 合併 Slots (保留未結算或已被買斷標記的 Slot)
                    const updatedDetailedSlots = currentData.detailedSlots.map((slot, idx) => {
                        // 如果在 transaction 期間 slot 已經被改成 outbid_by_buyout，就保留它！
                        if (slot.slotStatus === 'outbid_by_buyout') return slot;
                        if (res.slotStatuses[idx]) {
                            return { ...slot, slotStatus: res.slotStatuses[idx] };
                        }
                        return slot; 
                    });

                    // --- 情況 1: 全部輸 (釋放授權) ---
                    if (res.winCount === 0 && res.loseCount > 0) {
                        const pendingSlots = updatedDetailedSlots.filter(s => !['won', 'lost', 'outbid', 'outbid_by_buyout'].includes(s.slotStatus));
                        const isFullySettled = pendingSlots.length === 0;

                        if (isFullySettled) {
                            if (res.paymentIntentId) { 
                                try { 
                                    // 🔥 使用 Idempotency Key 確保即使 Transaction 重試都不會重複 Cancel
                                    await stripe.paymentIntents.cancel(res.paymentIntentId, {
                                        idempotencyKey: `cancel_${orderId}`
                                    });
                                } catch(e) {} 
                            }
                            transaction.update(orderRef, { 
                                status: 'lost', 
                                detailedSlots: updatedDetailedSlots,
                                lostAt: admin.firestore.FieldValue.serverTimestamp() 
                            });
                            // 發 Email 可以放喺 transaction 出面，但為簡化放這裡也無妨，如果重試有機會發兩次，但機率極低
                            sendEmail(EMAIL_CFG.templates.LOST_BID, { to_email: res.userEmail, to_name: res.userName, order_id: orderId }).catch(()=>{});
                        } else {
                            transaction.update(orderRef, { 
                                status: 'partially_outbid',
                                detailedSlots: updatedDetailedSlots 
                            });
                        }
                    }
                    
                    // --- 情況 2: 有贏 (Capture 贏的部分) ---
                    else if (res.winCount > 0) {
                        const amountToCaptureCents = Math.round(res.wonAmount * 100);
                        let captureSuccess = false;

                        if (res.paymentIntentId) {
                            try {
                                // 🔥 使用 Idempotency Key 確保 Stripe 扣款只會執行一次！
                                await stripe.paymentIntents.capture(res.paymentIntentId, {
                                    amount_to_capture: amountToCaptureCents
                                }, {
                                    idempotencyKey: `capture_${orderId}_${amountToCaptureCents}` 
                                });
                                captureSuccess = true;
                                console.log(`💰 Captured ${res.wonAmount} for ${orderId}`);
                            } catch (e) { 
                                // 如果已經扣過錢，Stripe 會報錯，但我們視為成功
                                if (e.message.includes("already been captured")) {
                                    captureSuccess = true;
                                } else {
                                    console.error(`Capture Error: ${e.message}`);
                                }
                            }
                        }

                        // 如果扣錢成功才 Update DB
                        if (captureSuccess || !res.paymentIntentId) {
                            const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';
                            transaction.update(orderRef, { 
                                status: finalStatus, 
                                amount: res.wonAmount, 
                                detailedSlots: updatedDetailedSlots, 
                                wonAt: admin.firestore.FieldValue.serverTimestamp(),
                                finalWinCount: res.winCount,
                                finalLostCount: res.loseCount
                            });

                            if (currentData.status !== 'won' && currentData.status !== 'partially_won') {
                                let slotSummaryHtml = `
                                    <b>✅ 成功競投 (Won):</b><br>${res.wonSlotsList.join('<br>')}<br><br>
                                    ${res.loseCount > 0 ? `<b>❌ 未能中標 (Lost):</b><br>${res.lostSlotsList.join('<br>')}` : ''}
                                `;
                                let screenNamesStr = Array.from(res.screenNames).join(', ');
                                const emailTemplate = finalStatus === 'partially_won' ? EMAIL_CFG.templates.PARTIAL_WIN : EMAIL_CFG.templates.WON_BID;
                                
                                sendEmail(emailTemplate, {
                                    to_email: res.userEmail, to_name: res.userName, amount: res.wonAmount,
                                    order_id: orderId, screen_names: screenNamesStr, slot_summary: slotSummaryHtml,
                                    order_link: "https://dooh-adv-pro.netlify.app" 
                                }).catch(()=>{});
                            }
                        }
                    }
                });
            } catch (txError) {
                console.error(`Transaction failed for order ${orderId}:`, txError);
            }
        }

        return { statusCode: 200, body: "Settlement Transaction V5 Done" };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);