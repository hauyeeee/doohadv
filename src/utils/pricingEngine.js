// src/utils/pricingEngine.js

const DEFAULT_CONFIG = {
    baseImpressions: 10000,
    primeMultiplier: 3.5,     // 預設 Prime 倍率
    goldMultiplier: 1.8,
    weekendMultiplier: 1.5,
    bundleMultiplier: 1.25,
    urgentFee24h: 1.5,
    urgentFee1h: 2.0
};

export const calculateDynamicPrice = (dateObj, hour, isBundle, screenData, globalConfig = DEFAULT_CONFIG, specialRules = []) => {
    const now = new Date();
    
    // --- 0. 優先檢查：特別日子規則 (Special Rules) ---
   const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dayDate = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayDate}`; // "2026-02-01"
   console.log(`Matching Rule for: [${dateStr}] Hour: ${hour} Screen: ${screenData.id}`);
    const screenIdStr = String(screenData.id);

    const activeRule = specialRules.find(r => {
        const isDateMatch = r.date === dateStr;
        const isScreenMatch = r.screenId === 'all' || String(r.screenId) === screenIdStr;
        const isHourMatch = r.hours.includes(hour);
        return isDateMatch && isScreenMatch && isHourMatch;
    });

    // 如果是鎖定規則，直接回傳
    if (activeRule && activeRule.type === 'lock') {
        return {
            minBid: 0, buyoutPrice: 0, isBuyoutDisabled: true, canBid: false,
            warning: `🔒 ${activeRule.note || '管理員鎖定'}`, isLocked: true
        };
    }

    // --- 1. 決定配置 (Config Merge Logic) 🔥 核心修改 ---
    // 邏輯：使用 Global Config 作為基底，如果 Screen 有個別設定 (customPricing)，則覆蓋之
    const effectiveConfig = { 
        ...DEFAULT_CONFIG, 
        ...globalConfig, 
        ...(screenData.customPricing || {}) // 👈 這裡就是「每部機唔同」的關鍵
    };
    
    const day = dateObj.getDay(); 
    const dayKey = String(day);
    
    // 讀取屏幕時段規則
    const rules = screenData.tierRules || {};
    const todayRules = rules[dayKey] || rules["default"] || { prime: [], gold: [] };
    const primeHours = todayRules.prime || [];
    const goldHours = todayRules.gold || [];

    // --- 2. 決定 Base Price ---
    let basePrice = screenData.basePrice || 50;
    // 如果有特別日子覆蓋價錢
    if (activeRule && activeRule.type === 'price_override' && activeRule.value) {
        basePrice = activeRule.value;
    }

    // --- 3. 計算倍率 (使用 effectiveConfig) ---
    let mDay = 1.0;
    if (day === 5 || day === 6) mDay = effectiveConfig.weekendMultiplier;
    
    let mTime = 1.0; 
    let isPrime = false;
    
    if (primeHours.includes(hour)) {
        mTime = effectiveConfig.primeMultiplier; 
        isPrime = true;
    } else if (goldHours.includes(hour)) {
        mTime = effectiveConfig.goldMultiplier;
    } 

    const fSync = isBundle ? effectiveConfig.bundleMultiplier : 1.0;

    // --- 4. 計算基礎價格 ---
    let dynamicBase = Math.ceil(basePrice * mDay * mTime * fSync);
    
    // --- 5. 急單加乘 ---
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
        expeditedFeeRate = effectiveConfig.urgentFee1h - 1; 
        expeditedLabel = `⚡ 極速審批 (+${Math.round(expeditedFeeRate*100)}%)`;
        canBid = false; warning = "Risk: 審批不保證";
    } else if (hoursUntil < 24) {
        expeditedFeeRate = effectiveConfig.urgentFee24h - 1; 
        expeditedLabel = `🚀 加急 (+${Math.round(expeditedFeeRate*100)}%)`;
        canBid = false; 
    }

    const finalMinBid = Math.ceil(dynamicBase * (1 + expeditedFeeRate));
    let buyoutPrice = Math.ceil(finalMinBid * 3); 
    
    // --- 6. Buyout 限制 ---
    let isBuyoutDisabled = isPrime || (activeRule && activeRule.type === 'disable_buyout');

    return {
        minBid: finalMinBid,
        buyoutPrice,
        isBuyoutDisabled,
        isPrime,
        expeditedLabel,
        canBid,
        warning,
        hoursUntil,
        ruleApplied: activeRule ? activeRule.note : null
    };
};