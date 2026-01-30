// src/utils/pricingEngine.js

const DEFAULT_CONFIG = {
    baseImpressions: 10000,
    primeMultiplier: 3.5,
    goldMultiplier: 1.8,
    weekendMultiplier: 1.5,
    bundleMultiplier: 1.25,
    urgentFee24h: 1.5,
    urgentFee1h: 2.0
};

/**
 * 計算動態價格
 * @param {Date} dateObj - 目標日期
 * @param {number} hour - 目標小時 (0-23)
 * @param {boolean} isBundle - 是否聯播
 * @param {object} screenData - 屏幕資料 (包含 basePrice)
 * @param {object} config - (New) 從 Admin Panel 設定的 system_config
 * @param {array} specialRules - (New) 從 Admin Panel 設定的 special_rules
 */
export const calculateDynamicPrice = (dateObj, hour, isBundle, screenData, config = DEFAULT_CONFIG, specialRules = []) => {
    const now = new Date();
    
    // --- 0. 優先檢查：特別日子規則 (Special Rules) ---
    // 格式化日期為 YYYY-MM-DD 以便比對
    const dateStr = dateObj.toISOString().split('T')[0];
    const screenIdStr = String(screenData.id);

    // 搜尋是否有符合的規則 (符合日期 + 符合時段 + 符合屏幕ID或Global)
    const activeRule = specialRules.find(r => {
        const isDateMatch = r.date === dateStr;
        const isScreenMatch = r.screenId === 'all' || String(r.screenId) === screenIdStr;
        const isHourMatch = r.hours.includes(hour);
        return isDateMatch && isScreenMatch && isHourMatch;
    });

    // 如果有 "Lock" 規則，直接回傳不可用
    if (activeRule && activeRule.type === 'lock') {
        return {
            minBid: 0,
            buyoutPrice: 0,
            isBuyoutDisabled: true,
            canBid: false,
            warning: `🔒 ${activeRule.note || '管理員鎖定'}`,
            isLocked: true
        };
    }

    // --- 1. 基礎參數 ---
    // 如果 Admin 有設定 config 就用 config，否則用預設
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    const day = dateObj.getDay(); // 0-6
    const dayKey = String(day);
    
    // 讀取屏幕本身的時段規則
    const rules = screenData.tierRules || {};
    const todayRules = rules[dayKey] || rules["default"] || { prime: [], gold: [] };
    const primeHours = todayRules.prime || [];
    const goldHours = todayRules.gold || [];

    // --- 2. 決定 Base Price ---
    // 如果有 "Price Override" 規則，使用規則價；否則使用屏幕原價
    let basePrice = screenData.basePrice || 50;
    if (activeRule && activeRule.type === 'price_override' && activeRule.value) {
        basePrice = activeRule.value;
    }

    // --- 3. 計算倍率 (Multipliers) ---
    let mDay = 1.0;
    if (day === 5 || day === 6) mDay = cfg.weekendMultiplier; // 使用 Config 的週末倍率
    
    let mTime = 1.0; 
    let isPrime = false;
    
    if (primeHours.includes(hour)) {
        mTime = cfg.primeMultiplier; // 使用 Config
        isPrime = true;
    } else if (goldHours.includes(hour)) {
        mTime = cfg.goldMultiplier; // 使用 Config
    } 

    // 聯播倍率
    const fSync = isBundle ? cfg.bundleMultiplier : 1.0; // 使用 Config

    // --- 4. 計算基礎價格 ---
    // 公式: 底價 * 日期倍率 * 時段倍率 * 聯播倍率
    let dynamicBase = Math.ceil(basePrice * mDay * mTime * fSync);
    
    // --- 5. 急單加乘 (Expedited Fee) ---
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
        expeditedFeeRate = cfg.urgentFee1h - 1; // e.g. 2.0x means +100%
        expeditedLabel = `⚡ 極速審批 (+${Math.round(expeditedFeeRate*100)}%)`;
        canBid = false; 
        warning = "Risk: 審批不保證";
    } else if (hoursUntil < 24) {
        expeditedFeeRate = cfg.urgentFee24h - 1; // e.g. 1.5x means +50%
        expeditedLabel = `🚀 加急 (+${Math.round(expeditedFeeRate*100)}%)`;
        canBid = false; 
    }

    // 最終價格計算
    const finalMinBid = Math.ceil(dynamicBase * (1 + expeditedFeeRate));
    let buyoutPrice = Math.ceil(finalMinBid * 3); // Buyout 默認 3 倍，可考慮也放入 Config
    
    // --- 6. Buyout 限制 ---
    let isBuyoutDisabled = false;
    
    // 條件 A: Prime 時段禁止 Buyout
    if (isPrime) isBuyoutDisabled = true;
    
    // 條件 B: 特別規則禁止 Buyout
    if (activeRule && activeRule.type === 'disable_buyout') isBuyoutDisabled = true;

    return {
        minBid: finalMinBid,
        buyoutPrice,
        isBuyoutDisabled,
        isPrime,
        expeditedLabel,
        canBid,
        warning,
        hoursUntil,
        ruleApplied: activeRule ? activeRule.note : null // 讓前端知道是否套用了特別規則
    };
};