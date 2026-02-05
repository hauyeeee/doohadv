import React, { createContext, useState, useContext } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // 預設中文 'zh'
  const [lang, setLang] = useState('zh');

  // 切換語言功能
  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  // 翻譯函數: t('hero_title_1') -> 會自動出中文或英文
  const t = (key) => {
    return translations[lang][key] || key; // 如果搵唔到，就出番 key 原名
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// 自訂 Hook，方便在其他頁面用
export const useLanguage = () => useContext(LanguageContext);