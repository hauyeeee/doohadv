import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-slate-100 py-10 mt-auto border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-6 text-center">
        {/* 連結區域 */}
        <div className="flex flex-wrap justify-center items-center gap-6 mb-4 text-sm font-bold text-slate-600">
          <a 
            href="/terms" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-slate-900 transition-colors border-b border-transparent hover:border-slate-900 pb-0.5"
          >
            條款及細則 (Terms)
          </a>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <a 
            href="/privacy" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-slate-900 transition-colors border-b border-transparent hover:border-slate-900 pb-0.5"
          >
            私隱政策 (Privacy)
          </a>
        </div>

        {/* 版權宣告 */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} Huntarmpeople Limited. All rights reserved.
          </p>
          <p className="text-[10px] text-slate-300">
            Powered by DOOH Advanced Bidding System
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;