import emailjs from '@emailjs/browser';

// 初始化 EmailJS
export const initEmailService = () => {
  emailjs.init("YOUR_PUBLIC_KEY"); // 🔥 請確保這裡填入你的 Public Key
};

// 定義 Template IDs (根據你的截圖)
const TEMPLATES = {
  BID_RECEIVED: "template_biprpck",      // 收到你的出價
  BUYOUT_SUCCESS: "template_99moneg",    // 你已成功「買斷」
  BID_WON: "template_3n90m3u",           // Congrats, 你已中標
  BID_LOST: "template_1v8p3y8",          // Bid Lost / 競投失敗
  OUTBID_BY_BUYOUT: "template_9vthu4n",  // 抱歉，你的時段已被買斷
  VIDEO_APPROVED: "template_409gjoj"     // Video Approved / 影片審核通過
};

const SERVICE_ID = "YOUR_SERVICE_ID"; // 🔥 請確保這裡填入你的 Service ID

// 通用發送函數
const sendEmail = async (templateId, params) => {
  try {
    const response = await emailjs.send(SERVICE_ID, templateId, params);
    console.log(`✅ Email sent successfully: ${templateId}`, response);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email (${templateId}):`, error);
    return false;
  }
};

// 1. 收到出價 (Bid Received)
export const sendBidReceivedEmail = async (user, orderData) => {
  return sendEmail(TEMPLATES.BID_RECEIVED, {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: orderData.id,
    bid_amount: orderData.amount,
    slot_summary: orderData.timeSlotSummary, // e.g. "2026-02-14 18:00 @ Screen A"
    message: "我們已收到你的出價。系統將於時段開始前進行結算。"
  });
};

// 2. 買斷成功 (Buyout Success)
export const sendBuyoutSuccessEmail = async (user, orderData) => {
  return sendEmail(TEMPLATES.BUYOUT_SUCCESS, {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: orderData.id,
    amount: orderData.amount,
    slot_summary: orderData.timeSlotSummary,
    message: "恭喜！你已成功買斷所選時段。請盡快上傳廣告素材。"
  });
};

// 3. 中標通知 (Bid Won) - 通常由 Admin 後台觸發或系統自動結算
export const sendBidWonEmail = async (user, orderData) => {
  return sendEmail(TEMPLATES.BID_WON, {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: orderData.id,
    slot_summary: orderData.timeSlotSummary,
    message: "恭喜！你的競價已勝出。請前往訂單頁面上傳影片。"
  });
};

// 4. 競投失敗 (Bid Lost) - 通常由 Admin 後台觸發或系統自動結算
export const sendBidLostEmail = async (user, orderData) => {
  return sendEmail(TEMPLATES.BID_LOST, {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: orderData.id,
    slot_summary: orderData.timeSlotSummary,
    message: "很遺憾，你的出價未能中標。歡迎嘗試競投其他時段。"
  });
};

// 5. 被買斷通知 (Outbid by Buyout) - 🔥 這是你要的 Scenario
export const sendOutbidByBuyoutEmail = async (loserEmail, loserName, slotInfo) => {
  return sendEmail(TEMPLATES.OUTBID_BY_BUYOUT, {
    to_name: loserName || 'Customer',
    to_email: loserEmail,
    slot_info: slotInfo, // e.g. "2026-02-14 18:00"
    message: "抱歉通知你，該時段已被其他客戶直接買斷。你的競價已被取消。"
  });
};

// 6. 影片審核通過 (Video Approved) - 由 Admin 觸發
export const sendVideoApprovedEmail = async (user, orderData) => {
  return sendEmail(TEMPLATES.VIDEO_APPROVED, {
    to_name: user.displayName || 'Customer',
    to_email: user.email,
    order_id: orderData.id,
    video_name: orderData.videoName,
    message: "你的影片已通過審核，將按排程播放。"
  });
};

// 舊函數兼容 (你可以保留或慢慢替換)
export const sendBidConfirmation = async (user, data, type) => {
    if (type === 'bid_submission') return sendBidReceivedEmail(user, data);
    if (type === 'buyout') return sendBuyoutSuccessEmail(user, data);
    if (type === 'video_approved') return sendVideoApprovedEmail(user, data);
    return false;
};