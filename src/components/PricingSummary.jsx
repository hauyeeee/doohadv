import React from 'react';
import { DollarSign, Sparkles, AlertTriangle, Lock, Ban, Zap } from 'lucide-react';

const PricingSummary = ({ pricing, isBundleMode, handleBidClick, handleBuyoutClick }) => (
  <section className="bg-slate-900 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between border-t-4 border-blue-500">
    <div className="mb-4">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><DollarSign size={16}/> 價格預覽 {isBundleMode && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Sparkles size={10}/> Bundle Active</span>}</h2>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">共 {pricing.totalSlots} 個可用時段</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-1">
        <div><p className="text-xs text-slate-400 mb-0.5">最低起標總額</p><div className="flex items-baseline gap-1"><span className="text-sm text-orange-500 font-bold">HK$</span><span className="text-2xl font-bold text-orange-400 tracking-tight">{pricing.minBidTotal.toLocaleString()}</span><span className="text-xs text-slate-500">起</span></div></div>
        <div className="w-px h-10 bg-slate-700"></div>
        <div className="text-right"><p className="text-xs text-slate-400 mb-0.5">直接買斷總額</p>{pricing.hasRestrictedBuyout ? (<div className="text-red-400 text-sm font-bold flex items-center justify-end gap-1"><Lock size={14}/> 不適用</div>) : (<div className="flex items-baseline justify-end gap-1"><span className="text-sm text-emerald-600 font-bold">HK$</span><span className="text-2xl font-bold text-emerald-500 tracking-tight">{pricing.buyoutTotal.toLocaleString()}</span></div>)}</div>
      </div>
      <div className="space-y-1 mt-3 min-h-[20px]">
        {isBundleMode && (
          <div className="text-xs text-purple-300 flex items-center gap-1 bg-purple-900/30 px-2 py-1 rounded border border-purple-800">
            <Sparkles size={12} className="text-purple-400"/> 
            <span>⚡ 已啟動聯播網模式 (Network Effect): 廣告將於同一區域同步播放，獲得最大曝光效益。 (溢價 +25%)</span>
          </div>
        )}
        
        {pricing.hasPrimeFarFutureLock && (
          <div className="text-xs text-red-300 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded border border-red-800">
            <Lock size={12}/> 
            <span>遠期 Prime (暫未開放，請於7天內競價)</span>
          </div>
        )}

        {pricing.urgentCount > 0 && (<div className="text-xs text-orange-400 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded"><Zap size={12}/> 已包含 {pricing.urgentCount} 個急單時段 (附加費 +20%)</div>)}
        {pricing.hasRestrictedBuyout && !pricing.hasPrimeFarFutureLock && <div className="text-xs text-red-400 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded"><Lock size={12}/> 包含 Prime 時段，無法直接買斷</div>}
        {pricing.soldOutCount > 0 && <div className="text-xs text-slate-400 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"><Ban size={12}/> 已自動過濾 {pricing.soldOutCount} 個已售罄時段</div>}
      </div>
    </div>
    <div className="flex gap-3">
      <button onClick={handleBidClick} disabled={!pricing.canStartBidding} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${!pricing.canStartBidding ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-900/50'}`}>
        <span>
          {pricing.hasRestrictedBid 
            ? '🚫 限買斷' 
            : '出價競投'}
        </span>
        {!pricing.hasRestrictedBid && pricing.totalSlots > 0 && <span className="text-[10px] font-normal opacity-80">自由出價</span>}
      </button>
      <button onClick={handleBuyoutClick} disabled={pricing.hasRestrictedBuyout || pricing.totalSlots === 0} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${(pricing.hasRestrictedBuyout || pricing.totalSlots === 0) ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-900/50'}`}><span>直接買斷</span>{pricing.totalSlots > 0 && !pricing.hasRestrictedBuyout && <span className="text-[10px] font-normal opacity-80">即時確認</span>}</button>
    </div>
  </section>
);

export default PricingSummary;