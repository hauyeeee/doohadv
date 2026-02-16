import ReactGA from "react-ga4";
import ReactPixel from 'react-facebook-pixel';

// 🔥 請換成你自己的 ID
const GA_MEASUREMENT_ID = "G-BQHMNDZT2C"; 
const FB_PIXEL_ID = "1744389019702374"; 

export const initAnalytics = () => {
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
  ReactGA.send({ hitType: "pageview", page: path });
  ReactPixel.pageView(); 
};

// 追蹤特定事件 (例如：購買成功)
export const trackEvent = (category, action, label, value = 0) => {
  // GA4 Event
  ReactGA.event({
    category: category,
    action: action,
    label: label, 
    value: value
  });

  // FB Custom Event (或者用標準事件如 'Purchase')
  ReactPixel.track(action, { 
    content_name: label, 
    value: value, 
    currency: "HKD" 
  });
};