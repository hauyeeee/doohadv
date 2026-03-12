import React from 'react';
import { DollarSign, Sparkles, AlertTriangle, Lock, Ban, Zap, Clock, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext'; 

const PricingSummary = ({ pricing, isBundleMode, handleBidClick, handleBuyoutClick }) => {
  const { t, lang } = useLanguage(); 

  // 計算溢價百分比
  const premiumPercent = pricing.currentBundleMultiplier > 1 
    ? Math.round((pricing.currentBundleMultiplier - 1) * 100) 
    : 0;

  // 判斷是否顯示 Bundle 橫幅
  const showBundleBanner = isBundleMode && premiumPercent > 0;

  return (
    <section className="bg-slate-900 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between border-t-4 border-blue-500">
      <div className="mb-4">
        
        {/* Header 區域 */}
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2">
            <DollarSign size={16}/> 投資預算摘要 
            {showBundleBanner && (
                <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Sparkles size={10}/> Bundle Active
                </span>
            )}
          </h2>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            共選 {pricing.totalSlots} {t('slot_unit')}
          </span>
        </div>

        {/* 🔥 專業文字解說 (教育客戶買斷的意思) */}
        <div className="text-[10px] text-blue-300 bg-blue-900/40 p-2 rounded-lg border border-blue-800/50 mb-3 flex items-start gap-1.5 leading-relaxed">
            <Info size={14} className="shrink-0 mt-0.5"/>
            <span>
                💡 註：「鎖定時段 (Buyout)」代表您將鎖定該時段內的【1 個標準輪播位】(佔整體聲量約 10%)。如需獨家包場，請聯絡企業專員。
            </span>
        </div>
        
        {/* 價錢對比區域 */}
        <div className="flex items-center justify-between gap-4 mt-1">
          {/* 左邊：競價 */}
          <div>
            <p className="text-xs text-slate-400 mb-0.5">預估競價起標額</p>
            <div className="flex items-baseline gap-1">
                <span className="text-sm text-orange-500 font-bold">HK$</span>
                <span className="text-2xl font-bold text-orange-400 tracking-tight">
                    {pricing.minBidTotal.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">up</span>
            </div>
          </div>
          
          {/* 中間分隔線 */}
          <div className="w-px h-10 bg-slate-700"></div>
          
          {/* 右邊：買斷 */}
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">即時鎖定價 (Buyout)</p>
            {pricing.hasRestrictedBuyout ? (
                <div className="text-red-400 text-sm font-bold flex items-center justify-end gap-1">
                    <Lock size={14}/> 暫不適用
                </div>
            ) : (
                <div className="flex items-baseline justify-end gap-1">
                    <span className="text-sm text-emerald-600 font-bold">HK$</span>
                    <span className="text-2xl font-bold text-emerald-500 tracking-tight">
                        {pricing.buyoutTotal.toLocaleString()}
                    </span>
                </div>
            )}
          </div>
        </div>

        {/* 各種狀態提示區 (Warnings & Tags) */}
        <div className="space-y-1 mt-3 min-h-[20px]">
          
          {/* 1. Bundle 提示 */}
          {showBundleBanner && (
            <div className="text-xs text-purple-300 flex items-center gap-1 bg-purple-900/30 px-2 py-1 rounded border border-purple-800">
              <Sparkles size={12} className="text-purple-400"/> 
              <span>⚡ 聯播網矩陣效應啟動 (+{premiumPercent}%)</span>
            </div>
          )}
          
          {/* 2. 黃金時段鎖定提示 */}
          {pricing.hasPrimeOrGoldLock && (
              <div className="text-xs text-red-300 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded border border-red-800">
                  <Lock size={12}/>
                  <span>包含品牌專屬時段 (為保障企業庫存，僅開放競價)</span>
              </div>
          )}

          {/* 3. 企業霸位鎖定提示 */}
          {pricing.hasCorporateLock && (
              <div className="text-xs text-orange-300 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded border border-orange-800">
                  <Lock size={12}/>
                  <span>包含企業預留時段 (庫存緊張，僅開放競價)</span>
              </div>
          )}

          {/* 4. 遠期限制提示 */}
          {pricing.hasDateRestrictedBid && !pricing.hasUrgentRisk && (
            <div className="text-xs text-blue-300 flex items-center gap-1 bg-blue-900/30 px-2 py-1 rounded border border-blue-800">
              <Info size={12}/>
              <span>{pricing.futureDateText || "包含遠期時段：僅限鎖定購買"}</span>
            </div>
          )}

          {/* 5. 急單提示 */}
          {pricing.hasUrgentRisk && (
             <div className="text-xs text-orange-300 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded border border-orange-800">
              <Clock size={12}/>
              <span>急單時段：僅限即時鎖定</span>
            </div>
          )}

        </div>
      </div>
      
      {/* 按鈕區域 */}
      <div className="flex gap-3">
        {/* 競價按鈕 */}
        <button 
            onClick={handleBidClick} 
            disabled={!pricing.canStartBidding} 
            className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 
                ${!pricing.canStartBidding 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-900/50'}`}
        >
          <span>{pricing.hasRestrictedBid ? '🚫 競價暫停' : '提交競價 (Bid)'}</span>
        </button>

        {/* 鎖定買斷按鈕 */}
        <button 
          onClick={handleBuyoutClick} 
          disabled={pricing.hasRestrictedBuyout || pricing.totalSlots === 0} 
          className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 relative overflow-hidden group 
          ${(pricing.hasRestrictedBuyout || pricing.totalSlots === 0) 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
              : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-[1.02]'}`}
        >
          <span className="flex items-center gap-1 z-10 relative">
              <Zap size={14} className="fill-white"/> 
              立即鎖定 (Buyout)
          </span>
          {/* Hover 閃光特效 */}
          {!pricing.hasRestrictedBuyout && pricing.totalSlots > 0 && (
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
          )}
        </button>
      </div>
    </section>
  );
}

export default PricingSummary;