import React from 'react';
import { X, Monitor, MapPin, AlertCircle, Info, BarChart3 } from 'lucide-react';

const BiddingModal = ({ 
    isOpen, onClose, generateAllSlots, slotBids, handleSlotBidChange, 
    batchBidInput, setBatchBidInput, handleBatchBid, isBundleMode, 
    pricing, termsAccepted, setTermsAccepted, onConfirm 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">設定出價 (暗標競投)</h3>
                        <p className="text-xs text-slate-500">共 {generateAllSlots.length} 個時段 | 請輸入您的目標價</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>

                {/* Batch Input */}
                <div className="p-3 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-blue-800">批量出價：</span>
                    <input type="number" placeholder="HKD" value={batchBidInput} onChange={e => setBatchBidInput(e.target.value)} className="w-24 px-3 py-1.5 rounded border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                    <button onClick={handleBatchBid} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700">應用全部</button>
                    {isBundleMode && <span className="ml-auto text-xs text-purple-600 font-bold bg-purple-100 px-2 py-1 rounded border border-purple-200">Bundle Active</span>}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 overscroll-contain">
                    {generateAllSlots.map((slot) => {
                        const currentVal = slotBids[slot.key] || '';
                        const bidAmount = parseInt(currentVal) || 0;
                        const isTooLow = bidAmount > 0 && bidAmount < slot.minBid; 
                        
                        // 🔥 讀取從 App.jsx 傳入的真實市場價
                        // const marketRefPrice = slot.marketAverage; // (已隱藏)

                        return (
                            <div key={slot.key} className={`flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border transition-colors bg-white ${slot.isPrime ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className={`w-14 text-center rounded p-1 shrink-0 ${slot.isPrime ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                        <div className="text-xs font-bold">{slot.dateStr.split('-')[1]}/{slot.dateStr.split('-')[2]}</div><div className="text-[10px]">{slot.hour}:00</div>
                                    </div>
                                    <div className="flex-1 md:w-64 text-xs space-y-1">
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2"><Monitor size={14} className="text-blue-500"/>{slot.screenName}</div>
                                        <div className="flex gap-3 text-slate-500"><span className="flex items-center gap-1"><MapPin size={10}/> {slot.location}</span></div>
                                        
                                        {/* 價格資訊區 */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                                            <div className="text-slate-500 flex justify-between items-center">
                                                <span>起標價:</span> 
                                                <span className="font-medium text-slate-700">${slot.minBid}</span>
                                            </div>
                                            {/* 🔥 修改 4: 隱藏參考市價 */}
                                            {/* <div className="text-blue-600 flex justify-between items-center" title="根據過往成交數據估算">
                                                <span className="flex items-center gap-1"><BarChart3 size={10}/> 參考市價:</span> 
                                                <span className="font-bold">~${marketRefPrice}</span>
                                            </div> 
                                            */}
                                        </div>
                                        
                                        <div className="flex gap-2 mt-1">
                                            {slot.isUrgent && <span className="text-[10px] text-orange-600 font-bold bg-orange-100 px-1 rounded">⚡ 急單</span>}
                                            {slot.isPrime && <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1 rounded">🔥 Prime</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
                                    <div className="relative flex-1 md:flex-none">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                        <input 
                                            type="number" 
                                            value={currentVal} 
                                            onChange={(e) => handleSlotBidChange(slot.key, e.target.value)} 
                                            className={`w-full md:w-28 pl-5 pr-2 py-2 rounded border text-sm font-bold outline-none focus:ring-2 transition-all ${isTooLow ? 'border-red-300 bg-red-50 text-red-600 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'}`} 
                                            placeholder="出價"
                                        />
                                    </div>
                                    <div className="w-24 flex justify-start shrink-0 text-xs font-bold">
                                        {isTooLow ? <span className="text-red-500 flex items-center gap-1"><AlertCircle size={14}/> 低於底價</span> : <span className="text-slate-400 flex items-center gap-1 font-normal"><Info size={12}/> 自由出價</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Terms */}
                <div className="p-4 border-t bg-slate-50 rounded-b-xl shrink-0 space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">
                        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"/>
                        <div className="text-xs text-slate-600">
                            <strong>我同意《廣告競價及審核條款》</strong>
                            <p className="mt-1 text-slate-500 leading-relaxed">
                                1. 本次採用<strong>暗標 (Blind Bid)</strong> 機制，價高者得，結果將於播放前 24 小時公佈。<br/>
                                2. <span className="text-slate-700 font-bold">審核準則：</span> 嚴禁色情、暴力、非法或粗言穢語內容。一般商業廣告只要符合《商品說明條例》均可通過。<br/>
                                3. 若因內容違規導致審核失敗，費用<span className="text-red-600 font-bold">不予退還</span>。
                            </p>
                        </div>
                    </label>
                    <div className="flex justify-between items-center">
                        <div className="text-sm">
                            <span className="text-slate-500">預授權總額: </span><span className="font-bold text-lg text-blue-600">HK$ {pricing.currentBidTotal.toLocaleString()}</span>
                            {!pricing.isReadyToSubmit && pricing.missingBids > 0 && <span className="block text-[10px] text-red-500">尚有 {pricing.missingBids} 個未出價</span>}
                            {!pricing.isReadyToSubmit && pricing.invalidBids > 0 && <span className="block text-[10px] text-red-500">有 {pricing.invalidBids} 個出價過低</span>}
                        </div>
                        <button 
                            onClick={onConfirm} 
                            className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed" 
                            disabled={!termsAccepted || !pricing.isReadyToSubmit}
                        >
                            確認並提交
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default BiddingModal;