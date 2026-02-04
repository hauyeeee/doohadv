import emailjs from '@emailjs/browser';

// 請確保這些環境變數已在 .env 文件中設定，或直接在此處替換字串
const SERVICE_ID = "service_xxxxxxxx"; // 你的 EmailJS Service ID
const PUBLIC_KEY = "xxxxxxxxxxxxxx";   // 你的 EmailJS Public Key

// 初始化 EmailJS
export const initEmailService = () => {
  emailjs.init(PUBLIC_KEY);
};

// 通用發送函數 (內部使用)
const sendEmail = async (templateId, templateParams) => {
  try {
    const response = await emailjs.send(SERVICE_ID, templateId, templateParams);
    console.log(`📧 Email sent successfully (${templateId})`, response.status, response.text);
    return response;
  } catch (error) {
    console.error(`❌ Failed to send email (${templateId})`, error);
    return null;
  }
};

// ============================================================
// 1. 下單相關 (Order Placement)
// ============================================================

/**
 * 當用戶成功提交競價 (Bid) 時發送
 * Template: 收到你的出價 (Bid Received)
 */
export const sendBidReceivedEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: order.id,
    amount: order.amount,
    slot_summary: order.timeSlotSummary || 'Selected Slots',
    order_date: new Date().toLocaleDateString('zh-HK')
  };
  // Template ID: template_biprpck
  return sendEmail("template_biprpck", params);
};

/**
 * 當用戶成功買斷 (Buyout) 時發送
 * Template: 你已成功「買斷 (Buyout)」所選的廣告時段
 */
export const sendBuyoutSuccessEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: order.id,
    amount: order.amount,
    slot_summary: order.timeSlotSummary || 'Buyout Slots',
    order_date: new Date().toLocaleDateString('zh-HK')
  };
  // Template ID: template_99moneg
  return sendEmail("template_99moneg", params);
};

// ============================================================
// 2. 競爭與被踢 (Outbid / Conflicts)
// ============================================================

/**
 * 當用戶出價被其他人「更高價」超越時發送 (叫佢加價)
 * Template: ⚠️ Outbid Alert / 出價被超越
 */
export const sendStandardOutbidEmail = async (userEmail, userName, slotInfo, currentPrice) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    slot_info: slotInfo, // 例如: "2024-02-05 18:00 @ Screen A"
    new_price: currentPrice // 現時最高價
  };
  // Template ID: template_34bea2p
  return sendEmail("template_34bea2p", params);
};

/**
 * 當用戶的時段被其他人「買斷 (Buyout)」踢走時發送 (無得救)
 * Template: 抱歉，你的時段已被買斷 (Outbid by Buyout)
 */
export const sendOutbidByBuyoutEmail = async (userEmail, userName, slotInfo) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    slot_info: slotInfo // 被買斷的時段詳情
  };
  // Template ID: template_9vthu4n
  return sendEmail("template_9vthu4n", params);
};

/**
 * 當 Bundle 訂單中，只有部分屏幕被踢走，其餘仍在競價
 * Template: ⚠️ Order Update / 訂單狀態更新
 */
export const sendPartialOutbidEmail = async (userEmail, userName, lostSlotsInfo) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    slot_info: lostSlotsInfo // 列出哪些時段失效了
  };
  // Template ID: template_f4h2lls
  return sendEmail("template_f4h2lls", params);
};

// ============================================================
// 3. 結果通知 (Result Notification)
// ============================================================

/**
 * 競價成功 (贏左)
 * Template: Congrats, 你已中標 (Bid Won)
 */
export const sendBidWonEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id,
    amount: order.amount,
    final_slots: order.timeSlotSummary
  };
  // Template ID: template_3n90m3u
  return sendEmail("template_3n90m3u", params);
};

/**
 * 競價失敗 (輸左)
 * Template: Bid Lost / 競投失敗 (未中標)
 */
export const sendBidLostEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id
  };
  // Template ID: template_1v8p3y8
  return sendEmail("template_1v8p3y8", params);
};

// ============================================================
// 4. 影片審核 (Video Review)
// ============================================================

/**
 * 影片審核通過
 * Template: Video Approved / 影片審核通過
 */
export const sendVideoApprovedEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id,
    order_id_short: order.id.slice(0, 8)
  };
  // Template ID: template_409gjoj
  return sendEmail("template_409gjoj", params);
};

/**
 * 影片審核被拒 (需要行動)
 * Template: 🚫 Action Required / 需要行動
 */
export const sendVideoRejectedEmail = async (user, order, reason) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id,
    order_id_short: order.id.slice(0, 8),
    reject_reason: reason || "Content policy violation"
  };
  // Template ID: template_waqdg9v
  return sendEmail("template_waqdg9v", params);
};

// 統一導出接口 (方便 AdminPanel 調用)
export const sendBidConfirmation = async (user, order, type, extraData = null) => {
    switch (type) {
        case 'bid_received': return sendBidReceivedEmail(user, order);
        case 'buyout_success': return sendBuyoutSuccessEmail(user, order);
        case 'bid_won': return sendBidWonEmail(user, order);
        case 'bid_lost': return sendBidLostEmail(user, order);
        case 'video_approved': return sendVideoApprovedEmail(user, order);
        case 'video_rejected': return sendVideoRejectedEmail(user, order, extraData);
        default: console.warn("Unknown email type:", type);
    }
};