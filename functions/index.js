const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { OpenAI } = require("openai");

admin.initializeApp();

// 監聽 orders 資料庫，當有單據被「更新」時觸發
exports.aiAdReview = onDocumentUpdated("orders/{orderId}", async (event) => {
  
  // 初始化 OpenAI
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const orderId = event.params.orderId;

  // 觸發條件：只有當 creativeStatus 剛剛變成 'pending_review'，並且有 videoUrl 時先開工
  if (afterData.creativeStatus !== "pending_review" || beforeData.creativeStatus === "pending_review" || !afterData.videoUrl) {
    return null; 
  }

  const fileUrl = afterData.videoUrl.toLowerCase();

  // 🎬 第一關：檢查係咪影片 (根據副檔名或常見影片格式)
  const isVideo = fileUrl.includes(".mp4") || fileUrl.includes(".mov") || fileUrl.includes(".webm");

  if (isVideo) {
    console.log(`訂單 ${orderId} 包含影片檔案，已轉交人工審批。`);
    return event.data.after.ref.update({
      creativeStatus: "manual_review", // 轉為人工審批狀態 (你可以喺 Admin Panel 加個 Filter 睇呢個 Status)
      aiReviewResult: "系統偵測到影片檔案，已自動轉交人工審批 🎬",
      aiReviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 🖼️ 第二關：確定係圖片，交畀 GPT-4o 審查
  try {
    console.log(`開始審查圖片訂單: ${orderId}, URL: ${fileUrl}`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `你現在是一位嚴格的香港戶外廣告審查員。請檢查這張圖片是否有以下違規情況：
              1. 裸露或色情內容
              2. 暴力或血腥
              3. 粗言穢語 (包括香港俗語及諧音)
              4. 敏感政治標語或圖像
              
              請嚴格以 JSON 格式回覆，不要包含其他廢話。格式如下：
              {"decision": "APPROVE", "reason": "圖片安全無違規事項"} 
              或 
              {"decision": "REJECT", "reason": "包含不雅字眼"} 
              或 
              {"decision": "MANUAL_REVIEW", "reason": "建議人工覆核"}`
            },
            {
              type: "image_url",
              image_url: { url: fileUrl } 
            }
          ]
        }
      ],
      max_tokens: 300,
      response_format: { type: "json_object" } 
    });

    const aiResult = JSON.parse(response.choices[0].message.content);
    console.log(`AI 判決結果:`, aiResult);

    let newStatus = "pending_review";

    if (aiResult.decision === "APPROVE") {
      newStatus = "approved"; // 🚀 綠燈
    } else if (aiResult.decision === "REJECT") {
      newStatus = "rejected"; // 🛑 紅燈
    } else if (aiResult.decision === "MANUAL_REVIEW") {
      newStatus = "manual_review"; // 🟡 踩界圖，AI 覺得要你親自睇
    }

    // 更新 Firestore 數據庫
    return event.data.after.ref.update({
      creativeStatus: newStatus,
      aiReviewResult: aiResult.reason,       
      aiReviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error("AI 審查過程中發生錯誤:", error);
    return event.data.after.ref.update({
      creativeStatus: "manual_review", // 發生錯誤都安全起見彈畀你批
      aiReviewResult: "AI 系統繁忙或無法分析此檔案，需人工審批 ⚠️",
      aiReviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});