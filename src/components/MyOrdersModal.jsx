import React, { useState } from 'react';
import { LogOut, X, Mail, History, ShoppingBag, Gavel, Clock, Monitor, CheckCircle, UploadCloud, Info, AlertTriangle, Lock } from 'lucide-react'; // 🔥 Added Lock icon

const MyOrdersModal = ({ isOpen, user, myOrders, onClose, onLogout, onUploadClick, handleUpdateBid }) => {
  const [updatingSlot, setUpdatingSlot] = useState(null); // Track which slot is being updated
  const [newBidPrice, setNewBidPrice] = useState('');

  if (!isOpen || !user) return null;

  const onUpdateBidSubmit = (orderId, slotIndex, currentPrice) => {
      if (!newBidPrice || parseInt(newBidPrice) <= parseInt(currentPrice)) {
          alert("新出價必須高於目前出價！");
          return;
      }
      if (window.confirm(`確定將出價提高至 HK$${newBidPrice} 嗎？`)) {
          handleUpdateBid(orderId, slotIndex, parseInt(newBidPrice));
          setUpdatingSlot(null);
          setNewBidPrice('');
      }
  };

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
                    <button onClick={onLogout} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors">
                        <LogOut size={16}/> 登出
                    </button>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24}/>
                    </button>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <h4 className="font-bold text-slate-700 text-lg flex items-center gap-2 mb-2">
                    <History size={20}/> 我的訂單記錄
                </h4>
                
                {myOrders.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <History size={64} className="mx-auto mb-4 text-slate-300"/>
                        <p>暫無訂單記錄</p>
                    </div>
                ) : (
                    myOrders.map((order) => {
                        // 整理時段顯示 (Grouping) & 搵出最早時間
                        const groupedSlots = {};
                        let firstSlotDate = null;

                        if (order.detailedSlots) { 
                            order.detailedSlots.forEach((slot, index) => { 
                                // Attach original index for updating
                                const slotWithIndex = { ...slot, originalIndex: index };
                                if (!groupedSlots[slot.date]) groupedSlots[slot.date] = []; 
                                groupedSlots[slot.date].push(slotWithIndex); 
                            }); 

                            // 搵出最早個個 Slot 用黎計公佈時間
                            if (order.detailedSlots.length > 0) {
                                const first = order.detailedSlots[0];
                                firstSlotDate = new Date(`${first.date}T${String(first.hour).padStart(2,'0')}:00:00`);
                            }
                        }
                        
                        // 核心狀態顯示邏輯 (Status Config)
                        let statusConfig = { bg: 'bg-slate-100', text: 'text-slate-600', label: '處理中...' };
                        
                        if (order.status === 'won' || order.status === 'paid' || order.status === 'completed') {
                            statusConfig = { bg: 'bg-green-100', text: 'text-green-700', label: '🎉 已中標 / 已付款' };
                        } else if (order.status === 'paid_pending_selection') {
                            statusConfig = { bg: 'bg-blue-50', text: 'text-blue-700', label: '⏳ 競價中 (等待結算)' };
                        } else if (order.status === 'partially_outbid' || order.status === 'outbid_needs_action') {
                            statusConfig = { bg: 'bg-red-50', text: 'text-red-600', label: '⚠️ 部分出價被超越 (需操作)' };
                        } else if (order.status === 'pending_auth') {
                            statusConfig = { bg: 'bg-orange-50', text: 'text-orange-600', label: '🏦 銀行授權中...' };
                        } else if (order.status === 'lost') {
                            statusConfig = { bg: 'bg-slate-100', text: 'text-slate-400', label: '❌ 未中標 (額度已釋放)' };
                        }

                        // 計算公佈時間 (播放時間 - 24小時)
                        let revealTimeStr = "---";
                        if (firstSlotDate) {
                            const revealDate = new Date(firstSlotDate);
                            revealDate.setHours(revealDate.getHours() - 24);
                            revealTimeStr = revealDate.toLocaleString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        }

                        return (
                            <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                {/* Order Header */}
                                <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
                                            {statusConfig.label}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">#{order.id.slice(0, 8)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-400 block">{order.displayTime}</span>
                                    </div>
                                </div>

                                {/* Order Body */}
                                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Details Column */}
                                    <div className="md:col-span-2 space-y-4">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">購買類型</p>
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                {order.type === 'buyout' ? <ShoppingBag size={16} className="text-emerald-500"/> : <Gavel size={16} className="text-blue-500"/>}
                                                {order.type === 'buyout' ? '直接買斷 (Buyout)' : '競價投標 (Bidding)'}
                                                {order.isBundle && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">Bundle</span>}
                                            </div>
                                        </div>

                                        {/* 公佈結果時間 (只在 Bid 單顯示) */}
                                        {order.type === 'bid' && (order.status === 'paid_pending_selection' || order.status === 'partially_outbid') && (
                                            <div className="bg-blue-50/50 border border-blue-100 rounded px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
                                                <Info size={14}/> <span>預計揭曉結果時間：<strong>{revealTimeStr}</strong> (播放前 24 小時)</span>
                                            </div>
                                        )}

                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">已選時段詳情</p>
                                            {order.detailedSlots ? (
                                                <div className="space-y-3">
                                                    {Object.keys(groupedSlots).sort().map(date => (
                                                        <div key={date} className="flex flex-col gap-2 border-b border-slate-100 pb-2 last:border-0">
                                                            <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono w-fit">{date}</div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {groupedSlots[date].map((slot) => {
                                                                    const isOutbid = slot.slotStatus === 'outbid';
                                                                    const isEditing = updatingSlot === `${order.id}-${slot.originalIndex}`;
                                                                    
                                                                    // 🔥🔥🔥 1. 新增：過期檢查邏輯 🔥🔥🔥
                                                                    const now = new Date();
                                                                    const slotTime = new Date(`${slot.date}T${String(slot.hour).padStart(2,'0')}:00:00`);
                                                                    const isExpired = now >= slotTime;

                                                                    return (
                                                                        <div key={slot.originalIndex} className={`flex items-center justify-between p-2 rounded border ${isOutbid ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1"><Clock size={10}/> {String(slot.hour).padStart(2,'0')}:00</span>
                                                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><Monitor size={10}/> {slot.screenName?.split(' ')[0] || slot.screenId}</span>
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center gap-2">
                                                                                {isEditing ? (
                                                                                    <div className="flex items-center gap-1 animate-in slide-in-from-right duration-200">
                                                                                        <input 
                                                                                            type="number" 
                                                                                            autoFocus
                                                                                            className="w-16 text-xs border rounded px-1 py-1"
                                                                                            placeholder={`>${slot.bidPrice}`}
                                                                                            value={newBidPrice}
                                                                                            onChange={e => setNewBidPrice(e.target.value)}
                                                                                        />
                                                                                        <button onClick={() => onUpdateBidSubmit(order.id, slot.originalIndex, slot.bidPrice)} className="bg-green-500 text-white p-1 rounded"><CheckCircle size={12}/></button>
                                                                                        <button onClick={() => {setUpdatingSlot(null); setNewBidPrice('')}} className="bg-slate-200 text-slate-500 p-1 rounded"><X size={12}/></button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        <span className={`text-xs font-bold ${isOutbid ? 'text-red-500 line-through' : 'text-slate-600'}`}>
                                                                                            ${slot.bidPrice}
                                                                                        </span>
                                                                                        
                                                                                        {/* 🔥🔥🔥 2. 修改：按鈕邏輯 (過期變灰色) 🔥🔥🔥 */}
                                                                                        {isOutbid && (
                                                                                            isExpired ? (
                                                                                                <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded font-bold flex items-center gap-1 cursor-not-allowed">
                                                                                                    <Lock size={10}/> 已截標
                                                                                                </span>
                                                                                            ) : (
                                                                                                <button 
                                                                                                    onClick={() => { setUpdatingSlot(`${order.id}-${slot.originalIndex}`); setNewBidPrice(''); }}
                                                                                                    className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-200 flex items-center gap-1 transition-colors"
                                                                                                >
                                                                                                    <AlertTriangle size={10}/> 加價
                                                                                                </button>
                                                                                            )
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
                                            ) : (
                                                <div className="text-sm text-slate-500 bg-slate-50 p-2 rounded">{order.timeSlotSummary || '沒有詳細時段資料'}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Amount & Actions Column */}
                                    <div className="md:col-span-1 border-l border-slate-100 pl-0 md:pl-6 flex flex-col justify-between">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">成交金額</p>
                                            <p className="text-2xl font-bold text-slate-800">HK$ {order.amount?.toLocaleString()}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {order.status === 'won' || order.status === 'paid' ? '已成功扣款' : 
                                                 (order.status === 'paid_pending_selection' || order.status === 'partially_outbid') ? '預授權已凍結 (未扣款)' : 
                                                 order.status === 'lost' ? '已取消授權' : 
                                                 '等待處理...'}
                                            </p>
                                        </div>
                                        
                                        <div className="mt-6 pt-6 border-t border-slate-100">
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">廣告素材</p>
                                            {order.hasVideo ? (
                                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                                                    <CheckCircle size={24} className="text-green-500 mx-auto mb-1"/>
                                                    <p className="text-xs font-bold text-green-700">已上傳</p>
                                                    <p className="text-[10px] text-green-600 truncate px-1">{order.videoName}</p>
                                                </div>
                                            ) : (
                                                // 只要不是 Lost，都允許上傳 (讓用戶可以提早準備)
                                                (order.status !== 'lost') ? (
                                                    <button 
                                                        onClick={() => onUploadClick(order.id)} 
                                                        className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg p-3 flex flex-col items-center transition-colors group"
                                                    >
                                                        <UploadCloud size={20} className="mb-1 group-hover:scale-110 transition-transform"/>
                                                        <span className="text-xs font-bold">立即上傳影片</span>
                                                    </button>
                                                ) : (
                                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center text-slate-400 text-xs">無需上傳</div>
                                                )
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