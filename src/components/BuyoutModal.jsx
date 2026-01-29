import React from 'react';
import { X, ShoppingBag, CreditCard } from 'lucide-react';

const BuyoutModal = ({ 
    isOpen, 
    onClose, 
    pricing, 
    selectedSpecificDates, 
    termsAccepted, 
    setTermsAccepted, 
    onConfirm // <--- 1. 確保這裡有接收 onConfirm
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-emerald-50 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
                            <ShoppingBag size={20}/> 確認直接買斷 (Buyout)
                        </h3>
                        <p className="text-xs text-emerald-600">您即將以一口價鎖定所有時段</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between mb-2 text-sm text-slate-500">
                            <span>總時段數</span>
                            <span className="font-bold text-slate-800">{pricing.totalSlots} Slots</span>
                        </div>
                        <div className="flex justify-between mb-2 text-sm text-slate-500">
                            <span>日期</span>
                            <span className="font-bold text-slate-800">
                                {Array.from(selectedSpecificDates).length > 0 ? Array.from(selectedSpecificDates)[0] : '多選/週期'} 等
                            </span>
                        </div>
                        <div className="border-t my-2"></div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700">應付總額</span>
                            <span className="text-2xl font-bold text-emerald-600">HK$ {pricing.buyoutTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Terms Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={termsAccepted} 
                            onChange={(e) => setTermsAccepted(e.target.checked)} 
                            className="mt-1 w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <div className="text-xs text-slate-600">
                            <strong>我同意《廣告競價及播放條款》</strong>
                            <p className="mt-1 text-slate-500">1. 本次交易為<strong>即時扣款 (Immediate Capture)</strong>，買斷操作將立即鎖定時段。<br/>2. 訂單一經確認<strong>不設退款</strong>。素材逾時上傳費用不予退還。</p>
                        </div>
                    </label>
                </div>

                {/* Footer Button */}
                <div className="p-5 border-t bg-slate-50 rounded-b-xl">
                    <button 
                        onClick={() => {
                            console.log("🖱️ [Modal Debug] 用戶點擊了付款按鈕"); // <--- 加左句 Log 俾你
                            onConfirm(); // <--- 2. 確保這裡真的執行了 onConfirm
                        }} 
                        disabled={!termsAccepted} 
                        className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <CreditCard size={18}/> 立即付款 HK$ {pricing.buyoutTotal.toLocaleString()}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BuyoutModal;