import React from 'react';
import { CheckCircle, AlertTriangle, Loader2, FileVideo, Mail, HelpCircle } from 'lucide-react';

const UrgentUploadModal = ({ 
    isOpen, modalPaymentStatus, creativeStatus, isUploadingReal, 
    uploadProgress, handleRealUpload, emailStatus, onClose 
}) => {
    if (!isOpen) return null;

    const isSuccessUI = modalPaymentStatus === 'paid';

    return (
        // 1. 外層加入 stopPropagation，防止點擊背景誤關閉
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-900/90 backdrop-blur-md p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 md:p-8 relative border-4 border-red-500 animate-in fade-in zoom-in duration-300">
                
                {/* Header Icon */}
                <div className="absolute -top-6 -left-6 bg-red-600 text-white p-3 rounded-full shadow-lg border-4 border-white">
                    {isSuccessUI ? <CheckCircle size={32} /> : <AlertTriangle size={32} className="animate-pulse"/>}
                </div>
                
                {/* Status Title */}
                {isSuccessUI ? (
                    <div className="text-center mb-6 mt-2">
                        <h2 className="text-2xl font-black text-green-700 mb-1 flex items-center justify-center gap-2">
                            <CheckCircle size={28} className="text-green-600"/> 付款成功！
                        </h2>
                        <p className="text-slate-500 text-sm">您的時段已鎖定，請盡快上傳影片。</p>
                    </div>
                ) : (
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-bold text-slate-700 mb-1 flex items-center justify-center gap-2">
                            <Loader2 className="animate-spin"/> 正在等待銀行確認...
                        </h2>
                        <p className="text-sm text-slate-500">請勿關閉，系統正在接收付款通知。</p>
                    </div>
                )}

                {/* Warning Box */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800 font-bold text-lg mb-1 flex items-center gap-2">
                        <AlertTriangle size={20}/> 必須上傳影片
                    </p>
                    <p className="text-red-600 text-sm">請在 24 小時內完成上傳，否則訂單可能會被取消且不設退款。</p>
                </div>

                {/* Upload Area (Desktop 標準版 + Email 提示) */}
                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 mb-6 min-h-[200px]">
                    {creativeStatus === 'empty' ? (
                        <div className="w-full max-w-xs mx-auto flex flex-col items-center justify-center">
                            
                            {/* 🔥 Desktop 版最標準寫法 (Label Wrapper) */}
                            <label className={`group w-full flex flex-col items-center justify-center relative transition-transform active:scale-95 ${isUploadingReal ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                
                                {/* 1. 真正的 Input */}
                                <input 
                                    type="file" 
                                    accept="video/*" 
                                    disabled={isUploadingReal}
                                    style={{ display: 'none' }} // 乾淨隱藏
                                    onChange={(e) => {
                                        console.log("📂 檔案選取成功:", e.target.files[0]?.name);
                                        handleRealUpload(e);
                                    }} 
                                    onClick={(e) => { e.target.value = null; }} // 允許重複選取
                                />
                                
                                {/* 2. 視覺按鈕 */}
                                <div className={`w-full bg-red-600 group-hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg text-lg flex items-center justify-center gap-2 select-none ${isUploadingReal ? 'opacity-50' : ''}`}>
                                    {isUploadingReal ? <Loader2 className="animate-spin"/> : <FileVideo size={20}/>} 
                                    {isUploadingReal ? `上傳中 ${Math.round(uploadProgress)}%` : '選擇影片檔案'}
                                </div>

                            </label>

                            <p className="text-xs text-slate-400 mt-3 mb-4">支援 MP4, MOV (Max 100MB)</p>

                            {/* 🔥 新增：Email 救援提示 */}
                            <div className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-center">
                                <p className="text-[11px] text-slate-500 mb-1 flex items-center justify-center gap-1">
                                    <HelpCircle size={12} /> 上傳遇到問題？
                                </p>
                                <p className="text-xs text-slate-600">
                                    請將影片直接電郵至：
                                    <br/>
                                    <a href="mailto:info@doohadv.com?subject=補交影片 - 請填寫訂單編號" className="font-bold text-blue-600 hover:underline select-text">
                                        info@doohadv.com
                                    </a>
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">(請務必註明訂單編號)</p>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center animate-in zoom-in">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle size={32} />
                            </div>
                            <p className="text-green-700 font-bold text-lg">影片已上傳！</p>
                            <p className="text-xs text-slate-500 mt-1">您可以隨時在「我的訂單」更換影片</p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 p-3 rounded">
                        <Mail size={16} className={`text-blue-500 ${emailStatus === 'sending' ? 'animate-pulse' : ''}`}/>
                        {emailStatus === 'sending' && <span>正在發送訂單確認信...</span>}
                        {emailStatus === 'sent' && <span>已發送訂單確認信至您的 Email</span>}
                        {emailStatus === 'error' && <span className="text-red-500">發送確認信失敗，請聯繫客服</span>}
                        {emailStatus === 'idle' && <span>準備發送確認信...</span>}
                    </div>
                    <button onClick={onClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold transition-colors">
                        完成並關閉
                    </button>
                </div>
            </div>
        </div>
    );
};
export default UrgentUploadModal;