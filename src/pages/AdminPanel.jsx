import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc, deleteDoc, addDoc, where
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Search, Video, Monitor, Save, Trash2, 
  LayoutDashboard, List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X
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
  const [specialRules, setSpecialRules] = useState([]); // 🔥 新增：特別規則數據
  
  // Config State
  const [pricingConfig, setPricingConfig] = useState({
      baseImpressions: 10000,
      primeMultiplier: 3.5,
      goldMultiplier: 1.8,
      weekendMultiplier: 1.5,
      bundleMultiplier: 1.25, // 🔥 Bundle 溢價設定
      urgentFee24h: 1.5,
      urgentFee1h: 2.0
  });
  
  // UI States
  const [activeTab, setActiveTab] = useState('rules'); // 預設跳去新功能頁面
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  // Analytics Filter (Multi-select)
  const [selectedStatScreens, setSelectedStatScreens] = useState(new Set()); // 🔥 改為 Set 支援多選

  // Bulk Action States
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [editingScreens, setEditingScreens] = useState({});

  // New Rule Form State
  const [newRule, setNewRule] = useState({
      screenId: 'all',
      date: '',
      hoursStr: '', // "18,19,20"
      action: 'price_up', // 'price_up', 'lock', 'disable_buyout'
      overridePrice: '',
      multiplier: 1.5,
      note: ''
  });

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
      
      // Orders
      const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAtDate: d.data().createdAt?.toDate() || new Date() })));
        setLoading(false);
      });

      // Screens
      const unsubScreens = onSnapshot(query(collection(db, "screens"), orderBy("id")), (snap) => {
          setScreens(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      });

      // Special Rules (Realtime)
      const unsubRules = onSnapshot(collection(db, "special_rules"), (snap) => {
          setSpecialRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // Pricing Config
      getDoc(doc(db, "system_config", "pricing_rules")).then(docSnap => {
          if (docSnap.exists()) setPricingConfig(docSnap.data());
      });

      return () => { unsubOrders(); unsubScreens(); unsubRules(); };
  };

  // --- 🧠 Helper: Repeat Customers ---
  const customerHistory = useMemo(() => {
      const history = {};
      orders.forEach(order => {
          const email = order.userEmail;
          if (!history[email]) history[email] = 0;
          history[email]++;
      });
      return history;
  }, [orders]);

  // --- 📊 Dashboard Stats ---
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let validOrders = 0;
    let pendingReview = 0;
    let dailyRevenue = {};
    let statusCount = {};

    orders.forEach(order => {
        statusCount[order.status || 'unknown'] = (statusCount[order.status || 'unknown'] || 0) + 1;
        if (order.status === 'won' && order.hasVideo && !order.isApproved && !order.isRejected) pendingReview++;
        if (['paid', 'won', 'completed', 'paid_pending_selection'].includes(order.status)) {
            totalRevenue += Number(order.amount) || 0;
            validOrders++;
            const dateKey = order.createdAtDate.toISOString().split('T')[0];
            dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + Number(order.amount);
        }
    });

    return {
        totalRevenue, totalOrders: orders.length, validOrders, pendingReview,
        dailyChartData: Object.keys(dailyRevenue).sort().map(d => ({ date: d.substring(5), amount: dailyRevenue[d] })),
        statusChartData: Object.keys(statusCount).map(k => ({ name: k, value: statusCount[k] }))
    };
  }, [orders]);

  // --- 📈 Real-time Market Stats (Multi-screen Logic) ---
  const realMarketStats = useMemo(() => {
      // Initialize 7 days x 24 hours
      const statsMap = {}; 
      for(let d=0; d<7; d++) {
          for(let h=0; h<24; h++) {
              statsMap[`${d}-${h}`] = { dayOfWeek: d, hour: h, totalAmount: 0, totalBids: 0 };
          }
      }

      orders.forEach(order => {
          if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) {
              order.detailedSlots.forEach(slot => {
                  // 🔥 核心修改：允許多選或 "All"
                  // 如果 selectedStatScreens 為空，代表選了 "All"
                  const isSelected = selectedStatScreens.size === 0 || selectedStatScreens.has(String(slot.screenId));
                  
                  if (isSelected) {
                      const dateObj = new Date(slot.date); 
                      const day = dateObj.getDay(); 
                      const hour = slot.hour; 
                      const key = `${day}-${hour}`;
                      if (statsMap[key]) {
                          statsMap[key].totalAmount += (Number(slot.bidPrice) || 0);
                          statsMap[key].totalBids += 1;
                      }
                  }
              });
          }
      });

      return Object.values(statsMap).map(item => ({
          ...item,
          averagePrice: item.totalBids > 0 ? Math.round(item.totalAmount / item.totalBids) : 0
      }));
  }, [orders, selectedStatScreens]);

  // --- 📅 Special Rules Logic (NEW) ---
  const handleAddRule = async () => {
      if (!newRule.date) return alert("請選擇日期");
      
      const hours = newRule.hoursStr ? newRule.hoursStr.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h>=0 && h<=23) : [];
      if (hours.length === 0 && newRule.hoursStr !== 'all') return alert("請輸入有效時段 (e.g. 18,19) 或留空代表全日");

      const ruleData = {
          screenId: newRule.screenId, // 'all' or specific ID
          date: newRule.date, // YYYY-MM-DD
          hours: newRule.hoursStr === 'all' ? Array.from({length:24},(_,i)=>i) : hours,
          type: newRule.action, // 'lock', 'price_override', 'disable_buyout'
          value: newRule.action === 'price_override' ? parseFloat(newRule.overridePrice) : null,
          note: newRule.note,
          createdAt: new Date()
      };

      try {
          await addDoc(collection(db, "special_rules"), ruleData);
          alert("✅ 特別規則已建立");
          setNewRule({ ...newRule, hoursStr: '', overridePrice: '', note: '' });
      } catch (e) { console.error(e); alert("建立失敗"); }
  };

  const handleDeleteRule = async (id) => {
      if(window.confirm("刪除此規則？")) await deleteDoc(doc(db, "special_rules", id));
  };

  // --- Other Logic (Keep same) ---
  const handleSelectStatScreen = (id) => {
      const newSet = new Set(selectedStatScreens);
      if (id === 'all') {
          setSelectedStatScreens(new Set()); // Empty means All
      } else {
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setSelectedStatScreens(newSet);
      }
  };

  const handleReview = async (orderId, action) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || !window.confirm(`確定要 ${action === 'approve' ? '通過' : '拒絕'}?`)) return;
    await updateDoc(doc(db, "orders", orderId), { isApproved: action === 'approve', isRejected: action === 'reject', reviewedAt: new Date() });
    if (action === 'approve') sendBidConfirmation({ email: targetOrder.userEmail, displayName: targetOrder.userName }, targetOrder, 'video_approved');
  };

  const savePricingConfig = async () => {
      await setDoc(doc(db, "system_config", "pricing_rules"), pricingConfig);
      alert("✅ 設定已更新");
  };

  // Screen Management (Simplified for brevity, logic same as before)
  const saveScreen = async (screen) => {
      const changes = editingScreens[screen.firestoreId];
      if (!changes) return;
      await updateDoc(doc(db, "screens", screen.firestoreId), { ...changes, basePrice: parseInt(changes.basePrice || screen.basePrice) });
      setEditingScreens(prev => { const n={...prev}; delete n[screen.firestoreId]; return n; });
      alert("已更新");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex items-center gap-2"><span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH V4.0</h1>
            <button onClick={() => signOut(auth)} className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded">登出</button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
            {[
                { id: 'dashboard', label: '儀表板', icon: <LayoutDashboard size={16}/> },
                { id: 'rules', label: '特別日子管理 (NEW)', icon: <Calendar size={16}/> },
                { id: 'analytics', label: '市場數據', icon: <TrendingUp size={16}/> },
                { id: 'screens', label: '屏幕管理', icon: <Monitor size={16}/> },
                { id: 'orders', label: '訂單管理', icon: <List size={16}/> },
                { id: 'review', label: `影片審核 (${stats.pendingReview})`, icon: <Video size={16}/>, alert: stats.pendingReview > 0 },
                { id: 'config', label: '價格公式', icon: <Settings size={16}/> },
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border'}`}>
                    {tab.icon} {tab.label} {tab.alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
            ))}
        </div>

        {/* --- 📅 Special Rules Tab (NEW) --- */}
        {activeTab === 'rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                {/* Rule Creator */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20}/> 新增特別規則</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">1. 選擇屏幕</label>
                            <select value={newRule.screenId} onChange={e => setNewRule({...newRule, screenId: e.target.value})} className="w-full border rounded px-3 py-2 text-sm">
                                <option value="all">🌍 全部屏幕 (Global)</option>
                                {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">2. 選擇日期</label>
                            <input type="date" value={newRule.date} onChange={e => setNewRule({...newRule, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">3. 設定時段 (0-23)</label>
                            <input type="text" placeholder="e.g. 18,19,20 (留空代表全日)" value={newRule.hoursStr} onChange={e => setNewRule({...newRule, hoursStr: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">4. 執行動作</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setNewRule({...newRule, action: 'price_override'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'price_override' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'text-slate-500'}`}>💰 設定底價</button>
                                <button onClick={() => setNewRule({...newRule, action: 'lock'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'lock' ? 'bg-red-50 border-red-500 text-red-700' : 'text-slate-500'}`}>🔒 強制鎖定</button>
                                <button onClick={() => setNewRule({...newRule, action: 'disable_buyout'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'disable_buyout' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'text-slate-500'}`}>🚫 禁買斷</button>
                            </div>
                        </div>
                        
                        {newRule.action === 'price_override' && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">新底價 (Base Price)</label>
                                <div className="flex items-center gap-2"><span className="font-bold">$</span><input type="number" value={newRule.overridePrice} onChange={e => setNewRule({...newRule, overridePrice: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/></div>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">備註 (自己睇)</label>
                            <input type="text" placeholder="e.g. 情人節旺季" value={newRule.note} onChange={e => setNewRule({...newRule, note: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                        </div>

                        <button onClick={handleAddRule} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800">建立規則</button>
                    </div>
                </div>

                {/* Rules List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> 已設定的規則 ({specialRules.length})</h3>
                    {specialRules.length === 0 ? <div className="text-center p-10 bg-white rounded-xl border border-dashed text-slate-400">暫無特別規則</div> : 
                    specialRules.sort((a,b) => b.date.localeCompare(a.date)).map(rule => (
                        <div key={rule.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{rule.date}</span>
                                    <span className="text-xs font-bold text-blue-600">{rule.screenId === 'all' ? '🌍 全部屏幕' : `Screen ${rule.screenId}`}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                        rule.type === 'lock' ? 'bg-red-50 border-red-200 text-red-600' : 
                                        rule.type === 'disable_buyout' ? 'bg-orange-50 border-orange-200 text-orange-600' : 
                                        'bg-green-50 border-green-200 text-green-600'
                                    }`}>
                                        {rule.type === 'lock' ? '🔒 鎖定' : rule.type === 'disable_buyout' ? '🚫 禁買斷' : `💰 底價 $${rule.value}`}
                                    </span>
                                    <span className="text-xs text-slate-500">時段: {rule.hours.length === 24 ? '全日' : rule.hours.join(', ')}</span>
                                </div>
                                {rule.note && <div className="text-xs text-slate-400 mt-1">備註: {rule.note}</div>}
                            </div>
                            <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- 📈 Analytics (Multi-Select Update) --- */}
        {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                    <div><h3 className="font-bold flex items-center gap-2"><TrendingUp size={18}/> 真實成交數據</h3><p className="text-xs text-slate-500">已選屏幕: {selectedStatScreens.size === 0 ? "全部 (All)" : `${selectedStatScreens.size} 部`}</p></div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleSelectStatScreen('all')} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.size === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>全部</button>
                        {screens.map(s => (
                            <button key={s.id} onClick={() => handleSelectStatScreen(String(s.id))} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.has(String(s.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto h-[500px]">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10"><tr><th className="p-3 text-left">星期</th><th className="p-3 text-left">時段</th><th className="p-3 text-right">平均成交價</th><th className="p-3 text-right">出價次數</th><th className="p-3 text-left pl-6">建議</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {realMarketStats.sort((a,b)=>(a.dayOfWeek-b.dayOfWeek)||(a.hour-b.hour)).map((m,i)=>(
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-3 text-slate-600 font-medium">{WEEKDAYS[m.dayOfWeek]}</td>
                                    <td className="p-3">{String(m.hour).padStart(2,'0')}:00</td>
                                    <td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td>
                                    <td className="p-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.totalBids>0?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-400'}`}>{m.totalBids}</span></td>
                                    <td className="p-3 pl-6">{m.totalBids>3?<span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUp size={12}/> 加價</span>:m.totalBids===0?<span className="text-red-500 text-xs font-bold flex items-center gap-1"><ArrowDown size={12}/> 減價</span>:<span className="text-slate-300">-</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- ⚙️ Pricing Config (Updated) --- */}
        {activeTab === 'config' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto animate-in fade-in">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Settings size={20}/> 價格公式設定</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ConfigInput label="Bundle (聯播) 溢價倍率" value={pricingConfig.bundleMultiplier} onChange={v => setPricingConfig({...pricingConfig, bundleMultiplier: parseFloat(v)})} />
                        <ConfigInput label="Prime Hour 倍率" value={pricingConfig.primeMultiplier} onChange={v => setPricingConfig({...pricingConfig, primeMultiplier: parseFloat(v)})} />
                        <ConfigInput label="Gold Hour 倍率" value={pricingConfig.goldMultiplier} onChange={v => setPricingConfig({...pricingConfig, goldMultiplier: parseFloat(v)})} />
                        <ConfigInput label="週末 (五六) 倍率" value={pricingConfig.weekendMultiplier} onChange={v => setPricingConfig({...pricingConfig, weekendMultiplier: parseFloat(v)})} />
                        <ConfigInput label="急單 (24h) 附加費率" value={pricingConfig.urgentFee24h} onChange={v => setPricingConfig({...pricingConfig, urgentFee24h: parseFloat(v)})} />
                    </div>
                    <button onClick={savePricingConfig} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800"><Save size={18} className="inline mr-2"/> 儲存設定</button>
                </div>
            </div>
        )}

        {/* Other Tabs (Dashboard, Screens, Orders, Review) - Kept same logic, just rendering */}
        {activeTab === 'dashboard' && <DashboardView stats={stats} />}
        {activeTab === 'screens' && <ScreensView screens={screens} editingScreens={editingScreens} setEditingScreens={setEditingScreens} saveScreen={saveScreen} />}
        {activeTab === 'orders' && <OrdersView orders={orders} customerHistory={customerHistory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} selectedOrderIds={selectedOrderIds} setSelectedOrderIds={setSelectedOrderIds} user={user} />}
        {activeTab === 'review' && <ReviewView orders={orders} handleReview={handleReview} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
      </div>
    </div>
  );
};

// --- Sub-Components to keep file clean (copy paste these at bottom) ---
const DashboardView = ({ stats }) => (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="總營業額" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
            <StatCard title="待審核" value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
            <StatCard title="有效訂單" value={stats.validOrders} icon={<Users className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[300px]"><h3 className="font-bold mb-4">每日生意額</h3><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[300px]"><h3 className="font-bold mb-4">訂單狀態</h3><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
        </div>
    </div>
);

const ScreensView = ({ screens, editingScreens, setEditingScreens, saveScreen }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase"><tr><th className="p-4">ID</th><th className="p-4">資料</th><th className="p-4">底價</th><th className="p-4 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
                {screens.map(s => {
                    const isEditing = editingScreens[s.firestoreId];
                    return (
                    <tr key={s.firestoreId} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-slate-500">#{s.id}</td>
                        <td className="p-4"><div className="font-bold">{s.name}</div><div className="text-xs text-slate-500">{s.location}</div></td>
                        <td className="p-4"><div className="flex items-center gap-1 border rounded px-2 py-1 w-24 bg-white"><span className="text-slate-400">$</span><input type="number" value={isEditing?.basePrice ?? s.basePrice} onChange={e=>setEditingScreens({...editingScreens, [s.firestoreId]: {...isEditing, basePrice: e.target.value}})} className="w-full outline-none font-bold"/></div></td>
                        <td className="p-4 text-right">{isEditing && <button onClick={()=>saveScreen(s)} className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1 rounded">儲存</button>}</td>
                    </tr>
                )})}
            </tbody>
        </table>
    </div>
);

const OrdersView = ({ orders, customerHistory, statusFilter, setStatusFilter, searchTerm, setSearchTerm, user }) => {
    // Simplified filtering for display logic in sub-component
    const filtered = orders.filter(o => (statusFilter === 'all' || o.status === statusFilter) && (o.id.includes(searchTerm) || o.userEmail.includes(searchTerm)));
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b flex gap-4"><input type="text" placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border rounded px-2 py-1 text-sm"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="all">All</option><option value="paid">Paid</option><option value="won">Won</option></select></div>
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 font-bold text-slate-500"><tr><th className="p-4">ID</th><th className="p-4">Amount</th><th className="p-4">Status</th></tr></thead><tbody>
                {filtered.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50">
                        <td className="p-4"><div className="font-mono font-bold">{o.id.slice(0,6)}</div><div className="text-xs">{o.userEmail} {customerHistory[o.userEmail]>1 && <span className="text-yellow-600 font-bold">VIP</span>}</div></td>
                        <td className="p-4 font-bold">${o.amount}</td>
                        <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{o.status}</span></td>
                    </tr>
                ))}
            </tbody></table>
        </div>
    );
};

const ReviewView = ({ orders, handleReview, reviewNote, setReviewNote }) => {
    const pending = orders.filter(o => o.status === 'won' && o.hasVideo && !o.isApproved && !o.isRejected);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.length===0?<div className="col-span-2 text-center p-10 text-slate-400">暫無待審核</div>:pending.map(o=>(
                <div key={o.id} className="bg-white p-4 rounded-xl border border-orange-200">
                    <div className="font-bold text-sm mb-2">{o.userEmail}</div>
                    <a href={o.videoUrl} target="_blank" className="text-blue-600 underline text-sm mb-4 block">查看影片</a>
                    <div className="flex gap-2"><button onClick={()=>handleReview(o.id,'approve')} className="flex-1 bg-green-600 text-white py-2 rounded text-xs font-bold">通過</button><input type="text" placeholder="原因" className="border rounded px-2 text-xs" onChange={e=>setReviewNote(e.target.value)}/><button onClick={()=>handleReview(o.id,'reject')} className="bg-red-50 text-red-600 px-3 rounded text-xs font-bold">拒絕</button></div>
                </div>
            ))}
        </div>
    );
};

const ConfigInput = ({ label, value, onChange }) => (<div className="bg-slate-50 p-3 rounded border border-slate-200"><label className="text-xs font-bold text-slate-500 block mb-1">{label}</label><input type="number" step="0.1" value={value || 0} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"/></div>);
const StatCard = ({ title, value, icon, bg, border }) => (<div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}><div><p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p><p className="text-xl font-bold text-slate-800">{value}</p></div><div className="bg-white p-2 rounded-full shadow-sm">{icon}</div></div>);

export default AdminPanel;