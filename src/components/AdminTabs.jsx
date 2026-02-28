import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Search, Video, Monitor, Save, Trash2, 
  List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X, CheckCircle, XCircle,
  Mail, MessageCircle, ChevronLeft, ChevronRight, AlertCircle, Edit, MapPin, Layers, Trophy, Copy, Eye, EyeOff, Briefcase, Loader2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { StatCard, StatusBadge, ConfigSection, ConfigInput } from './AdminUI';
import { useLanguage } from '../context/LanguageContext';

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ==========================================
// 共用組件：提現申請區塊
// ==========================================
const WithdrawalSection = ({ currentBalance, onWithdrawRequest }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('FPS');
    const [accountInfo, setAccountInfo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRequest = async () => {
        const reqAmount = parseFloat(amount);
        if (isNaN(reqAmount) || reqAmount < 1000) {
            return alert("❌ 提現金額最少為 HK$1,000");
        }
        if (reqAmount > currentBalance) {
            return alert("❌ 餘額不足");
        }
        if (!accountInfo.trim()) {
            return alert("❌ 請提供銀行帳戶或 FPS 號碼");
        }

        if (window.confirm(`確認申請提現 HK$${reqAmount}？\n預計處理時間：至少 3 個工作天。`)) {
            setIsSubmitting(true);
            await onWithdrawRequest({ amount: reqAmount, method, accountInfo });
            setIsSubmitting(false);
            setAmount('');
            setAccountInfo('');
        }
    };

    return (
        <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-blue-600"/> 申請提現 (Withdrawal)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">提現金額 (最少 $1,000)</label>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-100" 
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">收款方式</label>
                    <select 
                        value={method} 
                        onChange={e => setMethod(e.target.value)} 
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    >
                        <option value="FPS">轉數快 (FPS)</option>
                        <option value="Bank">銀行轉帳 (Bank Transfer)</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">帳戶資料 (銀行名稱/分行代碼/帳號 或 FPS 手機號碼/名稱)</label>
                    <textarea 
                        value={accountInfo} 
                        onChange={e => setAccountInfo(e.target.value)} 
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none h-20 resize-none" 
                        placeholder="請輸入詳細轉帳資料..."
                    />
                </div>
            </div>
            <button 
                onClick={handleRequest}
                disabled={isSubmitting || currentBalance < 1000}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    currentBalance < 1000 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                }`}
            >
                {isSubmitting ? <Loader2 className="animate-spin"/> : <CheckCircle size={18}/>}
                立即申請提現
            </button>
            <p className="text-[10px] text-slate-400 text-center italic">註：所有提現申請均需經人工核對，並於至少 3 個工作天內處理轉帳。</p>
        </div>
    );
};

// ==========================================
// 各大主要分頁 (Tabs)
// ==========================================

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
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col">
                    <h3 className="font-bold mb-4">{t('daily_revenue')}</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.dailyChartData}>
                                <CartesianGrid strokeDasharray="3 3"/>
                                <XAxis dataKey="date"/>
                                <YAxis/>
                                <Tooltip/>
                                <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col">
                    <h3 className="font-bold mb-4">{t('order_status_dist')}</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {stats.statusChartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                                </Pie>
                                <Tooltip/>
                                <Legend/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 1.1 財務配置視圖 (Financial Config)
// ==========================================
export const FinancialConfigView = ({ config, setConfig, onSave, screens }) => {
    const handleOverrideChange = (screenId, field, value) => {
        const numVal = value === '' ? undefined : parseFloat(value);
        const newOverrides = { ...(config.screenOverrides || {}) };
        
        if (!newOverrides[screenId]) {
            newOverrides[screenId] = {};
        }
        
        if (numVal === undefined || isNaN(numVal)) {
            delete newOverrides[screenId][field];
            if (Object.keys(newOverrides[screenId]).length === 0) {
                delete newOverrides[screenId];
            }
        } else {
            newOverrides[screenId][field] = numVal;
        }
        
        setConfig({ ...config, screenOverrides: newOverrides });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl mx-auto animate-in fade-in">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b pb-4">
                <Briefcase className="text-blue-600"/> 財務分成與成本配置
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-slate-700">🌍 全域預設值 (Global Defaults)</h4>
                </div>
                <ConfigSection title="全域成本設定">
                    <ConfigInput 
                        label="預估營運成本" 
                        val={config.costFactor ?? 0.5} // 🔥 改用 ??
                        onChange={v => setConfig({...config, costFactor: v === '' ? 0 : parseFloat(v)})} 
                        desc="扣除此比例後計算利潤" 
                    />
                </ConfigSection>
                <ConfigSection title="全域分紅比例">
                    <ConfigInput 
                        label="合作伙伴總池 %" 
                        val={config.partnerPoolRatio ?? 0.3} // 🔥 改用 ??
                        onChange={v => setConfig({...config, partnerPoolRatio: v === '' ? 0 : parseFloat(v)})} 
                        desc="佔利潤比例" 
                    />
                    <ConfigInput 
                        label="商家佔池比例" 
                        val={config.merchantRatioOfPool ?? 0.5} // 🔥 改用 ??
                        onChange={v => setConfig({...config, merchantRatioOfPool: v === '' ? 0 : parseFloat(v)})} 
                        desc="0 = 充電寶全取" 
                    />
                </ConfigSection>
            </div>
            
            <div className="mb-6">
                <h4 className="font-bold text-slate-700 mb-2">📍 單機獨立覆蓋 (Screen Overrides)</h4>
                <div className="overflow-y-auto max-h-[400px] border border-slate-200 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="p-3">屏幕名稱</th>
                                <th className="p-3">總池 %</th>
                                <th className="p-3">商家佔比 %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {screens.map(s => {
                                const ov = config.screenOverrides?.[s.id] || {};
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold text-slate-700">
                                            {s.name}
                                            <span className="text-[10px] text-slate-400 block">{s.merchantEmail || '未綁定'}</span>
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="number" step="0.05" 
                                                placeholder={config.partnerPoolRatio ?? 0.3} 
                                                value={ov.partnerPoolRatio ?? ''} 
                                                onChange={e => handleOverrideChange(s.id, 'partnerPoolRatio', e.target.value)} 
                                                className="w-24 border rounded px-2 py-1 outline-none"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="number" step="0.05" 
                                                placeholder={config.merchantRatioOfPool ?? 0.5} 
                                                value={ov.merchantRatioOfPool ?? ''} 
                                                onChange={e => handleOverrideChange(s.id, 'merchantRatioOfPool', e.target.value)} 
                                                className="w-24 border rounded px-2 py-1 outline-none"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <button onClick={onSave} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                <Save size={18}/> 儲存財務配置
            </button>
        </div>
    );
};

export const PlatformOwnerSettlementView = ({ stats, config, orders, screens, onWithdrawRequest }) => {
    const ownerTotalShare = useMemo(() => {
        let total = 0;
        if (!orders) return 0;
        
        orders.forEach(order => {
            if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) {
                order.detailedSlots.forEach(slot => {
                    const ov = config.screenOverrides?.[slot.screenId] || {};
                    const poolR = ov.partnerPoolRatio !== undefined ? ov.partnerPoolRatio : (config.partnerPoolRatio || 0.3);
                    const merchR = ov.merchantRatioOfPool !== undefined ? ov.merchantRatioOfPool : (config.merchantRatioOfPool || 0.5);
                    const revenue = Number(slot.bidPrice) || 0;
                    const netProfit = revenue * (1 - (config.costFactor || 0.5));
                    
                    total += (netProfit * poolR * (1 - merchR));
                });
            }
        });
        return total;
    }, [orders, config]);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 max-w-4xl mx-auto">
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                <p className="text-xs opacity-60 uppercase font-bold mb-1">本月累計分成結算 (已扣除營運成本及商家津貼)</p>
                <h2 className="text-5xl font-extrabold">HK$ {ownerTotalShare.toLocaleString(undefined, {minimumFractionDigits: 1})}</h2>
                <p className="text-[10px] mt-2 opacity-50">* 系統已自動根據各屏幕專屬協議比例進行結算。</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <StatCard title="合作設備數" value={stats.totalScreens} icon={<Monitor/>} bg="bg-white" />
                <StatCard title="有效訂單數" value={stats.validOrders} icon={<CheckCircle/>} bg="bg-white" />
            </div>
            <WithdrawalSection currentBalance={ownerTotalShare} onWithdrawRequest={onWithdrawRequest} />
        </div>
    );
};

export const MerchantSettlementView = ({ config, orders, screens, userRole, onWithdrawRequest }) => {
    const [selectedScreenId, setSelectedScreenId] = useState('all');
    const [isLocked, setIsLocked] = useState(userRole === 'merchant');

    useEffect(() => {
        if (userRole === 'merchant' && screens.length > 0 && selectedScreenId === 'all') {
            setSelectedScreenId(String(screens[0].id));
        }
    }, [userRole, screens, selectedScreenId]);

    const merchantShare = useMemo(() => {
        let share = 0;
        if (!orders) return 0;
        
        orders.forEach(order => {
            if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) {
                order.detailedSlots.forEach(slot => {
                    if (selectedScreenId === 'all' || String(slot.screenId) === String(selectedScreenId)) {
                        const ov = config.screenOverrides?.[slot.screenId] || {};
                        const poolR = ov.partnerPoolRatio !== undefined ? ov.partnerPoolRatio : (config.partnerPoolRatio || 0.3);
                        const merchR = ov.merchantRatioOfPool !== undefined ? ov.merchantRatioOfPool : (config.merchantRatioOfPool || 0.5);
                        
                        const revenue = Number(slot.bidPrice) || 0;
                        const netProfit = revenue * (1 - (config.costFactor || 0.5));
                        share += (netProfit * poolR * merchR);
                    }
                });
            }
        });
        return share;
    }, [orders, selectedScreenId, config]);

    const curName = selectedScreenId === 'all' ? '總預覽' : screens.find(s => String(s.id) === selectedScreenId)?.name;

    return (
        <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
            {userRole === 'admin' && !isLocked && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex flex-col sm:flex-row gap-4">
                    <select 
                        value={selectedScreenId} 
                        onChange={e => setSelectedScreenId(e.target.value)} 
                        className="flex-1 border rounded-lg px-3 py-2 outline-none font-bold text-slate-700"
                    >
                        <option value="all">總預覽 (請勿向商家展示)</option>
                        {screens.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                    <button 
                        onClick={() => {
                            if(selectedScreenId === 'all') return alert("請先選擇單一商家！");
                            setIsLocked(true);
                        }} 
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-800"
                    >
                        <Lock size={16}/> 鎖定展示模式
                    </button>
                </div>
            )}
            
            <div className="bg-emerald-600 text-white p-8 rounded-3xl relative shadow-lg">
                {userRole === 'admin' && isLocked && (
                    <div 
                        onDoubleClick={() => setIsLocked(false)} 
                        className="absolute top-4 right-4 text-[10px] opacity-20 cursor-pointer hover:opacity-100 bg-black/20 px-2 py-1 rounded"
                    >
                        雙擊解鎖
                    </div>
                )}
                <p className="text-xs opacity-80 uppercase font-bold mb-1">媒體管理津貼結算單</p>
                <h3 className="text-2xl font-bold mb-4 opacity-90">{curName}</h3>
                <h2 className="text-5xl font-extrabold">HK$ {merchantShare.toLocaleString(undefined, {minimumFractionDigits: 1})}</h2>
            </div>
            
            <WithdrawalSection currentBalance={merchantShare} onWithdrawRequest={onWithdrawRequest} />
            
            <div className="bg-white border rounded-xl p-5 text-sm text-slate-500 shadow-sm">
                <p className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Briefcase size={16} className="text-emerald-500"/> 商家專屬權益
                </p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>屏幕運作正常，已為貴店保留每小時 <strong className="text-emerald-600">10 分鐘</strong> 之免費專屬宣傳。</li>
                    <li>系統防護已啟動：成功攔截並過濾同區競爭對手廣告。</li>
                    <li>津貼已按貴店的專屬協議比例結算。</li>
                </ul>
            </div>
        </div>
    );
};

export const OrdersView = ({ orders, selectedIds = new Set(), onSelect, onBulkAction, customerHistory = {}, statusFilter, setStatusFilter, searchTerm, setSearchTerm, onDeleteOrder }) => {
    const { t, lang } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2 flex-1">
                    <Search className="text-slate-400" size={16}/>
                    <input 
                        type="text" placeholder={t('search')} 
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-2 border rounded px-2 py-1 text-sm outline-none w-64"
                    />
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)} 
                        className="border rounded px-2 py-1 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="paid_pending_selection">{t('status_paid_pending_selection')}</option>
                        <option value="won">{t('status_won')}</option>
                        <option value="paid">{t('status_paid')}</option>
                    </select>
                </div>
                {selectedIds.size > 0 && (
                    <button 
                        onClick={() => onBulkAction('cancel')} 
                        className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 animate-pulse"
                    >
                        <Trash2 size={14}/> {t('btn_bulk_cancel')} ({selectedIds.size})
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4 w-10 text-center">#</th>
                            <th className="p-4">{t('col_time')}</th>
                            <th className="p-4 w-1/3">{t('col_details')}</th>
                            <th className="p-4 text-right">{t('col_amount')}</th>
                            <th className="p-4 text-center">{t('col_status')}</th>
                            <th className="p-4 text-right">{t('col_action')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {orders.map(order => {
                            if (!order || !order.id) return null;
                            const isRepeat = customerHistory[order.userEmail] > 1;
                            return (
                                <tr key={order.id} className={`hover:bg-slate-50 ${selectedIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-4 text-center align-top">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.has(order.id)} 
                                            onChange={() => { 
                                                const n = new Set(selectedIds); 
                                                n.has(order.id) ? n.delete(order.id) : n.add(order.id); 
                                                onSelect(n); 
                                            }} 
                                        />
                                    </td>
                                    <td className="p-4 text-slate-500 whitespace-nowrap align-top">
                                        {order.createdAtDate?.toLocaleString ? order.createdAtDate.toLocaleString(lang === 'en' ? 'en-US' : 'zh-HK') : 'N/A'}
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="font-bold text-slate-700">
                                            {order.userEmail}
                                            {isRepeat && <span className="ml-2 bg-yellow-100 text-yellow-800 text-[10px] px-1 rounded">VIP</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono mb-2">#{order.id.slice(0, 8)}</div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs space-y-1 max-h-32 overflow-y-auto">
                                            {order.detailedSlots?.map((slot, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-slate-600">
                                                    <div className="flex items-center gap-2 font-mono">
                                                        {slot.date} {String(slot.hour).padStart(2, '0')}:00 @{slot.screenId}
                                                    </div>
                                                    <div>${slot.bidPrice}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-bold align-top">HK$ {order.amount?.toLocaleString()}</td>
                                    <td className="p-4 text-center align-top"><StatusBadge status={order.status} lang={lang} /></td>
                                    <td className="p-4 text-right align-top">
                                        <button onClick={() => onDeleteOrder(order.id)} className="text-red-500 text-xs hover:underline">{t('btn_cancel')}</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const ReviewView = ({ orders, onReview, reviewNote, setReviewNote }) => {
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
            {orders.map(order => (
                <div key={order.id} className="bg-white rounded-xl shadow-md border border-orange-200 overflow-hidden flex flex-col">
                    <video controls src={order.videoUrl} className="w-full aspect-video bg-black object-contain" />
                    <div className="p-4 space-y-3 flex-1">
                        <p className="font-bold text-sm truncate">{order.userEmail}</p>
                        <button 
                            onClick={() => onReview(order.id, 'approve')} 
                            className="w-full bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={16}/> {t('review_approve')}
                        </button>
                        <div className="flex gap-2">
                            <input 
                                type="text" placeholder={t('review_reason')} 
                                className="flex-1 border rounded px-2 text-xs" 
                                onChange={e => setReviewNote(e.target.value)} 
                            />
                            <button 
                                onClick={() => onReview(order.id, 'reject')} 
                                className="text-red-600 text-xs font-bold"
                            >
                                {t('review_reject')}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const AnalyticsView = ({ stats, screens, selectedScreens, setSelectedScreens, selectedHours, setSelectedHours }) => {
    const { t, lang } = useLanguage();
    const WEEKDAYS = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_ZH;
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
            <h3 className="font-bold flex items-center gap-2 mb-4"><TrendingUp size={18}/> {t('analytics_real_data')}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
                <button 
                    onClick={() => setSelectedScreens(new Set())} 
                    className={`px-3 py-1 rounded text-xs border ${selectedScreens.size === 0 ? 'bg-slate-800 text-white' : 'bg-white'}`}
                >
                    All
                </button>
                {screens.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => {
                            const n = new Set(selectedScreens); 
                            n.has(String(s.id)) ? n.delete(String(s.id)) : n.add(String(s.id)); 
                            setSelectedScreens(n);
                        }} 
                        className={`px-3 py-1 rounded text-xs border ${selectedScreens.has(String(s.id)) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                    >
                        {s.name}
                    </button>
                ))}
            </div>
            <div className="h-[400px] overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                        <tr>
                            <th className="p-3 text-left">Day</th>
                            <th className="p-3 text-left">Hour</th>
                            <th className="p-3 text-right">Avg Price</th>
                            <th className="p-3 text-right">Bids</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.rows.map((m, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3">{WEEKDAYS[m.dayOfWeek]}</td>
                                <td className="p-3">{m.hour}:00</td>
                                <td className="p-3 text-right font-bold">${m.averagePrice}</td>
                                <td className="p-3 text-right">{m.totalBids}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const ConfigView = ({ config, setConfig, screens, target, setTarget, onSave, onAddRule, onRuleChange, onRemoveRule, localRules }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> {t('tab_config')}</h3>
                <select 
                    value={target} 
                    onChange={e => setTarget(e.target.value)} 
                    className="border rounded px-3 py-1 text-sm font-bold bg-blue-50 text-blue-800"
                >
                    <option value="global">{t('target_global')}</option>
                    {screens.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ConfigSection title={t('config_price_multipliers')}>
                    <ConfigInput label={t('label_prime')} val={config.primeMultiplier} onChange={v => setConfig(p => ({...p, primeMultiplier: v}))} desc="3.5x"/>
                    <ConfigInput label={t('label_gold')} val={config.goldMultiplier} onChange={v => setConfig(p => ({...p, goldMultiplier: v}))} desc="1.8x"/>
                </ConfigSection>
                <ConfigSection title={t('config_surcharges')}>
                    <ConfigInput label={t('label_bundle')} val={config.bundleMultiplier} onChange={v => setConfig(p => ({...p, bundleMultiplier: v}))} desc="1.25x"/>
                </ConfigSection>
            </div>
            <div className="mt-8 flex justify-end">
                <button onClick={onSave} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2">
                    <Save size={18}/> {t('save')}
                </button>
            </div>
        </div>
    );
};

export const CalendarView = ({ date, setDate, mode, setMode, monthData, dayGrid, screens, onSelectSlot, onPrev, onNext }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col h-[750px] animate-in fade-in">
            <div className="flex justify-between items-center bg-slate-50 p-3 border-b">
                <div className="flex gap-4 items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Calendar size={20}/> {t('tab_calendar')}</h2>
                    <div className="flex bg-slate-200 rounded p-1">
                        <button onClick={() => setMode('month')} className={`px-3 py-1 text-xs font-bold rounded ${mode === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>{t('cal_month')}</button>
                        <button onClick={() => setMode('day')} className={`px-3 py-1 text-xs font-bold rounded ${mode === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>{t('cal_day')}</button>
                    </div>
                    <div className="flex items-center gap-1 bg-white border p-1 rounded-lg">
                        <button onClick={onPrev} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button>
                        <span className="px-3 font-mono font-bold text-sm">{date.toLocaleDateString()}</span>
                        <button onClick={onNext} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>
            {mode === 'month' ? (
                <div className="flex-1 p-4 grid grid-cols-7 gap-px bg-slate-200">
                    {Object.entries(monthData).map(([dStr, d]) => (
                        <div 
                            key={dStr} 
                            onClick={() => { setDate(new Date(dStr)); setMode('day'); }} 
                            className="bg-white min-h-[100px] p-2 hover:bg-blue-50 cursor-pointer flex flex-col"
                        >
                            <span className="text-xs font-bold text-slate-700">{dStr.split('-')[2]}</span>
                            <div className="mt-auto space-y-0.5">
                                {d.bidding > 0 && <div className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded flex justify-between"><span>Bid</span><span>{d.bidding}</span></div>}
                                {d.scheduled > 0 && <div className="text-[10px] bg-green-100 text-green-700 px-1 rounded flex justify-between"><span>Sch</span><span>{d.scheduled}</span></div>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 overflow-auto flex flex-col">
                    <div className="flex bg-slate-50 border-b sticky top-0">
                        <div className="w-12 border-r p-2 text-[10px] font-bold">Time</div>
                        {screens.map(s => <div key={s.id} className="flex-1 p-2 text-center text-xs font-bold truncate border-r">{s.name}</div>)}
                    </div>
                    {Array.from({length: 24}, (_, i) => i).map(h => (
                        <div key={h} className="flex h-12 border-b">
                            <div className="w-12 border-r flex items-center justify-center text-[10px] text-slate-400">{h}:00</div>
                            {screens.map(s => {
                                const g = dayGrid[`${h}-${s.id}`];
                                return (
                                    <div key={s.id} className="flex-1 border-r p-1 cursor-pointer hover:bg-slate-50" onClick={() => g && onSelectSlot(g)}>
                                        {g && <div className="h-full bg-blue-100 border border-blue-200 rounded text-[10px] p-1 truncate font-bold">{g[0].userEmail}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const RulesView = ({ rules, screens, newRule, setNewRule, onAdd, onDelete, onClearAll }) => { // 🔥 就係呢行加多咗 onClearAll
    const { t } = useLanguage();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-xl border border-slate-200 h-fit shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Plus size={20} className="text-blue-600"/> 新增特別規則</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">目標屏幕</label>
                        <select 
                            value={newRule.screenId} 
                            onChange={e => setNewRule({...newRule, screenId: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100"
                        >
                            <option value="all">🌍 全部屏幕 (Global)</option>
                            {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">開始日期</label>
                            <input 
                                type="date" 
                                value={newRule.startDate || ''} 
                                onChange={e => setNewRule({...newRule, startDate: e.target.value})} 
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">結束日期 (單日可留空)</label>
                            <input 
                                type="date" 
                                value={newRule.endDate || ''} 
                                onChange={e => setNewRule({...newRule, endDate: e.target.value})} 
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">指定時段 (留空代表全日)</label>
                        <input 
                            type="text" 
                            placeholder="例如: 18,19,20" 
                            value={newRule.hoursStr || ''} 
                            onChange={e => setNewRule({...newRule, hoursStr: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">規則類型</label>
                        <select 
                            value={newRule.action} 
                            onChange={e => setNewRule({...newRule, action: e.target.value, overridePrice: ''})} 
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100 font-bold text-blue-700 bg-blue-50"
                        >
                            <option value="price_override">💰 強制更改底價</option>
                            <option value="multiplier">📈 價格加乘倍數</option>
                            <option value="lock">🔒 鎖定時段 (不開放)</option>
                            <option value="disable_buyout">🚫 禁止買斷 (只限競價)</option>
                        </select>
                    </div>

                    {newRule.action !== 'lock' && newRule.action !== 'disable_buyout' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">
                                {newRule.action === 'multiplier' ? '輸入倍數 (例如 1.5, 2.0)' : '輸入新底價 (HK$)'}
                            </label>
                            <input 
                                type="number" 
                                step="any"
                                placeholder={newRule.action === 'multiplier' ? "e.g. 1.5" : "e.g. 150"} 
                                value={newRule.overridePrice || ''} 
                                onChange={e => setNewRule({...newRule, overridePrice: e.target.value})} 
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100 font-bold"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">備註 (只限內部看)</label>
                        <input 
                            type="text" 
                            placeholder="例如: 聖誕節平安夜" 
                            value={newRule.note || ''} 
                            onChange={e => setNewRule({...newRule, note: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 ring-blue-100"
                        />
                    </div>

                    <button onClick={onAdd} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 shadow-md">
                        {t('add')}
                    </button>
                </div>
            </div>

            {/* 右邊：已設定規則列表 */}
            <div className="lg:col-span-2 space-y-3">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-slate-700">已生效的特別規則</h4>
                    {rules.length > 0 && (
                        <button 
                            onClick={onClearAll} 
                            className="text-xs bg-red-50 text-red-600 font-bold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-600 hover:text-white transition-colors shadow-sm"
                        >
                            🗑️ 一鍵清空全部
                        </button>
                    )}
                </div>
                
                {rules.length === 0 ? (
                    <div className="text-center p-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                        暫時未有任何特別規則
                    </div>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm hover:shadow transition-shadow">
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-sm">{rule.date}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${rule.screenId === 'all' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {rule.screenId === 'all' ? '🌍 全部屏幕' : `Screen ID: ${rule.screenId}`}
                                    </span>
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                        🕒 {rule.hours && rule.hours.length === 24 ? '全日' : (rule.hours ? rule.hours.join(',') + ':00' : '全日')}
                                    </span>
                                </div>
                                <div className="text-sm font-medium">
                                    {rule.type === 'lock' && <span className="text-red-600 flex items-center gap-1"><span className="text-lg">🔒</span> 時段已鎖定 (不對外開放)</span>}
                                    {rule.type === 'disable_buyout' && <span className="text-orange-600 flex items-center gap-1"><span className="text-lg">🚫</span> 禁止買斷 (只允許競價)</span>}
                                    {rule.type === 'price_override' && <span className="text-blue-600 flex items-center gap-1"><span className="text-lg">💰</span> 強制底價: HK$ {rule.value}</span>}
                                    {rule.type === 'multiplier' && <span className="text-emerald-600 flex items-center gap-1"><span className="text-lg">📈</span> 價格倍數: {rule.value} 倍</span>}
                                </div>
                                {rule.note && <div className="text-[11px] text-slate-400">📝 備註: {rule.note}</div>}
                            </div>
                            <button onClick={() => onDelete(rule.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                                <Trash2 size={20}/>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export const ScreensView = ({ screens, editingScreens, onAdd, onEditFull, onCopy, onSaveSimple, onChange, onToggle }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold flex items-center gap-2"><Monitor size={20}/> {t('tab_screens')}</h3>
                <button onClick={onAdd} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700">
                    <Plus size={14}/> {t('add')}
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">ID</th>
                            <th className="p-4">{t('screen_name')}</th>
                            <th className="p-4">Merchant Email</th>
                            <th className="p-4">Base Price</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {screens.map(s => {
                            const isEditingSimple = editingScreens[s.firestoreId];
                            const currentPrice = isEditingSimple?.basePrice ?? s.basePrice;

                            return (
                                <tr key={s.firestoreId} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono text-slate-400">#{s.id}</td>
                                    <td className="p-4 font-bold">
                                        {s.name}
                                        <div className="text-[10px] text-slate-400 font-normal">{s.location}</div>
                                    </td>
                                    <td className="p-4 text-blue-600 font-mono text-xs">{s.merchantEmail || '-'}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1 bg-white border rounded px-2 py-1 w-24">
                                            <span className="text-slate-400">$</span>
                                            <input 
                                                type="number" 
                                                value={currentPrice} 
                                                onChange={(e) => onChange(s.firestoreId, 'basePrice', e.target.value)} 
                                                className="w-full font-bold outline-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2 items-center">
                                        {isEditingSimple && (
                                            <button onClick={() => onSaveSimple(s)} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700" title="儲存底價">
                                                <CheckCircle size={14}/>
                                            </button>
                                        )}
                                        <button onClick={() => onEditFull(s)} className="p-2 border rounded hover:bg-blue-50 text-blue-600">
                                            <Edit size={14}/>
                                        </button>
                                        <button onClick={() => onCopy(s)} className="p-2 border rounded hover:bg-emerald-50 text-emerald-600">
                                            <Copy size={14}/>
                                        </button>
                                        <button onClick={() => onToggle(s)} className={`p-2 border rounded ${s.isActive !== false ? 'text-green-600' : 'text-red-600'}`}>
                                            {s.isActive !== false ? <Eye size={14}/> : <EyeOff size={14}/>}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};