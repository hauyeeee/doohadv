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
    console.log("⏰ Settlement Run (Capture Fix V2)...");
    try {
        // 🔥 1. 抓取所有相關訂單 (包含已付款等待分配的、已贏的、部分贏的)
        // 注意：這裡不抓 'won'/'paid' 的歷史訂單，以免重複扣款，只抓需要結算的狀態
        // 但為了比價，我們需要所有參與該時段的訂單。
        // 修正策略：抓取所有相關訂單進行「虛擬比價」，但只對「未結算」的訂單執行扣款。
        
        const snapshot = await db.collection('orders').where('status', 'in', ['paid_pending_selection', 'outbid_needs_action', 'partially_outbid', 'partially_won']).get();
        if (snapshot.empty) return { statusCode: 200, body: "No pending orders" };

        const slotsMap = {};      
        const orderResults = {};

        // B. 準備數據 & 建立比價池
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderId = doc.id;

            if (!orderResults[orderId]) {
                orderResults[orderId] = {
                    id: orderId,
                    userEmail: data.userEmail,
                    userName: data.userName,
                    paymentIntentId: data.paymentIntentId,
                    originalAmount: data.amount || 0, // 這是預授權總額
                    
                    // 🔥 初始化歸零，重新計算
                    wonAmount: 0,                     
                    winCount: 0,
                    loseCount: 0,
                    totalSlots: 0,
                    
                    wonSlotsList: [], 
                    lostSlotsList: [], 
                    status: data.status,
                    screenNames: new Set()
                };
            }

            if (data.detailedSlots) {
                data.detailedSlots.forEach(slot => {
                    orderResults[orderId].totalSlots++; 
                    const slotDateTimeStr = `${slot.date} ${String(slot.hour).padStart(2,'0')}:00`;
                    // Key: Date-Hour-Screen (唯一時段標識)
                    const key = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                    
                    if (!slotsMap[key]) slotsMap[key] = [];
                    
                    slotsMap[key].push({
                        orderId: orderId,
                        bidPrice: parseInt(slot.bidPrice) || 0,
                        slotInfo: `${slotDateTimeStr} @ ${slot.screenName || slot.screenId}`
                    });
                    
                    orderResults[orderId].screenNames.add(slot.screenName || slot.screenId);
                });
            }
        });

        // C. 比武大會 (核心邏輯)
        for (const [key, bids] of Object.entries(slotsMap)) {
            // 按照出價高低排序 (高價者得)
            bids.sort((a, b) => b.bidPrice - a.bidPrice);
            
            const winner = bids[0]; // 贏家
            const losers = bids.slice(1); // 所有輸家

            // 1. 處理贏家
            if (orderResults[winner.orderId]) {
                // 🔥 只有在這裡加錢！確保 wonAmount 絕對準確
                orderResults[winner.orderId].wonAmount += winner.bidPrice;
                orderResults[winner.orderId].winCount++;
                orderResults[winner.orderId].wonSlotsList.push(`${winner.slotInfo} (HK$ ${winner.bidPrice})`);
            }

            // 2. 處理輸家
            losers.forEach(loser => {
                if (orderResults[loser.orderId]) {
                    // 輸家不加錢，只記錄輸了
                    orderResults[loser.orderId].loseCount++;
                    orderResults[loser.orderId].lostSlotsList.push(`${loser.slotInfo} (Bid: HK$ ${loser.bidPrice})`);
                }
            });
        }

        // D. 執行結算 & 扣款 (Capture)
        for (const [orderId, res] of Object.entries(orderResults)) {
            const orderRef = db.collection('orders').doc(orderId);
            
            console.log(`🧾 Settling Order ${orderId}: Won ${res.winCount}/${res.totalSlots}, Amount to Capture: $${res.wonAmount}`);

            // 情況 1: 全輸 (Win Count = 0)
            if (res.winCount === 0) {
                if (res.status !== 'lost') {
                    // 取消授權 (Release funds)
                    if (res.paymentIntentId) { 
                        try { await stripe.paymentIntents.cancel(res.paymentIntentId); } 
                        catch(e) { console.warn(`Cancel failed for ${orderId}: ${e.message}`); } 
                    }
                    await orderRef.update({ status: 'lost', lostAt: admin.firestore.FieldValue.serverTimestamp() });
                    await sendEmail(EMAIL_CFG.templates.LOST_BID, { to_email: res.userEmail, to_name: res.userName, order_id: orderId });
                }
            }
            
            // 情況 2: 有贏 (Win Count > 0) -> 包含全贏和部分贏
            else if (res.winCount > 0) {
                // 只有當狀態尚未標記為最終狀態時才處理
                if (res.status !== 'won' && res.status !== 'paid' && res.status !== 'partially_won') { // 實際上 snapshot 已經 filter 了一次，這裡再保險一點
                    
                    if (res.paymentIntentId) {
                        try {
                            // 🔥🔥🔥 核心 Capture 邏輯 🔥🔥🔥
                            const amountToCaptureCents = Math.round(res.wonAmount * 100);
                            
                            // 防呆：如果計算出的金額 > 原本授權金額 (理論上不可能，除非邏輯錯)，則只收原授權額
                            // 這裡我們信任 wonAmount 是正確的，因為上面是逐個 slot 累加的
                            
                            if (amountToCaptureCents > 0) {
                                await stripe.paymentIntents.capture(res.paymentIntentId, {
                                    amount_to_capture: amountToCaptureCents
                                });
                                console.log(`💰 Captured $${res.wonAmount} for ${orderId}`);
                            } else {
                                // 如果贏了但金額是 0 (例如免費 slot?) -> 不做 capture，直接 release? 
                                // 正常邏輯不會到這裡，除非 bidPrice 都是 0
                                console.warn(`⚠️ Won slots but amount is 0 for ${orderId}`);
                            }
                        } catch (e) { 
                            console.error(`❌ Capture failed for ${orderId}:`, e);
                            // 如果 Capture 失敗 (例如已經 capture 過，或者授權過期)，可能需要人工介入
                            // 這裡我們 continue 跳過狀態更新，以免數據不一致
                            continue; 
                        }
                    }

                    const finalStatus = (res.winCount === res.totalSlots) ? 'won' : 'partially_won';

                    // 更新 DB 狀態
                    await orderRef.update({ 
                        status: finalStatus, 
                        amount: res.wonAmount, // 更新訂單總額為「實際成交額」
                        wonAt: admin.firestore.FieldValue.serverTimestamp(),
                        finalWinCount: res.winCount,
                        finalLostCount: res.loseCount,
                        // 我們也可以選擇更新 detailedSlots 的狀態，這裡暫時只更新大狀態
                    });

                    // 準備 Email 內容
                    let slotSummaryHtml = `
                        <b>✅ 成功競投 (Won):</b><br>${res.wonSlotsList.join('<br>')}<br><br>
                        ${res.loseCount > 0 ? `<b>❌ 未能中標 (Lost - 已退款):</b><br>${res.lostSlotsList.join('<br>')}` : ''}
                    `;
                    let screenNamesStr = Array.from(res.screenNames).join(', ');

                    // 根據狀態選擇 Template
                    const emailTemplate = finalStatus === 'partially_won' ? EMAIL_CFG.templates.PARTIAL_WIN : EMAIL_CFG.templates.WON_BID;

                    await sendEmail(emailTemplate, {
                        to_email: res.userEmail,
                        to_name: res.userName,
                        amount: res.wonAmount, // 顯示實際收費
                        order_id: orderId,
                        screen_names: screenNamesStr,
                        slot_summary: slotSummaryHtml,
                        order_link: "https://dooh-adv-pro.netlify.app" 
                    });
                }
            }
        }

        return { statusCode: 200, body: "Settlement V2 Done" };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: e.message };
    }
};

module.exports.handler = schedule('0 * * * *', settlementHandler);