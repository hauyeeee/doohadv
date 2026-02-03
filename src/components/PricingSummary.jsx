import React from 'react';
import { DollarSign, Sparkles, AlertTriangle, Lock, Ban, Zap, Clock, Info } from 'lucide-react';

const PricingSummary = ({ pricing, isBundleMode, handleBidClick, handleBuyoutClick }) => {
  // Calculate premium percentage
  const premiumPercent = pricing.currentBundleMultiplier > 1 
    ? Math.round((pricing.currentBundleMultiplier - 1) * 100) 
    : 0;

  return (
    <section className="bg-slate-900 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between border-t-4 border-blue-500">
      <div className="mb-4">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><DollarSign size={16}/> Price Preview {isBundleMode && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Sparkles size={10}/> Bundle Active</span>}</h2>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Total {pricing.totalSlots} Slots</span>
        </div>
        <div className="flex items-center justify-between gap-4 mt-1">
          <div><p className="text-xs text-slate-400 mb-0.5">Min Bid Total</p><div className="flex items-baseline gap-1"><span className="text-sm text-orange-500 font-bold">HK$</span><span className="text-2xl font-bold text-orange-400 tracking-tight">{pricing.minBidTotal.toLocaleString()}</span><span className="text-xs text-slate-500">up</span></div></div>
          <div className="w-px h-10 bg-slate-700"></div>
          <div className="text-right"><p className="text-xs text-slate-400 mb-0.5">Buyout Total</p>{pricing.hasRestrictedBuyout ? (<div className="text-red-400 text-sm font-bold flex items-center justify-end gap-1"><Lock size={14}/> N/A</div>) : (<div className="flex items-baseline justify-end gap-1"><span className="text-sm text-emerald-600 font-bold">HK$</span><span className="text-2xl font-bold text-emerald-500 tracking-tight">{pricing.buyoutTotal.toLocaleString()}</span></div>)}</div>
        </div>
        <div className="space-y-1 mt-3 min-h-[20px]">
          {/* 🔥 Bundle Explanation */}
          {isBundleMode && (
            <div className="text-xs text-purple-300 flex items-center gap-1 bg-purple-900/30 px-2 py-1 rounded border border-purple-800">
              <Sparkles size={12} className="text-purple-400"/> 
              <span>⚡ Network Effect Active: Ads sync across screens for max impact. (+{premiumPercent}%)</span>
            </div>
          )}
          
          {/* 🔥 具體開放日期 (藍色提示) */}
          {pricing.hasDateRestrictedBid && !pricing.hasUrgentRisk && (
            <div className="text-xs text-blue-300 flex items-center gap-1 bg-blue-900/30 px-2 py-1 rounded border border-blue-800">
              <Info size={12}/> 
              <span>{pricing.futureDateText || "包含遠期時段：僅限 Buyout"}</span>
            </div>
          )}

           {/* Warnings */}
          {pricing.hasUrgentRisk && (
             <div className="text-xs text-orange-300 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded border border-orange-800">
              <Clock size={12}/> 
              <span>Urgent/Last-minute slots included: Buyout Only</span>
            </div>
          )}

          {pricing.hasPrimeFarFutureLock && (
            <div className="text-xs text-red-300 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded border border-red-800">
              <Lock size={12}/> 
              <span>Prime Future (Locked)</span>
            </div>
          )}

          {pricing.urgentCount > 0 && (<div className="text-xs text-orange-400 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded"><Zap size={12}/> Includes {pricing.urgentCount} urgent slots (+20%)</div>)}
          {pricing.soldOutCount > 0 && <div className="text-xs text-slate-400 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"><Ban size={12}/> {pricing.soldOutCount} sold-out slots hidden</div>}
        </div>
      </div>
      <div className="flex gap-3">
        {/* Bid Button */}
        <button onClick={handleBidClick} disabled={!pricing.canStartBidding} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${!pricing.canStartBidding ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-900/50'}`}>
          <span>
            {pricing.hasRestrictedBid ? '🚫 Bid Paused' : 'Place Bid'}
          </span>
          {!pricing.hasRestrictedBid && pricing.totalSlots > 0 && <span className="text-[10px] font-normal opacity-80">Free Bid</span>}
        </button>

        {/* Buyout Button (Flashy) */}
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
              Buyout Now
          </span>
          {pricing.totalSlots > 0 && !pricing.hasRestrictedBuyout && (
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded z-10 relative">
                  Instant Confirm
              </span>
          )}
          {/* Shine Effect */}
          {!pricing.hasRestrictedBuyout && pricing.totalSlots > 0 && (
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
          )}
        </button>
      </div>
    </section>
  );
}

export default PricingSummary;