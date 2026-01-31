import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc, deleteDoc, addDoc
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Search, Video, Monitor, Save, Trash2, 
  LayoutDashboard, List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X, CheckSquare, Filter,
  ChevronLeft, ChevronRight, CheckCircle, UploadCloud, FileText, PlayCircle
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { sendBidConfirmation } from '../utils/emailService';

const ADMIN_EMAILS = ["hauyeeee@gmail.com", "info@doohadv.com"]; // Added info@doohadv.com based on your request
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
  const [dailyNotes, setDailyNotes] = useState({}); // 🔥 NEW: Store daily notes
  
  // --- Config State ---
  const [globalPricingConfig, setGlobalPricingConfig] = useState({
      baseImpressions: 10000, primeMultiplier: 3.5, goldMultiplier: 1.8,
      weekendMultiplier: 1.5, bundleMultiplier: 1.25, urgentFee24h: 1.5, urgentFee1h: 2.0
  });
  const [activeConfig, setActiveConfig] = useState({}); 
  const [selectedConfigTarget, setSelectedConfigTarget] = useState('global');
  
  // --- UI States ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  // --- Calendar States (NEW) ---
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState('sales'); // 'sales' or 'ops'
  const [selectedDayDetail, setSelectedDayDetail] = useState(null); // Selected date string 'YYYY-MM-DD'
  
  // --- Advanced Filter States ---
  const [selectedStatScreens, setSelectedStatScreens] = useState(new Set()); 
  const [selectedAnalyticsHours, setSelectedAnalyticsHours] = useState(new Set()); 
  
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [editingScreens, setEditingScreens] = useState({});

  // --- Forms ---
  const [newRule, setNewRule] = useState({
      screenId: 'all', date: '', hoursStr: '', action: 'price_override', overridePrice: '', note: ''
  });

  // 1. Auth & Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email)) {
        // Allow access but maybe read-only or redirect? For now just load.
        // Assuming user logic is handled outside or strict redirect:
        if (!currentUser) setLoading(false); 
        else { setUser(currentUser); fetchAllData(); }
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
      // Special Rules
      const unsubRules = onSnapshot(collection(db, "special_rules"), (snap) => {
          setSpecialRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      // Daily Notes (NEW Collection for Ops Calendar)
      const unsubNotes = onSnapshot(collection(db, "daily_notes"), (snap) => {
          const notesMap = {};
          snap.docs.forEach(d => { notesMap[d.id] = d.data().content; });
          setDailyNotes(notesMap);
      });
      // Config
      getDoc(doc(db, "system_config", "pricing_rules")).then(docSnap => { 
          if (docSnap.exists()) { const data = docSnap.data(); setGlobalPricingConfig(data); setActiveConfig(data); }
      });

      return () => { unsubOrders(); unsubScreens(); unsubRules(); unsubNotes(); };
  };

  // --- 🧠 Logic ---
  const customerHistory = useMemo(() => { const h={}; orders.forEach(o=>{h[o.userEmail]=(h[o.userEmail]||0)+1}); return h; }, [orders]);

  const stats = useMemo(() => {
    let rev=0, valid=0, pending=0, daily={}, status={};
    orders.forEach(o => {
        status[o.status||'unknown']=(status[o.status]||0)+1;
        if(o.status==='won'&&o.hasVideo&&!o.isApproved&&!o.isRejected) pending++;
        if(['paid','won','completed','paid_pending_selection'].includes(o.status)) {
            rev+=(Number(o.amount)||0); valid++;
            const d=o.createdAtDate.toISOString().split('T')[0]; daily[d]=(daily[d]||0)+Number(o.amount);
        }
    });
    return { totalRevenue: rev, totalOrders: orders.length, validOrders: valid, pendingReview: pending, dailyChartData: Object.keys(daily).sort().map(d=>({date:d.substring(5),amount:daily[d]})), statusChartData: Object.keys(status).map(k=>({name:k,value:status[k]})) };
  }, [orders]);

  // --- 📅 Calendar Logic (Events Mapping) ---
  const eventsByDate = useMemo(() => {
      const map = {};
      
      orders.forEach(order => {
          // 只顯示有效訂單
          if (['paid', 'won', 'completed', 'paid_pending_selection'].includes(order.status) && order.detailedSlots) {
              order.detailedSlots.forEach(slot => {
                  const dateStr = slot.date; // YYYY-MM-DD
                  if (!map[dateStr]) map[dateStr] = [];
                  
                  map[dateStr].push({
                      id: order.id,
                      screenName: slot.screenName,
                      hour: slot.hour,
                      type: order.type, // 'bid' or 'buyout'
                      amount: order.amount, // Total amount
                      bidPrice: slot.bidPrice, // Slot specific price
                      userEmail: order.userEmail,
                      videoName: order.videoName,
                      hasVideo: order.hasVideo,
                      isApproved: order.isApproved,
                      isExternalUploaded: order.isExternalUploaded || false, // 🔥 NEW field
                      status: order.status
                  });
              });
          }
      });
      return map;
  }, [orders]);

  const calendarDays = useMemo(() => {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const days = [];
      for(let i=0; i<firstDay; i++) days.push(null);
      for(let d=1; d<=daysInMonth; d++) days.push(new Date(year, month, d));
      return days;
  }, [calendarDate]);

  // --- 📈 Real-time Market Stats ---
  const realMarketStats = useMemo(() => {
      const statsMap = {}; 
      for(let d=0; d<7; d++) for(let h=0; h<24; h++) statsMap[`${d}-${h}`] = { dayOfWeek: d, hour: h, totalAmount: 0, totalBids: 0 };
      
      orders.forEach(order => {
          if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) {
              order.detailedSlots.forEach(slot => {
                  const isScreenSelected = selectedStatScreens.size === 0 || selectedStatScreens.has(String(slot.screenId));
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

      let selectionTotalAmount = 0;
      let selectionTotalBids = 0;
      const rows = Object.values(statsMap).map(item => {
          if (item.totalBids > 0) {
              const isHourVisible = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(item.hour);
              if (isHourVisible) {
                  selectionTotalAmount += item.totalAmount;
                  selectionTotalBids += item.totalBids;
              }
          }
          return { ...item, averagePrice: item.totalBids > 0 ? Math.round(item.totalAmount / item.totalBids) : 0 };
      });

      const displayRows = selectedAnalyticsHours.size > 0 ? rows.filter(r => selectedAnalyticsHours.has(r.hour)) : rows;
      return { rows: displayRows, summary: { avgPrice: selectionTotalBids > 0 ? Math.round(selectionTotalAmount / selectionTotalBids) : 0, totalBids: selectionTotalBids } };
  }, [orders, selectedStatScreens, selectedAnalyticsHours]);

  // --- Actions ---
  const toggleAnalyticsHour = (h) => { const n = new Set(selectedAnalyticsHours); if (n.has(h)) n.delete(h); else n.add(h); setSelectedAnalyticsHours(n); };
  const handleSelectOrder = (id) => { const n=new Set(selectedOrderIds); if(n.has(id))n.delete(id); else n.add(id); setSelectedOrderIds(n); };
  const handleSelectAll = (e) => { setSelectedOrderIds(e.target.checked ? new Set(filteredOrders.map(o=>o.id)) : new Set()); };
  
  const handleBulkAction = async (action) => {
      if (!window.confirm(`確認執行?`)) return;
      const batch = writeBatch(db);
      selectedOrderIds.forEach(id => { if(action==='cancel') batch.update(doc(db,"orders",id),{status:'cancelled',cancelledAt:new Date(),cancelledBy:user.email}); });
      await batch.commit(); alert("完成"); setSelectedOrderIds(new Set());
  };

  const handleAddRule = async () => {
      if(!newRule.date) return alert("請選日期");
      let hours=[]; const str=newRule.hoursStr.trim();
      if(!str||str==='all') hours=Array.from({length:24},(_,i)=>i);
      else { if(str.includes('-')){const [s,e]=str.split('-').map(n=>parseInt(n));for(let i=s;i<=e;i++)if(i>=0&&i<24)hours.push(i);} else hours=str.split(',').map(n=>parseInt(n)).filter(n=>!isNaN(n)); }
      if(hours.length===0) return alert("時段錯誤");
      
      const safeDate = newRule.date; // Use string from input directly
      await addDoc(collection(db,"special_rules"), { screenId:newRule.screenId, date:safeDate, hours, type:newRule.action, value:newRule.action==='price_override'?parseFloat(newRule.overridePrice):null, note:newRule.note, createdAt:new Date() });
      alert("規則已建立");
  };
  
  const handleDeleteRule = async (id) => { if(window.confirm("刪除?")) await deleteDoc(doc(db,"special_rules",id)); };
  
  const handleReview = async (id,action) => {
      const o=orders.find(x=>x.id===id); if(!o||!window.confirm(action))return;
      await updateDoc(doc(db,"orders",id), {isApproved:action==='approve',isRejected:action==='reject',reviewedAt:new Date(),reviewNote:action==='reject'?reviewNote:''});
      if(action==='approve') sendBidConfirmation({email:o.userEmail,displayName:o.userName},o,'video_approved');
      alert("已處理");
  };

  const saveScreen = async (s) => { const c=editingScreens[s.firestoreId]; if(!c)return; const d={...c}; if(d.basePrice)d.basePrice=parseInt(d.basePrice); if(d.lockedHoursStr){d.lockedHours=d.lockedHoursStr.split(',').map(n=>parseInt(n)); delete d.lockedHoursStr;} await updateDoc(doc(db,"screens",s.firestoreId),d); setEditingScreens(p=>{const n={...p};delete n[s.firestoreId];return n;}); alert("已更新"); };
  const toggleScreenActive = async (s) => { if(window.confirm("切換狀態?")) await updateDoc(doc(db,"screens",s.firestoreId),{isActive:!s.isActive}); };
  
  const savePricingConfig = async () => {
      if(selectedConfigTarget==='global') { await setDoc(doc(db,"system_config","pricing_rules"), activeConfig); setGlobalPricingConfig(activeConfig); }
      else { const s=screens.find(x=>String(x.id)===selectedConfigTarget); if(s) await updateDoc(doc(db,"screens",s.firestoreId),{customPricing:activeConfig}); }
      alert("已儲存");
  };

  const handleConfigChange = (k,v) => setActiveConfig(p=>({...p,[k]:v}));
  useEffect(() => {
      if(selectedConfigTarget==='global') setActiveConfig(globalPricingConfig);
      else { const s=screens.find(x=>String(x.id)===selectedConfigTarget); setActiveConfig(s?.customPricing||globalPricingConfig); }
  }, [selectedConfigTarget, globalPricingConfig, screens]);

  // 🔥 NEW: Calendar Ops Functions
  const toggleExternalUpload = async (orderId, currentState) => {
      if(!window.confirm(`確認將此訂單影片標記為 ${!currentState ? '已上架 (Done)' : '未上架'} ?`)) return;
      await updateDoc(doc(db, "orders", orderId), { isExternalUploaded: !currentState });
  };

  const handleSaveDailyNote = async (dateStr, note) => {
      await setDoc(doc(db, "daily_notes", dateStr), { content: note, updatedAt: new Date() });
  };

  const filteredOrders = orders.filter(o => (statusFilter==='all'||o.status===statusFilter) && (o.id.includes(searchTerm)||o.userEmail.includes(searchTerm)) && (activeTab!=='review' || (o.status==='won'&&o.hasVideo&&!o.isApproved&&!o.isRejected)));

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex items-center gap-2"><span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH V5.0 Ultimate</h1>
            <div className="flex gap-2">
                <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded">返回首頁</button>
                <button onClick={() => signOut(auth)} className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded">登出</button>
            </div>
        </div>

        <div className="flex flex-wrap gap-2">
            {[
                {id:'dashboard',icon:<LayoutDashboard size={16}/>,label:'儀表板'},
                {id:'calendar',icon:<Calendar size={16}/>,label:'排程日曆 (New)'}, // 🔥 Added Calendar Tab
                {id:'orders',icon:<List size={16}/>,label:'訂單管理'},
                {id:'review',icon:<Video size={16}/>,label:`審核 (${stats.pendingReview})`, alert:stats.pendingReview>0},
                {id:'rules',icon:<Calendar size={16}/>,label:'特別規則'},
                {id:'screens',icon:<Monitor size={16}/>,label:'屏幕管理'},
                {id:'analytics',icon:<TrendingUp size={16}/>,label:'市場數據'},
                {id:'config',icon:<Settings size={16}/>,label:'價格公式'},
            ].map(t => <button key={t.id} onClick={()=>{setActiveTab(t.id);setSelectedOrderIds(new Set())}} className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 ${activeTab===t.id?'bg-blue-600 text-white shadow-md':'bg-white text-slate-500 border hover:bg-slate-50'}`}>{t.icon} {t.label} {t.alert&&<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}</button>)}
        </div>

        {/* 🔥 CALENDAR VIEW */}
        {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
                {/* Left: Month View */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Calendar size={20} className="text-blue-600"/> 
                                {calendarDate.getFullYear()}年 {calendarDate.getMonth()+1}月
                            </h2>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button onClick={()=>setCalendarViewMode('sales')} className={`px-3 py-1.5 text-xs font-bold rounded ${calendarViewMode==='sales'?'bg-white shadow text-blue-600':'text-slate-500'}`}>💰 銷售</button>
                                <button onClick={()=>setCalendarViewMode('ops')} className={`px-3 py-1.5 text-xs font-bold rounded ${calendarViewMode==='ops'?'bg-white shadow text-purple-600':'text-slate-500'}`}>▶️ 營運</button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={()=>setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth()-1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
                            <button onClick={()=>setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth()+1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 text-center font-bold text-slate-400 mb-2">
                        {WEEKDAYS.map(d => <div key={d} className="py-2">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {calendarDays.map((d, i) => {
                            if (!d) return <div key={i} className="h-24 bg-slate-50/50 rounded-lg"></div>;
                            const dateStr = d.toISOString().split('T')[0];
                            const dayEvents = eventsByDate[dateStr] || [];
                            const isSelected = selectedDayDetail === dateStr;
                            
                            // Stats for Sales Mode
                            const totalRev = dayEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
                            const hasPending = dayEvents.some(e => !e.isApproved);
                            
                            // Stats for Ops Mode
                            const totalTasks = dayEvents.length;
                            const doneTasks = dayEvents.filter(e => e.isExternalUploaded).length;
                            
                            return (
                                <div 
                                    key={dateStr} 
                                    onClick={() => setSelectedDayDetail(dateStr)}
                                    className={`h-28 rounded-lg p-2 border cursor-pointer transition-all hover:shadow-md flex flex-col justify-between ${isSelected ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-100 bg-white'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-bold ${d.toDateString()===new Date().toDateString()?'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center':''}`}>{d.getDate()}</span>
                                        {calendarViewMode === 'ops' && dailyNotes[dateStr] && <FileText size={12} className="text-orange-400"/>}
                                    </div>
                                    
                                    <div className="space-y-1">
                                        {calendarViewMode === 'sales' ? (
                                            <>
                                                {dayEvents.length > 0 && (
                                                    <div className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-center">
                                                        ${totalRev.toLocaleString()}
                                                    </div>
                                                )}
                                                {hasPending && <div className="text-[10px] text-orange-500 font-bold text-center">⚠ 待審</div>}
                                            </>
                                        ) : (
                                            <>
                                                {totalTasks > 0 && (
                                                    <div className="flex justify-center gap-1">
                                                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded">{doneTasks}</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">/ {totalTasks}</span>
                                                    </div>
                                                )}
                                                {totalTasks > 0 && doneTasks === totalTasks && <CheckCircle size={14} className="mx-auto text-green-500"/>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Detail View */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
                    {selectedDayDetail ? (
                        <>
                            <div className="border-b pb-4 mb-4">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    {selectedDayDetail} 明細
                                    {calendarViewMode === 'sales' ? <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">銷售視角</span> : <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">營運視角</span>}
                                </h3>
                                {/* Daily Note Input */}
                                <div className="mt-3">
                                    <label className="text-xs font-bold text-slate-400">當日備註 (Note):</label>
                                    <input 
                                        type="text" 
                                        placeholder="例如: 14:00 屏幕維修..." 
                                        className="w-full border rounded px-2 py-1.5 text-sm mt-1 bg-yellow-50 focus:bg-white transition-colors"
                                        value={dailyNotes[selectedDayDetail] || ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setDailyNotes(p => ({...p, [selectedDayDetail]: v}));
                                        }}
                                        onBlur={(e) => handleSaveDailyNote(selectedDayDetail, e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                {(eventsByDate[selectedDayDetail] || []).length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-sm">今日無排程</div>
                                ) : (
                                    (eventsByDate[selectedDayDetail] || []).sort((a,b)=>a.hour-b.hour).map((evt, idx) => (
                                        <div key={idx} className={`p-3 rounded-lg border text-sm ${evt.type==='buyout'?'bg-emerald-50 border-emerald-100':'bg-blue-50 border-blue-100'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono font-bold text-slate-700">{String(evt.hour).padStart(2,'0')}:00</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${evt.type==='buyout'?'bg-white text-emerald-600 border-emerald-200':'bg-white text-blue-600 border-blue-200'}`}>
                                                    {evt.type === 'buyout' ? '買斷' : '競價'}
                                                </span>
                                            </div>
                                            
                                            {calendarViewMode === 'sales' ? (
                                                // Sales View Details
                                                <div className="space-y-1">
                                                    <div className="font-bold">HK$ {evt.bidPrice || evt.amount}</div>
                                                    <div className="text-xs text-slate-500 truncate">{evt.userEmail}</div>
                                                    <div className="flex gap-2 mt-2">
                                                        {evt.hasVideo ? <span className="text-green-600 text-[10px] flex items-center gap-1"><CheckCircle size={10}/> 片已傳</span> : <span className="text-red-400 text-[10px]">未傳片</span>}
                                                        {evt.isApproved ? <span className="text-green-600 text-[10px] flex items-center gap-1"><CheckCircle size={10}/> 已批</span> : <span className="text-orange-400 text-[10px]">待批核</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                // Ops View Details
                                                <div className="space-y-2">
                                                    <div className="text-xs text-slate-500">影片素材:</div>
                                                    <a href="#" className="block font-bold text-blue-600 underline truncate">{evt.videoName || 'No Video'}</a>
                                                    
                                                    <button 
                                                        onClick={() => toggleExternalUpload(evt.id, evt.isExternalUploaded)}
                                                        className={`w-full py-2 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all ${evt.isExternalUploaded ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white border border-slate-300 text-slate-500 hover:bg-slate-50'}`}
                                                    >
                                                        {evt.isExternalUploaded ? <><CheckCircle size={14}/> 已上架 (Done)</> : <><UploadCloud size={14}/> 標記為已上架</>}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Calendar size={48} className="mb-4 opacity-20"/>
                            <p>請點擊左側日期查看詳情</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Reuse other views */}
        {activeTab === 'dashboard' && <DashboardView stats={stats} />}
        {activeTab === 'orders' && <OrdersView orders={filteredOrders} customerHistory={customerHistory} handleBulkAction={handleBulkAction} selectedOrderIds={selectedOrderIds} handleSelectOrder={handleSelectOrder} handleSelectAll={handleSelectAll} searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
        {activeTab === 'review' && <ReviewView orders={filteredOrders} handleReview={handleReview} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
        {activeTab === 'rules' && <RulesView screens={screens} newRule={newRule} setNewRule={setNewRule} handleAddRule={handleAddRule} specialRules={specialRules} handleDeleteRule={handleDeleteRule}/>}
        {activeTab === 'screens' && <ScreensView screens={screens} editingScreens={editingScreens} setEditingScreens={setEditingScreens} saveScreen={saveScreen} toggleScreenActive={toggleScreenActive} />}
        {activeTab === 'config' && <ConfigView screens={screens} activeConfig={activeConfig} selectedConfigTarget={selectedConfigTarget} setSelectedConfigTarget={setSelectedConfigTarget} handleConfigChange={handleConfigChange} savePricingConfig={savePricingConfig}/>}
        
        {/* Analytics Tab (Updated) */}
        {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
                {/* Summary Card */}
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
                {/* Filters */}
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase w-16">Screens:</span>
                        <button onClick={() => setSelectedStatScreens(new Set())} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.size===0?'bg-slate-800 text-white':'bg-white text-slate-600'}`}>All</button>
                        {screens.map(s => <button key={s.id} onClick={() => {const n=new Set(selectedStatScreens); n.has(String(s.id))?n.delete(String(s.id)):n.add(String(s.id)); setSelectedStatScreens(n);}} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.has(String(s.id))?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600'}`}>{s.name}</button>)}
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase w-16">Hours:</span>
                        <button onClick={() => setSelectedAnalyticsHours(new Set())} className={`w-8 h-8 rounded text-xs font-bold border ${selectedAnalyticsHours.size===0?'bg-slate-800 text-white':'bg-white text-slate-600'}`}>All</button>
                        {Array.from({length:24},(_,i)=>i).map(h => (
                            <button key={h} onClick={() => toggleAnalyticsHour(h)} className={`w-8 h-8 rounded text-xs border font-bold transition-all ${selectedAnalyticsHours.has(h)?'bg-orange-500 text-white border-orange-500':'bg-white text-slate-600 hover:bg-slate-100'}`}>
                                {h}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Table */}
                <div className="overflow-x-auto h-[400px] border rounded-lg">
                    <table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0 z-10 text-slate-600 font-bold"><tr><th className="p-3 text-left">星期</th><th className="p-3 text-left">時段</th><th className="p-3 text-right">平均成交價</th><th className="p-3 text-right">出價次數</th><th className="p-3 text-left pl-6">建議</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {realMarketStats.rows.sort((a,b)=>(a.dayOfWeek-b.dayOfWeek)||(a.hour-b.hour)).map((m,i)=>(
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3 text-slate-600 font-medium">{WEEKDAYS[m.dayOfWeek]}</td><td className="p-3">{String(m.hour).padStart(2,'0')}:00</td><td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td><td className="p-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.totalBids>0?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-400'}`}>{m.totalBids}</span></td><td className="p-3 pl-6">{m.totalBids>3?<span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUp size={12}/> 加價</span>:m.totalBids===0?<span className="text-red-500 text-xs font-bold flex items-center gap-1"><ArrowDown size={12}/> 減價</span>:<span className="text-slate-300">-</span>}</td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

// --- Sub-Components ---
const DashboardView = ({stats}) => (<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in"><div className="bg-white p-5 rounded-xl border h-[300px]"><h3 className="font-bold mb-4">每日生意</h3><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb"/></LineChart></ResponsiveContainer></div><div className="bg-white p-5 rounded-xl border h-[300px]"><h3 className="font-bold mb-4">狀態</h3><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>);
const OrdersView = ({orders, customerHistory, handleBulkAction, selectedOrderIds, handleSelectOrder, handleSelectAll, searchTerm, setSearchTerm, statusFilter, setStatusFilter}) => (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in">
        <div className="p-4 border-b flex gap-4 bg-slate-50"><input type="text" placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border rounded px-2 py-1 text-sm"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="all">All</option><option value="paid">Paid</option><option value="won">Won</option></select>{selectedOrderIds.size>0&&<button onClick={()=>handleBulkAction('cancel')} className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded flex items-center gap-1"><Trash2 size={14}/> 批量取消 ({selectedOrderIds.size})</button>}</div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 font-bold text-slate-500"><tr><th className="p-4 w-10 text-center"><input type="checkbox" onChange={handleSelectAll}/></th><th className="p-4">時間</th><th className="p-4">ID / 客戶</th><th className="p-4 text-right">金額</th><th className="p-4 text-center">狀態</th><th className="p-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map(o=><tr key={o.id} className="hover:bg-slate-50"><td className="p-4 text-center"><input type="checkbox" checked={selectedOrderIds.has(o.id)} onChange={()=>handleSelectOrder(o.id)}/></td><td className="p-4 text-slate-500">{o.createdAtDate.toLocaleString('zh-HK')}</td><td className="p-4"><div className="font-bold text-xs">{o.id.slice(0,8)}</div><div className="text-xs">{o.userEmail} {customerHistory[o.userEmail]>1&&<span className="text-yellow-600 font-bold">VIP</span>}</div></td><td className="p-4 text-right font-bold">${o.amount}</td><td className="p-4 text-center"><StatusBadge status={o.status} /></td><td className="p-4 text-right">{o.status!=='cancelled'&&<button onClick={()=>handleSelectOrder(o.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs">選擇</button>}</td></tr>)}</tbody></table></div>
    </div>
);
const ReviewView = ({orders, handleReview, reviewNote, setReviewNote}) => (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">{orders.map(o=><div key={o.id} className="bg-white p-4 rounded-xl border border-orange-200"><div className="font-bold text-sm mb-2">{o.userEmail}</div><a href={o.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm mb-4 block truncate">{o.videoName||'Video'}</a><div className="flex gap-2"><button onClick={()=>handleReview(o.id,'approve')} className="flex-1 bg-green-600 text-white py-2 rounded text-xs font-bold">通過</button><input type="text" placeholder="原因" className="border rounded px-2 text-xs w-24" onChange={e=>setReviewNote(e.target.value)}/><button onClick={()=>handleReview(o.id,'reject')} className="bg-red-50 text-red-600 px-3 rounded text-xs font-bold">拒絕</button></div></div>)}</div>);
const RulesView = ({screens, newRule, setNewRule, handleAddRule, specialRules, handleDeleteRule}) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in"><div className="bg-white p-6 rounded-xl border h-fit"><h3 className="font-bold mb-4">新增規則</h3><div className="space-y-3"><select value={newRule.screenId} onChange={e=>setNewRule({...newRule,screenId:e.target.value})} className="w-full border rounded px-3 py-2 text-sm"><option value="all">Global</option>{screens.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input type="date" value={newRule.date} onChange={e=>setNewRule({...newRule,date:e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/><input type="text" placeholder="0-23" value={newRule.hoursStr} onChange={e=>setNewRule({...newRule,hoursStr:e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-2">{['price_override','lock','disable_buyout'].map(t=><button key={t} onClick={()=>setNewRule({...newRule,action:t})} className={`py-2 text-xs border rounded ${newRule.action===t?'bg-blue-50 border-blue-500':''}`}>{t}</button>)}</div>{newRule.action==='price_override'&&<input type="number" placeholder="$" value={newRule.overridePrice} onChange={e=>setNewRule({...newRule,overridePrice:e.target.value})} className="w-full border rounded px-3 py-2"/>}<input type="text" placeholder="備註" value={newRule.note} onChange={e=>setNewRule({...newRule,note:e.target.value})} className="w-full border rounded px-3 py-2"/><button onClick={handleAddRule} className="w-full bg-slate-900 text-white py-2 rounded font-bold">建立</button></div></div><div className="lg:col-span-2 space-y-3">{specialRules.sort((a,b)=>b.date.localeCompare(a.date)).map(r=><div key={r.id} className="bg-white p-4 rounded-xl border flex justify-between"><div><span className="bg-slate-100 px-2 rounded text-xs font-bold mr-2">{r.date}</span><span className="text-sm font-bold">{r.screenId==='all'?'Global':r.screenId}</span><div className="text-xs text-slate-500">{r.type} @ {r.hours.join(',')}h</div></div><button onClick={()=>handleDeleteRule(r.id)}><Trash2 size={16} className="text-slate-400"/></button></div>)}</div></div>
);
const ScreensView = ({screens, editingScreens, setEditingScreens, saveScreen, toggleScreenActive}) => (<div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-100 font-bold"><tr><th className="p-4">ID</th><th className="p-4">資料</th><th className="p-4">鎖定</th><th className="p-4">底價</th><th className="p-4">操作</th></tr></thead><tbody>{screens.map(s=><tr key={s.firestoreId} className="hover:bg-slate-50"><td className="p-4">#{s.id}</td><td className="p-4 font-bold">{s.name}</td><td className="p-4"><button onClick={()=>toggleScreenActive(s)} className={`px-2 py-1 rounded text-xs font-bold ${s.isActive!==false?'bg-green-100':'bg-red-100'}`}>{s.isActive!==false?'Active':'Locked'}</button></td><td className="p-4"><input type="number" value={editingScreens[s.firestoreId]?.basePrice??s.basePrice} onChange={e=>setEditingScreens({...editingScreens,[s.firestoreId]:{...editingScreens[s.firestoreId],basePrice:e.target.value}})} className="border w-16 px-1"/></td><td className="p-4"><button onClick={()=>saveScreen(s)} className="text-blue-600 font-bold text-xs">Save</button></td></tr>)}</tbody></table></div>);
const ConfigView = ({screens, activeConfig, selectedConfigTarget, setSelectedConfigTarget, handleConfigChange, savePricingConfig}) => (<div className="bg-white p-6 rounded-xl border max-w-2xl mx-auto"><div className="flex justify-between mb-4"><h3 className="font-bold">價格公式</h3><select value={selectedConfigTarget} onChange={e=>setSelectedConfigTarget(e.target.value)} className="border rounded px-2"><option value="global">Global</option>{screens.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></div><div className="grid grid-cols-2 gap-4">{Object.keys(activeConfig).map(k=><ConfigInput key={k} label={k} val={activeConfig[k]} onChange={v=>handleConfigChange(k,v)} desc=""/>)}</div><button onClick={savePricingConfig} className="w-full bg-slate-900 text-white py-2 rounded mt-6 font-bold">Save</button></div>);

const ConfigInput = ({ label, val, onChange, desc }) => {
    const percentage = val ? Math.round((parseFloat(val) - 1) * 100) : 0;
    const sign = percentage > 0 ? '+' : '';
    return (
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-1">
            <div className="text-xs font-bold text-slate-600">{label}</div>
            <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${percentage > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>{sign}{percentage}%</span>
                <input type="number" step="0.05" value={val||0} onChange={e=>onChange(e.target.value)} className="w-16 border rounded px-2 py-1 text-sm font-bold text-right outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
        </div>
    );
};
const StatCard = ({ title, value, icon, bg, border }) => (<div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}><div><p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p><p className="text-xl font-bold text-slate-800">{value}</p></div><div className="bg-white p-2 rounded-full shadow-sm">{icon}</div></div>);
const StatusBadge = ({ status }) => { const map = { paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' }, won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' }, paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' }, cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' } }; const s = map[status] || { label: status, cls: 'bg-gray-100' }; return <span className={`text-[10px] px-2 py-1 rounded border font-bold ${s.cls}`}>{s.label}</span>; };

export default AdminPanel;