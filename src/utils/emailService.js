import emailjs from '@emailjs/browser';

// 請確保這些環境變數已在 .env 文件中設定
const SERVICE_ID = "service_euz8rzz"; 
const PUBLIC_KEY = "zTr4nyY_nusfPcNZU";   

// 初始化 EmailJS
export const initEmailService = () => {
  emailjs.init(PUBLIC_KEY);
};

// 通用發送函數
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
 * 收到出價 (Bid Received)
 * ID: template_biprpck
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
  return sendEmail("template_biprpck", params);
};

/**
 * 買斷成功 (Buyout Success)
 * ID: template_99moneg
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
  return sendEmail("template_99moneg", params);
};

// ============================================================
// 2. 競爭與被踢 (Outbid / Conflicts) - 發生在競價期間
// ============================================================

/**
 * 出價被超越 (Outbid Alert) - 標準競價被高價壓過
 * ID: template_34bea2p
 */
export const sendStandardOutbidEmail = async (userEmail, userName, slotInfo, currentPrice) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    slot_info: slotInfo,
    new_price: currentPrice
  };
  return sendEmail("template_34bea2p", params);
};

/**
 * 被買斷踢走 (Outbid by Buyout) - 全單失效
 * ID: template_9vthu4n
 */
export const sendOutbidByBuyoutEmail = async (userEmail, userName, slotInfo) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    slot_info: slotInfo
  };
  return sendEmail("template_9vthu4n", params);
};

/**
 * 訂單狀態更新 (Order Update) - 部分時段失效 (Partial Outbid)
 * ID: template_f4h2lls
 */
export const sendPartialOutbidEmail = async (userEmail, userName, lostSlotsInfo) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    slot_info: lostSlotsInfo
  };
  return sendEmail("template_f4h2lls", params);
};

// ============================================================
// 3. 結果通知 (Result Notification) - 發生在結算時
// ============================================================

/**
 * 恭喜中標 (Bid Won) - 全贏
 * ID: template_3n90m3u
 */
export const sendBidWonEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id,
    amount: order.amount,
    final_slots: order.timeSlotSummary
  };
  return sendEmail("template_3n90m3u", params);
};

/**
 * 🔥 部分中標 (Partial Win) - 贏一半 🔥
 * ID: template_vphbdyp (新開的 Template)
 */
export const sendPartialWinEmail = async (userEmail, userName, orderId, wonAmount, slotSummary) => {
  const params = {
    to_name: userName || 'Customer',
    to_email: userEmail,
    order_id: orderId,
    amount: wonAmount,
    slot_summary: slotSummary, // HTML 格式列表 (Win/Lost)
    message: "部分時段競投成功。未能中標的時段款項將自動退還至您的信用卡。"
  };
  return sendEmail("template_vphbdyp", params);
};

/**
 * 競投失敗 (Bid Lost) - 全輸
 * ID: template_1v8p3y8
 */
export const sendBidLostEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id
  };
  return sendEmail("template_1v8p3y8", params);
};

// ============================================================
// 4. 影片審核 (Video Review)
// ============================================================

/**
 * 影片審核通過 (Video Approved)
 * ID: template_409gjoj
 */
export const sendVideoApprovedEmail = async (user, order) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id,
    order_id_short: order.id.slice(0, 8)
  };
  return sendEmail("template_409gjoj", params);
};

/**
 * 需要行動 (Action Required) - 影片被拒
 * ID: template_waqdg9v
 */
export const sendVideoRejectedEmail = async (user, order, reason) => {
  const params = {
    to_name: user.displayName || 'Customer',
    to_email: user.email || user.userEmail,
    order_id: order.id,
    order_id_short: order.id.slice(0, 8),
    reject_reason: reason || "Content policy violation"
  };
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