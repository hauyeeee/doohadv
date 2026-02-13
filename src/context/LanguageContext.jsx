import React, { createContext, useState, useContext } from 'react';

// 🔥 1. 這是你原本的翻譯內容 (我幫你整合了截圖中的新內容進去)
const translations = {
  zh: {
    // ============================================
    //  通用 (Common)
    // ============================================
    loading: "載入中...",
    confirm: "確認",
    cancel: "取消",
    submit: "提交",
    save: "儲存",
    delete: "刪除",
    edit: "編輯",
    add: "新增",
    search: "搜尋",
    close: "關閉",
    back_home: "返回前台",
    logout: "登出",
    login: "登入 / 註冊",
    my_orders: "我的訂單",

    // ============================================
    //  前台 (Client Side)
    // ============================================
    
    // --- Header & Hero ---
    play_guide: "玩法說明",
    ad_platform: "自助廣告交易平台",
    
    // 🔥 整合截圖新內容
    hero_badge: "LIVE AD EXCHANGE V5.0",
    hero_title_prefix: "自己廣告，",
    hero_title_highlight: "自己投。",
    hero_subtitle: "全港地標屏幕，由你掌控。無需經 Agency，價格透明，即時上架。",
    start_bidding: "立即開始競投",
    
    // --- Selling Points (Hero Cards) ---
    feature_1_title: "低門檻",
    feature_1_desc: "HK$50 起 登上城市地標。小預算也能做大廣告。",
    feature_2_title: "高彈性",
    feature_2_desc: "按小時購買時段。隨時 Bid，隨時播。",
    feature_3_title: "全掌控",
    feature_3_desc: "手機一按，全港聯播。成效數據一目了然。",

    // --- InfoBox (玩法說明) ---
    infobox_title: "玩法說明 HOW IT WORKS",
    mode_bid_title: "競價投標 (Bidding)",
    mode_bid_point_1: "價高者得：自由出價，適合預算有限或爭奪黃金時段。",
    mode_bid_point_2: "限制：僅開放予 24小時 至 7天 內的時段。",
    mode_bid_point_3: "預授權機制：提交時只凍結額度 (Pre-auth)，不即時扣款。",
    
    mode_buyout_title: "直接買斷 (Buyout)",
    mode_buyout_point_1: "即時鎖定：付出一口價，立即確保獲得該時段。",
    mode_buyout_point_2: "遠期預訂：支援 7 至 60 天後的預訂 (Prime Time 除外)。",
    mode_buyout_point_3: "即時扣款：交易確認後立即從信用卡扣除全數。",

    // --- Step 1: Screen Selector ---
    step_1_title: "選擇投放屏幕",
    screen_selector_title: "1. 選擇屏幕",
    search_placeholder: "搜尋地點、區份...",
    filter_all: "全部",
    filter_selected: "已選",
    base_price: "起標價",
    view_map: "地圖",
    spec: "規格",
    
    // --- Step 2: Date Selector ---
    step_2_title: "選擇播放日期",
    date_selector_title: "2. 選擇日期",
    mode_consecutive: "連續播放 (每週)",
    mode_specific: "特定日期 (單次)",
    week_unit: "週",
    select_days_hint: "請選擇星期幾",
    select_dates_hint: "請點擊日曆選擇日期",
    
    // --- Step 3: Time Slot Selector ---
    step_3_title: "選擇播放時段",
    time_selector_title: "3. 選擇時段",
    legend_available: "可選",
    legend_selected: "已選",
    legend_occupied: "已滿",
    legend_bidding: "競價中",
    prime_time: "黃金時段",
    
    // --- Pricing Summary (底部) ---
    summary_title: "價格摘要",
    total_slots: "總時段",
    est_bid_total: "預計競價總額",
    buyout_price: "即時買斷價",
    btn_bid: "確認競價",
    btn_buyout: "立即買斷",
    slot_unit: "個",
    sidebar_info: "了解更多平台規則",
    term_link: "條款及細則",
    privacy_link: "私隱政策",
    
    // --- Bidding Modal ---
    bid_modal_title: "競價出價",
    bid_instruction: "請為每個時段輸入您的出價 (HK$)",
    batch_bid: "批量出價",
    batch_bid_placeholder: "輸入金額...",
    apply_all: "套用全部",
    min_bid_alert: "低於底價",
    terms_agree: "我同意平台服務條款及競價規則",

    // --- My Orders Modal ---
    order_type_bid: "競價投標 (Bidding)",
    order_type_buyout: "直接買斷 (Buyout)",
    reveal_time: "預計揭曉結果時間",
    before_24h: "(播放前 24 小時)",
    slot_details: "已選時段詳情",
    increase_bid: "加價",
    bid_closed: "已截標",
    amount_paid: "成交金額",
    upload_video: "立即上傳影片",
    video_uploaded: "✅ 已上傳",
    no_upload_needed: "無需上傳",

    // --- Modals & Errors ---
    modal_time_mismatch_title: "競價時段限制",
    modal_time_mismatch_desc: "一張競價訂單只能包含「同一日期 + 同一小時」。建議分次提交，或改用買斷 (Buyout) 模式。",
    btn_understand: "明白",
    modal_restriction_title: "重要注意事項",
    modal_restriction_agree: "我已閱讀並同意上述條款。",
    btn_cancel: "取消",
    btn_confirm_continue: "確認並繼續",
    
    // --- Transactions ---
    txn_confirm_title: "確認訂單金額",
    txn_type_buyout: "即時買斷",
    txn_type_bid: "競價投標",
    txn_type_label: "類型",
    txn_slot_count: "共 {{count}} 個時段",
    txn_total: "應付總額",
    btn_pay: "前往加密付款",
    btn_back_edit: "返回修改",
    processing_title: "正在處理中...",
    processing_desc: "請勿重新整理或關閉視窗",

    // ============================================
    //  後台 (Admin Side)
    // ============================================
    admin_title: "DOOH 後台系統",
    tab_dashboard: "數據總覽",
    tab_calendar: "排程總表",
    tab_orders: "訂單管理",
    tab_review: "審核",
    tab_rules: "特別規則",
    tab_screens: "屏幕管理",
    tab_analytics: "市場分析",
    tab_config: "價格公式",
    total_revenue: "總營業額",
    pending_review: "待審核",
    valid_orders: "有效訂單",
    total_records: "總記錄",
    daily_revenue: "每日生意額",
    order_status_dist: "訂單狀態分佈",
    col_time: "時間",
    col_details: "訂單詳情 / 聯絡",
    col_amount: "金額",
    col_status: "狀態",
    col_action: "操作",
    video_missing: "⚠️ 欠片 (請追)",
    btn_bulk_cancel: "批量取消",
    review_approve: "通過",
    review_reject: "拒絕",
    review_reason: "拒絕原因...",
    no_pending_videos: "✅ 暫無待審核影片",
    rule_add_title: "新增特別規則",
    rule_global: "🌍 全部屏幕 (Global)",
    rule_time_placeholder: "時段 (0-23 或 18,19)",
    rule_note_placeholder: "備註 (e.g. 情人節)",
    rule_type_price: "💰 底價",
    rule_type_lock: "🔒 鎖定",
    rule_type_disable_buyout: "🚫 禁買斷",
    rule_existing: "已設定規則",
    screen_name: "屏幕名稱",
    screen_location: "位置",
    screen_base_price: "底價",
    screen_status: "上架狀態",
    screen_bundle: "Bundle",
    btn_toggle_on: "上架中",
    btn_toggle_off: "已鎖定",
    config_price_multipliers: "時段倍率設定",
    config_surcharges: "附加費率設定",
    config_bundle_rules: "聯播網組合規則",
    target_global: "🌍 全局預設",
    label_prime: "Prime (18:00-23:00)",
    label_gold: "Gold (12:00-14:00)",
    label_weekend: "週末 (五/六)",
    label_bundle: "Bundle (聯播)",
    label_urgent_24h: "急單 (24h內)",
    label_urgent_1h: "極速 (1h內)",
    analytics_real_data: "真實成交數據",
    analytics_avg_price: "平均成交價",
    analytics_bid_count: "出價次數",
    col_day: "星期",
    col_hour: "時段",
    col_suggestion: "建議",
    suggestion_up: "加價",
    suggestion_down: "減價",
    cal_month: "月視圖",
    cal_day: "日視圖",
    btn_smart_resolve: "智能結算",
    btn_finalize: "正式截標 (只殺過期)",
    alert_confirm_resolve: "確定要進行「智能結算」？系統將會逐個時段比較出價。",
    alert_resolve_success: "✅ 結算完成！",
    alert_confirm_finalize: "⚠️ 確定過期截標？\n系統只會處理【已過期】的時段。",
    alert_finalize_success: "🏁 截標完成！",
    alert_no_expired: "沒有發現過期訂單。",
    alert_saved: "✅ 設定已儲存",
    
    // Statuses
    status_paid_pending_selection: "競價中 (領先)",
    status_partially_outbid: "部分被超越",
    status_outbid_needs_action: "出價被超越 (需操作)",
    status_won: "競價成功 (Won)",
    status_paid: "已付款 / 已買斷",
    status_completed: "已完成播放",
    status_lost: "未中標 (額度已釋放)",
    status_cancelled: "已取消",
    status_pending_auth: "銀行授權中"
  },
  
  en: {
    // ============================================
    //  Common
    // ============================================
    loading: "Loading...",
    confirm: "Confirm",
    cancel: "Cancel",
    submit: "Submit",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    close: "Close",
    back_home: "Home",
    logout: "Logout",
    login: "Login / Sign Up",
    my_orders: "My Orders",

    // ============================================
    //  Client Side
    // ============================================
    
    play_guide: "How it Works",
    ad_platform: "Self-Service Ad Exchange",
    
    hero_badge: "LIVE AD EXCHANGE V5.0",
    hero_title_prefix: "Your Ads, ",
    hero_title_highlight: "Your Way.",
    hero_subtitle: "Control prime screens across HK. No agencies, transparent pricing, instant launch.",
    start_bidding: "Start Bidding Now",

    feature_1_title: "Low Entry",
    feature_1_desc: "Start from HK$50.\nBig screens for small budgets.",
    feature_2_title: "High Flex",
    feature_2_desc: "Buy by the hour.\nBid anytime, play anytime.",
    feature_3_title: "Full Control",
    feature_3_desc: "One tap to go live citywide.\nTrack performance instantly.",

    infobox_title: "HOW IT WORKS",
    mode_bid_title: "Bidding",
    mode_bid_point_1: "Highest Bidder Wins: Flexible pricing, ideal for limited budgets or prime time slots.",
    mode_bid_point_2: "Restriction: Only available for slots within 24 hours to 7 days.",
    mode_bid_point_3: "Pre-auth Mechanism: Funds are frozen (Pre-auth) upon submission, not deducted immediately.",
    
    mode_buyout_title: "Buyout",
    mode_buyout_point_1: "Instant Lock: Pay a fixed price to secure the slot immediately.",
    mode_buyout_point_2: "Advance Booking: Supports booking 7 to 60 days in advance (excluding Prime Time).",
    mode_buyout_point_3: "Instant Charge: Full amount deducted immediately upon confirmation.",

    step_1_title: "Select Screens",
    screen_selector_title: "1. Select Screens",
    search_placeholder: "Search location, district...",
    filter_all: "All",
    filter_selected: "Selected",
    base_price: "Min Bid",
    view_map: "Map",
    spec: "Spec",

    step_2_title: "Select Dates",
    date_selector_title: "2. Select Dates",
    mode_consecutive: "Consecutive (Weekly)",
    mode_specific: "Specific Dates (Once)",
    week_unit: "Weeks",
    select_days_hint: "Select Days of Week",
    select_dates_hint: "Pick Dates from Calendar",

    step_3_title: "Select Time Slots",
    time_selector_title: "3. Select Time Slots",
    legend_available: "Available",
    legend_selected: "Selected",
    legend_occupied: "Full",
    legend_bidding: "Bidding",
    prime_time: "Prime Time",

    summary_title: "Price Summary",
    total_slots: "Total Slots",
    est_bid_total: "Est. Bid Total",
    buyout_price: "Buyout Price",
    btn_bid: "Place Bid",
    btn_buyout: "Buyout Now",
    slot_unit: "slots",
    sidebar_info: "Learn more about platform rules",
    term_link: "Terms & Conditions",
    privacy_link: "Privacy Policy",

    bid_modal_title: "Place Your Bid",
    bid_instruction: "Enter your bid amount (HK$) for each slot",
    batch_bid: "Batch Bid",
    batch_bid_placeholder: "Amount...",
    apply_all: "Apply All",
    min_bid_alert: "Below Min",
    terms_agree: "I agree to the Terms of Service & Bidding Rules",

    order_type_bid: "Bidding",
    order_type_buyout: "Buyout",
    reveal_time: "Result Reveal",
    before_24h: "(24h before)",
    slot_details: "Selected Slots",
    increase_bid: "Bid +",
    bid_closed: "Closed",
    amount_paid: "Total Amount",
    upload_video: "Upload Video",
    video_uploaded: "Uploaded",
    no_upload_needed: "No Upload Needed",

    modal_time_mismatch_title: "Bidding Restriction",
    modal_time_mismatch_desc: "A single bid order must contain slots from the SAME Date & Hour only. Please split orders or use Buyout.",
    btn_understand: "Understood",
    modal_restriction_title: "Important Notice",
    modal_restriction_agree: "I have read and agree to the above terms.",
    btn_cancel: "Cancel",
    btn_confirm_continue: "Confirm & Continue",
    
    txn_confirm_title: "Confirm Order Amount",
    txn_type_buyout: "Buyout",
    txn_type_bid: "Bidding",
    txn_type_label: "Type",
    txn_slot_count: "{{count}} slots total",
    txn_total: "Total Payable",
    btn_pay: "Proceed to Payment",
    btn_back_edit: "Back to Edit",
    processing_title: "Processing...",
    processing_desc: "Do not refresh or close this window",

    // ============================================
    //  Admin Side
    // ============================================
    admin_title: "DOOH Admin",
    tab_dashboard: "Dashboard",
    tab_calendar: "Calendar",
    tab_orders: "Orders",
    tab_review: "Review",
    tab_rules: "Rules",
    tab_screens: "Screens",
    tab_analytics: "Analytics",
    tab_config: "Pricing",
    total_revenue: "Total Revenue",
    pending_review: "Pending Review",
    valid_orders: "Valid Orders",
    total_records: "Total Records",
    daily_revenue: "Daily Revenue",
    order_status_dist: "Order Status",
    col_time: "Time",
    col_details: "Details / Contact",
    col_amount: "Amount",
    col_status: "Status",
    col_action: "Action",
    video_missing: "⚠️ Missing",
    btn_bulk_cancel: "Bulk Cancel",
    review_approve: "Approve",
    review_reject: "Reject",
    review_reason: "Reason...",
    no_pending_videos: "✅ No pending videos",
    rule_add_title: "Add Special Rule",
    rule_global: "🌍 Global (All Screens)",
    rule_time_placeholder: "Hours (0-23 or 18,19)",
    rule_note_placeholder: "Note (e.g. Holiday)",
    rule_type_price: "💰 Min Price",
    rule_type_lock: "🔒 Lock",
    rule_type_disable_buyout: "🚫 No Buyout",
    rule_existing: "Existing Rules",
    screen_name: "Name",
    screen_location: "Location",
    screen_base_price: "Base Price",
    screen_status: "Status",
    screen_bundle: "Bundle",
    btn_toggle_on: "Active",
    btn_toggle_off: "Locked",
    config_price_multipliers: "Time Multipliers",
    config_surcharges: "Surcharges",
    config_bundle_rules: "Bundle Rules",
    target_global: "🌍 Global Default",
    label_prime: "Prime (18:00-23:00)",
    label_gold: "Gold (12:00-14:00)",
    label_weekend: "Weekend (Fri/Sat)",
    label_bundle: "Bundle",
    label_urgent_24h: "Urgent (<24h)",
    label_urgent_1h: "Express (<1h)",
    analytics_real_data: "Market Data",
    analytics_avg_price: "Avg Price",
    analytics_bid_count: "Bid Count",
    col_day: "Day",
    col_hour: "Hour",
    col_suggestion: "Advice",
    suggestion_up: "Increase",
    suggestion_down: "Decrease",
    cal_month: "Month",
    cal_day: "Day",
    btn_smart_resolve: "Smart Resolve",
    btn_finalize: "Finalize (Expired)",
    alert_confirm_resolve: "Confirm Smart Resolve? This will compare all slots.",
    alert_resolve_success: "✅ Resolve Complete!",
    alert_confirm_finalize: "⚠️ Confirm Finalize?\nOnly EXPIRED slots will be processed.",
    alert_finalize_success: "🏁 Finalize Complete!",
    alert_no_expired: "No expired orders found.",
    alert_saved: "✅ Settings Saved",

    // Statuses
    status_pending_auth: "Authorizing...",
    status_paid_pending_selection: "Winning (Active)",
    status_partially_outbid: "Partially Outbid",
    status_outbid_needs_action: "Outbid (Action Needed)",
    status_won: "Bid Won",
    status_paid: "Paid / Buyout",
    status_completed: "Completed",
    status_lost: "Bid Lost (Released)",
    status_cancelled: "Cancelled"
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('zh'); // 預設中文

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const t = (key, params = {}) => {
    let str = key;
    if (translations[lang] && translations[lang][key]) {
      str = translations[lang][key];
    }

    Object.keys(params).forEach(param => {
      str = str.replace(`{{${param}}}`, params[param]);
    });

    return str;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// 確保在 LanguageContext.jsx 的最後加上：
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};