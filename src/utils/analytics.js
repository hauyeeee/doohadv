import ReactGA from "react-ga4";
import ReactPixel from 'react-facebook-pixel';

// 🔥 你的 ID
const GA_MEASUREMENT_ID = "G-BQHMNDZT2C"; 
const FB_PIXEL_ID = "1744389019702374"; 

// 加一個鎖，確保唔會重複開機
let isInitialized = false;

export const initAnalytics = () => {
  if (isInitialized) return; // 如果已經開咗機，就跳過
  
  // Initialize GA4
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log("📊 GA4 Initialized");
  }

  // Initialize Facebook Pixel
  if (FB_PIXEL_ID) {
    const options = {
      autoConfig: true, 
      debug: false, 
    };
    ReactPixel.init(FB_PIXEL_ID, options);
    console.log("📊 FB Pixel Initialized");
  }
  
  isInitialized = true; // 鎖上，標記已成功開機
};

// 追蹤頁面瀏覽 (Page View)
export const trackPageView = (path) => {
  initAnalytics(); // 🔥 每次發射前，強制確保已經開機！
  
  ReactGA.send({ hitType: "pageview", page: path });
  ReactPixel.pageView(); 
};

// 追蹤特定事件 (例如：購買成功)
export const trackEvent = (category, action, label, value = 0) => {
  initAnalytics(); // 🔥 每次發射前，強制確保已經開機！
  
  // GA4 Event
  ReactGA.event({
    category: category,
    action: action,
    label: label, 
    value: value
  });

  // FB Custom Event
  ReactPixel.track(action, { 
    content_name: label, 
    value: value, 
    currency: "HKD" 
  });
};