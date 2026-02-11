import React, { useState } from 'react';
import { LogOut, X, Mail, History, ShoppingBag, Gavel, Clock, Monitor, CheckCircle, UploadCloud, Info, AlertTriangle, Lock, Trophy, Ban, Zap, CreditCard, Flag, Edit, Hourglass } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MyOrdersModal = ({ isOpen, user, myOrders, existingBids, onClose, onLogout, onUploadClick, handleUpdateBid, onResumePayment }) => {
  const { t, lang } = useLanguage();
  const [updatingSlot, setUpdatingSlot] = useState(null);
  const [newBidPrice, setNewBidPrice] = useState('');

  if (!isOpen || !user) return null;

  const onUpdateBidSubmit = (orderId, slotIndex, currentPrice, otherSlotsSum, isPendingPayment, marketHighestPrice) => {
      const bidInt = parseInt(newBidPrice);
      const currentInt = parseInt(currentPrice);
      
      let floorPrice = currentInt;
      if (isPendingPayment) {
          floorPrice = marketHighestPrice;
      }

      if (!newBidPrice || bidInt <= floorPrice) {
          const msg = lang === 'en' 
              ? `Bid must be higher than HK$${floorPrice}!` 
              : `出價必須高於 HK$${floorPrice}！`;
          alert(msg);
          return;
      }

      const newTotal = otherSlotsSum + bidInt;
      const confirmMsg = lang === 'en' 
          ? `Confirm bid increase? Total re-authorization: HK$${newTotal.toLocaleString()}` 
          : `確定加價？系統將重新預授權總額 HK$${newTotal.toLocaleString()}。`;

      if (window.confirm(confirmMsg)) {
          handleUpdateBid(orderId, slotIndex, bidInt, newTotal);
          setUpdatingSlot(null);
          setNewBidPrice('');
      }
  };

  // Helper: 渲染訂單頂部狀態 Badge
  const renderStatusBadge = (statusConfig) => (
      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
          {statusConfig.label}
      </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden" onClick={onClose}>
        <div className="bg-slate-50 rounded-2xl shadow-2xl max-w-3xl w-full h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b bg-white flex justify-between items-center shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <img src={user.photoURL} className="w-12 h-12 rounded-full border-2 border-white shadow-md" alt="User"/>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-xl text-slate-800">{user.displayName}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Mail size={10}/> {user.email}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onLogout} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors"><LogOut size={16}/> {t('logout')}</button>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <h4 className="font-bold text-slate-700 text-lg flex items-center gap-2 mb-2"><History size={20}/> {t('my_orders')}</h4>
                
                {myOrders.length === 0 ? (
                    <div className="text-center py-20 opacity-50"><History size={64} className="mx-auto mb-4 text-slate-300"/><p>No orders yet</p></div>
                ) : (
                    myOrders.map((order) => {
                        const groupedSlots = {};
                        let firstSlotDate = null;
                        let hasRealTimeOutbid = false;
                        
                        // 檢查訂單是否有效 (已付款)
                        const isOrderEffective = ['won', 'paid_pending_selection', 'partially_outbid', 'outbid_needs_action', 'paid', 'completed'].includes(order.status);
                        // 檢查訂單是否付款中
                        const isPendingPayment = order.status === 'pending_auth' || order.status === 'pending_reauth';

                        // 🔥 1. 計算「動態預計金額」 (Projected Amount)
                        // 只計算那些「贏」或「領先」的 slot，排除被超越的 slot
                        let projectedAmount = 0;

                        if (order.detailedSlots) { 
                            order.detailedSlots.forEach((slot, index) => { 
                                const slotWithIndex = { ...slot, originalIndex: index };
                                if (!groupedSlots[slot.date]) groupedSlots[slot.date] = []; 
                                groupedSlots[slot.date].push(slotWithIndex);
                                
                                const slotKey = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                                const marketHighestPrice = existingBids ? (existingBids[slotKey] || 0) : 0;
                                const myBidPrice = parseInt(slot.bidPrice) || 0;
                                
                                // 判斷是否輸了
                                const isRealTimeOutbidCheck = isOrderEffective && myBidPrice < marketHighestPrice;
                                const isBackendOutbidCheck = slot.slotStatus === 'outbid';
                                const isLostCheck = slot.slotStatus === 'lost';

                                if (isRealTimeOutbidCheck) {
                                    hasRealTimeOutbid = true;
                                }

                                // 🔥 如果目前是領先或已贏，這筆錢就算在預計金額內
                                if (!isRealTimeOutbidCheck && !isBackendOutbidCheck && !isLostCheck) {
                                    projectedAmount += myBidPrice;
                                }
                            }); 
                            
                            if (order.detailedSlots.length > 0) {
                                const d = new Date(order.detailedSlots[0].date); 
                                d.setHours(parseInt(order.detailedSlots[0].hour), 0, 0, 0);
                                firstSlotDate = d;
                            }
                        }

                        // 後端結算金額 (如果已結算)
                        const actualWinningAmount = order.detailedSlots ? order.detailedSlots.reduce((sum, s) => {
                            const isLost = s.slotStatus === 'outbid' || s.slotStatus === 'lost';
                            if (['won', 'partially_won', 'paid', 'completed'].includes(order.status)) {
                                return isLost ? sum : sum + (parseInt(s.bidPrice)||0);
                            }
                            return sum + (parseInt(s.bidPrice)||0);
                        }, 0) : 0;

                        const isSettled = ['won', 'paid', 'completed', 'lost', 'partially_won'].includes(order.status);
                        
                        // 🔥 決定顯示哪個金額
                        // 1. 如果已結算 -> 顯示後端算好的 wonAmount
                        // 2. 如果待付款 -> 顯示全額 (Max)
                        // 3. 如果競價中/結算中 -> 顯示前端動態算的 projectedAmount (只含領先部分)
                        let displayAmount = 0;
                        if (isSettled) {
                            displayAmount = actualWinningAmount;
                        } else if (isPendingPayment) {
                            displayAmount = order.amount || 0;
                        } else {
                            displayAmount = projectedAmount;
                        }
                        
                        const now = new Date();
                        let revealTimeStr = "---";
                        let isOrderExpired = false;

                        if (firstSlotDate) {
                            const revealDate = new Date(firstSlotDate);
                            revealDate.setHours(revealDate.getHours() - 24); 
                            isOrderExpired = now >= revealDate;
                            revealTimeStr = revealDate.toLocaleString(lang === 'en' ? 'en-US' : 'zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        }

                        let statusConfig = { bg: 'bg-slate-100', text: 'text-slate-500', label: lang === 'en' ? 'Processing...' : '處理中...' };
                        
                        // Badge 狀態邏輯
                        if (isPendingPayment) {
                            if (isOrderExpired) {
                                statusConfig = { bg: 'bg-slate-200', text: 'text-slate-500', label: lang === 'en' ? 'Payment Failed / Expired' : '❌ 付款未完成 / 已失效' };
                            } else {
                                statusConfig = { bg: 'bg-purple-100', text: 'text-purple-700', label: lang === 'en' ? 'Payment Required' : '💳 等待付款' };
                            }
                        } else if (['won', 'paid', 'completed'].includes(order.status)) {
                            if (order.type === 'buyout') {
                                statusConfig = { bg: 'bg-emerald-100', text: 'text-emerald-800', label: lang === 'en' ? 'Purchased' : '已購買 (成功)' };
                            } else {
                                statusConfig = { bg: 'bg-green-100', text: 'text-green-700', label: t('status_won') };
                            }
                        } else if (order.status === 'partially_won') {
                            statusConfig = { bg: 'bg-emerald-100', text: 'text-emerald-700', label: lang==='en'?'Partially Won':'部分中標' };
                        } else if (order.status === 'lost') {
                            statusConfig = { bg: 'bg-gray-100', text: 'text-gray-500', label: t('status_lost') };
                        } else if (order.status === 'cancelled') {
                            statusConfig = { bg: 'bg-slate-100', text: 'text-slate-400', label: t('status_cancelled') };
                        } else if (order.status === 'outbid_needs_action') {
                            statusConfig = { bg: 'bg-red-50', text: 'text-red-600', label: t('status_outbid_needs_action') };
                        } else if (isOrderExpired && ['paid_pending_selection', 'partially_outbid'].includes(order.status)) {
                            statusConfig = { bg: 'bg-slate-200', text: 'text-slate-600', label: lang === 'en' ? 'Finalizing...' : '⏳ 正在結算...' };
                        } else if (order.status === 'paid_pending_selection') {
                            if (hasRealTimeOutbid) {
                                statusConfig = { bg: 'bg-yellow-100', text: 'text-yellow-700', label: lang === 'en' ? 'Outbid (Action Needed)' : '⚠️ 部份被超越' };
                            } else {
                                statusConfig = { bg: 'bg-blue-50', text: 'text-blue-700', label: t('status_paid_pending_selection') };
                            }
                        } else if (order.status === 'partially_outbid') {
                            statusConfig = { bg: 'bg-orange-50', text: 'text-orange-700', label: t('status_partially_outbid') };
                        }

                        return (
                            <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex items-center gap-3">
                                        {renderStatusBadge(statusConfig)}
                                        <span className="text-xs text-slate-400 font-mono">#{order.id.slice(0, 8)}</span>
                                    </div>
                                    <div className="text-right"><span className="text-xs text-slate-400 block">{order.displayTime}</span></div>
                                </div>

                                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-4">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{lang==='en'?'Type':'購買類型'}</p>
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                {order.type === 'buyout' ? <ShoppingBag size={16} className="text-emerald-500"/> : <Gavel size={16} className="text-blue-500"/>}
                                                {order.type === 'buyout' ? t('order_type_buyout') : t('order_type_bid')}
                                                {order.isBundle && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">Bundle</span>}
                                            </div>
                                        </div>

                                        {order.type === 'bid' && !['won','paid','completed','lost','cancelled'].includes(order.status) && !isOrderExpired && (
                                            <div className="bg-blue-50/50 border border-blue-100 rounded px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
                                                <Info size={14}/> <span>{t('reveal_time')}：<strong>{revealTimeStr}</strong> {t('before_24h')}</span>
                                            </div>
                                        )}

                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">{t('slot_details')}</p>
                                            <div className="space-y-3">
                                                {Object.keys(groupedSlots).sort().map(date => (
                                                    <div key={date} className="flex flex-col gap-2 border-b border-slate-100 pb-2 last:border-0">
                                                        <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono w-fit">{date}</div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {groupedSlots[date].map((slot) => {
                                                                const slotKey = `${slot.date}-${parseInt(slot.hour)}-${String(slot.screenId)}`;
                                                                const marketHighestPrice = existingBids ? (existingBids[slotKey] || 0) : 0;
                                                                const myBidPrice = parseInt(slot.bidPrice) || 0;
                                                                
                                                                const isRealTimeOutbid = myBidPrice < marketHighestPrice;
                                                                const isBackendOutbid = slot.slotStatus === 'outbid'; 
                                                                const isLost = slot.slotStatus === 'lost';
                                                                const isFinalWon = isSettled && (slot.slotStatus === 'won' || (!isBackendOutbid && !isLost));
                                                                
                                                                const isLeading = isOrderEffective && !isSettled && !isBackendOutbid && !isLost && !isRealTimeOutbid && !isOrderExpired;
                                                                const isProcessingResult = isOrderEffective && !isSettled && isOrderExpired;

                                                                const showOutbidWarning = isOrderEffective && (isBackendOutbid || isRealTimeOutbid) && !isOrderExpired;
                                                                const showLost = isLost || ((isBackendOutbid || isRealTimeOutbid) && isOrderExpired);
                                                                
                                                                const showIncreaseButton = (showOutbidWarning || isLost) && !isOrderExpired && !isFinalWon;
                                                                const showEditButton = isPendingPayment && !isOrderExpired;

                                                                const isEditing = updatingSlot === `${order.id}-${slot.originalIndex}`;
                                                                
                                                                const renderSlotBadge = () => {
                                                                    if (isFinalWon) {
                                                                        if (order.type === 'buyout') return <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-emerald-200"><CheckCircle size={8}/> BOUGHT</span>;
                                                                        return <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-green-200"><Trophy size={8}/> WIN</span>;
                                                                    }
                                                                    if (isLeading) {
                                                                        return <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-blue-200"><Flag size={8}/> {lang==='en'?'Leading':'領先'}</span>;
                                                                    }
                                                                    if (isProcessingResult) {
                                                                        return <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-slate-200"><Hourglass size={8}/> 結算中</span>;
                                                                    }
                                                                    if (showOutbidWarning) {
                                                                        return <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-yellow-200 animate-pulse"><AlertTriangle size={8}/> 被超越</span>;
                                                                    }
                                                                    if (showLost) {
                                                                        return <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-red-200"><Ban size={8}/> LOST</span>;
                                                                    }
                                                                    if (isPendingPayment) {
                                                                        return <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 border border-purple-200"><CreditCard size={8}/> 待付款</span>;
                                                                    }
                                                                    return null;
                                                                };

                                                                let borderClass = "border-slate-200";
                                                                let bgClass = "bg-white";
                                                                if (isFinalWon) { borderClass = "border-green-200"; bgClass = "bg-green-50/30"; }
                                                                else if (isLeading) { borderClass = "border-blue-200"; bgClass = "bg-blue-50/30"; } 
                                                                else if (showOutbidWarning) { borderClass = "border-yellow-300"; bgClass = "bg-yellow-50"; }
                                                                else if (showLost) { borderClass = "border-red-200"; bgClass = "bg-red-50/30"; }
                                                                else if (isPendingPayment) { borderClass = "border-purple-300"; bgClass = "bg-purple-50"; } 
                                                                else if (isProcessingResult) { borderClass = "border-slate-200"; bgClass = "bg-slate-100/50"; }

                                                                const inputPlaceholder = isPendingPayment ? "修改金額" : `>${Math.max(slot.bidPrice, marketHighestPrice)}`;

                                                                return (
                                                                    <div key={slot.originalIndex} className={`flex items-center justify-between p-2 rounded border ${borderClass} ${bgClass}`}>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex flex-col">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                                                        <Clock size={10}/> {String(slot.hour).padStart(2,'0')}:00
                                                                                    </span>
                                                                                    {renderSlotBadge()}
                                                                                </div>
                                                                                <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Monitor size={10}/> {slot.screenName || slot.screenId}</span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-2">
                                                                            {isEditing ? (
                                                                                <div className="flex items-center gap-1 animate-in slide-in-from-right duration-200">
                                                                                    <input type="number" autoFocus className="w-16 text-xs border rounded px-1 py-1" placeholder={inputPlaceholder} value={newBidPrice} onChange={e => setNewBidPrice(e.target.value)} />
                                                                                    <button onClick={() => onUpdateBidSubmit(order.id, slot.originalIndex, slot.bidPrice, currentTotalAmount - parseInt(slot.bidPrice), isPendingPayment, marketHighestPrice)} className="bg-green-500 text-white p-1 rounded hover:bg-green-600"><CheckCircle size={12}/></button>
                                                                                    <button onClick={() => {setUpdatingSlot(null); setNewBidPrice('')}} className="bg-slate-200 text-slate-500 p-1 rounded hover:bg-slate-300"><X size={12}/></button>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <div className="flex flex-col items-end">
                                                                                        <span className={`text-xs font-bold ${isPendingPayment ? 'text-purple-600' : (showOutbidWarning || showLost) ? 'text-red-500 line-through' : 'text-slate-600'}`}>HK${slot.bidPrice}</span>
                                                                                        <span className="text-[8px] text-slate-400">最高: HK${marketHighestPrice}</span>
                                                                                    </div>
                                                                                    
                                                                                    {showIncreaseButton && (
                                                                                        <button onClick={() => { setUpdatingSlot(`${order.id}-${slot.originalIndex}`); setNewBidPrice(''); }} className="text-[9px] bg-red-600 text-white px-2 py-1 rounded font-bold hover:bg-red-700 flex items-center gap-1 shadow-sm transition-all animate-pulse"><Zap size={10}/> {t('increase_bid')}</button>
                                                                                    )}
                                                                                    {showEditButton && (
                                                                                        <button onClick={() => { setUpdatingSlot(`${order.id}-${slot.originalIndex}`); setNewBidPrice(''); }} className="text-[9px] bg-purple-600 text-white px-2 py-1 rounded font-bold hover:bg-purple-700 flex items-center gap-1 shadow-sm transition-all"><Edit size={10}/> 修改</button>
                                                                                    )}
                                                                                    {showLost && !showIncreaseButton && (
                                                                                        <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-1 rounded font-bold flex items-center gap-1 cursor-not-allowed border border-slate-200"><Lock size={10}/> {t('bid_closed')}</span>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-1 border-l border-slate-100 pl-0 md:pl-6 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{t('amount_paid')}</p>
                                            <p className="text-2xl font-bold text-slate-800">HK$ {displayAmount.toLocaleString()}</p>
                                            {/* 🔥 根據狀態顯示不同的文字說明 */}
                                            <p className="text-xs text-slate-400 mt-1">
                                                {isSettled ? (lang==='en'?'Paid (Final Settlement)':'已成功扣款 (最終結算)') : 
                                                 isPendingPayment ? (lang==='en'?'Pre-auth will be held':'預授權將被凍結 (最高)') : 
                                                 isOrderExpired ? (lang==='en'?'Estimated winning amount':'預計成交金額 (結算中)') :
                                                 (lang==='en'?'Projected winning amount':'預計成交金額 (競價中)')}
                                            </p>
                                            
                                            {isPendingPayment && !isOrderExpired && (
                                                <button onClick={() => onResumePayment(order)} className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm animate-pulse">
                                                    <CreditCard size={14}/> {lang==='en'?'Complete Payment':'繼續付款'}
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="mt-6 pt-6 border-t border-slate-100">
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">{lang==='en'?'Creative':'廣告素材'}</p>
                                            {order.hasVideo ? (
                                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center"><CheckCircle size={24} className="text-green-500 mx-auto mb-1"/><p className="text-xs font-bold text-green-700">{t('video_uploaded')}</p><p className="text-[10px] text-green-600 truncate px-1">{order.videoName}</p></div>
                                            ) : (
                                                (order.status !== 'lost' && order.status !== 'cancelled') ? (
                                                    <button onClick={() => onUploadClick(order.id)} className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg p-3 flex flex-col items-center transition-colors group"><UploadCloud size={20} className="mb-1 group-hover:scale-110 transition-transform"/><span className="text-xs font-bold">{t('upload_video')}</span></button>
                                                ) : <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center text-slate-400 text-xs">{t('no_upload_needed')}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    </div>
  );
};

export default MyOrdersModal;