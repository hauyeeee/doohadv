import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch 
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Search, Filter, XCircle, CheckCircle, AlertCircle, RefreshCw, 
  LayoutDashboard, List, Video, Monitor, Save, Power, Gavel, CheckSquare, Trash2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

// 引入發信服務
import { sendBidConfirmation } from '../utils/emailService';

// 設定你的 Admin Email
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
  
  // UI States
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  // Bulk Action States
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

  // Screen Editing State
  const [editingScreens, setEditingScreens] = useState({});

  // 權限檢查 & 初始載入
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email)) {
        // alert("⛔️ Access Denied: 你不是管理員");
        // navigate("/");
        // 為了方便測試，如果權限不足可以只顯示 loading 或 redirect
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
      // 1. 監聽訂單 (Realtime)
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

      // 2. 獲取 Screens (One-time)
      const fetchScreensData = async () => {
          const sSnap = await getDocs(query(collection(db, "screens"), orderBy("id")));
          setScreens(sSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      };

      // 3. 獲取 Market Stats (One-time)
      const fetchMarketData = async () => {
          const mSnap = await getDocs(collection(db, "market_stats"));
          setMarketStats(mSnap.docs.map(d => d.data()));
      };

      fetchScreensData();
      fetchMarketData();

      return () => unsubOrders();
  };

  // --- 📊 核心數據計算 (Dashboard Logic) ---
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let completedOrders = 0;
    let pendingReview = 0;
    let dailyRevenue = {};
    let screenPopularity = {};
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

            if (order.detailedSlots) {
                order.detailedSlots.forEach(slot => {
                    const screenName = slot.screenName || 'Unknown';
                    screenPopularity[screenName] = (screenPopularity[screenName] || 0) + 1;
                });
            }
        }
    });

    return {
        totalRevenue,
        totalOrders: orders.length,
        validOrders: completedOrders,
        pendingReview,
        averageOrderValue: completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0,
        dailyChartData: Object.keys(dailyRevenue).sort().map(date => ({ date: date.substring(5), amount: dailyRevenue[date] })),
        screenChartData: Object.keys(screenPopularity).map(name => ({ name, count: screenPopularity[name] })).sort((a, b) => b.count - a.count).slice(0, 5),
        statusChartData: Object.keys(statusCount).map(key => ({ name: key, value: statusCount[key] }))
    };
  }, [orders]);

  // --- 🛠 Bulk Action Logic (批量操作) ---
  const handleSelectOrder = (id) => {
      const newSet = new Set(selectedOrderIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedOrderIds(newSet);
  };

  const handleSelectAll = (e) => {
      if (e.target.checked) {
          const ids = filteredOrders.map(o => o.id);
          setSelectedOrderIds(new Set(ids));
      } else {
          setSelectedOrderIds(new Set());
      }
  };

  const handleBulkCancel = async () => {
      if (selectedOrderIds.size === 0) return;
      if (!window.confirm(`⚠️ 確定要批量取消選中的 ${selectedOrderIds.size} 張訂單嗎？`)) return;

      setLoading(true);
      try {
          const batch = writeBatch(db);
          selectedOrderIds.forEach(id => {
              const ref = doc(db, "orders", id);
              batch.update(ref, { 
                  status: 'cancelled', 
                  cancelledAt: new Date(),
                  cancelledBy: user.email 
              });
          });
          await batch.commit();
          alert("✅ 批量取消成功");
          setSelectedOrderIds(new Set());
      } catch (e) {
          console.error(e);
          alert("❌ 批量操作失敗");
      } finally {
          setLoading(false);
      }
  };

  // --- 🎬 Review Logic (審核 + Email) ---
  const handleReview = async (orderId, action) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;
    if (!window.confirm(`確定要 ${action === 'approve' ? '通過' : '拒絕'} 此廣告嗎？`)) return;
    
    try {
      await updateDoc(doc(db, "orders", orderId), {
        isApproved: action === 'approve',
        isRejected: action === 'reject',
        reviewedAt: new Date(),
        reviewNote: action === 'reject' ? reviewNote : ''
      });

      if (action === 'approve') {
          const emailUser = { email: targetOrder.userEmail, displayName: targetOrder.userName || 'Client' };
          const emailSuccess = await sendBidConfirmation(emailUser, targetOrder, 'video_approved');
          if (emailSuccess) alert(`✅ 已批核並發送 Email！`);
          else alert(`⚠️ 已批核但 Email 發送失敗`);
      } else {
          alert(`✅ 已拒絕`);
      }
    } catch (error) { console.error(error); alert("❌ 系統錯誤"); }
  };

  // --- 📺 Screen Management Logic ---
  const handleScreenChange = (fid, field, val) => {
      setEditingScreens(prev => ({ ...prev, [fid]: { ...prev[fid], [field]: val } }));
  };
  const saveScreen = async (screen) => {
      const changes = editingScreens[screen.firestoreId];
      if (!changes) return;
      try {
          const finalData = { ...changes };
          if (finalData.basePrice) finalData.basePrice = parseInt(finalData.basePrice);
          await updateDoc(doc(db, "screens", screen.firestoreId), finalData);
          alert("✅ 更新成功");
          setEditingScreens(prev => { const n = {...prev}; delete n[screen.firestoreId]; return n; });
          // refresh screens manually or rely on state if realtime (here using state update simulation or re-fetch)
          const sSnap = await getDocs(query(collection(db, "screens"), orderBy("id")));
          setScreens(sSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      } catch (e) { alert("❌ 更新失敗"); }
  };
  const toggleScreenActive = async (screen) => {
      if(!window.confirm("確定更改狀態?")) return;
      try {
          await updateDoc(doc(db, "screens", screen.firestoreId), { isActive: !screen.isActive });
          // re-fetch simple
          const sSnap = await getDocs(query(collection(db, "screens"), orderBy("id")));
          setScreens(sSnap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
      } catch(e) { alert("Error"); }
  };

  // --- Filter Logic ---
  const filteredOrders = orders.filter(order => {
      if (activeTab === 'review') return order.status === 'won' && order.hasVideo && !order.isApproved && !order.isRejected;
      
      const matchesSearch = (order.id||'').toLowerCase().includes(searchTerm.toLowerCase()) || (order.userEmail||'').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
  });

  if (loading && !orders.length) return <div className="flex justify-center items-center h-screen"><RefreshCw className="animate-spin mr-2"/> 載入數據中...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span>
                    DOOH 管理後台
                </h1>
                <p className="text-slate-500 text-sm">操作員: {user?.email}</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">返回首頁</button>
                <button onClick={() => signOut(auth)} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200">登出</button>
            </div>
        </div>

        {/* 導航 Tabs */}
        <div className="flex flex-wrap gap-2">
            {[
                { id: 'dashboard', label: '儀表板', icon: <LayoutDashboard size={16}/> },
                { id: 'orders', label: '訂單管理', icon: <List size={16}/> },
                { id: 'review', label: `影片審核 (${stats.pendingReview})`, icon: <Video size={16}/>, alert: stats.pendingReview > 0 },
                { id: 'screens', label: '屏幕管理', icon: <Monitor size={16}/> },
                { id: 'analytics', label: '市場數據', icon: <TrendingUp size={16}/> },
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

        {/* --- 📊 儀表板 --- */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="總營業額" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
                    <StatCard title="待審核影片" value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
                    <StatCard title="有效訂單" value={stats.validOrders} icon={<CheckCircle className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
                    <StatCard title="總記錄" value={stats.totalOrders} icon={<Users className="text-slate-500"/>} bg="bg-slate-50" border="border-slate-100" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={18}/> 每日生意額</h3>
                        <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4">訂單狀態分佈</h3>
                        <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
                    </div>
                </div>
            </div>
        )}

        {/* --- 📋 訂單管理 (Bulk Actions) --- */}
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
                            <option value="cancelled">已取消</option>
                        </select>
                    </div>
                    {/* Bulk Action Bar */}
                    {selectedOrderIds.size > 0 && (
                        <div className="flex items-center gap-3 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 animate-pulse">
                            <span className="text-xs font-bold text-blue-700">已選 {selectedOrderIds.size} 項</span>
                            <div className="h-4 w-px bg-blue-200"></div>
                            <button onClick={handleBulkCancel} className="text-red-600 text-xs font-bold hover:underline flex items-center gap-1"><Trash2 size={14}/> 批量取消</button>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4 w-10 text-center">
                                    <input type="checkbox" onChange={handleSelectAll} checked={selectedOrderIds.size > 0 && selectedOrderIds.size === filteredOrders.length} />
                                </th>
                                <th className="p-4">時間</th>
                                <th className="p-4">訂單 ID / 客戶</th>
                                <th className="p-4 text-right">金額</th>
                                <th className="p-4 text-center">狀態</th>
                                <th className="p-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map((order) => (
                                <tr key={order.id} className={`hover:bg-slate-50 ${selectedOrderIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-4 text-center">
                                        <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} />
                                    </td>
                                    <td className="p-4 text-slate-500 whitespace-nowrap">{order.createdAtDate.toLocaleString('zh-HK')}</td>
                                    <td className="p-4">
                                        <div className="font-mono text-xs font-bold text-slate-700">{order.id.slice(0,8)}...</div>
                                        <div className="text-xs text-slate-500">{order.userEmail}</div>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- 🎬 影片審核 (Review Tab) --- */}
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
                            <div>
                                <p className="text-xs text-slate-400">客戶</p>
                                <p className="font-bold text-sm">{order.userEmail}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">播放影片</p>
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

        {/* --- 📺 屏幕管理 (Screens Tab) --- */}
        {activeTab === 'screens' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                        <tr><th className="p-4">ID</th><th className="p-4">名稱</th><th className="p-4">狀態</th><th className="p-4">底價</th><th className="p-4 text-right">操作</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {screens.map(s => {
                             const isEditing = editingScreens[s.firestoreId];
                             const currentPrice = isEditing?.basePrice ?? s.basePrice;
                             return (
                                <tr key={s.firestoreId} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono text-slate-500">#{s.id}</td>
                                    <td className="p-4 font-bold">{s.name} <div className="text-xs font-normal text-slate-400">{s.location}</div></td>
                                    <td className="p-4"><button onClick={()=>toggleScreenActive(s)} className={`px-2 py-1 rounded text-xs font-bold ${s.isActive!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{s.isActive!==false?'Active':'Inactive'}</button></td>
                                    <td className="p-4 flex items-center gap-1">$ <input type="number" value={currentPrice} onChange={(e)=>handleScreenChange(s.firestoreId, 'basePrice', e.target.value)} className="w-20 border rounded px-1"/></td>
                                    <td className="p-4 text-right">{isEditing && <button onClick={()=>saveScreen(s)} className="text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1 rounded"><Save size={14}/> 儲存</button>}</td>
                                </tr>
                             )
                        })}
                    </tbody>
                </table>
             </div>
        )}

        {/* --- 📈 市場數據 (Analytics Tab) --- */}
        {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold mb-4">歷史成交數據</h3>
                <div className="overflow-x-auto h-[500px]">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0"><tr><th className="p-3 text-left">Screen</th><th className="p-3 text-left">Day</th><th className="p-3 text-left">Hour</th><th className="p-3 text-right">Avg Price</th><th className="p-3 text-right">Bids</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {marketStats.map((m, i) => (
                                <tr key={i}>
                                    <td className="p-3">Screen {m.screenId}</td>
                                    <td className="p-3">{WEEKDAYS[m.dayOfWeek]}</td>
                                    <td className="p-3">{String(m.hour).padStart(2,'0')}:00</td>
                                    <td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td>
                                    <td className="p-3 text-right">{m.totalBids}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

// UI Components
const StatusBadge = ({ status }) => {
    const map = {
        paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
        won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' },
        paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
        cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' },
        pending_auth: { label: '未付款', cls: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100' };
    return <span className={`text-[10px] px-2 py-1 rounded border font-bold ${s.cls}`}>{s.label}</span>;
};

const StatCard = ({ title, value, icon, bg, border }) => (
    <div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}>
        <div><p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p><p className="text-xl font-bold text-slate-800">{value}</p></div>
        <div className="bg-white p-2 rounded-full shadow-sm">{icon}</div>
    </div>
);

export default AdminPanel;