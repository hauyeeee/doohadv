export const translations = {
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
    hero_title_1: "自己廣告，",
    hero_title_2: "自己投。",
    hero_subtitle: "全港地標屏幕，由你掌控。無需經 Agency，價格透明，即時上架。",
    start_bidding: "立即開始競投",
    
    // --- Selling Points ---
    point_1_title: "低門檻",
    point_1_desc: "HK$50 起 登上城市地標。\n小預算也能做大廣告。",
    point_2_title: "高彈性",
    point_2_desc: "按小時購買時段。\n隨時 Bid，隨時播。",
    point_3_title: "全掌控",
    point_3_desc: "手機一按，全港聯播。\n成效數據一目了然。",

    // --- Step 1: Screen Selector ---
    screen_selector_title: "1. 選擇屏幕",
    search_placeholder: "搜尋地點、區份...",
    filter_all: "全部",
    filter_selected: "已選",
    base_price: "起標價",
    view_map: "地圖",
    spec: "規格",
    
    // --- Step 2: Date Selector ---
    date_selector_title: "2. 選擇日期",
    mode_consecutive: "連續播放 (每週)",
    mode_specific: "特定日期 (單次)",
    week_unit: "週",
    select_days_hint: "請選擇星期幾",
    select_dates_hint: "請點擊日曆選擇日期",
    
    // --- Step 3: Time Slot Selector ---
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

    // ============================================
    //  後台 (Admin Side)
    // ============================================
    
    // --- Header / Nav ---
    admin_title: "DOOH 後台系統",
    tab_dashboard: "數據總覽",
    tab_calendar: "排程總表",
    tab_orders: "訂單管理",
    tab_review: "審核",
    tab_rules: "特別規則",
    tab_screens: "屏幕管理",
    tab_analytics: "市場分析",
    tab_config: "價格公式",

    // --- Dashboard ---
    total_revenue: "總營業額",
    pending_review: "待審核",
    valid_orders: "有效訂單",
    total_records: "總記錄",
    daily_revenue: "每日生意額",
    order_status_dist: "訂單狀態分佈",

    // --- Orders Table ---
    col_time: "時間",
    col_details: "訂單詳情 / 聯絡",
    col_amount: "金額",
    col_status: "狀態",
    col_action: "操作",
    video_missing: "⚠️ 欠片 (請追)",
    btn_cancel: "取消",
    btn_bulk_cancel: "批量取消",

    // --- Review ---
    review_approve: "通過",
    review_reject: "拒絕",
    review_reason: "拒絕原因...",
    no_pending_videos: "✅ 暫無待審核影片",

    // --- Rules ---
    rule_add_title: "新增特別規則",
    rule_global: "🌍 全部屏幕 (Global)",
    rule_time_placeholder: "時段 (0-23 或 18,19)",
    rule_note_placeholder: "備註 (e.g. 情人節)",
    rule_type_price: "💰 底價",
    rule_type_lock: "🔒 鎖定",
    rule_type_disable_buyout: "🚫 禁買斷",
    rule_existing: "已設定規則",

    // --- Screens ---
    screen_name: "屏幕名稱",
    screen_location: "位置",
    screen_base_price: "底價",
    screen_status: "上架狀態",
    screen_bundle: "Bundle",
    btn_toggle_on: "上架中",
    btn_toggle_off: "已鎖定",

    // --- Config ---
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

    // --- Analytics ---
    analytics_real_data: "真實成交數據",
    analytics_avg_price: "平均成交價",
    analytics_bid_count: "出價次數",
    col_day: "星期",
    col_hour: "時段",
    col_suggestion: "建議",
    suggestion_up: "加價",
    suggestion_down: "減價",

    // --- Calendar ---
    cal_month: "月視圖",
    cal_day: "日視圖",
    
    // --- Actions / Buttons ---
    btn_smart_resolve: "智能結算",
    btn_finalize: "正式截標 (只殺過期)",
    
    // --- Alerts ---
    alert_confirm_resolve: "確定要進行「智能結算」？系統將會逐個時段比較出價。",
    alert_resolve_success: "✅ 結算完成！",
    alert_confirm_finalize: "⚠️ 確定過期截標？\n系統只會處理【已過期】的時段。",
    alert_finalize_success: "🏁 截標完成！",
    alert_no_expired: "沒有發現過期訂單。",
    alert_saved: "✅ 設定已儲存",

    // ============================================
    //  共享狀態 (Shared Statuses)
    // ============================================
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
    
    // --- Header & Hero ---
    play_guide: "How it Works",
    ad_platform: "Self-Service Ad Exchange",
    hero_title_1: "Your Ads, ",
    hero_title_2: "Your Way.",
    hero_subtitle: "Control prime screens across HK. No agencies, transparent pricing, instant launch.",
    start_bidding: "Start Bidding Now",

    // --- Selling Points ---
    point_1_title: "Low Entry",
    point_1_desc: "Start from HK$50.\nBig screens for small budgets.",
    point_2_title: "High Flex",
    point_2_desc: "Buy by the hour.\nBid anytime, play anytime.",
    point_3_title: "Full Control",
    point_3_desc: "One tap to go live citywide.\nTrack performance instantly.",

    // --- Step 1: Screen Selector ---
    screen_selector_title: "1. Select Screens",
    search_placeholder: "Search location, district...",
    filter_all: "All",
    filter_selected: "Selected",
    base_price: "Min Bid",
    view_map: "Map",
    spec: "Spec",

    // --- Step 2: Date Selector ---
    date_selector_title: "2. Select Dates",
    mode_consecutive: "Consecutive (Weekly)",
    mode_specific: "Specific Dates (Once)",
    week_unit: "Weeks",
    select_days_hint: "Select Days of Week",
    select_dates_hint: "Pick Dates from Calendar",

    // --- Step 3: Time Slot Selector ---
    time_selector_title: "3. Select Time Slots",
    legend_available: "Available",
    legend_selected: "Selected",
    legend_occupied: "Full",
    legend_bidding: "Bidding",
    prime_time: "Prime Time",

    // --- Pricing Summary ---
    summary_title: "Price Summary",
    total_slots: "Total Slots",
    est_bid_total: "Est. Bid Total",
    buyout_price: "Buyout Price",
    btn_bid: "Place Bid",
    btn_buyout: "Buyout Now",
    slot_unit: "slots",

    // --- Bidding Modal ---
    bid_modal_title: "Place Your Bid",
    bid_instruction: "Enter your bid amount (HK$) for each slot",
    batch_bid: "Batch Bid",
    batch_bid_placeholder: "Amount...",
    apply_all: "Apply All",
    min_bid_alert: "Below Min",
    terms_agree: "I agree to the Terms of Service & Bidding Rules",

    // --- My Orders Modal ---
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

    // ============================================
    //  Admin Side
    // ============================================
    
    // --- Header / Nav ---
    admin_title: "DOOH Admin",
    tab_dashboard: "Dashboard",
    tab_calendar: "Calendar",
    tab_orders: "Orders",
    tab_review: "Review",
    tab_rules: "Rules",
    tab_screens: "Screens",
    tab_analytics: "Analytics",
    tab_config: "Pricing",

    // --- Dashboard ---
    total_revenue: "Total Revenue",
    pending_review: "Pending Review",
    valid_orders: "Valid Orders",
    total_records: "Total Records",
    daily_revenue: "Daily Revenue",
    order_status_dist: "Order Status",

    // --- Orders Table ---
    col_time: "Time",
    col_details: "Details / Contact",
    col_amount: "Amount",
    col_status: "Status",
    col_action: "Action",
    video_missing: "⚠️ Missing",
    btn_cancel: "Cancel",
    btn_bulk_cancel: "Bulk Cancel",

    // --- Review ---
    review_approve: "Approve",
    review_reject: "Reject",
    review_reason: "Reason...",
    no_pending_videos: "✅ No pending videos",

    // --- Rules ---
    rule_add_title: "Add Special Rule",
    rule_global: "🌍 Global (All Screens)",
    rule_time_placeholder: "Hours (0-23 or 18,19)",
    rule_note_placeholder: "Note (e.g. Holiday)",
    rule_type_price: "💰 Min Price",
    rule_type_lock: "🔒 Lock",
    rule_type_disable_buyout: "🚫 No Buyout",
    rule_existing: "Existing Rules",

    // --- Screens ---
    screen_name: "Name",
    screen_location: "Location",
    screen_base_price: "Base Price",
    screen_status: "Status",
    screen_bundle: "Bundle",
    btn_toggle_on: "Active",
    btn_toggle_off: "Locked",

    // --- Config ---
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

    // --- Analytics ---
    analytics_real_data: "Market Data",
    analytics_avg_price: "Avg Price",
    analytics_bid_count: "Bid Count",
    col_day: "Day",
    col_hour: "Hour",
    col_suggestion: "Advice",
    suggestion_up: "Increase",
    suggestion_down: "Decrease",

    // --- Calendar ---
    cal_month: "Month",
    cal_day: "Day",

    // --- Actions ---
    btn_smart_resolve: "Smart Resolve",
    btn_finalize: "Finalize (Expired)",

    // --- Alerts ---
    alert_confirm_resolve: "Confirm Smart Resolve? This will compare all slots.",
    alert_resolve_success: "✅ Resolve Complete!",
    alert_confirm_finalize: "⚠️ Confirm Finalize?\nOnly EXPIRED slots will be processed.",
    alert_finalize_success: "🏁 Finalize Complete!",
    alert_no_expired: "No expired orders found.",
    alert_saved: "✅ Settings Saved",

    // ============================================
    //  Shared Statuses
    // ============================================
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