export const translations = {
  zh: {
    // --- Common ---
    loading: "載入中...",
    confirm: "確認",
    cancel: "取消",
    submit: "提交",
    save: "儲存設定",
    delete: "刪除",
    edit: "編輯",
    add: "新增",
    search: "搜尋",
    back_home: "返回前台",
    logout: "登出",
    
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
    video_uploaded: "✅ 已上傳",
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

    // --- Status Badges ---
    status_paid_pending_selection: "競價中 (領先)",
    status_partially_outbid: "部分被超越",
    status_outbid_needs_action: "出價被超越",
    status_won: "競價成功",
    status_paid: "已付款",
    status_completed: "已完成",
    status_lost: "未中標",
    status_cancelled: "已取消",
    status_pending_auth: "授權中"
  },
  en: {
    // --- Common ---
    loading: "Loading...",
    confirm: "Confirm",
    cancel: "Cancel",
    submit: "Submit",
    save: "Save Config",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    back_home: "Home",
    logout: "Logout",

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
    video_uploaded: "✅ Uploaded",
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

    // --- Status Badges ---
    status_paid_pending_selection: "Winning",
    status_partially_outbid: "Partially Outbid",
    status_outbid_needs_action: "Outbid",
    status_won: "Won",
    status_paid: "Paid",
    status_completed: "Completed",
    status_lost: "Lost",
    status_cancelled: "Cancelled",
    status_pending_auth: "Auth Pending"
  }
};