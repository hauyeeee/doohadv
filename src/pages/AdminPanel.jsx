import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Play, CheckCircle, XCircle, AlertTriangle, RefreshCw, LogOut, DollarSign, Video, Clock, Gavel, LayoutList, BarChart3, TrendingUp, Monitor, Save, Power } from 'lucide-react';

// 引入發信服務
import { sendBidConfirmation } from '../utils/emailService';

// ⚠️ 安全性警告 ⚠️
// 單純在前端這裡檢查 Email 是不安全的 (黑客可以繞過)。
// 請務必在 Firebase Console -> Firestore Database -> Rules 中設定權限 (參考下方的 firestore.rules 檔案)
const ADMIN_EMAILS = ["hauyeeee@gmail.com"]; 

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const AdminPanel = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, pendingReview: 0, activeAds: 0 });
  const [marketData, setMarketData] = useState([]);
  const [screens, setScreens] = useState([]); 

  const [reviewNote, setReviewNote] = useState("");
  
  // 分頁狀態
  const [activeTab, setActiveTab] = useState('review');
  const [selectedScreenId, setSelectedScreenId] = useState(1);

  // 用來暫存編輯中的屏幕數據
  const [editingScreens, setEditingScreens] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && ADMIN_EMAILS.includes(currentUser.email)) {
        setUser(currentUser);
        fetchAllData();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchAllData = () => {
      fetchOrders();
      fetchMarketStats();
      fetchScreens(); 
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetchedOrders);

      const revenue = fetchedOrders
        .filter(o => ['won', 'paid', 'completed'].includes(o.status))
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const pending = fetchedOrders.filter(o => o.status === 'won' && o.hasVideo && !o.isApproved && !o.isRejected).length;
      const active = fetchedOrders.filter(o => o.status === 'won' && o.isApproved).length;

      setStats({ revenue, pendingReview: pending, activeAds: active });
    } catch (error) { console.error("Error fetching orders:", error); } 
    finally { setLoading(false); }
  };

  const fetchMarketStats = async () => {
      try {
          const q = query(collection(db, "market_stats"));
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => doc.data());
          setMarketData(data);
      } catch (error) { console.error("Error fetching market stats:", error); }
  };

  const fetchScreens = async () => {
      try {
          const q = query(collection(db, "screens"), orderBy("id"));
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
          setScreens(data);
      } catch (error) { console.error("Error fetching screens:", error); }
  };

  const handleScreenChange = (firestoreId, field, value) => {
      setEditingScreens(prev => ({
          ...prev,
          [firestoreId]: {
              ...prev[firestoreId],
              [field]: value
          }
      }));
  };

  const saveScreen = async (screen) => {
      const changes = editingScreens[screen.firestoreId];
      if (!changes) return; 

      try {
          const docRef = doc(db, "screens", screen.firestoreId);
          const finalData = { ...changes };
          if (finalData.basePrice) finalData.basePrice = parseInt(finalData.basePrice);

          await updateDoc(docRef, finalData);
          alert(`✅ Screen ${screen.id} 更新成功！`);
          
          setEditingScreens(prev => {
              const newState = { ...prev };
              delete newState[screen.firestoreId];
              return newState;
          });
          fetchScreens();
          
      } catch (error) {
          console.error("Update failed:", error);
          alert("❌ 更新失敗");
      }
  };

  const toggleScreenActive = async (screen) => {
      const newStatus = !screen.isActive;
      if (!window.confirm(`確定要${newStatus ? '上架' : '下架'} Screen ${screen.id} 嗎？`)) return;

      try {
          await updateDoc(doc(db, "screens", screen.firestoreId), { isActive: newStatus });
          fetchScreens();
      } catch (error) { alert("❌ 操作失敗"); }
  };

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
          const emailUser = {
              email: targetOrder.userEmail,
              displayName: targetOrder.userName || 'Valued Client'
          };

          // 這裡假設你的 emailService.js 已經支援 'video_approved' 類型
          const emailSuccess = await sendBidConfirmation(
              emailUser, 
              targetOrder, 
              'video_approved' 
          );

          if (emailSuccess) {
              alert(`✅ 影片已批核，並成功發送 Email 給客戶！`);
          } else {
              alert(`⚠️ 影片已批核，但 Email 發送失敗 (請檢查 Console)`);
          }
      } else {
          alert(`✅ 已拒絕此影片`);
      }

      fetchOrders(); 
    } catch (error) { 
        console.error(error);
        alert("❌ 系統錯誤"); 
    }
  };

  const filteredOrders = orders.filter(order => {
      if (activeTab === 'review') return order.status === 'won' && order.hasVideo;
      if (activeTab === 'bidding') return order.status === 'paid_pending_selection';
      return true; 
  });

  const filteredMarketStats = useMemo(() => {
      return marketData
        .filter(d => d.screenId == selectedScreenId)
        .sort((a, b) => {
            if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
            return a.hour - b.hour;
        });
  }, [marketData, selectedScreenId]);

  const uniqueScreens = useMemo(() => {
      const ids = new Set(marketData.map(d => d.screenId));
      return Array.from(ids).sort((a,b) => a - b);
  }, [marketData]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center">Access Denied</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="bg-slate-800 text-white px-2 py-1 rounded text-sm">ADMIN</span> 
            DOOH 管理後台
          </h1>
          <p className="text-slate-500 text-sm">{user.email}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAllData} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200" title="刷新"><RefreshCw size={20}/></button>
          <button onClick={() => signOut(auth)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100" title="登出"><LogOut size={20}/></button>
        </div>
      </header>
     {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
          <div className="flex justify-between items-center">
            <div><p className="text-slate-500 text-sm font-bold uppercase">總營業額</p><h2 className="text-3xl font-bold text-slate-800">HK$ {stats.revenue.toLocaleString()}</h2></div>
            <div className="bg-blue-100 p-3 rounded-full text-blue-600"><DollarSign size={24}/></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-orange-500">
          <div className="flex justify-between items-center">
            <div><p className="text-slate-500 text-sm font-bold uppercase">待審核影片</p><h2 className="text-3xl font-bold text-orange-600">{stats.pendingReview}</h2></div>
            <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Video size={24}/></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
          <div className="flex justify-between items-center">
            <div><p className="text-slate-500 text-sm font-bold uppercase">生效中廣告</p><h2 className="text-3xl font-bold text-green-600">{stats.activeAds}</h2></div>
            <div className="bg-green-100 p-3 rounded-full text-green-600"><CheckCircle size={24}/></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setActiveTab('review')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'review' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-200'}`}>
              <Video size={16}/> 待審核 ({stats.pendingReview})
          </button>
          <button onClick={() => setActiveTab('bidding')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'bidding' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-200'}`}>
              <Gavel size={16}/> 競價中
          </button>
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-200'}`}>
              <LayoutList size={16}/> 全部訂單
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'analytics' ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-200'}`}>
              <BarChart3 size={16}/> 數據分析
          </button>
          <button onClick={() => setActiveTab('screens')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'screens' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-200'}`}>
              <Monitor size={16}/> 屏幕管理
          </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {/* Screen Management */}
        {activeTab === 'screens' ? (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                        <tr>
                            <th className="p-4 w-16">ID</th>
                            <th className="p-4">屏幕名稱 & 地點</th>
                            <th className="p-4">狀態 (接單中?)</th>
                            <th className="p-4 w-40">底價 (HKD)</th>
                            <th className="p-4 w-24 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {screens.map(screen => {
                            const isEditing = editingScreens[screen.firestoreId];
                            const currentPrice = isEditing?.basePrice !== undefined ? isEditing.basePrice : screen.basePrice;

                            return (
                                <tr key={screen.firestoreId} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono font-bold text-slate-500">#{screen.id}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{screen.name || '未命名'}</div>
                                        <div className="text-xs text-slate-500">{screen.location}</div>
                                    </td>
                                    <td className="p-4">
                                        <button 
                                            onClick={() => toggleScreenActive(screen)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${screen.isActive !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                        >
                                            <Power size={12}/>
                                            {screen.isActive !== false ? '🟢 上架中 (Active)' : '🔴 已下架 (Inactive)'}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">$</span>
                                            <input 
                                                type="number" 
                                                value={currentPrice}
                                                onChange={(e) => handleScreenChange(screen.firestoreId, 'basePrice', e.target.value)}
                                                className="w-24 border border-slate-300 rounded px-2 py-1 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        {isEditing ? (
                                            <button 
                                                onClick={() => saveScreen(screen)}
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1 ml-auto shadow-sm animate-pulse"
                                            >
                                                <Save size={14}/> 儲存
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-400">---</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        ) : activeTab === 'analytics' ? (
            /* Analytics View */
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2"><TrendingUp size={20}/> 市場參考價監控</h3>
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-500 px-2">選擇屏幕:</span>
                        {uniqueScreens.map(id => (
                            <button 
                                key={id} 
                                onClick={() => setSelectedScreenId(id)}
                                className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${selectedScreenId == id ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                            >
                                Screen {id}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                <th className="p-3 text-left w-24">星期</th>
                                <th className="p-3 text-left">時段</th>
                                <th className="p-3 text-right">平均成交價</th>
                                <th className="p-3 text-right">歷史熱度 (總出價次數)</th>
                                <th className="p-3 text-right">狀態</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMarketStats.map((stat, index) => {
                                const isPrime = stat.hour >= 18 && stat.hour < 23;
                                return (
                                    <tr key={index} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold text-slate-600">
                                            {index % 24 === 0 && <span className="bg-slate-200 px-2 py-1 rounded text-xs">週{WEEKDAYS[stat.dayOfWeek]}</span>}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{String(stat.hour).padStart(2,'0')}:00</span>
                                                {isPrime && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">Prime</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className={`font-bold ${isPrime ? 'text-red-600' : 'text-slate-700'}`}>HK$ {stat.averagePrice}</span>
                                        </td>
                                        <td className="p-3 text-right text-slate-500">
                                            {stat.totalBids} 次
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 max-w-[100px] ml-auto">
                                                <div 
                                                    className={`h-1.5 rounded-full ${isPrime ? 'bg-red-400' : 'bg-blue-400'}`} 
                                                    style={{ width: `${Math.min((stat.averagePrice / 2000) * 100, 100)}%` }} 
                                                ></div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
            /* Orders Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-4">訂單 ID / 客戶</th>
                    <th className="p-4">狀態</th>
                    <th className="p-4">詳情 (金額/時段)</th>
                    <th className="p-4">影片狀態</th>
                    <th className="p-4">預覽</th>
                    <th className="p-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-400">沒有符合條件的訂單</td></tr>
                  ) : filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">#{order.id.slice(0,6)}</span>
                        <div className="font-bold mt-1">{order.userName}</div>
                        <div className="text-xs text-slate-400">{order.userEmail}</div>
                      </td>
                      <td className="p-4">
                          {order.status === 'won' ? <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded text-xs">🎉 已中標</span> :
                           order.status === 'paid_pending_selection' ? <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded text-xs">⏳ 競價中</span> :
                           order.status === 'lost' ? <span className="text-red-400 font-bold bg-red-50 px-2 py-1 rounded text-xs">❌ 落選</span> :
                           <span className="text-slate-400 text-xs">{order.status}</span>}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-700">HK$ {order.amount}</div>
                        <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">{order.timeSlotSummary}</div>
                      </td>
                      <td className="p-4">
                        {!order.hasVideo ? <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs font-bold">未上傳</span> : 
                         order.isApproved ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1"><CheckCircle size={12}/> 已通過</span> : 
                         order.isRejected ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1"><XCircle size={12}/> 已拒絕</span> : 
                         <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1 animate-pulse"><AlertTriangle size={12}/> 待審核</span>}
                      </td>
                      <td className="p-4">
                        {order.hasVideo && <a href={order.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-bold"><Play size={14}/> 播放影片</a>}
                      </td>
                      <td className="p-4 text-right">
                        {order.status === 'won' && order.hasVideo && !order.isApproved && !order.isRejected && (
                          <div className="flex flex-col gap-2 items-end">
                            <button onClick={() => handleReview(order.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm">通過 (Send Email)</button>
                            <div className="flex gap-1">
                              <input type="text" placeholder="原因..." className="border border-slate-300 rounded px-2 py-1 text-xs w-24" onChange={(e) => setReviewNote(e.target.value)}/>
                              <button onClick={() => handleReview(order.id, 'reject')} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded text-xs font-bold transition-colors">拒絕</button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;