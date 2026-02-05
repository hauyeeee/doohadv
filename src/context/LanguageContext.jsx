import React, { createContext, useState, useContext } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('zh'); // 預設中文

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const t = (key) => {
    // 安全檢查：防止找不到 key 時報錯
    if (translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    return key; // 如果找不到，回傳 key 原名
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);