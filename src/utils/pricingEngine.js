const DEFAULT_CONFIG = {
    baseImpressions: 10000,
    primeMultiplier: 3.5,     
    goldMultiplier: 1.8,
    weekendMultiplier: 1.5,
    bundleMultiplier: 1.25,
    urgentFee24h: 1.5,
    urgentFee1h: 2.0
};

export const calculateDynamicPrice = (dateObj, hour, activeBundleMultiplier = 1.0, screenData, globalConfig = DEFAULT_CONFIG, specialRules = []) => {
    const now = new Date();
    
    // --- 0. Check Special Rules ---
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dayDate = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayDate}`; 
    const screenIdStr = String(screenData.id);

    const activeRule = specialRules.find(r => {
        const isDateMatch = r.date === dateStr;
        const isScreenMatch = r.screenId === 'all' || String(r.screenId) === screenIdStr;
        const isHourMatch = r.hours.includes(hour);
        return isDateMatch && isScreenMatch && isHourMatch;
    });

    if (activeRule && activeRule.type === 'lock') {
        return {
            minBid: 0, buyoutPrice: 0, isBuyoutDisabled: true, canBid: false,
            warning: `🔒 ${activeRule.note || '管理員鎖定'}`, isLocked: true
        };
    }

    // --- 1. Config Merge ---
    const effectiveConfig = { 
        ...DEFAULT_CONFIG, 
        ...globalConfig, 
        ...(screenData.customPricing || {}) 
    };
    
    const day = dateObj.getDay(); 
    const dayKey = String(day);
    
    const rules = screenData.tierRules || {};
    const todayRules = rules[dayKey] || rules["default"] || { prime: [], gold: [] };
    const primeHours = todayRules.prime || [];
    const goldHours = todayRules.gold || [];

    // --- 2. Base Price ---
    let basePrice = screenData.basePrice || 50;
    if (activeRule && activeRule.type === 'price_override' && activeRule.value) {
        basePrice = activeRule.value;
    }

    // --- 3. Multipliers ---
    let mDay = 1.0;
    if (day === 5 || day === 6) mDay = effectiveConfig.weekendMultiplier;
    
    let mTime = 1.0; 
    let isPrime = false;
    let isGold = false; 
    
    if (primeHours.includes(hour)) {
        mTime = effectiveConfig.primeMultiplier; 
        isPrime = true;
    } else if (goldHours.includes(hour)) {
        mTime = effectiveConfig.goldMultiplier;
        isGold = true;
    } 

    const fSync = activeBundleMultiplier; 

    // --- 4. Calculate Base Dynamic Price ---
    let dynamicBase = Math.ceil(basePrice * mDay * mTime * fSync);
    
    // --- 5. Time Constraints & Fees ---
    const slotTime = new Date(dateObj);
    slotTime.setHours(hour, 0, 0, 0);
    
    const timeDiffMs = slotTime.getTime() - now.getTime();
    const hoursUntil = timeDiffMs / (1000 * 60 * 60);
    const daysUntil = hoursUntil / 24;

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
    } else if (daysUntil > 7) {
        // 🔥🔥🔥 FIX 2: 顯示具體開放日期 (7日前) 🔥🔥🔥
        canBid = false; 
        const openDate = new Date(slotTime);
        openDate.setDate(openDate.getDate() - 7);
        const openDateStr = openDate.toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric' });
        warning = `🔒 遠期 (競價將於 ${openDateStr} 開放)`;
    }

    const finalMinBid = Math.ceil(dynamicBase * (1 + expeditedFeeRate));

    // --- 6. Buyout Logic ---
    let buyoutMultiplier = 3.0; 
    if (isPrime) buyoutMultiplier = 5.0;
    else if (isGold) buyoutMultiplier = 4.0;

    let originalBuyout = Math.ceil(finalMinBid * buyoutMultiplier);

    if (activeRule && activeRule.type === 'buyout_override' && activeRule.value) {
        originalBuyout = activeRule.value;
    }

    let isBuyoutDisabled = (activeRule && activeRule.type === 'disable_buyout');

    return {
        minBid: finalMinBid,
        buyoutPrice: originalBuyout,
        isBuyoutDisabled,
        isPrime,
        isGold, 
        expeditedLabel,
        canBid,
        warning,
        hoursUntil,
        ruleApplied: activeRule ? activeRule.note : null
    };
};