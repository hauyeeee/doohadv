const admin = require("firebase-admin");
const serviceAccount = require("./service-account-key.json"); // 確保指啱你頭先 download 嗰個 JSON file

// 1. 初始化 Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. 準備 Payload
const peakGalleriaScreens = [
  { id: "peak_lg_zhongtea_22", name: "鍾茶館 22吋", location: "山頂廣場 LG地庫 鍾茶館", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 50, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" },
  { id: "peak_lg_momentsnack_a", name: "片刻時光零食店 22吋 (A機)", location: "山頂廣場 LG地庫 片刻時光零食店", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 50, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" },
  { id: "peak_lg_momentsnack_b", name: "片刻時光零食店 22吋 (B機)", location: "山頂廣場 LG地庫 片刻時光零食店", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 50, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" },
  { id: "peak_lg_tanghulu", name: "冰糖葫蘆 22吋", location: "山頂廣場 LG地庫 冰糖葫蘆", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 50, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" },
  { id: "peak_l2_momentclaw_a", name: "片刻時光夾公仔店 22吋 (A機)", location: "山頂廣場 2樓 片刻時光夾公仔店", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 60, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" },
  { id: "peak_l2_momentclaw_b", name: "片刻時光夾公仔店 22吋 (B機)", location: "山頂廣場 2樓 片刻時光夾公仔店", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 60, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" },
  { id: "peak_l2_momentclaw_c", name: "片刻時光夾公仔店 22吋 (C機)", location: "山頂廣場 2樓 片刻時光夾公仔店", district: "The Peak", bundleGroup: "peak_galleria", merchantEmail: "", basePrice: 60, specifications: "22吋 高清直屏 (1080x1920px)", size: "22\"", orientation: "Vertical", lat: "22.2714", lng: "114.1498" }
];

const defaultTierRules = {
  0: { prime: [14, 15, 16, 17, 18, 19, 20], gold: [11, 12, 13, 21] }, 
  1: { prime: [16, 17, 18, 19], gold: [12, 13, 14, 15, 20] },         
  2: { prime: [16, 17, 18, 19], gold: [12, 13, 14, 15, 20] },         
  3: { prime: [16, 17, 18, 19], gold: [12, 13, 14, 15, 20] },         
  4: { prime: [16, 17, 18, 19], gold: [12, 13, 14, 15, 20] },         
  5: { prime: [16, 17, 18, 19], gold: [12, 13, 14, 15, 20] },         
  6: { prime: [14, 15, 16, 17, 18, 19, 20], gold: [11, 12, 13, 21] }  
};

// 3. 執行 Batch Write
async function seedData() {
  const batch = db.batch();

  peakGalleriaScreens.forEach(screen => {
    const screenData = {
      ...screen,
      tierRules: defaultTierRules,
      images: [],
      isActive: true,
      // Admin SDK 要用 FieldValue.serverTimestamp()
      createdAt: admin.firestore.FieldValue.serverTimestamp() 
    };
    
    // 指定 Collection 同 Doc ID
    const screenRef = db.collection('screens').doc(screen.id);
    batch.set(screenRef, screenData, { merge: true }); // Merge: true 確保安全覆寫
  });

  try {
    await batch.commit();
    console.log("✅ 搞掂！7 部山頂廣場屏幕已成功加入 Database！");
    process.exit(0);
  } catch (error) {
    console.error("❌ 寫入失敗: ", error);
    process.exit(1);
  }
}

seedData();