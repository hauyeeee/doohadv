import React from 'react';
import { HelpCircle, Gavel, Zap } from 'lucide-react';

const InfoBox = () => (
  <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 overflow-hidden relative">
    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-50"></div>
    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2 relative z-10">
      <HelpCircle size={16}/> 玩法說明 How it works
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
        <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold"><Gavel size={18}/> 競價投標 (Bidding)</div>
        <ul className="space-y-2 text-xs text-slate-600">
          <li className="flex items-start gap-2"><span className="text-blue-400">•</span> <span><strong>價高者得：</strong> 自由出價，適合預算有限或爭奪黃金時段。</span></li>
          <li className="flex items-start gap-2"><span className="text-orange-500 font-bold">•</span> <span className="text-orange-700 font-medium"><strong>限制：</strong> 僅開放予 24小時 至 7天 內的時段。</span></li>
          <li className="flex items-start gap-2"><span className="text-blue-400">•</span> <span><strong>預授權機制：</strong> 提交時只凍結額度 (Pre-auth)，不即時扣款。</span></li>
        </ul>
      </div>
      <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
        <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold"><Zap size={18}/> 直接買斷 (Buyout)</div>
        <ul className="space-y-2 text-xs text-slate-600">
          <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>即時鎖定：</strong> 付出一口價，立即確保獲得該時段。</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>遠期預訂：</strong> 支援 7 至 60 天後的預訂 (Prime Time 除外)。</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>即時扣款：</strong> 交易確認後立即從信用卡扣除全數。</span></li>
        </ul>
      </div>
    </div>
  </div>
);

export default InfoBox;