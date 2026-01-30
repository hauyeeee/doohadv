import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc 
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Search, Video, Monitor, Save, Gavel, Trash2, 
  LayoutDashboard, List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { sendBidConfirmation } from '../utils/emailService';

const ADMIN_EMAILS = ["hauyeeee@gmail.com"];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [marketStats, setMarketStats] = useState([]);
  const [pricingConfig, setPricingConfig] = useState({
      baseImpressions: 10000,
      primeMultiplier: 3.5,
      goldMultiplier: 1.8,
      weekendMultiplier: 1.5,
      bundleMultiplier: 1.25,
      urgentFee24h: 1.5,
      urgentFee1h: 2.0
  });
  
  // UI States
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  const [selectedStatScreen, setSelectedStatScreen] = useState('all');

  // Bulk Action States
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [editingScreens, setEditingScreens] = useState({});

  // 1. Auth & Initial Data Fetch
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email)) {
        setLoading(false); 
      } else {
        setUser(currentUser);
        fetchAllData();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllData = () => {
      setLoading(true);
      
      // Orders (Realtime)
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const unsubOrders = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAtDate: doc.data().createdAt?.toDate() || new Date()
        }));
        setOrders(ordersData);
        setLoading(false);
      });

      // Screens (One-time)
      getDocs(query(collection(db, "screens"), orderBy("id"))).then(sSnap => {
          setScreens(sSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      });

      // Market Stats (One-time)
      getDocs(collection(db, "market_stats")).then(mSnap => {
          setMarketStats(mSnap.docs.map(d => d.data()));
      });

      // Pricing Config
      getDoc(doc(db, "system_config", "pricing_rules")).then(docSnap => {
          if (docSnap.exists()) {
              setPricingConfig(docSnap.data());
          }
      });

      return () => unsubOrders();
  };

  // --- 🧠 Helper: Identify Repeat Customers ---
  const customerHistory = useMemo(() => {
      const history = {};
      orders.forEach(order => {
          const email = order.userEmail;
          if (!history[email]) history[email] = 0;
          history[email]++;
      });
      return history;
  }, [orders]);

  // --- 📊 Dashboard Logic ---
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let completedOrders = 0;
    let pendingReview = 0;
    let dailyRevenue = {};
    let statusCount = {};

    orders.forEach(order => {
        const status = order.status || 'unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;

        if (status === 'won' && order.hasVideo && !order.isApproved && !order.isRejected) {
            pendingReview++;
        }

        if (['paid', 'won', 'completed', 'paid_pending_selection'].includes(status)) {
            const amount = Number(order.amount) || 0;
            totalRevenue += amount;
            completedOrders += 1;
            const dateKey = order.createdAtDate.toISOString().split('T')[0];
            dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + amount;
        }
    });

    return {
        totalRevenue,
        totalOrders: orders.length,
        validOrders: completedOrders,
        pendingReview,
        dailyChartData: Object.keys(dailyRevenue).sort().map(date => ({ date: date.substring(5), amount: dailyRevenue[date] })),
        statusChartData: Object.keys(statusCount).map(key => ({ name: key, value: statusCount[key] }))
    };
  }, [orders]);

  // --- 🛠 Bulk Action Logic ---
  const handleSelectOrder = (id) => {
      const newSet = new Set(selectedOrderIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedOrderIds(newSet);
  };

  const handleBulkCancel = async () => {
      if (!window.confirm(`⚠️ 確定要批量取消選中的 ${selectedOrderIds.size} 張訂單嗎？`)) return;
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => {
          const ref = doc(db, "orders", id);
          batch.update(ref, { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.email });
      });
      await batch.commit();
      alert("✅ 批量取消成功");
      setSelectedOrderIds(new Set());
  };

  // --- 🎬 Review Logic ---
  const handleReview = async (orderId, action) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || !window.confirm(`確定要 ${action === 'approve' ? '通過' : '拒絕'} 此廣告嗎？`)) return;
    
    await updateDoc(doc(db, "orders", orderId), {
        isApproved: action === 'approve',
        isRejected: action === 'reject',
        reviewedAt: new Date(),
        reviewNote: action === 'reject' ? reviewNote : ''
    });

    if (action === 'approve') {
        const emailUser = { email: targetOrder.userEmail, displayName: targetOrder.userName || 'Client' };
        sendBidConfirmation(emailUser, targetOrder, 'video_approved');
    }
    alert(action === 'approve' ? "✅ 已批核並發送 Email" : "✅ 已拒絕");
  };

  // --- ⚙️ Pricing Config Logic ---
  const handleConfigChange = (key, value) => {
      setPricingConfig(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  const savePricingConfig = async () => {
      try {
          await setDoc(doc(db, "system_config", "pricing_rules"), pricingConfig);
          alert("✅ 價格公式已更新！");
      } catch (e) {
          console.error(e);
          alert("❌ 更新失敗");
      }
  };

  // --- Filter Logic ---
  const filteredOrders = orders.filter(order => {
      if (activeTab === 'review') return order.status === 'won' && order.hasVideo && !order.isApproved && !order.isRejected;
      const matchesSearch = (order.id||'').toLowerCase().includes(searchTerm.toLowerCase()) || (order.userEmail||'').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
  });

  const filteredStats = useMemo(() => {
      if (selectedStatScreen === 'all') return [];
      return marketStats.filter(m => String(m.screenId) === String(selectedStatScreen));
  }, [marketStats, selectedStatScreen]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH 管理後台
                </h1>
                <p className="text-slate-500 text-sm">操作員: {user?.email}</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">返回首頁</button>
                <button onClick={() => signOut(auth)} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200">登出</button>
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
            {[
                { id: 'dashboard', label: '儀表板', icon: <LayoutDashboard size={16}/> },
                { id: 'orders', label: '訂單管理', icon: <List size={16}/> },
                { id: 'review', label: `影片審核 (${stats.pendingReview})`, icon: <Video size={16}/>, alert: stats.pendingReview > 0 },
                { id: 'screens', label: '屏幕管理', icon: <Monitor size={16}/> },
                { id: 'analytics', label: '市場數據', icon: <TrendingUp size={16}/> },
                { id: 'config', label: '價格公式', icon: <Settings size={16}/> },
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setSelectedOrderIds(new Set()); }}
                    className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                        activeTab === tab.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    {tab.icon} {tab.label}
                    {tab.alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
            ))}
        </div>

        {/* --- 📊 Dashboard --- */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="總營業額" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
                    <StatCard title="待審核影片" value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
                    <StatCard title="有效訂單" value={stats.validOrders} icon={<Users className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px]">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={18}/> 每日生意額</h3>
                        <ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px]">
                        <h3 className="font-bold text-slate-700 mb-4">訂單狀態分佈</h3>
                        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* --- 📋 Orders Management --- */}
        {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-2">
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                            <input type="text" placeholder="搜尋 ID / Email..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"/>
                        </div>
                        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="p-2 rounded-lg border border-slate-300 text-sm outline-none">
                            <option value="all">所有狀態</option>
                            <option value="paid_pending_selection">競價中</option>
                            <option value="won">成功 (Won)</option>
                            <option value="paid">已完成 (Paid)</option>
                        </select>
                    </div>
                    {selectedOrderIds.size > 0 && (
                        <button onClick={handleBulkCancel} className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1"><Trash2 size={14}/> 批量取消 ({selectedOrderIds.size})</button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4 w-10 text-center">#</th>
                                <th className="p-4">時間</th>
                                <th className="p-4">訂單 ID / 客戶</th>
                                <th className="p-4 text-right">金額</th>
                                <th className="p-4 text-center">狀態</th>
                                <th className="p-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map((order) => {
                                const isRepeatCustomer = customerHistory[order.userEmail] > 1;
                                return (
                                    <tr key={order.id} className={`hover:bg-slate-50 ${selectedOrderIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-4 text-center">
                                            <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} />
                                        </td>
                                        <td className="p-4 text-slate-500 whitespace-nowrap">{order.createdAtDate.toLocaleString('zh-HK')}</td>
                                        <td className="p-4">
                                            <div className="font-mono text-xs font-bold text-slate-700">{order.id.slice(0,8)}...</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                {order.userEmail}
                                                {isRepeatCustomer && (
                                                    <span className="flex items-center gap-0.5 bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-yellow-200" title={`已下單 ${customerHistory[order.userEmail]} 次`}>
                                                        <Star size={10} fill="currentColor"/> VIP ({customerHistory[order.userEmail]})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold">HK$ {order.amount?.toLocaleString()}</td>
                                        <td className="p-4 text-center"><StatusBadge status={order.status} /></td>
                                        <td className="p-4 text-right">
                                            {order.status !== 'cancelled' && (
                                                <button onClick={async () => {
                                                    if(window.confirm("取消訂單?")) {
                                                        await updateDoc(doc(db, "orders", order.id), { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.email });
                                                    }
                                                }} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-transparent hover:border-red-200">取消</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- 🎬 Review --- */}
        {activeTab === 'review' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
                {filteredOrders.length === 0 ? <div className="col-span-full text-center p-10 text-slate-400">✅ 暫無待審核影片</div> : 
                filteredOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                        <div className="bg-orange-50 p-3 border-b border-orange-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-orange-700 flex items-center gap-1"><Video size={14}/> 待審核</span>
                            <span className="text-[10px] text-slate-500">{order.createdAtDate.toLocaleDateString()}</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="font-bold text-sm">{order.userEmail}</p>
                            <a href={order.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-bold underline truncate block">{order.videoName || 'Video'}</a>
                            <div className="pt-2 border-t flex flex-col gap-2">
                                <button onClick={() => handleReview(order.id, 'approve')} className="w-full bg-green-600 text-white py-2 rounded font-bold text-xs hover:bg-green-700 shadow-sm">✅ 通過並發送 Email</button>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="拒絕原因..." className="flex-1 border rounded px-2 text-xs" onChange={e => setReviewNote(e.target.value)} />
                                    <button onClick={() => handleReview(order.id, 'reject')} className="bg-red-50 text-red-600 border border-red-200 px-3 rounded text-xs font-bold hover:bg-red-100">拒絕</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- 📈 Analytics (Market Stats) --- */}
        {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold flex items-center gap-2"><TrendingUp size={18}/> 歷史成交數據</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">選擇屏幕:</span>
                        <select 
                            value={selectedStatScreen} 
                            onChange={(e) => setSelectedStatScreen(e.target.value)} 
                            className="border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">-- 請選擇屏幕 --</option>
                            {screens.map(s => (
                                <option key={s.firestoreId} value={s.id}>
                                    {s.name} ({s.location})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedStatScreen === 'all' ? (
                    <div className="text-center p-10 text-slate-400 bg-slate-50 rounded-lg">
                        👈 請先在上方選擇一個屏幕以查看詳細分析
                    </div>
                ) : (
                    <div className="overflow-x-auto h-[500px]">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 text-left">星期</th>
                                    <th className="p-3 text-left">時段</th>
                                    <th className="p-3 text-right">平均成交價</th>
                                    <th className="p-3 text-right">總出價次數</th>
                                    <th className="p-3 text-left pl-6">系統建議</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStats.sort((a,b) => (a.dayOfWeek - b.dayOfWeek) || (a.hour - b.hour)).map((m, i) => {
                                    let suggestion = <span className="text-slate-400 text-xs">-</span>;
                                    if (m.totalBids > 5) suggestion = <span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUp size={12}/> 加價空間大</span>;
                                    else if (m.totalBids === 0) suggestion = <span className="text-red-500 text-xs font-bold flex items-center gap-1"><ArrowDown size={12}/> 建議減價</span>;
                                    
                                    return (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="p-3 text-slate-600 font-medium">{WEEKDAYS[m.dayOfWeek]}</td>
                                            <td className="p-3">{String(m.hour).padStart(2,'0')}:00</td>
                                            <td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td>
                                            <td className="p-3 text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.totalBids > 5 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {m.totalBids}
                                                </span>
                                            </td>
                                            <td className="p-3 pl-6">{suggestion}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {/* --- ⚙️ Pricing Config --- */}
        {activeTab === 'config' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Settings size={20}/> 價格公式設定 (Pricing Engine)</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ConfigInput label="Prime Hour 倍率" value={pricingConfig.primeMultiplier} onChange={v => handleConfigChange('primeMultiplier', v)} />
                        <ConfigInput label="Gold Hour 倍率" value={pricingConfig.goldMultiplier} onChange={v => handleConfigChange('goldMultiplier', v)} />
                        <ConfigInput label="週末 (五六) 倍率" value={pricingConfig.weekendMultiplier} onChange={v => handleConfigChange('weekendMultiplier', v)} />
                        <ConfigInput label="聯播網 (Bundle) 倍率" value={pricingConfig.bundleMultiplier} onChange={v => handleConfigChange('bundleMultiplier', v)} />
                        <ConfigInput label="急單 (24h) 附加費率" value={pricingConfig.urgentFee24h} onChange={v => handleConfigChange('urgentFee24h', v)} />
                        <ConfigInput label="極速 (1h) 附加費率" value={pricingConfig.urgentFee1h} onChange={v => handleConfigChange('urgentFee1h', v)} />
                    </div>
                    <div className="bg-blue-50 p-3 rounded text-xs text-blue-700 flex items-start gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                        修改此處會即時影響前端的價格計算邏輯。請謹慎調整。
                    </div>
                    <button onClick={savePricingConfig} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                        <Save size={18}/> 儲存設定
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

// UI Components
const ConfigInput = ({ label, value, onChange }) => (
    <div className="bg-slate-50 p-3 rounded border border-slate-200">
        <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
        <input 
            type="number" step="0.1" 
            value={value || 0} 
            onChange={e => onChange(e.target.value)} 
            className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
        />
    </div>
);

const StatCard = ({ title, value, icon, bg, border }) => (
    <div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}>
        <div><p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p><p className="text-xl font-bold text-slate-800">{value}</p></div>
        <div className="bg-white p-2 rounded-full shadow-sm">{icon}</div>
    </div>
);

const StatusBadge = ({ status }) => {
    const map = {
        paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
        won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' },
        paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
        cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100' };
    return <span className={`text-[10px] px-2 py-1 rounded border font-bold ${s.cls}`}>{s.label}</span>;
};

export default AdminPanel;