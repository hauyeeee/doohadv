import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, where 
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, Calendar, 
  Search, Filter, XCircle, CheckCircle, AlertCircle, RefreshCw, LayoutDashboard, List
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

// 設定你的 Admin Email
const ADMIN_EMAILS = ["hauyeeee@gmail.com"];

// 顏色設定
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'orders'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 權限檢查
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email)) {
        alert("⛔️ Access Denied: 你不是管理員");
        navigate("/");
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 實時讀取訂單數據
  useEffect(() => {
    if (!user) return;

    // 讀取所有訂單，按時間倒序
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // 確保有 Date 對象方便處理
        createdAtDate: doc.data().createdAt?.toDate() || new Date()
      }));
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 🔥 核心數據處理邏輯 (Analytics Engine)
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let completedOrders = 0;
    let dailyRevenue = {};
    let screenPopularity = {};
    let statusCount = { 
        paid_pending_selection: 0, 
        won: 0, 
        paid: 0, 
        cancelled: 0, 
        pending_auth: 0 
    };

    orders.forEach(order => {
        // 1. 計算狀態分佈
        const status = order.status || 'unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;

        // 只計算有效訂單 (已付款/已完成/競價成功)
        const isValid = ['paid', 'won', 'completed', 'paid_pending_selection'].includes(status);
        
        if (isValid) {
            // 2. 總營業額
            const amount = Number(order.amount) || 0;
            totalRevenue += amount;
            completedOrders += 1;

            // 3. 每日生意額 (Group by Date)
            const dateKey = order.createdAtDate.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + amount;

            // 4. 屏幕熱度 (Group by Screen)
            if (order.detailedSlots) {
                order.detailedSlots.forEach(slot => {
                    const screenName = slot.screenName || 'Unknown';
                    screenPopularity[screenName] = (screenPopularity[screenName] || 0) + 1;
                });
            }
        }
    });

    // 轉換為圖表格式
    const dailyChartData = Object.keys(dailyRevenue).sort().map(date => ({
        date: date.substring(5), // 只顯示 MM-DD
        amount: dailyRevenue[date]
    }));

    const screenChartData = Object.keys(screenPopularity)
        .map(name => ({ name, count: screenPopularity[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // 取前 5 名

    const statusChartData = Object.keys(statusCount).map(key => ({
        name: key,
        value: statusCount[key]
    }));

    return {
        totalRevenue,
        totalOrders: orders.length,
        validOrders: completedOrders,
        averageOrderValue: completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0,
        dailyChartData,
        screenChartData,
        statusChartData
    };
  }, [orders]);

  // 取消訂單功能
  const handleCancelOrder = async (orderId) => {
      if (!window.confirm("⚠️ 確定要取消此訂單嗎？\n注意：這只會更改數據庫狀態，如果已扣款，你需要手動去 Stripe 退款。")) return;
      
      try {
          await updateDoc(doc(db, "orders", orderId), {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelledBy: user.email
          });
          alert("✅ 訂單已取消");
      } catch (error) {
          console.error("Cancel failed:", error);
          alert("❌ 取消失敗");
      }
  };

  // 篩選訂單列表
  const filteredOrders = orders.filter(order => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            order.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex justify-center items-center h-screen"><RefreshCw className="animate-spin mr-2"/> 載入數據中...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">管理員控制台</h1>
                <p className="text-slate-500 text-sm">歡迎回來, {user?.displayName || 'Admin'}</p>
            </div>
            <div className="flex space-x-2">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <LayoutDashboard size={18}/> 儀表板
                </button>
                <button 
                    onClick={() => setActiveTab('orders')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <List size={18}/> 訂單管理
                </button>
            </div>
        </div>

        {/* 📊 TAB 1: 儀表板 (Analytics Dashboard) */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
                {/* 1. 核心指標卡片 (KPI Cards) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="總營業額 (Revenue)" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
                    <StatCard title="有效訂單數" value={stats.validOrders} icon={<CheckCircle className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
                    <StatCard title="平均客單價 (AOV)" value={`HK$ ${stats.averageOrderValue.toLocaleString()}`} icon={<TrendingUp className="text-purple-500"/>} bg="bg-purple-50" border="border-purple-100" />
                    <StatCard title="總記錄數" value={stats.totalOrders} icon={<Users className="text-slate-500"/>} bg="bg-slate-50" border="border-slate-100" />
                </div>

                {/* 2. 主要圖表區域 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Line Chart: 每日生意額 */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={18}/> 每日生意額走勢</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.dailyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                                    <XAxis dataKey="date" fontSize={12}/>
                                    <YAxis fontSize={12}/>
                                    <Tooltip formatter={(value) => `HK$ ${value}`}/>
                                    <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart: 最受歡迎屏幕 */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={18}/> 最受歡迎屏幕 Top 5</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.screenChartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0"/>
                                    <XAxis type="number" fontSize={12}/>
                                    <YAxis dataKey="name" type="category" width={100} fontSize={10}/>
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                        {stats.screenChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                
                {/* Pie Chart: 狀態分佈 */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 w-full md:w-1/2">
                    <h3 className="font-bold text-slate-700 mb-4">訂單狀態分佈</h3>
                    <div className="h-[250px] flex">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.statusChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                                    {stats.statusChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" verticalAlign="middle" align="right"/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* 📋 TAB 2: 訂單管理 (Order Management) */}
        {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4">
                {/* Tools Bar */}
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input 
                            type="text" 
                            placeholder="搜尋訂單 ID 或 Email..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-500"/>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="p-2 rounded-lg border border-slate-300 text-sm bg-white outline-none"
                        >
                            <option value="all">所有狀態</option>
                            <option value="paid_pending_selection">已付款 (待選位)</option>
                            <option value="won">競價成功 (Won)</option>
                            <option value="paid">已完成 (Paid)</option>
                            <option value="cancelled">已取消 (Cancelled)</option>
                            <option value="pending_auth">未付款 (Pending)</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4">訂單時間</th>
                                <th className="p-4">訂單 ID / 客戶</th>
                                <th className="p-4">類型</th>
                                <th className="p-4 text-right">金額</th>
                                <th className="p-4 text-center">狀態</th>
                                <th className="p-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-500 whitespace-nowrap">
                                        {order.createdAtDate.toLocaleString('zh-HK')}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-mono text-xs font-bold text-slate-700">{order.id}</div>
                                        <div className="text-xs text-slate-500">{order.userEmail}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${order.type === 'buyout' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {order.type === 'buyout' ? '直接買斷' : '競價投標'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-bold text-slate-700">
                                        HK$ {order.amount?.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        <StatusBadge status={order.status} />
                                    </td>
                                    <td className="p-4 text-right">
                                        {order.status !== 'cancelled' && (
                                            <button 
                                                onClick={() => handleCancelOrder(order.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded transition-all text-xs font-bold border border-red-200 hover:border-red-400 flex items-center gap-1 ml-auto"
                                            >
                                                <XCircle size={14}/> 取消
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-400">找不到符合的訂單</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

// 小組件：狀態標籤
const StatusBadge = ({ status }) => {
    const styles = {
        paid_pending_selection: "bg-purple-100 text-purple-700 border-purple-200",
        won: "bg-green-100 text-green-700 border-green-200",
        paid: "bg-blue-100 text-blue-700 border-blue-200",
        completed: "bg-slate-100 text-slate-700 border-slate-200",
        cancelled: "bg-red-50 text-red-500 border-red-100 line-through",
        pending_auth: "bg-yellow-50 text-yellow-600 border-yellow-200",
    };
    
    const labels = {
        paid_pending_selection: "已付款 (待選位)",
        won: "競價成功",
        paid: "已付款",
        completed: "已完成",
        cancelled: "已取消",
        pending_auth: "未付款",
    };

    return (
        <span className={`text-[10px] px-2 py-1 rounded-full border font-bold ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
            {labels[status] || status}
        </span>
    );
};

// 小組件：數據卡片
const StatCard = ({ title, value, icon, bg, border }) => (
    <div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}>
        <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
        <div className="bg-white p-2 rounded-full shadow-sm">{icon}</div>
    </div>
);

export default AdminPanel;