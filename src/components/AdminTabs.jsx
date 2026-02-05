import React from 'react';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Search, Video, Monitor, Save, Trash2, 
  List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X, CheckCircle, XCircle,
  Mail, MessageCircle, ChevronLeft, ChevronRight, AlertCircle, Edit, MapPin, Layers 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { StatCard, StatusBadge, ConfigSection, ConfigInput } from './AdminUI';

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// --- 1. Dashboard View ---
export const DashboardView = ({ stats, COLORS }) => (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="總營業額" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
            <StatCard title="待審核" value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
            <StatCard title="有效訂單" value={stats.validOrders} icon={<Users className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
            <StatCard title="總記錄" value={stats.totalOrders} icon={<List className="text-slate-500"/>} bg="bg-slate-50" border="border-slate-100" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col"><h3 className="font-bold mb-4">每日生意額</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer></div></div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col"><h3 className="font-bold mb-4">訂單狀態</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
        </div>
    </div>
);

// --- 2. Orders View ---
export const OrdersView = ({ orders, selectedIds, onSelect, onBulkAction, customerHistory, statusFilter, setStatusFilter, searchTerm, setSearchTerm, onDeleteOrder }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
            <div className="flex items-center gap-2 flex-1">
                <Search className="text-slate-400" size={16}/>
                <input type="text" placeholder="搜尋 ID / Email..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-2 border rounded px-2 py-1 text-sm outline-none w-64"/>
                <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="all">所有狀態</option><option value="paid_pending_selection">競價中</option><option value="won">成功 (Won)</option><option value="paid">已完成 (Paid)</option><option value="cancelled">已取消</option></select>
            </div>
            {selectedIds.size > 0 && <button onClick={() => onBulkAction('cancel')} className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 animate-pulse"><Trash2 size={14}/> 批量取消 ({selectedIds.size})</button>}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4 w-10 text-center">#</th><th className="p-4">時間</th><th className="p-4 w-1/3">訂單詳情 / 聯絡</th><th className="p-4 text-right">金額</th><th className="p-4 text-center">狀態</th><th className="p-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {orders.map(order => {
                        const isRepeat = customerHistory[order.userEmail] > 1;
                        return (
                            <tr key={order.id} className={`hover:bg-slate-50 ${selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                <td className="p-4 text-center"><input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => { const n = new Set(selectedIds); n.has(order.id)?n.delete(order.id):n.add(order.id); onSelect(n); }} /></td>
                                <td className="p-4 text-slate-500 whitespace-nowrap align-top">{order.createdAtDate ? order.createdAtDate.toLocaleString('zh-HK') : 'N/A'}</td>
                                <td className="p-4 align-top">
                                    <div className="font-mono text-xs font-bold text-slate-700">#{order.id.slice(0,8)}</div>
                                    <div className="my-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                        <div className="text-xs text-slate-700 font-bold flex items-center gap-2 mb-1">{order.userEmail}{isRepeat && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5"><Star size={10} fill="currentColor"/> VIP</span>}</div>
                                        <div className="flex flex-wrap gap-2 mt-2"><a href={`mailto:${order.userEmail}`} className="text-[10px] px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 flex items-center gap-1"><Mail size={12}/> Email</a>{(order.mobile) && <span className="text-[10px] px-2 py-1 bg-green-50 border border-green-200 rounded text-green-700 flex items-center gap-1"><MessageCircle size={12}/> {order.mobile}</span>}</div>
                                    </div>
                                    <div className="mb-2">{order.hasVideo ? <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-100"><CheckCircle size={12}/> 影片已上傳</span> : <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100 animate-pulse"><AlertTriangle size={12}/> ⚠️ 欠片</span>}</div>
                                    <div className="text-xs text-slate-500 font-bold mb-1">時段:</div>
                                    <div className="bg-white border border-slate-200 rounded p-2 text-xs space-y-1 max-h-32 overflow-y-auto">{order.detailedSlots && order.detailedSlots.map((slot, idx) => (<div key={idx} className="flex gap-2 text-slate-600"><span className="font-mono bg-slate-100 px-1 rounded">{slot.date}</span><span className="font-bold text-slate-800">{String(slot.hour).padStart(2,'0')}:00</span><span className="text-slate-400">@ {slot.screenId}</span></div>))}</div>
                                </td>
                                <td className="p-4 text-right font-bold align-top">HK$ {order.amount?.toLocaleString()}</td>
                                <td className="p-4 text-center align-top"><StatusBadge status={order.status} /></td>
                                <td className="p-4 text-right align-top">{order.status !== 'cancelled' && <button onClick={() => onDeleteOrder(order.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-transparent hover:border-red-200">取消</button>}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

// --- 3. Review View ---
export const ReviewView = ({ orders, onReview, reviewNote, setReviewNote }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
        {orders.length === 0 ? <div className="col-span-full text-center p-10 text-slate-400">✅ 暫無待審核影片</div> : 
        orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl shadow-md border border-orange-200 overflow-hidden flex flex-col">
                <div className="bg-orange-50 p-3 border-b border-orange-100 flex justify-between items-center"><span className="text-xs font-bold text-orange-700 flex items-center gap-1"><Video size={14}/> 待審核</span></div>
                <div className="relative bg-black aspect-video w-full">{order.videoUrl ? <video controls src={order.videoUrl} className="w-full h-full object-contain" /> : <div className="flex items-center justify-center h-full text-white/50 text-xs">No Video File</div>}</div>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div><p className="text-xs text-slate-400">客戶</p><p className="font-bold text-sm">{order.userEmail}</p></div>
                    <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <button onClick={() => onReview(order.id, 'approve')} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"><CheckCircle size={16}/> 通過</button>
                        <div className="flex gap-2"><input type="text" placeholder="拒絕原因" className="flex-1 border rounded px-3 py-1.5 text-xs bg-slate-50" onChange={e => setReviewNote(e.target.value)} /><button onClick={() => onReview(order.id, 'reject')} className="bg-white text-red-600 border border-red-200 px-3 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center gap-1">拒絕</button></div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// --- 4. Analytics View ---
export const AnalyticsView = ({ stats, screens, selectedScreens, setSelectedScreens, selectedHours, setSelectedHours }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
            <div><h3 className="font-bold flex items-center gap-2"><TrendingUp size={18}/> 真實成交數據</h3><p className="text-xs text-slate-500">已選: {selectedScreens.size === 0 ? "全部" : `${selectedScreens.size} 部`}</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={() => setSelectedScreens(new Set())} className={`px-3 py-1 rounded text-xs font-bold border ${selectedScreens.size === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>全部</button>{screens.map(s => (<button key={s.id} onClick={() => {const n=new Set(selectedScreens); n.has(String(s.id))?n.delete(String(s.id)):n.add(String(s.id)); setSelectedScreens(n);}} className={`px-3 py-1 rounded text-xs font-bold border ${selectedScreens.has(String(s.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>{s.name}</button>))}</div>
        </div>
        <div className="flex flex-wrap gap-1 items-center mb-4"><span className="text-xs font-bold text-slate-500 uppercase w-12">Hours:</span><button onClick={() => setSelectedHours(new Set())} className={`w-8 h-8 rounded text-xs font-bold border ${selectedHours.size===0?'bg-slate-800 text-white':'bg-white text-slate-600'}`}>All</button>{Array.from({length:24},(_,i)=>i).map(h => (<button key={h} onClick={() => {const n=new Set(selectedHours); n.has(h)?n.delete(h):n.add(h); setSelectedHours(n);}} className={`w-8 h-8 rounded text-xs border font-bold transition-all ${selectedHours.has(h)?'bg-orange-500 text-white border-orange-500':'bg-white text-slate-600 hover:bg-slate-100'}`}>{h}</button>))}</div>
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white flex justify-between items-center shadow-lg"><div><h3 className="font-bold text-lg mb-1">平均成交價</h3></div><div className="text-right"><div className="text-3xl font-bold">HK$ {stats.summary.avgPrice.toLocaleString()}</div><div className="text-xs text-blue-200">{stats.summary.totalBids} 次出價</div></div></div>
        <div className="overflow-x-auto h-[400px] border rounded-lg">
            <table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0 z-10"><tr><th className="p-3 text-left">星期</th><th className="p-3 text-left">時段</th><th className="p-3 text-right">平均價</th><th className="p-3 text-right">次數</th><th className="p-3 text-left pl-6">建議</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{stats.rows.sort((a,b)=>(a.dayOfWeek-b.dayOfWeek)||(a.hour-b.hour)).map((m,i)=>(<tr key={i} className="hover:bg-slate-50"><td className="p-3 text-slate-600 font-medium">{WEEKDAYS[m.dayOfWeek]}</td><td className="p-3">{String(m.hour).padStart(2,'0')}:00</td><td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td><td className="p-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.totalBids>0?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-400'}`}>{m.totalBids}</span></td><td className="p-3 pl-6">{m.totalBids>3?<span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUp size={12}/> 加價</span>:m.totalBids===0?<span className="text-red-500 text-xs font-bold flex items-center gap-1"><ArrowDown size={12}/> 減價</span>:<span className="text-slate-300">-</span>}</td></tr>))}</tbody></table>
        </div>
    </div>
);

// --- 5. Config View ---
export const ConfigView = ({ config, setConfig, globalConfig, setGlobal, target, setTarget, screens, localRules, setLocalRules, onSave, onAddRule, onRuleChange, onRemoveRule }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b pb-4"><div><h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> 價格公式設定</h3></div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-600">對象:</span><select value={target} onChange={e => setTarget(e.target.value)} className="border-2 border-blue-100 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-800 outline-none"><option value="global">🌍 全局預設</option><option disabled>──────────</option>{screens.map(s => <option key={s.id} value={String(s.id)}>🖥️ {s.name}</option>)}</select></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ConfigSection title="時段倍率"><ConfigInput label="Prime (18-23)" val={config.primeMultiplier} onChange={v=>setConfig(p=>({...p, primeMultiplier:v}))} desc="預設 3.5x"/><ConfigInput label="Gold (12-14)" val={config.goldMultiplier} onChange={v=>setConfig(p=>({...p, goldMultiplier:v}))} desc="預設 1.8x"/><ConfigInput label="週末 (五/六)" val={config.weekendMultiplier} onChange={v=>setConfig(p=>({...p, weekendMultiplier:v}))} desc="預設 1.5x"/></ConfigSection>
            <ConfigSection title="附加費率"><ConfigInput label="Bundle" val={config.bundleMultiplier} onChange={v=>setConfig(p=>({...p, bundleMultiplier:v}))} desc="預設 1.25x"/><ConfigInput label="急單 (24h)" val={config.urgentFee24h} onChange={v=>setConfig(p=>({...p, urgentFee24h:v}))} desc="預設 1.5x"/><ConfigInput label="極速 (1h)" val={config.urgentFee1h} onChange={v=>setConfig(p=>({...p, urgentFee1h:v}))} desc="預設 2.0x"/></ConfigSection>
        </div>
        <div className="border-t pt-6 mt-6"><h3 className="font-bold text-lg flex items-center gap-2 mb-4"><Layers size={20}/> 組合規則</h3>
            {localRules.map((r,i)=>(<div key={i} className="flex gap-2 mb-2 items-center"><input value={r.screensStr} onChange={(e)=>onRuleChange(i,'screensStr',e.target.value)} className="border p-1 w-full rounded" placeholder="1,2,3" /><span className="font-bold text-xs">x</span><input type="number" step="0.05" value={r.multiplier} onChange={(e)=>onRuleChange(i,'multiplier',e.target.value)} className="border p-1 w-16 rounded font-bold text-blue-600"/><button onClick={()=>onRemoveRule(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div>))}
            <button onClick={onAddRule} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded"><Plus size={16}/> 新增</button>
        </div>
        <div className="mt-6 flex justify-end"><button onClick={onSave} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2"><Save size={18}/> 儲存設定</button></div>
    </div>
);

// --- 6. Calendar View ---
export const CalendarView = ({ date, setDate, mode, setMode, monthData, dayGrid, screens, onSelectSlot, onPrev, onNext }) => (
    <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col h-[750px] animate-in fade-in">
        <div className="flex justify-between items-center bg-slate-50 p-3 border-b border-slate-200">
            <div className="flex gap-4 items-center">
                <h2 className="text-lg font-bold flex items-center gap-2"><Calendar size={20}/> 排程</h2>
                <div className="flex bg-slate-200 rounded p-1"><button onClick={()=>setMode('month')} className={`px-3 py-1 text-xs font-bold rounded ${mode==='month'?'bg-white shadow text-slate-800':'text-slate-500'}`}>月</button><button onClick={()=>setMode('day')} className={`px-3 py-1 text-xs font-bold rounded ${mode==='day'?'bg-white shadow text-slate-800':'text-slate-500'}`}>日</button></div>
                <div className="flex items-center gap-1 bg-white border p-1 rounded-lg"><button onClick={onPrev} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button><span className="px-3 font-mono font-bold text-sm min-w-[100px] text-center">{mode==='month'?date.toLocaleDateString('zh-HK',{year:'numeric',month:'long'}):date.toLocaleDateString()}</span><button onClick={onNext} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button></div>
            </div>
            <div className="flex gap-3 text-[10px] font-medium"><span className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-400 rounded-full"></div> 競價</span><span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> 待審</span><span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Ready</span></div>
        </div>
        {mode === 'month' && (
            <div className="flex-1 p-4 overflow-auto">
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">{d}</div>)}
                    {Array.from({length: new Date(date.getFullYear(), date.getMonth(), 1).getDay()}).map((_,i)=><div key={`e-${i}`} className="bg-white min-h-[100px]"></div>)}
                    {Object.entries(monthData).map(([dStr, d]) => (
                        <div key={dStr} onClick={()=>{setDate(new Date(dStr)); setMode('day');}} className="bg-white min-h-[100px] p-2 hover:bg-blue-50 cursor-pointer relative group">
                            <div className="text-xs font-bold text-slate-700 mb-2">{dStr.split('-')[2]}</div>
                            <div className="space-y-1">{d.pending>0 && <div className="text-[10px] bg-red-100 text-red-700 px-1 rounded flex justify-between"><span>待審</span><span>{d.pending}</span></div>}{d.scheduled>0 && <div className="text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded flex justify-between"><span>Ready</span><span>{d.scheduled}</span></div>}{d.bidding>0 && <div className="text-[10px] bg-yellow-50 text-yellow-600 px-1 rounded flex justify-between"><span>競價</span><span>{d.bidding}</span></div>}</div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        {mode === 'day' && (
            <div className="flex-1 overflow-auto flex flex-col min-h-0">
                <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10"><div className="w-12 shrink-0 border-r border-slate-200 p-2 text-[10px] font-bold text-slate-400">Time</div>{screens.map(s=>(<div key={s.id} className="flex-1 min-w-[120px] border-r border-slate-200 p-2 text-center text-xs font-bold truncate">{s.name}</div>))}</div>
                {Array.from({length: 24},(_,i)=>i).map(h=>(<div key={h} className="flex h-12 border-b border-slate-100 hover:bg-slate-50/50"><div className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-[10px] text-slate-400">{String(h).padStart(2,'0')}:00</div>{screens.map(s=>{const k=`${h}-${s.id}`;const g=dayGrid[k];const top=g?g[0]:null;let cls='bg-white';if(top){if(top.displayStatus==='scheduled')cls='bg-emerald-100 text-emerald-700';else if(top.displayStatus==='action_needed')cls='bg-blue-100 text-blue-700';else if(top.displayStatus==='review_needed')cls='bg-red-100 text-red-700';else if(top.displayStatus==='bidding')cls='bg-yellow-50 text-yellow-600';}return(<div key={k} className={`flex-1 min-w-[120px] border-r border-slate-100 p-1 cursor-pointer transition-all ${cls}`} onClick={()=>g&&onSelectSlot(g)}>{top&&(<div className="w-full h-full flex flex-col justify-center px-1 text-[10px] leading-tight relative">{g.length>1&&<span className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center">{g.length}</span>}<div className="font-bold truncate">{top.userEmail}</div><div className="opacity-80">${top.price}</div></div>)}</div>)})}</div>))}
            </div>
        )}
    </div>
);

// --- 7. Rules View ---
export const RulesView = ({ rules, screens, newRule, setNewRule, onAdd, onDelete }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20}/> 新增特別規則</h3>
            <div className="space-y-4">
                <select value={newRule.screenId} onChange={e => setNewRule({...newRule, screenId: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"><option value="all">🌍 全部屏幕</option>{screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <input type="date" value={newRule.date} onChange={e => setNewRule({...newRule, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                <input type="text" placeholder="時段 (0-23 或 18,19)" value={newRule.hoursStr} onChange={e => setNewRule({...newRule, hoursStr: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                <div className="grid grid-cols-2 gap-2"><button onClick={() => setNewRule({...newRule, action: 'price_override'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'price_override' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'text-slate-500'}`}>💰 底價</button><button onClick={() => setNewRule({...newRule, action: 'lock'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'lock' ? 'bg-red-50 border-red-500 text-red-700' : 'text-slate-500'}`}>🔒 鎖定</button><button onClick={() => setNewRule({...newRule, action: 'disable_buyout'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'disable_buyout' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'text-slate-500'}`}>🚫 禁買斷</button></div>
                {newRule.action === 'price_override' && <div className="flex items-center gap-2"><span className="font-bold">$</span><input type="number" value={newRule.overridePrice} onChange={e => setNewRule({...newRule, overridePrice: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/></div>}
                <input type="text" placeholder="備註" value={newRule.note} onChange={e => setNewRule({...newRule, note: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                <button onClick={onAdd} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800">建立規則</button>
            </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> 已設定規則 ({rules.length})</h3>
            {rules.sort((a,b) => b.date.localeCompare(a.date)).map(rule => (
                <div key={rule.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                    <div><div className="flex items-center gap-2 mb-1"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{rule.date}</span><span className="text-xs font-bold text-blue-600">{rule.screenId === 'all' ? 'Global' : `Screen ${rule.screenId}`}</span></div><div className="flex items-center gap-2"><span className={`text-xs font-bold px-2 py-0.5 rounded border ${rule.type === 'lock' ? 'bg-red-50 border-red-200 text-red-600' : rule.type === 'disable_buyout' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-green-50 border-green-200 text-green-600'}`}>{rule.type === 'lock' ? '🔒 鎖定' : rule.type === 'disable_buyout' ? '🚫 禁買斷' : `💰 底價 $${rule.value}`}</span><span className="text-xs text-slate-500">時段: {rule.hours.length === 24 ? '全日' : rule.hours.join(', ')}</span></div></div>
                    <button onClick={() => onDelete(rule.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                </div>
            ))}
        </div>
    </div>
);

// --- 8. Screens View ---
export const ScreensView = ({ screens, editingScreens, onAdd, onEdit, onSaveSimple, onChange, onToggle, onEditFull }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-bold flex items-center gap-2"><Monitor size={20}/> 屏幕管理 ({screens.length})</h3>
            <button onClick={onAdd} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700"><Plus size={14}/> 新增屏幕</button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4">ID</th><th className="p-4">資料</th><th className="p-4">Bundle</th><th className="p-4 text-center">狀態</th><th className="p-4">底價</th><th className="p-4 text-right">操作</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {screens.map(s => {
                         const isEditingSimple = editingScreens[s.firestoreId];
                         const currentPrice = isEditingSimple?.basePrice ?? s.basePrice;
                         return (
                            <tr key={s.firestoreId} className="hover:bg-slate-50">
                                <td className="p-4 font-mono text-slate-500">#{s.id}</td>
                                <td className="p-4"><div className="font-bold">{s.name}</div><div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {s.location}</div></td>
                                <td className="p-4">{s.bundleGroup ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-200">{s.bundleGroup}</span> : <span className="text-slate-300">-</span>}</td>
                                <td className="p-4 text-center"><button onClick={()=>onToggle(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold w-full ${s.isActive!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{s.isActive!==false?<><Unlock size={12} className="inline"/> 上架</>:<><Lock size={12} className="inline"/> 鎖定</>}</button></td>
                                <td className="p-4"><div className="flex items-center gap-1 bg-white border rounded px-2 py-1"><span className="text-slate-400">$</span><input type="number" value={currentPrice} onChange={(e)=>onChange(s.firestoreId, 'basePrice', e.target.value)} className="w-full font-bold outline-none"/></div></td>
                                <td className="p-4 text-right flex items-center justify-end gap-2">
                                    {isEditingSimple && <button onClick={()=>onSaveSimple(s)} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700"><CheckCircle size={14}/></button>}
                                    <button onClick={()=>onEditFull(s)} className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-slate-50"><Edit size={14}/></button>
                                </td>
                            </tr>
                         )
                    })}
                </tbody>
            </table>
        </div>
    </div>
);