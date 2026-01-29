import emailjs from '@emailjs/browser';

// 🔥 定義不同情境的 Template ID (來自你的截圖)
const TEMPLATE_IDS = {
  buyout: "template_99moneg",       // 你已購買 Buyout
  bid_submission: "template_biprpck", // 收到你的出價 (競投剛提交)
  bid_won: "template_3n90m3u",      // Congrats, 你已中標 (未來用)
  default: "template_99moneg",       // 預設 (以防萬一)
  video_approved: "template_409gjoj"
};

export const initEmailService = () => {
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  if (publicKey) {
    emailjs.init(publicKey);
    console.log("🔧 EmailJS Initialized");
  }
};

// 🔥 新增了 templateType 參數
export const sendBidConfirmation = async (user, orderData, templateType = 'buyout') => {
  console.log(`🚀 [EmailService] 準備發送類型: ${templateType}`);

  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  
  // 根據類型選擇 Template ID
  const selectedTemplateId = TEMPLATE_IDS[templateType] || TEMPLATE_IDS.default;

  if (!serviceId || !publicKey) {
    console.error("❌ EmailJS 環境變數缺失");
    return false;
  }

  const targetEmail = user?.email || orderData.userEmail;
  const targetName = user?.displayName || orderData.userName || "Customer";

  if (!targetEmail) {
    console.error("❌ 找不到收件人 Email");
    return false;
  }

  // 整合參數
  const templateParams = {
    to_name: targetName,
    to_email: targetEmail,
    order_id: orderData.id,
    amount: orderData.amount,
    // 如果是競價，顯示「出價金額」；如果是買斷，顯示「付款金額」
    price_label: templateType === 'bid_submission' ? '出價金額' : '付款金額',
    slot_summary: orderData.timeSlotSummary || 'Selected Slots',
    screen_names: orderData.screens ? orderData.screens.join(', ') : 'Selected Screens',
    order_link: `https://spectacular-profiterole-51f526.netlify.app/?order_id=${orderData.id}`,
  };

  try {
    const response = await emailjs.send(serviceId, selectedTemplateId, templateParams, publicKey);
    console.log(`✅ Email (${templateType}) Sent Successfully!`, response.status);
    return true;
  } catch (error) {
    console.error('❌ Email Send Failed:', error);
    return false;
  }
};

export const sendSystemEmail = async (data) => {
    return true; 
};