import React from 'react';

const Footer = () => {
  return (
    // 移除背景色，將 py-10 縮減，完全融入底色
    <footer className="w-full pb-6 pt-4 text-center mt-auto">
      {/* 使用 text-[10px] (極小字) 和 text-slate-400 (淺灰色) */}
      <div className="flex flex-wrap justify-center items-center gap-3 text-[10px] text-slate-400">
        <span>&copy; {new Date().getFullYear()} Huntarmpeople Limited.</span>
        
        <span className="opacity-50">|</span>
        
        <a 
          href="/terms" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:text-slate-600 transition-colors"
        >
          條款及細則
        </a>
        
        <span className="opacity-50">|</span>
        
        <a 
          href="/privacy" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:text-slate-600 transition-colors"
        >
          私隱政策
        </a>
      </div>
    </footer>
  );
};

export default Footer;