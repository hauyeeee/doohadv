import ReactGA from "react-ga4";
import ReactPixel from 'react-facebook-pixel';

// 🔥 請換成你自己的 ID
const GA_MEASUREMENT_ID = "G-VRKLQ7YK5G"; 
const FB_PIXEL_ID = "1744389019702374"; 

export const initAnalytics = () => {
  // 只在生產環境 (Production) 啟動 Analytics，避免開發時產生雜訊
  // 如果你想在本地也測試，可以暫時註解掉這個 if 檢查
  if (process.env.NODE_ENV !== 'production') {
      console.log("🚧 Analytics disabled in development mode");
      return;
  }

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
};

// 追蹤頁面瀏覽 (Page View)
export const trackPageView = (path) => {
  if (process.env.NODE_ENV !== 'production') return;
  
  if (GA_MEASUREMENT_ID) ReactGA.send({ hitType: "pageview", page: path });
  if (FB_PIXEL_ID) ReactPixel.pageView(); 
};

// 追蹤特定事件 (例如：購買成功)
export const trackEvent = (category, action, label, value = 0) => {
  if (process.env.NODE_ENV !== 'production') {
      console.log(`[Event Tracked] ${category} - ${action}`);
      return;
  }

  // GA4 Event
  if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: category,
        action: action,
        label: label, 
        value: value
      });
  }

  // FB Custom Event
  if (FB_PIXEL_ID) {
      ReactPixel.track(action, { 
        content_name: label, 
        value: value, 
        currency: "HKD" 
      });
  }
};