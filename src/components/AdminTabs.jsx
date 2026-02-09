import React from 'react';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Search, Video, Monitor, Save, Trash2, 
  List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X, CheckCircle, XCircle,
  Mail, MessageCircle, ChevronLeft, ChevronRight, AlertCircle, Edit, MapPin, Layers, Trophy 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { StatCard, StatusBadge, ConfigSection, ConfigInput } from './AdminUI';
import { useLanguage } from '../context/LanguageContext';

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// --- 1. Dashboard View ---
export const DashboardView = ({ stats, COLORS }) => {
    const { t } = useLanguage();
    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title={t('total_revenue')} value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
                <StatCard title={t('pending_review')} value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
                <StatCard title={t('valid_orders')} value={stats.validOrders} icon={<Users className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
                <StatCard title={t('total_records')} value={stats.totalOrders} icon={<List className="text-slate-500"/>} bg="bg-slate-50" border="border-slate-100" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col"><h3 className="font-bold mb-4">{t('daily_revenue')}</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer></div></div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col"><h3 className="font-bold mb-4">{t('order_status_dist')}</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
            </div>
        </div>
    );
};

// --- 2. Orders View (詳細版) ---
export const OrdersView = ({ orders, selectedIds = new Set(), onSelect, onBulkAction, customerHistory = {}, statusFilter, setStatusFilter, searchTerm, setSearchTerm, onDeleteOrder }) => {
    const { t, lang } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2 flex-1">
                    <Search className="text-slate-400" size={16}/>
                    <input type="text" placeholder={t('search')} value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-2 border rounded px-2 py-1 text-sm outline-none w-64"/>
                    <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="all">All Status</option><option value="paid_pending_selection">{t('status_paid_pending_selection')}</option><option value="won">{t('status_won')}</option><option value="paid">{t('status_paid')}</option></select>
                </div>
                {selectedIds.size > 0 && <button onClick={() => onBulkAction('cancel')} className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 animate-pulse"><Trash2 size={14}/> {t('btn_bulk_cancel')} ({selectedIds.size})</button>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4 w-10 text-center">#</th><th className="p-4">{t('col_time')}</th><th className="p-4 w-1/3">{t('col_details')}</th><th className="p-4 text-right">{t('col_amount')}</th><th className="p-4 text-center">{t('col_status')}</th><th className="p-4 text-right">{t('col_action')}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {orders.map(order => {
                            if (!order || !order.id) return null;
                            const isRepeat = customerHistory[order.userEmail] > 1;
                            return (
                                <tr key={order.id} className={`hover:bg-slate-50 ${selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-4 text-center align-top"><input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => { const n = new Set(selectedIds); n.has(order.id)?n.delete(order.id):n.add(order.id); onSelect(n); }} /></td>
                                    <td className="p-4 text-slate-500 whitespace-nowrap align-top">{order.createdAtDate?.toLocaleString ? order.createdAtDate.toLocaleString(lang==='en'?'en-US':'zh-HK') : 'N/A'}</td>
                                    <td className="p-4 align-top">
                                        <div className="font-bold text-slate-700">{order.userEmail}{isRepeat && <span className="ml-2 bg-yellow-100 text-yellow-800 text-[10px] px-1 rounded">VIP</span>}</div>
                                        <div className="text-xs text-slate-500 font-mono mb-2">#{order.id.slice(0,8)}</div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                            {order.detailedSlots && order.detailedSlots.length > 0 ? (
                                                order.detailedSlots.map((slot, idx) => {
                                                    const isWinning = slot.slotStatus === 'winning';
                                                    const isOutbid = slot.slotStatus === 'outbid';
                                                    let statusIcon = null;
                                                    let rowClass = 'text-slate-600';
                                                    if (isWinning) { statusIcon = <Trophy size={10} className="text-green-600"/>; rowClass = 'text-green-700 font-bold bg-green-50/50 rounded px-1'; }
                                                    if (isOutbid) { statusIcon = <AlertTriangle size={10} className="text-red-500"/>; rowClass = 'text-red-600 bg-red-50/50 rounded px-1'; }
                                                    return (
                                                        <div key={idx} className={`flex justify-between items-center ${rowClass}`}>
                                                            <div className="flex items-center gap-2">{statusIcon}<span className="font-mono">{slot.date}</span><span>{String(slot.hour).padStart(2,'0')}:00</span><span className="text-[10px] opacity-80">@{slot.screenId}</span></div>
                                                            <div>${slot.bidPrice}</div>
                                                        </div>
                                                    );
                                                })
                                            ) : <span className="text-slate-400 italic">No slot details available</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-2">Video: {order.hasVideo ? t('video_uploaded') : t('video_missing')}</div>
                                    </td>
                                    <td className="p-4 text-right font-bold align-top">HK$ {order.amount?.toLocaleString()}</td>
                                    <td className="p-4 text-center align-top"><StatusBadge status={order.status} lang={lang} /></td>
                                    <td className="p-4 text-right align-top">{order.status !== 'cancelled' && <button onClick={() => onDeleteOrder(order.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-transparent hover:border-red-200">{t('btn_cancel')}</button>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- 3. Review View ---
export const ReviewView = ({ orders, onReview, reviewNote, setReviewNote }) => {
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
            {orders.length === 0 ? <div className="col-span-full text-center p-10 text-slate-400">{t('no_pending_videos')}</div> : 
            orders.map(order => (
                <div key={order.id} className="bg-white rounded-xl shadow-md border border-orange-200 overflow-hidden flex flex-col">
                    <div className="bg-orange-50 p-3 border-b border-orange-100 flex justify-between items-center"><span className="text-xs font-bold text-orange-700 flex items-center gap-1"><Video size={14}/> {t('pending_review')}</span></div>
                    <div className="relative bg-black aspect-video w-full">{order.videoUrl ? <video controls src={order.videoUrl} className="w-full h-full object-contain" /> : <div className="flex items-center justify-center h-full text-white/50 text-xs">No Video File</div>}</div>
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                        <div><p className="text-xs text-slate-400">User</p><p className="font-bold text-sm">{order.userEmail}</p></div>
                        <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
                            <button onClick={() => onReview(order.id, 'approve')} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"><CheckCircle size={16}/> {t('review_approve')}</button>
                            <div className="flex gap-2"><input type="text" placeholder={t('review_reason')} className="flex-1 border rounded px-3 py-1.5 text-xs bg-slate-50" onChange={e => setReviewNote(e.target.value)} /><button onClick={() => onReview(order.id, 'reject')} className="bg-white text-red-600 border border-red-200 px-3 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center gap-1">{t('review_reject')}</button></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 4. Analytics View ---
export const AnalyticsView = ({ stats, screens, selectedScreens, setSelectedScreens, selectedHours, setSelectedHours }) => {
    const { t, lang } = useLanguage();
    const WEEKDAYS = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_ZH;
    
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
                <div><h3 className="font-bold flex items-center gap-2"><TrendingUp size={18}/> {t('analytics_real_data')}</h3><p className="text-xs text-slate-500">Selected: {selectedScreens.size === 0 ? "All" : `${selectedScreens.size}`}</p></div>
                <div className="flex flex-wrap gap-2"><button onClick={() => setSelectedScreens(new Set())} className={`px-3 py-1 rounded text-xs font-bold border ${selectedScreens.size === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>All</button>{screens.map(s => (<button key={s.id} onClick={() => {const n=new Set(selectedScreens); n.has(String(s.id))?n.delete(String(s.id)):n.add(String(s.id)); setSelectedScreens(n);}} className={`px-3 py-1 rounded text-xs font-bold border ${selectedScreens.has(String(s.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>{s.name}</button>))}</div>
            </div>
            <div className="flex flex-wrap gap-1 items-center mb-4"><span className="text-xs font-bold text-slate-500 uppercase w-12">Hours:</span><button onClick={() => setSelectedHours(new Set())} className={`w-8 h-8 rounded text-xs font-bold border ${selectedHours.size===0?'bg-slate-800 text-white':'bg-white text-slate-600'}`}>All</button>{Array.from({length:24},(_,i)=>i).map(h => (<button key={h} onClick={() => {const n=new Set(selectedHours); n.has(h)?n.delete(h):n.add(h); setSelectedHours(n);}} className={`w-8 h-8 rounded text-xs border font-bold transition-all ${selectedHours.has(h)?'bg-orange-500 text-white border-orange-500':'bg-white text-slate-600 hover:bg-slate-100'}`}>{h}</button>))}</div>
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white flex justify-between items-center shadow-lg"><div><h3 className="font-bold text-lg mb-1">{t('analytics_avg_price')}</h3></div><div className="text-right"><div className="text-3xl font-bold">HK$ {stats.summary.avgPrice.toLocaleString()}</div><div className="text-xs text-blue-200">{stats.summary.totalBids} {t('analytics_bid_count')}</div></div></div>
            <div className="overflow-x-auto h-[400px] border rounded-lg">
                <table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0 z-10"><tr><th className="p-3 text-left">{t('col_day')}</th><th className="p-3 text-left">{t('col_hour')}</th><th className="p-3 text-right">{t('analytics_avg_price')}</th><th className="p-3 text-right">{t('analytics_bid_count')}</th><th className="p-3 text-left pl-6">{t('col_suggestion')}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{stats.rows.sort((a,b)=>(a.dayOfWeek-b.dayOfWeek)||(a.hour-b.hour)).map((m,i)=>(<tr key={i} className="hover:bg-slate-50"><td className="p-3 text-slate-600 font-medium">{WEEKDAYS[m.dayOfWeek]}</td><td className="p-3">{String(m.hour).padStart(2,'0')}:00</td><td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td><td className="p-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.totalBids>0?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-400'}`}>{m.totalBids}</span></td><td className="p-3 pl-6">{m.totalBids>3?<span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUp size={12}/> {t('suggestion_up')}</span>:m.totalBids===0?<span className="text-red-500 text-xs font-bold flex items-center gap-1"><ArrowDown size={12}/> {t('suggestion_down')}</span>:<span className="text-slate-300">-</span>}</td></tr>))}</tbody></table>
            </div>
        </div>
    );
};

// --- 5. Config View ---
export const ConfigView = ({ config, setConfig, globalConfig, setGlobal, target, setTarget, screens, localRules, setLocalRules, onSave, onAddRule, onRuleChange, onRemoveRule }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in">
            <div className="flex justify-between items-center mb-6 border-b pb-4"><div><h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> {t('tab_config')}</h3></div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-600">Target:</span><select value={target} onChange={e => setTarget(e.target.value)} className="border-2 border-blue-100 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-800 outline-none"><option value="global">{t('target_global')}</option><option disabled>──────────</option>{screens.map(s => <option key={s.id} value={String(s.id)}>🖥️ {s.name}</option>)}</select></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ConfigSection title={t('config_price_multipliers')}><ConfigInput label={t('label_prime')} val={config.primeMultiplier} onChange={v=>setConfig(p=>({...p, primeMultiplier:v}))} desc="3.5x"/><ConfigInput label={t('label_gold')} val={config.goldMultiplier} onChange={v=>setConfig(p=>({...p, goldMultiplier:v}))} desc="1.8x"/><ConfigInput label={t('label_weekend')} val={config.weekendMultiplier} onChange={v=>setConfig(p=>({...p, weekendMultiplier:v}))} desc="1.5x"/></ConfigSection>
                <ConfigSection title={t('config_surcharges')}><ConfigInput label={t('label_bundle')} val={config.bundleMultiplier} onChange={v=>setConfig(p=>({...p, bundleMultiplier:v}))} desc="1.25x"/><ConfigInput label={t('label_urgent_24h')} val={config.urgentFee24h} onChange={v=>setConfig(p=>({...p, urgentFee24h:v}))} desc="1.5x"/><ConfigInput label={t('label_urgent_1h')} val={config.urgentFee1h} onChange={v=>setConfig(p=>({...p, urgentFee1h:v}))} desc="2.0x"/></ConfigSection>
            </div>
            <div className="border-t pt-6 mt-6"><h3 className="font-bold text-lg flex items-center gap-2 mb-4"><Layers size={20}/> {t('config_bundle_rules')}</h3>
                {localRules.map((r,i)=>(<div key={i} className="flex gap-2 mb-2 items-center"><input value={r.screensStr} onChange={(e)=>onRuleChange(i,'screensStr',e.target.value)} className="border p-1 w-full rounded" placeholder="1,2,3" /><span className="font-bold text-xs">x</span><input type="number" step="0.05" value={r.multiplier} onChange={(e)=>onRuleChange(i,'multiplier',e.target.value)} className="border p-1 w-16 rounded font-bold text-blue-600"/><button onClick={()=>onRemoveRule(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div>))}
                <button onClick={onAddRule} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded"><Plus size={16}/> {t('add')}</button>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={onSave} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2"><Save size={18}/> {t('save')}</button></div>
        </div>
    );
};

// --- 6. Calendar View (🔥 重點升級：顯示所有工作細節) ---
export const CalendarView = ({ date, setDate, mode, setMode, monthData, dayGrid, screens, onSelectSlot, onPrev, onNext }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col h-[750px] animate-in fade-in">
            <div className="flex justify-between items-center bg-slate-50 p-3 border-b border-slate-200">
                <div className="flex gap-4 items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Calendar size={20}/> {t('tab_calendar')}</h2>
                    <div className="flex bg-slate-200 rounded p-1"><button onClick={()=>setMode('month')} className={`px-3 py-1 text-xs font-bold rounded ${mode==='month'?'bg-white shadow text-slate-800':'text-slate-500'}`}>{t('cal_month')}</button><button onClick={()=>setMode('day')} className={`px-3 py-1 text-xs font-bold rounded ${mode==='day'?'bg-white shadow text-slate-800':'text-slate-500'}`}>{t('cal_day')}</button></div>
                    <div className="flex items-center gap-1 bg-white border p-1 rounded-lg"><button onClick={onPrev} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button><span className="px-3 font-mono font-bold text-sm min-w-[100px] text-center">{mode==='month'?date.toLocaleDateString():date.toLocaleDateString()}</span><button onClick={onNext} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button></div>
                </div>
            </div>
            
            {/* 🔥🔥🔥 月視圖：顯示所有標籤 (待辦/審核/已排/競價) 🔥🔥🔥 */}
            {mode === 'month' && (
                <div className="flex-1 p-4 overflow-auto">
                    <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">{d}</div>)}
                        {Object.entries(monthData).map(([dStr, d]) => (
                            <div key={dStr} onClick={()=>{setDate(new Date(dStr)); setMode('day');}} className="bg-white min-h-[100px] p-2 hover:bg-blue-50 cursor-pointer relative group flex flex-col">
                                <div className="text-xs font-bold text-slate-700 mb-1">{dStr.split('-')[2]}</div>
                                <div className="space-y-0.5 mt-auto">
                                    {d.action > 0 && <div className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded flex justify-between font-bold mb-0.5"><span>待辦</span><span>{d.action}</span></div>}
                                    {d.pending > 0 && <div className="text-[10px] bg-red-100 text-red-700 px-1 rounded flex justify-between font-bold mb-0.5"><span>審核</span><span>{d.pending}</span></div>}
                                    {d.scheduled > 0 && <div className="text-[10px] bg-green-100 text-green-700 px-1 rounded flex justify-between font-bold mb-0.5"><span>已排</span><span>{d.scheduled}</span></div>}
                                    {d.bidding > 0 && <div className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded flex justify-between font-bold mb-0.5"><span>競價</span><span>{d.bidding}</span></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 🔥🔥🔥 日視圖：顯示詳細工作卡 (Job Card) 🔥🔥🔥 */}
            {mode === 'day' && (
                <div className="flex-1 overflow-auto flex flex-col min-h-0">
                    <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                        <div className="w-12 shrink-0 border-r border-slate-200 p-2 text-[10px] font-bold text-slate-400">Time</div>
                        {screens.map(s=>(<div key={s.id} className="flex-1 min-w-[120px] border-r border-slate-200 p-2 text-center text-xs font-bold truncate">{s.name}</div>))}
                    </div>
                    {Array.from({length: 24},(_,i)=>i).map(h=>(
                        <div key={h} className="flex h-12 border-b border-slate-100 hover:bg-slate-50/50">
                            <div className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-[10px] text-slate-400">{String(h).padStart(2,'0')}:00</div>
                            {screens.map(s=>{
                                const k=`${h}-${s.id}`;
                                const g=dayGrid[k];
                                const top=g?g[0]:null;
                                
                                let cls='bg-white';
                                let icon=null;
                                let statusText = '';

                                if(top){
                                    if(top.displayStatus==='scheduled') { cls='bg-emerald-100 text-emerald-700 border-emerald-200'; icon=<CheckCircle size={10}/>; statusText='已排程'; }
                                    else if(top.displayStatus==='action_needed') { cls='bg-blue-100 text-blue-700 border-blue-200'; icon=<AlertCircle size={10}/>; statusText='待處理'; }
                                    else if(top.displayStatus==='review_needed') { cls='bg-red-100 text-red-700 border-red-200'; icon=<Video size={10}/>; statusText='待審核'; }
                                    else if(top.displayStatus==='bidding') { cls='bg-yellow-50 text-yellow-700 border-yellow-200'; icon=<Clock size={10}/>; statusText='競價中'; }
                                }

                                return(
                                    <div key={k} className={`flex-1 min-w-[120px] border-r border-slate-100 p-1 cursor-pointer transition-all ${top ? 'hover:shadow-md' : ''}`} onClick={()=>g&&onSelectSlot(g)}>
                                        {top && (
                                            <div className={`w-full h-full flex flex-col justify-center px-1.5 py-0.5 text-[10px] leading-tight relative rounded border ${cls}`}>
                                                {g.length>1 && <span className="absolute -top-1 -right-1 bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">{g.length}</span>}
                                                <div className="font-bold truncate flex items-center gap-1">{icon} {statusText}</div>
                                                <div className="truncate opacity-80">{top.userEmail}</div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- 7. Rules View (🔥 重點升級：詳細顯示所有設定) ---
export const RulesView = ({ rules, screens, newRule, setNewRule, onAdd, onDelete }) => {
    const { t } = useLanguage();
    
    // 輔助函數：顯示屏幕名稱
    const getScreenName = (id) => {
        if(id === 'all') return t('rule_global') || 'Global (全部)';
        const s = screens.find(x => String(x.id) === String(id));
        return s ? s.name : id;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20}/> {t('rule_add_title')}</h3>
                <div className="space-y-4">
                    <select value={newRule.screenId} onChange={e => setNewRule({...newRule, screenId: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"><option value="all">{t('rule_global')}</option>{screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    <input type="date" value={newRule.date} onChange={e => setNewRule({...newRule, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                    <input type="text" placeholder={t('rule_time_placeholder')} value={newRule.hoursStr} onChange={e => setNewRule({...newRule, hoursStr: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                    <div className="grid grid-cols-2 gap-2"><button onClick={() => setNewRule({...newRule, action: 'price_override'})} className={`py-2 text-xs font-bold rounded border ${newRule.action==='price_override'?'bg-blue-600 text-white':'bg-slate-50 text-slate-600'}`}>{t('rule_type_price')}</button><button onClick={() => setNewRule({...newRule, action: 'lock'})} className={`py-2 text-xs font-bold rounded border ${newRule.action==='lock'?'bg-red-600 text-white':'bg-slate-50 text-slate-600'}`}>{t('rule_type_lock')}</button></div>
                    {newRule.action === 'price_override' && <div className="flex items-center border rounded px-3 py-2 bg-slate-50"><span className="text-slate-500 mr-2">$</span><input type="number" value={newRule.overridePrice} onChange={e => setNewRule({...newRule, overridePrice: e.target.value})} className="w-full text-sm outline-none bg-transparent"/></div>}
                    <button onClick={onAdd} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 shadow-md">{t('add')}</button>
                </div>
            </div>
            
            {/* 🔥 詳細規則列表 🔥 */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> {t('rule_existing')} ({rules.length})</h3>
                {rules.length === 0 ? (
                    <div className="text-slate-400 text-center py-10 bg-white rounded-xl border border-dashed text-sm">No rules set</div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center hover:shadow-md transition-shadow">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-700 text-lg">{rule.date}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${rule.screenId === 'all' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                        {getScreenName(rule.screenId)}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-500 flex items-center gap-4">
                                    <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-0.5 rounded text-xs"><Clock size={12}/> {rule.hours && rule.hours.length === 24 ? 'All Day (全日)' : `Hours: ${rule.hours?.join(',')}`}</span>
                                    
                                    {rule.type === 'lock' ? (
                                        <span className="text-red-600 font-bold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded text-xs"><Lock size={12}/> Locked (鎖定)</span>
                                    ) : (
                                        <span className="text-green-600 font-bold flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded text-xs"><DollarSign size={12}/> ${rule.value}</span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => onDelete(rule.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- 8. Screens View ---
export const ScreensView = ({ screens, editingScreens, onAdd, onEdit, onSaveSimple, onChange, onToggle, onEditFull }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold flex items-center gap-2"><Monitor size={20}/> {t('tab_screens')}</h3>
                <button onClick={onAdd} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700"><Plus size={14}/> {t('add')}</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4">ID</th><th className="p-4">{t('screen_name')}</th><th className="p-4">{t('screen_bundle')}</th><th className="p-4 text-center">{t('screen_status')}</th><th className="p-4">{t('screen_base_price')}</th><th className="p-4 text-right">{t('col_action')}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {screens.map(s => {
                             const isEditingSimple = editingScreens[s.firestoreId];
                             const currentPrice = isEditingSimple?.basePrice ?? s.basePrice;
                             return (
                                <tr key={s.firestoreId} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono text-slate-500">#{s.id}</td>
                                    <td className="p-4"><div className="font-bold">{s.name}</div><div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {s.location}</div></td>
                                    <td className="p-4">{s.bundleGroup ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-200">{s.bundleGroup}</span> : <span className="text-slate-300">-</span>}</td>
                                    <td className="p-4 text-center"><button onClick={()=>onToggle(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold w-full ${s.isActive!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{s.isActive!==false?t('btn_toggle_on'):t('btn_toggle_off')}</button></td>
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
};