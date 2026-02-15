import React, { useState } from 'react';
import { 
  Loader2, X, MapPin, Layers, Image as ImageIcon, FileText, Map, Clock, 
  Copy, Save, CheckCircle, UploadCloud, AlertCircle, Trophy, Monitor, AlertTriangle
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase'; 

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];

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
  const safeStatus = status || 'unknown';
  const map = {
    paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' },
    paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    lost: { label: '未中標', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    outbid_needs_action: { label: '被超越(需操作)', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    partially_outbid: { label: '部分被超越', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' }
  };
  const s = map[safeStatus] || { label: safeStatus, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-[10px] px-2 py-1 rounded border font-bold whitespace-nowrap ${s.cls}`}>{s.label}</span>;
};

// --- 彈出視窗 (Modals) ---
export const ScreenModal = ({ isOpen, onClose, isEdit, data, setData, handleApplyToAllDays, toggleTierHour, activeDayTab, setActiveDayTab, onSave, onImageUpload, isUploading }) => {
  const [uploadingField, setUploadingField] = useState(null);

  const uploadVideoFile = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const storageRef = ref(storage, `screens_videos/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        null,
        (error) => {
          console.error(error);
          alert("❌ 影片上傳失敗");
          setUploadingField(null);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setData({ ...data, [fieldName]: downloadURL }); 
          setUploadingField(null);
        }
      );
    } catch (err) {
      console.error(err);
      alert("❌ 發生錯誤");
      setUploadingField(null);
    }
  };

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
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">屏幕名稱</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 ring-blue-100 outline-none transition-all"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">底價 (Base Price)</label><div className="flex items-center gap-2 border rounded px-3 py-2"><span className="text-slate-400">$</span><input type="number" value={data.basePrice} onChange={e => setData({...data, basePrice: e.target.value})} className="w-full text-sm outline-none font-bold"/></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">位置</label><div className="flex items-center gap-2 border rounded px-3 py-2"><MapPin size={14} className="text-slate-400"/><input type="text" value={data.location} onChange={e => setData({...data, location: e.target.value})} className="w-full text-sm outline-none" placeholder="e.g. 皇后大道中 100號"/></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">區域 (District)</label><input type="text" value={data.district} onChange={e => setData({...data, district: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Central"/></div>
                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Bundle Group (Optional)</label><div className="flex items-center gap-2 border rounded px-3 py-2"><Layers size={14} className="text-slate-400"/><input type="text" value={data.bundleGroup} onChange={e => setData({...data, bundleGroup: e.target.value})} className="w-full text-sm outline-none" placeholder="e.g. central_network"/></div><p className="text-[10px] text-slate-400 mt-1">相同 Bundle Group ID 的屏幕會自動組成聯播網。</p></div>
                    
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <ImageIcon size={12}/> 圖片集 (最多 3 張)
                        </label>
                        <div className="space-y-3">
                            {data.images && data.images.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {data.images.map((url, index) => (
                                        <div key={index} className="relative w-24 h-24 border rounded-lg overflow-hidden group bg-slate-100 shadow-sm">
                                            <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newImages = data.images.filter((_, i) => i !== index);
                                                    setData({ ...data, images: newImages });
                                                }}
                                                className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-700"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(!data.images || data.images.length < 3) && (
                                <div className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-3 py-2 bg-slate-50 hover:bg-white transition-colors">
                                    <ImageIcon size={16} className="text-slate-400"/>
                                    <input 
                                        type="text" 
                                        placeholder="貼上網址或點擊右側上傳 ->" 
                                        className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = e.target.value.trim();
                                                if (val) {
                                                    setData(prev => ({ ...prev, images: [...(prev.images || []), val] }));
                                                    e.target.value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <div className="relative group">
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            onChange={(e) => onImageUpload(e.target.files[0], data.images ? data.images.length : 0)}
                                            disabled={isUploading}
                                        />
                                        <button className={`p-2 rounded border border-slate-200 hover:bg-blue-50 text-blue-600 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {isUploading ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

            
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            Google Map 搜尋字眼 (選填)
                        </label>
                        <div className="flex items-center gap-2 border rounded px-3 py-2">
                            <Map size={14} className="text-slate-400"/>
                            <input 
                                type="text" 
                                value={data.mapUrl || ''} 
                                onChange={e => setData({...data, mapUrl: e.target.value})} 
                                className="w-full text-sm outline-none" 
                                placeholder="例如：銅鑼灣時代廣場 (留空則自動以屏幕名稱及地址搜尋)"
                            />
                        </div>
                    </div>

                    
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1 text-red-500"><AlertTriangle size={12}/> 注意事項 / 限制條款 (Important Notes)</label>
                        <div className="flex items-start gap-2 border border-red-200 bg-red-50 rounded px-3 py-2">
                            <textarea rows="2" value={data.restrictions || ''} onChange={e => setData({...data, restrictions: e.target.value})} className="w-full text-sm outline-none resize-none bg-transparent text-red-700 placeholder-red-300" placeholder="例如：此屏幕位於清真餐廳旁，禁止播放豬肉相關廣告。"/>
                        </div>
                    </div>

                    <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">屏幕規格</label><div className="flex items-start gap-2 border rounded px-3 py-2"><FileText size={14} className="text-slate-400 mt-1"/><textarea rows="3" value={data.specifications} onChange={e => setData({...data, specifications: e.target.value})} className="w-full text-sm outline-none resize-none" placeholder="e.g. 1920x1080px..."/></div></div>
                    
                    <div className="col-span-2 border-t pt-4 mt-2">
                        <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">營銷數據</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">尺寸 (Size)</label><input type="text" value={data.size} onChange={e => setData({...data, size: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder='e.g. 32"' /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">方向 (Orientation)</label><input type="text" value={data.orientation} onChange={e => setData({...data, orientation: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Portrait" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">每日人流</label><input type="text" value={data.footfall} onChange={e => setData({...data, footfall: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">受眾類型</label><input type="text" value={data.audience} onChange={e => setData({...data, audience: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">播放時間</label><input type="text" value={data.operatingHours} onChange={e => setData({...data, operatingHours: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">解析度</label><input type="text" value={data.resolution} onChange={e => setData({...data, resolution: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" /></div>
                        </div>
                    </div>

                    {/* 播片控制項 + 一鍵上傳 */}
                    <div className="col-span-2 border-t pt-4 mt-2">
                        <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase flex items-center gap-1">
                          播片控制 (Player Control)
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                            
                            {/* Priority 3: 預設影片 */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    預設宣傳片 URL (Priority 3 - 沒人買時播放)
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={data.defaultVideo || ''} 
                                        onChange={e => setData({...data, defaultVideo: e.target.value})} 
                                        className="flex-1 border rounded px-3 py-2 text-sm bg-white outline-none focus:ring-2 ring-blue-100" 
                                        placeholder="輸入 mp4 網址或按右方上傳..."
                                    />
                                    <div className="relative group shrink-0">
                                        <input 
                                            type="file" 
                                            accept="video/mp4,video/mov,video/*"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            onChange={(e) => uploadVideoFile(e, 'defaultVideo')}
                                            disabled={uploadingField === 'defaultVideo'}
                                        />
                                        <button type="button" className={`h-full px-3 rounded border border-slate-200 bg-white hover:bg-blue-50 text-blue-600 transition-colors flex items-center justify-center gap-1 ${uploadingField === 'defaultVideo' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {uploadingField === 'defaultVideo' ? <Loader2 size={16} className="animate-spin"/> : <><UploadCloud size={16}/> <span className="text-xs font-bold">上傳</span></>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Priority 1: 緊急插播 */}
                            <div className="bg-red-50 p-3 rounded-lg border border-red-200 shadow-inner">
                                <label className="block text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                                    <AlertTriangle size={14}/> 緊急插播 URL (Priority 1 - 強制覆蓋)
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={data.emergencyOverride || ''} 
                                        onChange={e => setData({...data, emergencyOverride: e.target.value})} 
                                        className="flex-1 border border-red-300 rounded px-3 py-2 text-sm bg-white text-red-700 outline-none focus:ring-2 ring-red-200" 
                                        placeholder="留空代表全自動運作。輸入網址即強制轉播！"
                                    />
                                    <div className="relative group shrink-0">
                                        <input 
                                            type="file" 
                                            accept="video/mp4,video/mov,video/*"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            onChange={(e) => uploadVideoFile(e, 'emergencyOverride')}
                                            disabled={uploadingField === 'emergencyOverride'}
                                        />
                                        <button type="button" className={`h-full px-3 rounded border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors flex items-center justify-center gap-1 ${uploadingField === 'emergencyOverride' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {uploadingField === 'emergencyOverride' ? <Loader2 size={16} className="animate-spin"/> : <><UploadCloud size={16}/> <span className="text-xs font-bold">上傳</span></>}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-red-500 mt-1">⚠️ 警告：一旦有影片，將無視所有客人的訂單，強制播放此影片直至清空為止。</p>
                            </div>

                        </div>
                    </div>

                </div>

                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-700 flex items-center gap-2"><Clock size={16}/> 時段設定</h4><button onClick={handleApplyToAllDays} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-100 flex items-center gap-1"><Copy size={12}/> 複製至所有日子</button></div>
                    <div className="flex gap-1 mb-4 border-b border-slate-200">{WEEKDAYS_ZH.map((d, i) => (
                        <button key={i} onClick={() => setActiveDayTab(i)} className={`flex-1 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${activeDayTab === i ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{d}</button>
                    ))}</div>
                    <div className="space-y-4">
                        <div><span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">🔥 Prime Time (3.5x)</span><div className="flex flex-wrap gap-1 mt-2">{Array.from({length: 24}, (_, i) => i).map(h => (<button key={h} onClick={() => toggleTierHour('prime', h)} className={`w-8 h-8 text-xs font-bold rounded border ${data.tierRules[activeDayTab]?.prime?.includes(h) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{h}</button>))}</div></div>
                        <div><span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">⭐ Gold Time (1.8x)</span><div className="flex flex-wrap gap-1 mt-2">{Array.from({length: 24}, (_, i) => i).map(h => (<button key={h} onClick={() => toggleTierHour('gold', h)} className={`w-8 h-8 text-xs font-bold rounded border ${data.tierRules[activeDayTab]?.gold?.includes(h) ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{h}</button>))}</div></div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded text-sm font-bold text-slate-500 hover:bg-slate-200">取消</button>
                <button onClick={onSave} className="px-6 py-2 rounded text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2">
                    <Save size={16}/> {isEdit ? '儲存變更' : '建立屏幕'}
                </button>
            </div>
        </div>
    </div>
  );
};

// 🔥 原本遺失的 SlotGroupModal 🔥
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