import React from 'react';
import { 
  Loader2, X, MapPin, Layers, Image as ImageIcon, FileText, Map, Clock, 
  Copy, Save, CheckCircle, UploadCloud, AlertCircle, Trophy, Monitor 
} from 'lucide-react';

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// --- 基礎組件 ---

export const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <Loader2 className="animate-spin text-blue-600" size={32} />
  </div>
);

export const ConfigSection = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-bold text-slate-700 border-b pb-1">{title}</h4>
    <div className="space-y-2">{children}</div>
  </div>
);

export const ConfigInput = ({ label, val, onChange, desc }) => {
  const percentage = val ? Math.round((parseFloat(val) - 1) * 100) : 0;
  const sign = percentage > 0 ? '+' : '';
  return (
    <div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-1">
      <div className="text-xs font-bold text-slate-600">
        {label} <span className="text-[10px] font-normal text-slate-400 block">{desc}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${percentage > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
          {sign}{percentage}%
        </span>
        <input
          type="number"
          step="0.05"
          value={val || 0}
          onChange={e => onChange(e.target.value)}
          className="w-16 border rounded px-2 py-1 text-sm font-bold text-right outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export const StatCard = ({ title, value, icon, bg, border }) => (
  <div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}>
    <div>
      <p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p>
      <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
    <div className="bg-white p-2 rounded-full shadow-sm">{icon}</div>
  </div>
);

export const StatusBadge = ({ status }) => {
  const map = {
    paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' },
    paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    lost: { label: '未中標', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    outbid_needs_action: { label: '被超越(需操作)', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    partially_outbid: { label: '部分被超越', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' }
  };
  const s = map[status] || { label: status, cls: 'bg-gray-100' };
  return <span className={`text-[10px] px-2 py-1 rounded border font-bold ${s.cls}`}>{s.label}</span>;
};

// --- 彈出視窗 (Modals) ---

export const ScreenModal = ({ isOpen, onClose, isEdit, data, setData, handleImageChange, handleApplyToAllDays, toggleTierHour, activeDayTab, setActiveDayTab, onSave }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col h-[90vh] animate-in zoom-in duration-200">
            <div className="p-4 border-b bg-slate-900 text-white rounded-t-xl flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><Monitor size={20}/> {isEdit ? '編輯屏幕' : '新增屏幕'}</h3>
                <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">屏幕名稱</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 中環旗艦店 A"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">底價 (Base Price)</label><div className="flex items-center gap-2 border rounded px-3 py-2"><span className="text-slate-400">$</span><input type="number" value={data.basePrice} onChange={e => setData({...data, basePrice: e.target.value})} className="w-full text-sm outline-none font-bold"/></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">位置</label><div className="flex items-center gap-2 border rounded px-3 py-2"><MapPin size={14} className="text-slate-400"/><input type="text" value={data.location} onChange={e => setData({...data, location: e.target.value})} className="w-full text-sm outline-none" placeholder="e.g. 皇后大道中 100號"/></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">區域 (District)</label><input type="text" value={data.district} onChange={e => setData({...data, district: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Central"/></div>
                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Bundle Group (Optional)</label><div className="flex items-center gap-2 border rounded px-3 py-2"><Layers size={14} className="text-slate-400"/><input type="text" value={data.bundleGroup} onChange={e => setData({...data, bundleGroup: e.target.value})} className="w-full text-sm outline-none" placeholder="e.g. central_network"/></div><p className="text-[10px] text-slate-400 mt-1">相同 Bundle Group ID 的屏幕會自動組成聯播網。</p></div>
                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">圖片集 (最多 3 張)</label><div className="space-y-2">{data.images.map((url, index) => (<div key={index} className="flex items-center gap-2 border rounded px-3 py-2"><ImageIcon size={14} className="text-slate-400"/><input type="text" value={url} onChange={e => handleImageChange(index, e.target.value)} className="w-full text-sm outline-none" placeholder={`Image URL ${index + 1} (https://...)`}/></div>))}</div></div>
                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Google Map Link</label><div className="flex items-center gap-2 border rounded px-3 py-2"><Map size={14} className="text-slate-400"/><input type="text" value={data.mapUrl} onChange={e => setData({...data, mapUrl: e.target.value})} className="w-full text-sm outline-none" placeholder="http://maps.google.com..."/></div></div>
                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">屏幕規格</label><div className="flex items-start gap-2 border rounded px-3 py-2"><FileText size={14} className="text-slate-400 mt-1"/><textarea rows="3" value={data.specifications} onChange={e => setData({...data, specifications: e.target.value})} className="w-full text-sm outline-none resize-none" placeholder="e.g. 1920x1080px..."/></div></div>
                    <div className="col-span-2 border-t pt-4 mt-2">
                        <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">營銷數據</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">每日人流</label><input type="text" value={data.footfall} onChange={e => setData({...data, footfall: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">受眾類型</label><input type="text" value={data.audience} onChange={e => setData({...data, audience: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">播放時間</label><input type="text" value={data.operatingHours} onChange={e => setData({...data, operatingHours: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">解析度</label><input type="text" value={data.resolution} onChange={e => setData({...data, resolution: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                        </div>
                    </div>
                </div>
                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-700 flex items-center gap-2"><Clock size={16}/> 時段設定</h4><button onClick={handleApplyToAllDays} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-100 flex items-center gap-1"><Copy size={12}/> 複製至所有日子</button></div>
                    <div className="flex gap-1 mb-4 border-b border-slate-200">{WEEKDAYS.map((day, idx) => (<button key={idx} onClick={() => setActiveDayTab(idx)} className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeDayTab === idx ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{day}</button>))}</div>
                    <div className="space-y-4">
                        <div><span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">🔥 Prime Time (3.5x)</span><div className="flex flex-wrap gap-1 mt-2">{Array.from({length: 24}, (_, i) => i).map(h => (<button key={h} onClick={() => toggleTierHour('prime', h)} className={`w-8 h-8 text-xs font-bold rounded border ${data.tierRules[activeDayTab]?.prime?.includes(h) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{h}</button>))}</div></div>
                        <div><span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">⭐ Gold Time (1.8x)</span><div className="flex flex-wrap gap-1 mt-2">{Array.from({length: 24}, (_, i) => i).map(h => (<button key={h} onClick={() => toggleTierHour('gold', h)} className={`w-8 h-8 text-xs font-bold rounded border ${data.tierRules[activeDayTab]?.gold?.includes(h) ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{h}</button>))}</div></div>
                    </div>
                </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 rounded text-sm font-bold text-slate-500 hover:bg-slate-200">取消</button><button onClick={onSave} className="px-6 py-2 rounded text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2"><Save size={16}/> {isEdit ? '儲存變更' : '建立屏幕'}</button></div>
        </div>
    </div>
  );
};

export const SlotGroupModal = ({ group, onClose, onReview, onMarkScheduled }) => {
  if (!group) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                    <Clock size={16}/> 時段詳情: {group[0].date} {group[0].hour}:00
                    <span className="bg-blue-600 px-2 py-0.5 rounded text-xs ml-2">{group.length} 個出價</span>
                </h3>
                <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded"><span className="text-xl">×</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {group.map((slot, index) => (
                    <div key={slot.orderId} className={`border rounded-lg p-4 flex gap-4 ${index===0 ? 'border-yellow-400 bg-yellow-50 ring-1 ring-yellow-200' : 'border-slate-200'}`}>
                        <div className="flex flex-col items-center justify-center min-w-[50px] border-r border-slate-200 pr-4">
                            {index === 0 ? <Trophy className="text-yellow-500 mb-1" size={24}/> : <span className="text-slate-400 font-bold text-lg">#{index+1}</span>}
                            <div className="text-xs font-bold text-slate-500">{slot.price === 'Buyout' ? 'Buyout' : `$${slot.price}`}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2">
                                <div><div className="font-bold text-slate-800 text-sm">{slot.userEmail}</div><div className="text-xs text-slate-500 font-mono">#{slot.orderId.slice(0,8)}</div></div>
                                <StatusBadge status={slot.status} />
                            </div>
                            <div className="flex gap-4 mt-3">
                                <div className="w-32 aspect-video bg-black rounded flex items-center justify-center overflow-hidden shrink-0">{slot.videoUrl ? <video src={slot.videoUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] text-white/50">No Video</span>}</div>
                                <div className="flex-1 flex flex-col justify-center gap-2">
                                    {slot.displayStatus === 'review_needed' && (<button onClick={() => onReview(slot.orderId, 'approve')} className="w-full bg-red-600 hover:bg-red-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2"><CheckCircle size={14}/> 審核通過</button>)}
                                    {slot.displayStatus === 'action_needed' && (<button onClick={() => onMarkScheduled(slot.orderId)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2"><UploadCloud size={14}/> 確認已編排</button>)}
                                    {slot.displayStatus === 'bidding' && (<div className="text-xs text-yellow-600 font-bold flex items-center gap-1"><Clock size={12}/> 等待結算中...</div>)}
                                    {slot.displayStatus === 'scheduled' && (<div className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> Ready</div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};