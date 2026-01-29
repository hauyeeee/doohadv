// src/utils/pricingEngine.js

const BASE_IMPRESSIONS = 10000; 

export const calculateDynamicPrice = (dateObj, hour, isBundle, screenData) => {
    const day = dateObj.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const dayKey = String(day);   // 轉成字串 "0", "1"... 用來查 Firebase Map
    const now = new Date();
    
    // 1. 讀取該屏幕的規則
    // 優先讀取「當天」的規則 (例如 "5")，如果沒有，就讀 "default"
    const rules = screenData.tierRules || {};
    const todayRules = rules[dayKey] || rules["default"] || { prime: [], gold: [] };

    const primeHours = todayRules.prime || [];
    const goldHours = todayRules.gold || [];

    const basePrice = screenData.basePrice || 50;

    // 2. 日期加乘 (五六還是貴一點，作為 Base 係數)
    let mDay = 1.0;
    if (day === 5 || day === 6) mDay = 1.5; // 週末 Base 貴 1.5 倍
    
    // 3. 時間加乘 (根據 Database 規則)
    let mTime = 1.0; 
    let isPrime = false;
    
    if (primeHours.includes(hour)) {
        mTime = 3.5; // Prime = 3.5x
        isPrime = true;
    } else if (goldHours.includes(hour)) {
        mTime = 1.8; // Gold = 1.8x
    } 
    // Normal = 1.0x

    // 🔥 智能聯播溢價
    const fSync = isBundle ? 1.25 : 1.0;

    // 計算基礎價格
    let dynamicBase = Math.ceil(basePrice * mDay * mTime * fSync);
    
    // 4. 急單加乘 (Expedited Fee)
    const slotTime = new Date(dateObj);
    slotTime.setHours(hour, 0, 0, 0);
    const timeDiffMs = slotTime.getTime() - now.getTime();
    const hoursUntil = timeDiffMs / (1000 * 60 * 60);
    
    let expeditedFeeRate = 0;
    let expeditedLabel = null;
    let canBid = true;
    let warning = null;

    if (hoursUntil < 0) {
        canBid = false; warning = "Expired";
    } else if (hoursUntil < 1) {
        expeditedFeeRate = 1.0; expeditedLabel = '⚡ 極速審批 (+100%)';
        canBid = false; warning = "Risk: 審批不保證";
    } else if (hoursUntil < 24) {
        expeditedFeeRate = 0.5; expeditedLabel = '🚀 加急 (+50%)';
        canBid = false; 
    }

    const finalMinBid = Math.ceil(dynamicBase * (1 + expeditedFeeRate));
    let buyoutPrice = Math.ceil(finalMinBid * 3);
    
    // 5. 買斷限制：只要是 Prime 時段，任何日子都禁止買斷 (保護利潤)
    let isBuyoutDisabled = false;
    if (isPrime) {
        isBuyoutDisabled = true;
    }

    const estimatedImpressions = Math.floor(BASE_IMPRESSIONS * mDay * mTime * (isBundle ? 4 : 1));

    return {
        minBid: finalMinBid,
        buyoutPrice,
        isBuyoutDisabled,
        isPrime,
        expeditedLabel,
        canBid,
        warning,
        hoursUntil
    };
};