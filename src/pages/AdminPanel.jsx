import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc, deleteDoc, addDoc
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Search, Video, Monitor, Save, Trash2, 
  LayoutDashboard, List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X, CheckSquare, Filter
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
  
  // --- Data States ---
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [specialRules, setSpecialRules] = useState([]);
  
  // --- Pricing Config States (Global & Active) ---
  const [globalPricingConfig, setGlobalPricingConfig] = useState({
      baseImpressions: 10000, primeMultiplier: 3.5, goldMultiplier: 1.8,
      weekendMultiplier: 1.5, bundleMultiplier: 1.25, urgentFee24h: 1.5, urgentFee1h: 2.0
  });
  const [activeConfig, setActiveConfig] = useState({}); // Current editing config
  const [selectedConfigTarget, setSelectedConfigTarget] = useState('global'); // 'global' or 'screenId'
  
  // --- UI States ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  // --- Advanced Filter States ---
  const [selectedStatScreens, setSelectedStatScreens] = useState(new Set()); // Analytics Multi-select (Screens)
  const [selectedAnalyticsHours, setSelectedAnalyticsHours] = useState(new Set()); // Analytics Multi-select (Hours) 🔥 NEW
  
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());       // Bulk Action Multi-select
  const [editingScreens, setEditingScreens] = useState({});                  // Inline Screen Editing

  // --- Forms ---
  const [newRule, setNewRule] = useState({
      screenId: 'all', date: '', hoursStr: '', action: 'price_override', overridePrice: '', note: ''
  });

  // 1. Auth & Data Fetching
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
      
      // 1. Orders (Realtime)
      const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAtDate: d.data().createdAt?.toDate() || new Date() })));
        setLoading(false);
      });

      // 2. Screens (Realtime)
      const unsubScreens = onSnapshot(query(collection(db, "screens"), orderBy("id")), (snap) => {
          setScreens(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      });

      // 3. Special Rules (Realtime)
      const unsubRules = onSnapshot(collection(db, "special_rules"), (snap) => {
          setSpecialRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // 4. Config (One-time)
      getDoc(doc(db, "system_config", "pricing_rules")).then(docSnap => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setGlobalPricingConfig(data);
              setActiveConfig(data); // Initial view is global
          }
      });

      return () => { unsubOrders(); unsubScreens(); unsubRules(); };
  };

  // --- 🧠 Logic: VIP Customer Identification ---
  const customerHistory = useMemo(() => {
      const history = {};
      orders.forEach(order => {
          const email = order.userEmail;
          if (!history[email]) history[email] = 0;
          history[email]++;
      });
      return history;
  }, [orders]);

  // --- 📊 Logic: Dashboard Stats ---
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

  // --- 📈 Logic: Real-time Market Stats (Multi-Screen + Multi-Hour Filter) ---
  const realMarketStats = useMemo(() => {
      const statsMap = {}; 
      // Init Grid 7x24
      for(let d=0; d<7; d++) {
          for(let h=0; h<24; h++) {
              statsMap[`${d}-${h}`] = { dayOfWeek: d, hour: h, totalAmount: 0, totalBids: 0 };
          }
      }
      
      // Populate Data
      orders.forEach(order => {
          if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) {
              order.detailedSlots.forEach(slot => {
                  // If selectedStatScreens is empty, it means "All"
                  const isScreenSelected = selectedStatScreens.size === 0 || selectedStatScreens.has(String(slot.screenId));
                  // If selectedAnalyticsHours is empty, it means "All"
                  const isHourSelected = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(slot.hour);

                  if (isScreenSelected && isHourSelected) {
                      const dateObj = new Date(slot.date); 
                      const key = `${dateObj.getDay()}-${slot.hour}`;
                      if (statsMap[key]) {
                          statsMap[key].totalAmount += (Number(slot.bidPrice) || 0);
                          statsMap[key].totalBids += 1;
                      }
                  }
              });
          }
      });

      // 🔥 Calculate Summary for the Selection
      let selectionTotalAmount = 0;
      let selectionTotalBids = 0;
      
      const rows = Object.values(statsMap).map(item => {
          // 只計算有出價的時段進入總平均 (避免被 0 拉低)
          if (item.totalBids > 0) {
              // 注意：這裡 statsMap 已經經過上面的篩選填入數據，所以這裡累加就是準確的
              // 但為了更嚴謹，我們只累加符合「顯示條件」的行
              const isHourVisible = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(item.hour);
              if (isHourVisible) {
                  selectionTotalAmount += item.totalAmount;
                  selectionTotalBids += item.totalBids;
              }
          }
          
          return {
              ...item,
              averagePrice: item.totalBids > 0 ? Math.round(item.totalAmount / item.totalBids) : 0
          };
      });

      // Filter rows for display based on hour selection
      const displayRows = selectedAnalyticsHours.size > 0 
          ? rows.filter(r => selectedAnalyticsHours.has(r.hour))
          : rows;

      return {
          rows: displayRows,
          summary: {
              avgPrice: selectionTotalBids > 0 ? Math.round(selectionTotalAmount / selectionTotalBids) : 0,
              totalBids: selectionTotalBids
          }
      };
  }, [orders, selectedStatScreens, selectedAnalyticsHours]);

  // --- ⚙️ Logic: Pricing Configuration (Global vs Screen) ---
  useEffect(() => {
      if (selectedConfigTarget === 'global') {
          setActiveConfig(globalPricingConfig);
      } else {
          const screen = screens.find(s => String(s.id) === selectedConfigTarget);
          if (screen && screen.customPricing) {
              setActiveConfig(screen.customPricing); // Load custom config
          } else {
              setActiveConfig(globalPricingConfig); // Fallback to global for editing
          }
      }
  }, [selectedConfigTarget, globalPricingConfig, screens]);

  const handleConfigChange = (key, val) => {
      setActiveConfig(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  const savePricingConfig = async () => {
      if (selectedConfigTarget === 'global') {
          await setDoc(doc(db, "system_config", "pricing_rules"), activeConfig);
          setGlobalPricingConfig(activeConfig);
          alert("🌍 全局價格公式已更新");
      } else {
          const screen = screens.find(s => String(s.id) === selectedConfigTarget);
          if (!screen) return;
          await updateDoc(doc(db, "screens", screen.firestoreId), { customPricing: activeConfig });
          alert(`✅ Screen ${screen.name} 的專屬公式已更新`);
      }
  };

  // --- 🛠 Logic: Bulk Actions ---
  // Helper to filter orders for display AND for "Select All" logic
  const filteredOrders = useMemo(() => {
      return orders.filter(o => {
          if (activeTab === 'review') return o.status === 'won' && o.hasVideo && !o.isApproved && !o.isRejected;
          const matchesSearch = (o.id||'').toLowerCase().includes(searchTerm.toLowerCase()) || (o.userEmail||'').toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
          return matchesSearch && matchesStatus;
      });
  }, [orders, activeTab, searchTerm, statusFilter]);

  const handleSelectOrder = (id) => {
      const newSet = new Set(selectedOrderIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedOrderIds(newSet);
  };

  const handleSelectAll = (e) => {
      if (e.target.checked) {
          setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
      } else {
          setSelectedOrderIds(new Set());
      }
  };

  const handleBulkAction = async (action) => {
      if (selectedOrderIds.size === 0) return;
      if (!window.confirm(`⚠️ 確認對選中的 ${selectedOrderIds.size} 張訂單執行 ${action === 'cancel' ? '批量取消' : action}?`)) return;
      
      try {
          const batch = writeBatch(db);
          selectedOrderIds.forEach(id => {
              const ref = doc(db, "orders", id);
              if (action === 'cancel') {
                  batch.update(ref, { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.email });
              }
          });
          await batch.commit();
          alert("✅ 批量操作完成");
          setSelectedOrderIds(new Set());
      } catch (e) { console.error(e); alert("❌ 操作失敗"); }
  };

  // --- 📅 Logic: Special Rules ---
  const handleAddRule = async () => {
      if (!newRule.date) return alert("❌ 請選擇日期");
      
      let hours = [];
      const inputStr = newRule.hoursStr.trim();

      if (!inputStr || inputStr.toLowerCase() === 'all') {
          hours = Array.from({length: 24}, (_, i) => i);
      } else {
          // Support "0-23" or "18,19,20"
          if (inputStr.includes('-')) {
              const [start, end] = inputStr.split('-').map(n => parseInt(n));
              if (!isNaN(start) && !isNaN(end) && start <= end) {
                  for (let i = start; i <= end; i++) if (i >= 0 && i <= 23) hours.push(i);
              }
          } else {
              hours = inputStr.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23);
          }
      }

      if (hours.length === 0) return alert("❌ 時段格式錯誤 (e.g., 0-23 or 18,19)");

      try {
          await addDoc(collection(db, "special_rules"), {
              screenId: newRule.screenId, date: newRule.date, hours: hours,
              type: newRule.action, 
              value: newRule.action === 'price_override' ? parseFloat(newRule.overridePrice) : null,
              note: newRule.note, createdAt: new Date()
          });
          alert("✅ 規則已建立");
          setNewRule({ ...newRule, hoursStr: '', overridePrice: '', note: '' });
      } catch (e) { console.error(e); alert("❌ 建立失敗 (請檢查 Firebase Rules)"); }
  };

  const handleDeleteRule = async (id) => {
      if(window.confirm("確認刪除此規則？")) await deleteDoc(doc(db, "special_rules", id));
  };

  // --- 🎬 Logic: Review ---
  const handleReview = async (orderId, action) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || !window.confirm(`確定要 ${action === 'approve' ? '通過' : '拒絕'}?`)) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            isApproved: action === 'approve', 
            isRejected: action === 'reject', 
            reviewedAt: new Date(),
            reviewNote: action === 'reject' ? reviewNote : ''
        });
        if (action === 'approve') {
            sendBidConfirmation({ email: targetOrder.userEmail, displayName: targetOrder.userName || 'Client' }, targetOrder, 'video_approved');
        }
        alert(action === 'approve' ? "✅ 已批核並發送 Email" : "✅ 已拒絕");
        setReviewNote("");
    } catch (e) { alert("操作失敗"); }
  };

  // --- 📺 Logic: Screen Management ---
  const handleScreenChange = (fid, field, val) => {
      setEditingScreens(prev => ({ ...prev, [fid]: { ...prev[fid], [field]: val } }));
  };

  const saveScreen = async (screen) => {
      const changes = editingScreens[screen.firestoreId];
      if (!changes) return;
      try {
          const finalData = { ...changes };
          if (finalData.basePrice) finalData.basePrice = parseInt(finalData.basePrice);
          if (finalData.lockedHoursStr !== undefined) {
              const hoursArray = finalData.lockedHoursStr.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h));
              finalData.lockedHours = hoursArray;
              delete finalData.lockedHoursStr;
          }
          await updateDoc(doc(db, "screens", screen.firestoreId), finalData);
          alert("✅ 屏幕設定已更新");
          setEditingScreens(prev => { const n={...prev}; delete n[screen.firestoreId]; return n; });
      } catch (e) { alert("❌ 更新失敗"); }
  };

  const toggleScreenActive = async (screen) => {
      if(!window.confirm(`確定要 ${!screen.isActive ? '解鎖 (Unlock)' : '鎖定 (Lock)'} 整部 ${screen.name} 嗎？`)) return;
      try { await updateDoc(doc(db, "screens", screen.firestoreId), { isActive: !screen.isActive }); } catch(e) { alert("❌ 操作失敗"); }
  };

  const toggleAnalyticsHour = (h) => {
      const n = new Set(selectedAnalyticsHours);
      if (n.has(h)) n.delete(h); else n.add(h);
      setSelectedAnalyticsHours(n);
  };

  // ---------------- Render ----------------

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex items-center gap-2"><span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH V5.0 Ultimate</h1>
            <div className="flex gap-2">
                <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded">返回首頁</button>
                <button onClick={() => signOut(auth)} className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded">登出</button>
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
            {[
                {id:'dashboard',icon:<LayoutDashboard size={16}/>,label:'儀表板'},
                {id:'orders',icon:<List size={16}/>,label:'訂單管理'},
                {id:'review',icon:<Video size={16}/>,label:`審核 (${stats.pendingReview})`, alert:stats.pendingReview>0},
                {id:'rules',icon:<Calendar size={16}/>,label:'特別規則'},
                {id:'screens',icon:<Monitor size={16}/>,label:'屏幕管理'},
                {id:'analytics',icon:<TrendingUp size={16}/>,label:'市場數據'},
                {id:'config',icon:<Settings size={16}/>,label:'價格公式 (進階)'},
            ].map(t => (
                <button key={t.id} onClick={()=>{setActiveTab(t.id); setSelectedOrderIds(new Set())}} className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab===t.id?'bg-blue-600 text-white shadow-md':'bg-white text-slate-500 hover:bg-slate-100 border'}`}>
                    {t.icon} {t.label} {t.alert&&<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
            ))}
        </div>

        {/* === CONTENT === */}

        {/* 1. Dashboard */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="總營業額" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
                    <StatCard title="待審核" value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
                    <StatCard title="有效訂單" value={stats.validOrders} icon={<Users className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
                    <StatCard title="總記錄" value={stats.totalOrders} icon={<List className="text-slate-500"/>} bg="bg-slate-50" border="border-slate-100" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px]"><h3 className="font-bold mb-4">每日生意額</h3><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px]"><h3 className="font-bold mb-4">訂單狀態</h3><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
                </div>
            </div>
        )}

        {/* 2. Orders Management (Restored Bulk Actions & VIP) */}
        {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2 flex-1">
                        <Search className="text-slate-400" size={16}/>
                        <input type="text" placeholder="搜尋 ID / Email..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-2 border rounded px-2 py-1 text-sm outline-none w-64"/>
                        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="all">所有狀態</option><option value="paid_pending_selection">競價中</option><option value="won">成功 (Won)</option><option value="paid">已完成 (Paid)</option><option value="cancelled">已取消</option></select>
                    </div>
                    {/* 🔥 Bulk Action Bar */}
                    {selectedOrderIds.size > 0 && <button onClick={() => handleBulkAction('cancel')} className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 animate-pulse"><Trash2 size={14}/> 批量取消 ({selectedOrderIds.size})</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}/></th>
                                <th className="p-4">時間</th>
                                <th className="p-4">訂單詳情</th>
                                <th className="p-4 text-right">金額</th>
                                <th className="p-4 text-center">狀態</th>
                                <th className="p-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map(order => {
                                const isRepeat = customerHistory[order.userEmail] > 1;
                                return (
                                    <tr key={order.id} className={`hover:bg-slate-50 ${selectedOrderIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-4 text-center"><input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} /></td>
                                        <td className="p-4 text-slate-500 whitespace-nowrap">{order.createdAtDate.toLocaleString('zh-HK')}</td>
                                        <td className="p-4">
                                            <div className="font-mono text-xs font-bold text-slate-700">{order.id.slice(0,8)}...</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                {order.userEmail}
                                                {/* 🔥 VIP Tag */}
                                                {isRepeat && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5"><Star size={10} fill="currentColor"/> VIP ({customerHistory[order.userEmail]})</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold">HK$ {order.amount?.toLocaleString()}</td>
                                        <td className="p-4 text-center"><StatusBadge status={order.status} /></td>
                                        <td className="p-4 text-right">
                                            {order.status !== 'cancelled' && <button onClick={async () => { if(window.confirm("取消此訂單？")) await updateDoc(doc(db, "orders", order.id), { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.email }) }} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-transparent hover:border-red-200">取消</button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* 3. Review (Restored Detailed View) */}
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
                            <div><p className="text-xs text-slate-400">客戶</p><p className="font-bold text-sm">{order.userEmail}</p></div>
                            <div>
                                <p className="text-xs text-slate-400">影片素材</p>
                                {/* 🔥 Video Link */}
                                <a href={order.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-bold underline truncate block">{order.videoName || 'Download Video'}</a>
                            </div>
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

        {/* 4. Special Rules */}
        {activeTab === 'rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20}/> 新增特別規則</h3>
                    <div className="space-y-4">
                        <select value={newRule.screenId} onChange={e => setNewRule({...newRule, screenId: e.target.value})} className="w-full border rounded px-3 py-2 text-sm">
                            <option value="all">🌍 全部屏幕 (Global)</option>
                            {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="date" value={newRule.date} onChange={e => setNewRule({...newRule, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                        <input type="text" placeholder="時段: 0-23 或 18,19 (留空=全日)" value={newRule.hoursStr} onChange={e => setNewRule({...newRule, hoursStr: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setNewRule({...newRule, action: 'price_override'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'price_override' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'text-slate-500'}`}>💰 設定底價</button>
                            <button onClick={() => setNewRule({...newRule, action: 'lock'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'lock' ? 'bg-red-50 border-red-500 text-red-700' : 'text-slate-500'}`}>🔒 強制鎖定</button>
                            <button onClick={() => setNewRule({...newRule, action: 'disable_buyout'})} className={`py-2 text-xs font-bold rounded border ${newRule.action === 'disable_buyout' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'text-slate-500'}`}>🚫 禁買斷</button>
                        </div>
                        {newRule.action === 'price_override' && <div className="flex items-center gap-2"><span className="font-bold">$</span><input type="number" value={newRule.overridePrice} onChange={e => setNewRule({...newRule, overridePrice: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/></div>}
                        <input type="text" placeholder="備註 (e.g. 情人節)" value={newRule.note} onChange={e => setNewRule({...newRule, note: e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/>
                        <button onClick={handleAddRule} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800">建立規則</button>
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> 已設定的規則 ({specialRules.length})</h3>
                    {specialRules.sort((a,b) => b.date.localeCompare(a.date)).map(rule => (
                        <div key={rule.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{rule.date}</span><span className="text-xs font-bold text-blue-600">{rule.screenId === 'all' ? 'Global' : `Screen ${rule.screenId}`}</span></div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${rule.type === 'lock' ? 'bg-red-50 border-red-200 text-red-600' : rule.type === 'disable_buyout' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-green-50 border-green-200 text-green-600'}`}>
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

        {/* 5. Screens Management */}
        {activeTab === 'screens' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4">ID</th><th className="p-4">資料</th><th className="p-4 text-center">全機鎖定</th><th className="p-4">底價</th><th className="p-4">鎖定時段 (0-23)</th><th className="p-4 text-right">操作</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {screens.map(s => {
                                 const isEditing = editingScreens[s.firestoreId];
                                 const currentPrice = isEditing?.basePrice ?? s.basePrice;
                                 const currentLocked = isEditing?.lockedHoursStr ?? (s.lockedHours ? s.lockedHours.join(',') : '');
                                 return (
                                    <tr key={s.firestoreId} className="hover:bg-slate-50">
                                        <td className="p-4 font-mono text-slate-500">#{s.id}</td>
                                        <td className="p-4"><div className="font-bold">{s.name}</div><div className="text-xs text-slate-500">{s.location}</div></td>
                                        <td className="p-4 text-center"><button onClick={()=>toggleScreenActive(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold w-full ${s.isActive!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{s.isActive!==false?<><Unlock size={12} className="inline"/> 上架中</>:<><Lock size={12} className="inline"/> 已鎖定</>}</button></td>
                                        <td className="p-4"><div className="flex items-center gap-1 bg-white border rounded px-2 py-1"><span className="text-slate-400">$</span><input type="number" value={currentPrice} onChange={(e)=>handleScreenChange(s.firestoreId, 'basePrice', e.target.value)} className="w-full font-bold outline-none"/></div></td>
                                        <td className="p-4"><input type="text" placeholder="e.g. 0,1,2" value={currentLocked} onChange={(e)=>handleScreenChange(s.firestoreId, 'lockedHoursStr', e.target.value)} className="border rounded px-2 py-1 text-xs w-full outline-none"/></td>
                                        <td className="p-4 text-right">{isEditing && <button onClick={()=>saveScreen(s)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ml-auto animate-pulse"><Save size={14}/> 儲存</button>}</td>
                                    </tr>
                                 )
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

        {/* 6. Analytics (Real-time & Multi-select) */}
        {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                    <div><h3 className="font-bold flex items-center gap-2"><TrendingUp size={18}/> 真實成交數據</h3><p className="text-xs text-slate-500">已選: {selectedStatScreens.size === 0 ? "全部 (All)" : `${selectedStatScreens.size} 部`}</p></div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedStatScreens(new Set())} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.size === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>全部</button>
                        {screens.map(s => (
                            <button key={s.id} onClick={() => {const n=new Set(selectedStatScreens); n.has(String(s.id))?n.delete(String(s.id)):n.add(String(s.id)); setSelectedStatScreens(n);}} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.has(String(s.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
                {/* 🔥 NEW: Hour Filters */}
                <div className="flex flex-wrap gap-1 items-center mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase w-12">Hours:</span>
                    <button onClick={() => setSelectedAnalyticsHours(new Set())} className={`w-8 h-8 rounded text-xs font-bold border ${selectedAnalyticsHours.size===0?'bg-slate-800 text-white':'bg-white text-slate-600'}`}>All</button>
                    {Array.from({length:24},(_,i)=>i).map(h => (
                        <button key={h} onClick={() => toggleAnalyticsHour(h)} className={`w-8 h-8 rounded text-xs border font-bold transition-all ${selectedAnalyticsHours.has(h)?'bg-orange-500 text-white border-orange-500':'bg-white text-slate-600 hover:bg-slate-100'}`}>
                            {h}
                        </button>
                    ))}
                </div>

                {/* 🔥 NEW: Summary Card */}
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white flex justify-between items-center shadow-lg">
                    <div>
                        <h3 className="font-bold text-lg mb-1">所選組合平均成交價 (Average Price)</h3>
                        <p className="text-blue-100 text-sm">
                            範圍: {selectedStatScreens.size===0?'全部屏幕':selectedStatScreens.size+' 個屏幕'} × {selectedAnalyticsHours.size===0?'24小時':selectedAnalyticsHours.size+' 個時段'}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold">HK$ {realMarketStats.summary.avgPrice.toLocaleString()}</div>
                        <div className="text-xs text-blue-200">基於 {realMarketStats.summary.totalBids} 次出價</div>
                    </div>
                </div>

                <div className="overflow-x-auto h-[400px] border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10"><tr><th className="p-3 text-left">星期</th><th className="p-3 text-left">時段</th><th className="p-3 text-right">平均成交價</th><th className="p-3 text-right">出價次數</th><th className="p-3 text-left pl-6">建議</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {realMarketStats.rows.sort((a,b)=>(a.dayOfWeek-b.dayOfWeek)||(a.hour-b.hour)).map((m,i)=>(
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

        {/* 7. Config (Updated: Global vs Screen) */}
        {activeTab === 'config' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> 價格公式設定</h3>
                        <p className="text-xs text-slate-500 mt-1">您可以設定全局預設值，或針對個別屏幕設定不同的倍率。</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-600">編輯對象:</span>
                        <select 
                            value={selectedConfigTarget} 
                            onChange={e => setSelectedConfigTarget(e.target.value)} 
                            className="border-2 border-blue-100 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-800 outline-none focus:border-blue-500"
                        >
                            <option value="global">🌍 Global System Default (全局)</option>
                            <option disabled>──────────</option>
                            {screens.map(s => <option key={s.id} value={String(s.id)}>🖥️ {s.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ConfigSection title="時段倍率 (Time Multipliers)">
                        <ConfigInput label="Prime Hour (18:00-23:00)" val={activeConfig.primeMultiplier} onChange={v=>handleConfigChange('primeMultiplier',v)} desc="預設 3.5x"/>
                        <ConfigInput label="Gold Hour (12:00-14:00)" val={activeConfig.goldMultiplier} onChange={v=>handleConfigChange('goldMultiplier',v)} desc="預設 1.8x"/>
                        <ConfigInput label="週末倍率 (Fri/Sat)" val={activeConfig.weekendMultiplier} onChange={v=>handleConfigChange('weekendMultiplier',v)} desc="預設 1.5x"/>
                    </ConfigSection>
                    
                    <ConfigSection title="附加費率 (Surcharges)">
                        <ConfigInput label="聯播網 (Bundle)" val={activeConfig.bundleMultiplier} onChange={v=>handleConfigChange('bundleMultiplier',v)} desc="預設 1.25x"/>
                        <ConfigInput label="急單 (24h內)" val={activeConfig.urgentFee24h} onChange={v=>handleConfigChange('urgentFee24h',v)} desc="預設 1.5x (+50%)"/>
                        <ConfigInput label="極速 (1h內)" val={activeConfig.urgentFee1h} onChange={v=>handleConfigChange('urgentFee1h',v)} desc="預設 2.0x (+100%)"/>
                    </ConfigSection>
                </div>

                <div className="mt-6 flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <AlertTriangle size={14}/> 
                        {selectedConfigTarget === 'global' ? "修改此處將影響所有沒有自定義設定的屏幕。" : `此設定只會影響 ${screens.find(s=>String(s.id)===selectedConfigTarget)?.name}。`}
                    </div>
                    <button onClick={savePricingConfig} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2">
                        <Save size={18}/> 儲存設定
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

// --- Sub-Components ---
const ConfigSection = ({title, children}) => (<div className="space-y-3"><h4 className="text-sm font-bold text-slate-700 border-b pb-1">{title}</h4><div className="space-y-2">{children}</div></div>);
const ConfigInput = ({ label, val, onChange, desc }) => (<div className="flex justify-between items-center"><div className="text-xs font-bold text-slate-500">{label} <span className="text-[10px] font-normal text-slate-400 block">{desc}</span></div><input type="number" step="0.1" value={val||0} onChange={e=>onChange(e.target.value)} className="w-16 border rounded px-2 py-1 text-sm font-bold text-right outline-none focus:border-blue-500"/></div>);
const StatCard = ({ title, value, icon, bg, border }) => (<div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}><div><p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p><p className="text-xl font-bold text-slate-800">{value}</p></div><div className="bg-white p-2 rounded-full shadow-sm">{icon}</div></div>);
const StatusBadge = ({ status }) => { 
    const map = { 
        paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' }, 
        won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' }, 
        paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' }, 
        cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' } 
    }; 
    const s = map[status] || { label: status, cls: 'bg-gray-100' }; 
    return <span className={`text-[10px] px-2 py-1 rounded border font-bold ${s.cls}`}>{s.label}</span>; 
};

export default AdminPanel;