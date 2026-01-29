const admin = require('firebase-admin');

// ⚠️ 安全警告：這個檔案包含了 Service Account Key，千萬不要上傳到 GitHub 公開 Repository
// 建議使用環境變數或將此檔案加入 .gitignore
const serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ⚖️ 校正倍率：必須與 frontend/src/utils/pricingEngine.js 保持一致
const getTimeMultiplier = (hour) => {
    // Prime Hours (18:00 - 23:00)
    if (hour >= 18 && hour < 23) return 3.5; 
    
    // Gold Hours (12:00 - 14:00)
    if (hour >= 12 && hour < 14) return 1.8;
    
    // Late Night (00:00 - 07:00)
    if (hour >= 0 && hour < 7) return 0.5;
    
    // Normal Hours
    return 1.0;
};

const getDayMultiplier = (day) => {
    // 週末 (Fri, Sat) 加乘
    if (day === 5 || day === 6) return 1.5; // Engine 也是 1.5x
    return 1.0;
};

async function initData() {
  console.log("🚀 連接 Database 讀取真實屏幕資料...");
  const screensSnapshot = await db.collection('screens').get();

  if (screensSnapshot.empty) {
      console.log("❌ 找不到任何屏幕資料！");
      return;
  }

  console.log(`✅ 找到 ${screensSnapshot.size} 個真實屏幕，開始生成數據...`);

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const doc of screensSnapshot.docs) {
      const screen = doc.data();
      const screenId = screen.id; 
      const basePrice = parseInt(screen.basePrice) || 100; 
      const screenName = screen.location || screen.name || 'Unknown';
      console.log(`Processing: [ID: ${screenId}] ${screenName} ($${basePrice})...`);

      for (let day = 0; day <= 6; day++) {
        for (let hour = 0; hour < 24; hour++) {
          
          const docId = `${screenId}_${day}_${hour}`;
          const docRef = db.collection('market_stats').doc(docId);

          const timeMult = getTimeMultiplier(hour);
          const dayMult = getDayMultiplier(day);
          
          // 模擬稍微波動的市場價 (Base Price * Multipliers * Random Factor 1.0~1.3)
          const randomFactor = 1.0 + (Math.random() * 0.3);
          const simulatedPrice = Math.ceil(basePrice * timeMult * dayMult * randomFactor);
          
          batch.set(docRef, {
            screenId: screenId,
            dayOfWeek: day,
            hour: hour,
            totalBids: Math.floor(Math.random() * 20), // 隨機生成 0-20 次出價
            totalAmount: 0, 
            averagePrice: simulatedPrice,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });

          count++;
          batchCount++;

          if (batchCount >= 450) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
              process.stdout.write("."); 
          }
        }
      }
  }

  if (batchCount > 0) {
      await batch.commit();
  }

  console.log(`\n✅ 完成！成功建立了 ${count} 條統計數據。`);
}

initData().catch(console.error);