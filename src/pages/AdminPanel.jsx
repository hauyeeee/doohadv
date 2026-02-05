import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc, deleteDoc, addDoc, serverTimestamp, where 
} from "firebase/firestore";
import { 
  LayoutDashboard, List, Settings, Video, Monitor, TrendingUp, Calendar, Gavel, Flag 
} from 'lucide-react';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { sendBidConfirmation, sendBidLostEmail } from '../utils/emailService';

// 🔥 引入拆分後的組件
import { LoadingScreen, ScreenModal, SlotGroupModal } from '../components/AdminUI';
import { 
  DashboardView, OrdersView, ReviewView, AnalyticsView, ConfigView, CalendarView, RulesView, ScreensView 
} from '../components/AdminTabs';

const ADMIN_EMAILS = ["hauyeeee@gmail.com"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const EMPTY_DAY_RULE = { prime: [], gold: [] };
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- Data ---
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [specialRules, setSpecialRules] = useState([]);
  
  // --- Config ---
  const [globalPricingConfig, setGlobalPricingConfig] = useState({});
  const [activeConfig, setActiveConfig] = useState({}); 
  const [selectedConfigTarget, setSelectedConfigTarget] = useState('global'); 
  const [localBundleRules, setLocalBundleRules] = useState([]); 

  // --- UI ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  const [selectedStatScreens, setSelectedStatScreens] = useState(new Set()); 
  const [selectedAnalyticsHours, setSelectedAnalyticsHours] = useState(new Set()); 
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());        
  const [editingScreens, setEditingScreens] = useState({});
  
  // --- Modals State ---
  const [isAddScreenModalOpen, setIsAddScreenModalOpen] = useState(false);
  const [editingScreenId, setEditingScreenId] = useState(null);
  const [activeDayTab, setActiveDayTab] = useState(1);
  const [selectedSlotGroup, setSelectedSlotGroup] = useState(null); 
  
  const [newScreenData, setNewScreenData] = useState({
    name: '', location: '', district: '', basePrice: 50, images: ['', '', ''], specifications: '', mapUrl: '', bundleGroup: '',
    footfall: '', audience: '', operatingHours: '', resolution: '',
    tierRules: { 0: {...EMPTY_DAY_RULE}, 1: {...EMPTY_DAY_RULE}, 2: {...EMPTY_DAY_RULE}, 3: {...EMPTY_DAY_RULE}, 4: {...EMPTY_DAY_RULE}, 5: {...EMPTY_DAY_RULE}, 6: {...EMPTY_DAY_RULE} }
  });

  const [calendarDate, setCalendarDate] = useState(new Date()); 
  const [calendarViewMode, setCalendarViewMode] = useState('month'); 
  const [newRule, setNewRule] = useState({ screenId: 'all', date: '', hoursStr: '', action: 'price_override', overridePrice: '', note: '' });

  // 1. Auth & Data Fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) { navigate("/"); return; }
      if (!ADMIN_EMAILS.includes(currentUser.email)) { alert("⛔ 權限不足"); signOut(auth); navigate("/"); return; }
      setUser(currentUser);
      fetchAllData();
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllData = () => {
      setLoading(true);
      const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAtDate: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date() })));
        setLoading(false);
      });
      const unsubScreens = onSnapshot(query(collection(db, "screens"), orderBy("id")), (snap) => {
          const sorted = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a,b) => Number(a.id) - Number(b.id));
          setScreens(sorted);
      });
      const unsubRules = onSnapshot(collection(db, "special_rules"), (snap) => { setSpecialRules(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
      getDoc(doc(db, "system_config", "pricing_rules")).then(docSnap => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setGlobalPricingConfig(data);
              setActiveConfig(data);
              if (data.bundleRules) setLocalBundleRules(data.bundleRules.map(r => ({ screensStr: r.screens.join(','), multiplier: r.multiplier })));
          }
      });
      return () => { unsubOrders(); unsubScreens(); unsubRules(); };
  };

  // --- Logic Helpers ---
  const customerHistory = useMemo(() => { const h = {}; orders.forEach(o => { if(!h[o.userEmail]) h[o.userEmail]=0; h[o.userEmail]++; }); return h; }, [orders]);
  
  const stats = useMemo(() => {
    let totalRevenue = 0, validOrders = 0, pendingReview = 0, dailyRevenue = {}, statusCount = {};
    orders.forEach(order => {
        statusCount[order.status || 'unknown'] = (statusCount[order.status || 'unknown'] || 0) + 1;
        const needsReview = order.creativeStatus === 'pending_review' || (order.hasVideo && !order.creativeStatus && !order.isApproved && !order.isRejected && order.status !== 'cancelled');
        if (needsReview) pendingReview++;
        if (['paid', 'won', 'completed', 'paid_pending_selection', 'partially_outbid', 'partially_won'].includes(order.status)) {
            totalRevenue += Number(order.amount) || 0; validOrders++;
            const dateKey = order.createdAtDate.toISOString().split('T')[0];
            dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + Number(order.amount);
        }
    });
    return { totalRevenue, totalOrders: orders.length, validOrders, pendingReview, dailyChartData: Object.keys(dailyRevenue).sort().map(d => ({ date: d.substring(5), amount: dailyRevenue[d] })), statusChartData: Object.keys(statusCount).map(k => ({ name: k, value: statusCount[k] })) };
  }, [orders]);

  const realMarketStats = useMemo(() => {
      const statsMap = {}; for(let d=0; d<7; d++) { for(let h=0; h<24; h++) { statsMap[`${d}-${h}`] = { dayOfWeek: d, hour: h, totalAmount: 0, totalBids: 0 }; } }
      orders.forEach(order => { if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) { order.detailedSlots.forEach(slot => { const isScreenSelected = selectedStatScreens.size === 0 || selectedStatScreens.has(String(slot.screenId)); const isHourSelected = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(slot.hour); if (isScreenSelected && isHourSelected) { const dateObj = new Date(slot.date); const key = `${dateObj.getDay()}-${slot.hour}`; if (statsMap[key]) { statsMap[key].totalAmount += (Number(slot.bidPrice) || 0); statsMap[key].totalBids += 1; } } }); } });
      let selectionTotalAmount = 0; let selectionTotalBids = 0;
      const rows = Object.values(statsMap).map(item => { if (item.totalBids > 0) { const isHourVisible = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(item.hour); if (isHourVisible) { selectionTotalAmount += item.totalAmount; selectionTotalBids += item.totalBids; } } return { ...item, averagePrice: item.totalBids > 0 ? Math.round(item.totalAmount / item.totalBids) : 0 }; });
      const displayRows = selectedAnalyticsHours.size > 0 ? rows.filter(r => selectedAnalyticsHours.has(r.hour)) : rows;
      return { rows: displayRows, summary: { avgPrice: selectionTotalBids > 0 ? Math.round(selectionTotalAmount / selectionTotalBids) : 0, totalBids: selectionTotalBids } };
  }, [orders, selectedStatScreens, selectedAnalyticsHours]);

  const monthViewData = useMemo(() => {
      const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1); const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0); const days = {}; 
      for(let d = 1; d <= endOfMonth.getDate(); d++) { const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; days[dateStr] = { count: 0, pending: 0, scheduled: 0, bidding: 0 }; }
      orders.forEach(order => { if (!['paid', 'won', 'paid_pending_selection', 'partially_outbid', 'partially_won'].includes(order.status) || !order.detailedSlots) return; order.detailedSlots.forEach(slot => { if(days[slot.date]) { days[slot.date].count++; if(order.status === 'paid_pending_selection' || order.status === 'partially_outbid') days[slot.date].bidding++; else if(order.creativeStatus === 'pending_review' || (order.hasVideo && !order.isApproved && !order.isRejected)) days[slot.date].pending++; else if(order.isScheduled) days[slot.date].scheduled++; } }); });
      return days;
  }, [orders, calendarDate]);

  const dayViewGrid = useMemo(() => {
    const grid = {}; const targetDateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(calendarDate.getDate()).padStart(2,'0')}`;
    orders.forEach(order => { if (!['paid', 'won', 'paid_pending_selection', 'partially_outbid', 'partially_won'].includes(order.status) || !order.detailedSlots) return; order.detailedSlots.forEach(slot => { if (slot.date !== targetDateStr) return; const key = `${slot.hour}-${slot.screenId}`; let status = 'normal'; if (order.status === 'paid_pending_selection') status = 'bidding'; else if (order.creativeStatus === 'pending_review' || (order.hasVideo && !order.creativeStatus && !order.isApproved)) status = 'review_needed'; else if (order.isScheduled) status = 'scheduled'; else if (order.status === 'won' || order.status === 'paid' || order.status === 'partially_won') status = 'action_needed'; const slotData = { ...slot, orderId: order.id, userEmail: order.userEmail, videoUrl: order.videoUrl, status: order.status, creativeStatus: order.creativeStatus, isScheduled: order.isScheduled, displayStatus: status, price: order.type === 'bid' ? (slot.bidPrice || 0) : 'Buyout', priceVal: order.type === 'bid' ? (parseInt(slot.bidPrice) || 0) : 999999 }; if (!grid[key]) grid[key] = []; grid[key].push(slotData); }); });
    Object.keys(grid).forEach(key => { grid[key].sort((a, b) => b.priceVal - a.priceVal); });
    return grid;
  }, [orders, calendarDate]);

  const filteredOrders = useMemo(() => { return orders.filter(o => { if (activeTab === 'review') { return o.creativeStatus === 'pending_review' || (o.hasVideo && !o.creativeStatus && !o.isApproved && !o.isRejected && o.status !== 'cancelled'); } const matchesSearch = (o.id||'').toLowerCase().includes(searchTerm.toLowerCase()) || (o.userEmail||'').toLowerCase().includes(searchTerm.toLowerCase()); const matchesStatus = statusFilter === 'all' || o.status === statusFilter; return matchesSearch && matchesStatus; }); }, [orders, activeTab, searchTerm, statusFilter]);

  // --- Handlers ---
  const handleAutoResolve = async () => {
      if (!confirm("確定要進行「智能結算」？系統將會逐個時段比較出價，判定贏家與輸家 (同價者先到先得)。")) return;
      setLoading(true);
      try {
          const q = query(collection(db, "orders"), where("status", "in", ["paid_pending_selection", "partially_outbid", "outbid_needs_action", "won", "lost"]));
          const snapshot = await getDocs(q);
          const allOrders = snapshot.docs.map(d => { const data = d.data(); let timeVal = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(); return { id: d.id, ...data, timeVal }; });
          const slotWars = {};
          allOrders.forEach(order => { if(order.detailedSlots) order.detailedSlots.forEach(slot => { const key = `${slot.date}-${parseInt(slot.hour)}-${slot.screenId}`; const myPrice = parseInt(slot.bidPrice)||0; if(!slotWars[key] || myPrice > slotWars[key].maxPrice || (myPrice===slotWars[key].maxPrice && order.timeVal < slotWars[key].timeVal)) slotWars[key] = { maxPrice: myPrice, timeVal: order.timeVal, winnerOrderId: order.id }; })});
          const batch = writeBatch(db); let updateCount = 0;
          allOrders.forEach(order => {
              if(!order.detailedSlots) return;
              let win=0, lose=0, hasChange=false;
              const newSlots = order.detailedSlots.map(slot => { const winner = slotWars[`${slot.date}-${parseInt(slot.hour)}-${slot.screenId}`]; let status = 'normal'; if(winner) { if(winner.winnerOrderId !== order.id) { lose++; status='outbid'; } else { win++; status='winning'; } } if(slot.slotStatus !== status) hasChange=true; return {...slot, slotStatus: status}; });
              let newStatus = order.status;
              if(lose>0 && win===0) newStatus='outbid_needs_action'; else if(lose>0 && win>0) newStatus='partially_outbid'; else if(lose===0 && win>0 && newStatus!=='paid' && newStatus!=='completed') newStatus='paid_pending_selection';
              if(hasChange || newStatus!==order.status) { batch.update(doc(db,"orders",order.id), {detailedSlots: newSlots, status: newStatus}); updateCount++; }
          });
          await batch.commit(); alert(`✅ 更新了 ${updateCount} 張單`);
      } catch(e) { console.error(e); alert("❌ 錯誤"); } finally { setLoading(false); }
  };

  const handleFinalizeAuction = async () => {
      if(!confirm("⚠️ 確定過期截標？")) return; setLoading(true);
      try {
          const q = query(collection(db, "orders"), where("status", "==", "outbid_needs_action"));
          const snapshot = await getDocs(q); const batch = writeBatch(db); let count=0; const now=new Date();
          for(const d of snapshot.docs) {
              const o = d.data();
              if(o.detailedSlots?.every(s => now > new Date(`${s.date} ${String(s.hour).padStart(2,'0')}:00`))) {
                  batch.update(doc(db,"orders",d.id), {status:'lost', finalizedAt: serverTimestamp()});
                  await sendBidLostEmail({email:o.userEmail, displayName:o.userName}, {id:d.id});
                  count++;
              }
          }
          if(count>0) { await batch.commit(); alert(`🏁 ${count} 張過期單已截標`); } else alert("無過期單");
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReview = async (id, action) => { 
      if(!confirm(action)) return; 
      try { 
          await updateDoc(doc(db,"orders",id), { creativeStatus: action==='approve'?'approved':'rejected', isApproved: action==='approve', isRejected: action!=='approve', reviewNote: action!=='approve'?reviewNote:'' }); 
          if(action==='approve') { const o = orders.find(x=>x.id===id); sendBidConfirmation({email:o.userEmail, displayName:o.userName}, o, 'video_approved'); }
          alert("OK"); 
      } catch(e){ alert("Error"); } 
  };

  const handleMarkAsScheduled = async (id) => { if(!confirm("OK?"))return; await updateDoc(doc(db,"orders",id), {isScheduled:true, scheduledAt: new Date()}); alert("Scheduled"); };
  const handleBulkAction = async (act) => { if(!confirm('Confirm?'))return; const b=writeBatch(db); selectedOrderIds.forEach(id=>{if(act==='cancel') b.update(doc(db,"orders",id),{status:'cancelled'})}); await b.commit(); alert("Done"); setSelectedOrderIds(new Set()); };
  const handleDeleteOrder = async (id) => { if(confirm("Cancel?")) await updateDoc(doc(db,"orders",id),{status:'cancelled'}); };
  
  // Rules
  const handleAddRule = async () => { if(!newRule.date) return alert("Date?"); let hours=[]; if(!newRule.hoursStr) hours=Array.from({length:24},(_,i)=>i); else hours=newRule.hoursStr.split(',').map(Number); await addDoc(collection(db,"special_rules"),{...newRule, hours, type:newRule.action, value: parseFloat(newRule.overridePrice)}); alert("Done"); };
  const handleDeleteRule = async (id) => { if(confirm("Del?")) await deleteDoc(doc(db,"special_rules",id)); };

  // Screens & Config
  const savePricingConfig = async () => { const rules=localBundleRules.map(r=>({screens:r.screensStr.split(','), multiplier:parseFloat(r.multiplier)})); if(selectedConfigTarget==='global'){await setDoc(doc(db,"system_config","pricing_rules"),{...activeConfig, bundleRules:rules}); setGlobalPricingConfig(activeConfig);} else {const s=screens.find(x=>String(x.id)===selectedConfigTarget); await updateDoc(doc(db,"screens",s.firestoreId),{customPricing:activeConfig});} alert("Saved"); };
  const handleAddBundleRule = () => setLocalBundleRules([...localBundleRules, {screensStr:"", multiplier:1.2}]);
  const handleBundleRuleChange = (i,f,v) => { const n=[...localBundleRules]; n[i][f]=v; setLocalBundleRules(n); };
  const handleRemoveBundleRule = (i) => { const n=[...localBundleRules]; n.splice(i,1); setLocalBundleRules(n); };
  
  // Screen Modal
  const handleAddScreen = () => { setIsAddScreenModalOpen(true); setEditingScreenId(null); };
  const handleEditScreenFull = (s) => { 
      let rules = s.tierRules || {}; if(rules.default && !rules[0]) { let r=rules.default; rules={}; for(let i=0;i<7;i++) rules[i]=r; }
      setNewScreenData({ ...s, tierRules: rules, images: s.images||['','',''] }); 
      setEditingScreenId(s.firestoreId); setIsAddScreenModalOpen(true); 
  };
  const saveScreenFull = async () => { 
      const p = { ...newScreenData, basePrice: parseFloat(newScreenData.basePrice), images: newScreenData.images.filter(x=>x), lastUpdated: new Date() };
      if(editingScreenId) await updateDoc(doc(db,"screens",editingScreenId), p);
      else { const maxId = screens.reduce((m,s)=>Math.max(m,Number(s.id)||0),0); await addDoc(collection(db,"screens"),{...p, id:String(maxId+1), createdAt:new Date(), isActive:true}); }
      alert("Saved"); setIsAddScreenModalOpen(false); 
  };
  const toggleScreenActive = async (s) => { if(confirm("Toggle?")) await updateDoc(doc(db,"screens",s.firestoreId),{isActive:!s.isActive}); };
  const handleScreenChange = (fid,f,v) => setEditingScreens(p=>({...p, [fid]:{...p[fid], [f]:v}}));
  const saveScreenSimple = async (s) => { const d=editingScreens[s.firestoreId]; if(d){ if(d.basePrice) d.basePrice=parseFloat(d.basePrice); await updateDoc(doc(db,"screens",s.firestoreId), d); alert("Saved"); setEditingScreens(p=>{const n={...p}; delete n[s.firestoreId]; return n;}); }};

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex items-center gap-2"><span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH V5.3</h1>
            <div className="flex gap-2">
                <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded">前台</button>
                <button onClick={() => signOut(auth)} className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded">登出</button>
                <button onClick={handleAutoResolve} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-purple-700 shadow-lg"><Gavel size={16}/> 智能結算</button>
                <button onClick={handleFinalizeAuction} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-red-700 shadow-lg"><Flag size={16}/> 截標</button>
            </div>
        </div>

        {/* Tab Nav */}
        <div className="flex flex-wrap gap-2">
            {[ {id:'dashboard',icon:<LayoutDashboard size={16}/>,label:'數據'}, {id:'calendar',icon:<Calendar size={16}/>,label:'排程'}, {id:'orders',icon:<List size={16}/>,label:'訂單'}, {id:'review',icon:<Video size={16}/>,label:`審核 (${stats.pendingReview})`, alert:stats.pendingReview>0}, {id:'rules',icon:<Settings size={16}/>,label:'規則'}, {id:'screens',icon:<Monitor size={16}/>,label:'屏幕'}, {id:'analytics',icon:<TrendingUp size={16}/>,label:'分析'}, {id:'config',icon:<Settings size={16}/>,label:'公式'} ].map(t => (
                <button key={t.id} onClick={()=>{setActiveTab(t.id); setSelectedOrderIds(new Set())}} className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab===t.id?'bg-blue-600 text-white shadow-md':'bg-white text-slate-500 hover:bg-slate-100 border'}`}>
                    {t.icon} {t.label} {t.alert&&<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
            ))}
        </div>

        {/* Views */}
        {activeTab === 'dashboard' && <DashboardView stats={stats} COLORS={COLORS} />}
        {activeTab === 'orders' && <OrdersView orders={filteredOrders} selectedIds={selectedOrderIds} onSelect={setSelectedOrderIds} onBulkAction={handleBulkAction} customerHistory={customerHistory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onDeleteOrder={handleDeleteOrder} />}
        {activeTab === 'review' && <ReviewView orders={filteredOrders} onReview={handleReview} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
        {activeTab === 'analytics' && <AnalyticsView stats={realMarketStats} screens={screens} selectedScreens={selectedStatScreens} setSelectedScreens={setSelectedStatScreens} selectedHours={selectedAnalyticsHours} setSelectedHours={setSelectedAnalyticsHours} />}
        {activeTab === 'config' && <ConfigView config={activeConfig} setConfig={setActiveConfig} globalConfig={globalPricingConfig} setGlobal={setGlobalPricingConfig} target={selectedConfigTarget} setTarget={setSelectedConfigTarget} screens={screens} localRules={localBundleRules} setLocalRules={setLocalBundleRules} onSave={savePricingConfig} onAddRule={handleAddBundleRule} onRuleChange={handleBundleRuleChange} onRemoveRule={handleRemoveBundleRule} />}
        {activeTab === 'rules' && <RulesView rules={specialRules} screens={screens} newRule={newRule} setNewRule={setNewRule} onAdd={handleAddRule} onDelete={handleDeleteRule} />}
        {activeTab === 'screens' && <ScreensView screens={screens} editingScreens={editingScreens} onAdd={handleAddScreen} onEditFull={handleEditScreenFull} onSaveSimple={saveScreenSimple} onChange={handleScreenChange} onToggle={toggleScreenActive} />}
        {activeTab === 'calendar' && <CalendarView date={calendarDate} setDate={setCalendarDate} mode={calendarViewMode} setMode={setCalendarViewMode} monthData={monthViewData} dayGrid={dayViewGrid} screens={screens} onSelectSlot={setSelectedSlotGroup} onPrev={() => { const d = new Date(calendarDate); if(calendarViewMode==='month') d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-1); setCalendarDate(d); }} onNext={() => { const d = new Date(calendarDate); if(calendarViewMode==='month') d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+1); setCalendarDate(d); }} />}

        {/* Modals */}
        <ScreenModal isOpen={isAddScreenModalOpen} onClose={()=>setIsAddScreenModalOpen(false)} isEdit={!!editingScreenId} data={newScreenData} setData={setNewScreenData} handleImageChange={(i,v)=>{const n=[...newScreenData.images];n[i]=v;setNewScreenData({...newScreenData,images:n})}} handleApplyToAllDays={()=>{const r=newScreenData.tierRules; for(let i=0;i<7;i++) r[i]=JSON.parse(JSON.stringify(r[activeDayTab])); setNewScreenData({...newScreenData, tierRules:r})}} toggleTierHour={(t,h)=>{const r={...newScreenData.tierRules}; const d=r[activeDayTab][t]; if(d.includes(h)) r[activeDayTab][t]=d.filter(x=>x!==h); else r[activeDayTab][t]=[...d,h]; setNewScreenData({...newScreenData, tierRules:r})}} activeDayTab={activeDayTab} setActiveDayTab={setActiveDayTab} onSave={saveScreenFull} />
        <SlotGroupModal group={selectedSlotGroup} onClose={()=>setSelectedSlotGroup(null)} onReview={handleReview} onMarkScheduled={handleMarkAsScheduled} />
      
      </div>
    </div>
  );
};

export default AdminPanel;