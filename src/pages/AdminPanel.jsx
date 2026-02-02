import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc, deleteDoc, addDoc
} from "firebase/firestore";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Search, Video, Monitor, Save, Trash2, 
  LayoutDashboard, List, Settings, Star, AlertTriangle, ArrowUp, ArrowDown, Lock, Unlock, Clock, Calendar, Plus, X, CheckSquare, Filter, Play, CheckCircle, XCircle,
  Mail, MessageCircle, ChevronLeft, ChevronRight, UploadCloud, User, AlertCircle, Grid, Maximize, Loader2, Trophy,
  Edit, MapPin, Image as ImageIcon, Layers, FileText, Map, Copy
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

// Default tier configuration (Fallback)
const EMPTY_DAY_RULE = { prime: [], gold: [] };

const AdminPanel = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- Data States ---
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [specialRules, setSpecialRules] = useState([]);
  
  // --- Pricing Config States (Global & Active) ---
  const [globalPricingConfig, setGlobalPricingConfig] = useState({});
  const [activeConfig, setActiveConfig] = useState({}); 
  const [selectedConfigTarget, setSelectedConfigTarget] = useState('global'); 
  
  // 🔥🔥🔥 FIX: Initialize localBundleRules state to prevent crash
  const [localBundleRules, setLocalBundleRules] = useState([]);

  // --- UI States ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  // --- Advanced Filter States ---
  const [selectedStatScreens, setSelectedStatScreens] = useState(new Set()); 
  const [selectedAnalyticsHours, setSelectedAnalyticsHours] = useState(new Set()); 
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());       
  const [editingScreens, setEditingScreens] = useState({});
  
  // --- Screen Management States ---
  const [isAddScreenModalOpen, setIsAddScreenModalOpen] = useState(false);
  const [editingScreenId, setEditingScreenId] = useState(null);
  const [activeDayTab, setActiveDayTab] = useState(1);
  
  const [newScreenData, setNewScreenData] = useState({
    name: '', location: '', district: '', basePrice: 50,
    images: ['', '', ''], specifications: '', mapUrl: '',
    bundleGroup: '',
    footfall: '',       // 新增
  audience: '',       // 新增
  operatingHours: '', // 新增
  resolution: '',     // 新增
    tierRules: { 0: {...EMPTY_DAY_RULE}, 1: {...EMPTY_DAY_RULE}, 2: {...EMPTY_DAY_RULE}, 3: {...EMPTY_DAY_RULE}, 4: {...EMPTY_DAY_RULE}, 5: {...EMPTY_DAY_RULE}, 6: {...EMPTY_DAY_RULE} }
  });

  // --- Calendar States ---
  const [calendarDate, setCalendarDate] = useState(new Date()); 
  const [calendarViewMode, setCalendarViewMode] = useState('month'); 
  const [selectedSlotGroup, setSelectedSlotGroup] = useState(null); 

  // --- Forms ---
  const [newRule, setNewRule] = useState({ screenId: 'all', date: '', hoursStr: '', action: 'price_override', overridePrice: '', note: '' });

  // 1. Auth & Data Fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email)) {
        setUser(currentUser); 
        fetchAllData();
      } else {
        setUser(currentUser);
        fetchAllData();
      }
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
      const unsubRules = onSnapshot(collection(db, "special_rules"), (snap) => {
          setSpecialRules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      getDoc(doc(db, "system_config", "pricing_rules")).then(docSnap => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setGlobalPricingConfig(data);
              setActiveConfig(data);
              // 🔥 Sync bundle rules if they exist
              if (data.bundleRules) {
                 const formatted = data.bundleRules.map(r => ({
                    screensStr: r.screens.join(','),
                    multiplier: r.multiplier
                 }));
                 setLocalBundleRules(formatted);
              }
          }
      });
      return () => { unsubOrders(); unsubScreens(); unsubRules(); };
  };

  // 🔥 Sync Logic for Bundle Rules
  useEffect(() => {
      if (globalPricingConfig.bundleRules) {
          const formatted = globalPricingConfig.bundleRules.map(r => ({
              screensStr: r.screens.join(','),
              multiplier: r.multiplier
          }));
          setLocalBundleRules(formatted);
      }
  }, [globalPricingConfig]);

  const customerHistory = useMemo(() => {
      const history = {};
      orders.forEach(order => { const email = order.userEmail; if (!history[email]) history[email] = 0; history[email]++; });
      return history;
  }, [orders]);

  const stats = useMemo(() => {
    let totalRevenue = 0, validOrders = 0, pendingReview = 0;
    let dailyRevenue = {}, statusCount = {};
    orders.forEach(order => {
        statusCount[order.status || 'unknown'] = (statusCount[order.status || 'unknown'] || 0) + 1;
        const needsReview = order.creativeStatus === 'pending_review' || (order.hasVideo && !order.creativeStatus && !order.isApproved && !order.isRejected && order.status !== 'cancelled');
        if (needsReview) pendingReview++;
        if (['paid', 'won', 'completed', 'paid_pending_selection'].includes(order.status)) {
            totalRevenue += Number(order.amount) || 0;
            validOrders++;
            const dateKey = order.createdAtDate.toISOString().split('T')[0];
            dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + Number(order.amount);
        }
    });
    return { totalRevenue, totalOrders: orders.length, validOrders, pendingReview, dailyChartData: Object.keys(dailyRevenue).sort().map(d => ({ date: d.substring(5), amount: dailyRevenue[d] })), statusChartData: Object.keys(statusCount).map(k => ({ name: k, value: statusCount[k] })) };
  }, [orders]);

  // 🔥 Switch Config Logic
  useEffect(() => {
      if (selectedConfigTarget === 'global') { setActiveConfig(globalPricingConfig); } 
      else { const screen = screens.find(s => String(s.id) === selectedConfigTarget); if (screen && screen.customPricing) { setActiveConfig(screen.customPricing); } else { setActiveConfig(globalPricingConfig); } }
  }, [selectedConfigTarget, globalPricingConfig, screens]);

  const realMarketStats = useMemo(() => {
      const statsMap = {}; for(let d=0; d<7; d++) { for(let h=0; h<24; h++) { statsMap[`${d}-${h}`] = { dayOfWeek: d, hour: h, totalAmount: 0, totalBids: 0 }; } }
      orders.forEach(order => { if (['paid', 'won', 'completed'].includes(order.status) && order.detailedSlots) { order.detailedSlots.forEach(slot => { const isScreenSelected = selectedStatScreens.size === 0 || selectedStatScreens.has(String(slot.screenId)); const isHourSelected = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(slot.hour); if (isScreenSelected && isHourSelected) { const dateObj = new Date(slot.date); const key = `${dateObj.getDay()}-${slot.hour}`; if (statsMap[key]) { statsMap[key].totalAmount += (Number(slot.bidPrice) || 0); statsMap[key].totalBids += 1; } } }); } });
      let selectionTotalAmount = 0; let selectionTotalBids = 0;
      const rows = Object.values(statsMap).map(item => { if (item.totalBids > 0) { const isHourVisible = selectedAnalyticsHours.size === 0 || selectedAnalyticsHours.has(item.hour); if (isHourVisible) { selectionTotalAmount += item.totalAmount; selectionTotalBids += item.totalBids; } } return { ...item, averagePrice: item.totalBids > 0 ? Math.round(item.totalAmount / item.totalBids) : 0 }; });
      const displayRows = selectedAnalyticsHours.size > 0 ? rows.filter(r => selectedAnalyticsHours.has(r.hour)) : rows;
      return { rows: displayRows, summary: { avgPrice: selectionTotalBids > 0 ? Math.round(selectionTotalAmount / selectionTotalBids) : 0, totalBids: selectionTotalBids } };
  }, [orders, selectedStatScreens, selectedAnalyticsHours]);

  const monthViewData = useMemo(() => {
      const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
      const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
      const days = {}; for(let d = 1; d <= endOfMonth.getDate(); d++) { const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; days[dateStr] = { count: 0, pending: 0, scheduled: 0, bidding: 0 }; }
      orders.forEach(order => { if (!['paid', 'won', 'paid_pending_selection'].includes(order.status) || !order.detailedSlots) return; order.detailedSlots.forEach(slot => { if(days[slot.date]) { days[slot.date].count++; if(order.status === 'paid_pending_selection') days[slot.date].bidding++; else if(order.creativeStatus === 'pending_review' || (order.hasVideo && !order.isApproved && !order.isRejected)) days[slot.date].pending++; else if(order.isScheduled) days[slot.date].scheduled++; } }); });
      return days;
  }, [orders, calendarDate]);

  const dayViewGrid = useMemo(() => {
    const grid = {}; const targetDateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(calendarDate.getDate()).padStart(2,'0')}`;
    orders.forEach(order => { if (!['paid', 'won', 'paid_pending_selection'].includes(order.status) || !order.detailedSlots) return; order.detailedSlots.forEach(slot => { if (slot.date !== targetDateStr) return; const key = `${slot.hour}-${slot.screenId}`; let status = 'normal'; if (order.status === 'paid_pending_selection') status = 'bidding'; else if (order.creativeStatus === 'pending_review' || (order.hasVideo && !order.creativeStatus && !order.isApproved)) status = 'review_needed'; else if (order.isScheduled) status = 'scheduled'; else if (order.status === 'won' || order.status === 'paid') status = 'action_needed'; const slotData = { ...slot, orderId: order.id, userEmail: order.userEmail, videoUrl: order.videoUrl, status: order.status, creativeStatus: order.creativeStatus, isScheduled: order.isScheduled, displayStatus: status, price: order.type === 'bid' ? (slot.bidPrice || 0) : 'Buyout', priceVal: order.type === 'bid' ? (parseInt(slot.bidPrice) || 0) : 999999 }; if (!grid[key]) grid[key] = []; grid[key].push(slotData); }); });
    Object.keys(grid).forEach(key => { grid[key].sort((a, b) => b.priceVal - a.priceVal); });
    return grid;
  }, [orders, calendarDate]);

  const handleConfigChange = (k, v) => setActiveConfig(p => ({ ...p, [k]: parseFloat(v) }));
  
  // 🔥🔥🔥 Bundle Rules Save Logic 🔥🔥🔥
  const savePricingConfig = async () => { 
      const formattedRules = localBundleRules.map(r => ({
          screens: r.screensStr.split(',').map(s => s.trim()).filter(s => s !== ""),
          multiplier: parseFloat(r.multiplier)
      }));

      if (selectedConfigTarget === 'global') { 
          await setDoc(doc(db, "system_config", "pricing_rules"), {
              ...activeConfig,
              bundleRules: formattedRules 
          }); 
          setGlobalPricingConfig(activeConfig); 
          alert("🌍 全局價格公式及 Bundle 規則已更新"); 
      } else { 
          const screen = screens.find(s => String(s.id) === selectedConfigTarget); 
          if (!screen) return; 
          await updateDoc(doc(db, "screens", screen.firestoreId), { customPricing: activeConfig }); 
          alert(`✅ Screen ${screen.name} 的專屬公式已更新`); 
      } 
  };

  // 🔥 Bundle Rule Handlers
  const handleAddBundleRule = () => { setLocalBundleRules([...localBundleRules, { screensStr: "", multiplier: 1.2 }]); };
  const handleBundleRuleChange = (index, field, value) => { const newRules = [...localBundleRules]; newRules[index][field] = value; setLocalBundleRules(newRules); };
  const handleRemoveBundleRule = (index) => { const newRules = [...localBundleRules]; newRules.splice(index, 1); setLocalBundleRules(newRules); };

  const handleSelectOrder = (id) => { const n = new Set(selectedOrderIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedOrderIds(n); };
  const handleSelectAll = (e) => { if (e.target.checked) { setSelectedOrderIds(new Set(filteredOrders.map(o => o.id))); } else { setSelectedOrderIds(new Set()); } };
  const handleBulkAction = async (act) => { if(selectedOrderIds.size===0)return; if(!confirm('Confirm?'))return; const b=writeBatch(db); selectedOrderIds.forEach(id=>{if(act==='cancel') b.update(doc(db,"orders",id),{status:'cancelled'})}); await b.commit(); alert("Done"); setSelectedOrderIds(new Set()); };
  const handleAddRule = async () => { if(!newRule.date) return alert("Date required"); let hours = []; const inputStr = newRule.hoursStr.trim(); if (!inputStr || inputStr.toLowerCase() === 'all') { hours = Array.from({length: 24}, (_, i) => i); } else { if (inputStr.includes('-')) { const [start, end] = inputStr.split('-').map(n => parseInt(n)); if (!isNaN(start) && !isNaN(end) && start <= end) { for (let i = start; i <= end; i++) if (i >= 0 && i <= 23) hours.push(i); } } else { hours = inputStr.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23); } } if (hours.length === 0) return alert("❌ 時段格式錯誤"); try { await addDoc(collection(db, "special_rules"), { screenId: newRule.screenId, date: newRule.date, hours: hours, type: newRule.action, value: newRule.action === 'price_override' ? parseFloat(newRule.overridePrice) : null, note: newRule.note, createdAt: new Date() }); alert("✅ 規則已建立"); setNewRule({ ...newRule, hoursStr: '', overridePrice: '', note: '' }); } catch (e) { console.error(e); alert("❌ 建立失敗"); } };
  const handleDeleteRule = async (id) => { if(confirm("Del?")) await deleteDoc(doc(db, "special_rules", id)); };
  const handleScreenChange = (fid, f, v) => setEditingScreens(p => ({ ...p, [fid]: { ...p[fid], [f]: v } }));
  const saveScreenSimple = async (s) => { const d = editingScreens[s.firestoreId]; if(d) { if(d.basePrice) d.basePrice = parseFloat(d.basePrice); await updateDoc(doc(db, "screens", s.firestoreId), d); alert("Saved"); setEditingScreens(p=>{const n={...p};delete n[s.firestoreId];return n;}); } };
  const handleMarkAsScheduled = async (orderId) => { if (!confirm("確認已將影片編排至播放系統？")) return; try { await updateDoc(doc(db, "orders", orderId), { isScheduled: true, scheduledAt: new Date(), scheduledBy: user.email }); alert("✅ 狀態已更新：準備播放"); if (selectedSlotGroup) { const updatedGroup = selectedSlotGroup.map(s => s.orderId === orderId ? { ...s, isScheduled: true, displayStatus: 'scheduled' } : s); setSelectedSlotGroup(updatedGroup); } } catch (e) { alert("更新失敗"); } };
  const handleReview = async (orderId, action) => { const targetOrder = orders.find(o => o.id === orderId); if (!targetOrder || !window.confirm(`確定要 ${action === 'approve' ? '通過' : '拒絕'}?`)) return; try { const updateData = { creativeStatus: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date(), reviewedBy: user.email, reviewNote: action === 'reject' ? reviewNote : '', isApproved: action === 'approve', isRejected: action === 'reject' }; await updateDoc(doc(db, "orders", orderId), updateData); if (action === 'approve') sendBidConfirmation({ email: targetOrder.userEmail, displayName: targetOrder.userName }, targetOrder, 'video_approved'); alert(action === 'approve' ? "✅ 已批核並發送 Email" : "✅ 已拒絕"); setReviewNote(""); if (selectedSlotGroup) setSelectedSlotGroup(null); } catch (e) { alert("操作失敗"); } };
  const filteredOrders = useMemo(() => { return orders.filter(o => { if (activeTab === 'review') { return o.creativeStatus === 'pending_review' || (o.hasVideo && !o.creativeStatus && !o.isApproved && !o.isRejected && o.status !== 'cancelled'); } const matchesSearch = (o.id||'').toLowerCase().includes(searchTerm.toLowerCase()) || (o.userEmail||'').toLowerCase().includes(searchTerm.toLowerCase()); const matchesStatus = statusFilter === 'all' || o.status === statusFilter; return matchesSearch && matchesStatus; }); }, [orders, activeTab, searchTerm, statusFilter]);

  // --- Modal: Edit Screen Logic ---
  const handleEditScreenFull = (screen) => {
      let initializedRules = {}; 
      const existingRules = screen.tierRules || {};
      
      // Migration: default -> 0-6
      if (existingRules.default && !existingRules['0']) {
         for(let i=0; i<7; i++) initializedRules[i] = existingRules.default;
      } else {
         for(let i=0; i<7; i++) {
             initializedRules[i] = existingRules[i] || { prime: [], gold: [] };
         }
      }

      setNewScreenData({
          name: screen.name,
          location: screen.location,
          district: screen.district || '',
          basePrice: screen.basePrice || 50,
          // 🔥 確保 images 陣列存在
          images: Array.isArray(screen.images) && screen.images.length >= 3 ? screen.images.slice(0,3) : [screen.imageUrl || '', '', ''],
          // 🔥 讀取你的 Firebase 欄位
          specifications: screen.specifications || '',
          mapUrl: screen.mapUrl || screen.mapEmbedUrl || '', // 兼容舊地圖欄位
          bundleGroup: screen.bundleGroup || screen.bundlegroup || '', // 兼容大小寫
          footfall: screen.footfall || '',
        audience: screen.audience || '',
        operatingHours: screen.operatingHours || '',
        resolution: screen.resolution || '',
        tierRules: initializedRules
      });
      setEditingScreenId(screen.firestoreId);
      setIsAddScreenModalOpen(true);
      setActiveDayTab(1);
  };

  const handleAddScreen = () => {
      let initializedRules = {}; for(let i=0; i<7; i++) initializedRules[i] = { prime: [], gold: [] };
      setNewScreenData({ name: '', location: '', district: '', basePrice: 50, images: ['', '', ''], specifications: '', mapUrl: '', bundleGroup: '', tierRules: initializedRules });
      setEditingScreenId(null); setIsAddScreenModalOpen(true); setActiveDayTab(1);
  };
  const handleImageChange = (index, value) => { const newImages = [...newScreenData.images]; newImages[index] = value; setNewScreenData({ ...newScreenData, images: newImages }); };
  const saveScreenFull = async () => { 
    try { 
        const cleanedImages = newScreenData.images.filter(url => url.trim() !== ''); 
        const payload = { 
            name: newScreenData.name, 
            location: newScreenData.location, 
            district: newScreenData.district, 
            basePrice: parseFloat(newScreenData.basePrice), 
            images: cleanedImages, 
            imageUrl: cleanedImages[0] || '', 
            specifications: newScreenData.specifications, 
            mapUrl: newScreenData.mapUrl, bundleGroup: 
           footfall: newScreenData.footfall,
            audience: newScreenData.audience,
            operatingHours: newScreenData.operatingHours,
            resolution: newScreenData.resolution,
            tierRules: newScreenData.tierRules,
            isActive: true, 
            lastUpdated: new Date() }; if (editingScreenId) { await updateDoc(doc(db, "screens", editingScreenId), payload); alert("✅ 屏幕資料已更新"); } else { const maxId = screens.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0); payload.id = String(maxId + 1); payload.createdAt = new Date(); await addDoc(collection(db, "screens"), payload); alert("✅ 新屏幕已建立"); } setIsAddScreenModalOpen(false); } catch (e) { console.error(e); alert("❌ 儲存失敗"); } };
  const toggleTierHour = (type, hour) => { setNewScreenData(prev => { const currentRules = { ...prev.tierRules }; const dayKey = String(activeDayTab); if (!currentRules[dayKey]) currentRules[dayKey] = { prime: [], gold: [] }; let list = currentRules[dayKey][type] || []; if (list.includes(hour)) { list = list.filter(h => h !== hour); } else { const otherType = type === 'prime' ? 'gold' : 'prime'; currentRules[dayKey][otherType] = (currentRules[dayKey][otherType] || []).filter(h => h !== hour); list.push(hour); } currentRules[dayKey][type] = list.sort((a,b) => a-b); return { ...prev, tierRules: currentRules }; }); };
  const handleApplyToAllDays = () => { if(!confirm(`將 ${WEEKDAYS[activeDayTab]} 的時段設定套用到所有日子 (週一至週日)？`)) return; const templateRule = newScreenData.tierRules[activeDayTab]; setNewScreenData(prev => { const newRules = {}; for(let i=0; i<7; i++) { newRules[i] = JSON.parse(JSON.stringify(templateRule)); } return { ...prev, tierRules: newRules }; }); alert("✅ 已套用至所有日子"); };
  const toggleScreenActive = async (s) => { if(confirm("Toggle?")) await updateDoc(doc(db, "screens", s.firestoreId), { isActive: !s.isActive }); };
  const toggleAnalyticsHour = (h) => { const n = new Set(selectedAnalyticsHours); n.has(h)?n.delete(h):n.add(h); setSelectedAnalyticsHours(n); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex items-center gap-2"><span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH V5.3 Ultimate</h1>
            <div className="flex gap-2">
                <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded">返回首頁</button>
                <button onClick={() => signOut(auth)} className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded">登出</button>
            </div>
        </div>

        <div className="flex flex-wrap gap-2">
            {[ {id:'dashboard',icon:<LayoutDashboard size={16}/>,label:'儀表板'}, {id:'calendar',icon:<Calendar size={16}/>,label:'排程總表'}, {id:'orders',icon:<List size={16}/>,label:'訂單管理'}, {id:'review',icon:<Video size={16}/>,label:`審核 (${stats.pendingReview})`, alert:stats.pendingReview>0}, {id:'rules',icon:<Settings size={16}/>,label:'特別規則'}, {id:'screens',icon:<Monitor size={16}/>,label:'屏幕管理'}, {id:'analytics',icon:<TrendingUp size={16}/>,label:'市場數據'}, {id:'config',icon:<Settings size={16}/>,label:'公式'} ].map(t => (
                <button key={t.id} onClick={()=>{setActiveTab(t.id); setSelectedOrderIds(new Set())}} className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab===t.id?'bg-blue-600 text-white shadow-md':'bg-white text-slate-500 hover:bg-slate-100 border'}`}>
                    {t.icon} {t.label} {t.alert&&<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
            ))}
        </div>

        {/* --- DASHBOARD --- */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="總營業額" value={`HK$ ${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-green-500"/>} bg="bg-green-50" border="border-green-100" />
                    <StatCard title="待審核" value={stats.pendingReview} icon={<Video className="text-orange-500"/>} bg="bg-orange-50" border="border-orange-100" />
                    <StatCard title="有效訂單" value={stats.validOrders} icon={<Users className="text-blue-500"/>} bg="bg-blue-50" border="border-blue-100" />
                    <StatCard title="總記錄" value={stats.totalOrders} icon={<List className="text-slate-500"/>} bg="bg-slate-50" border="border-slate-100" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col"><h3 className="font-bold mb-4">每日生意額</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.dailyChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3}/></LineChart></ResponsiveContainer></div></div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[350px] w-full flex flex-col"><h3 className="font-bold mb-4">訂單狀態</h3><div className="flex-1 w-full min-h-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.statusChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.statusChartData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></div>
                </div>
            </div>
        )}

        {/* --- CALENDAR --- */}
        {activeTab === 'calendar' && (
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col h-[750px] animate-in fade-in">
                <div className="flex justify-between items-center bg-slate-50 p-3 border-b border-slate-200">
                    <div className="flex gap-4 items-center">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Calendar size={20}/> 排程總表</h2>
                        <div className="flex bg-slate-200 rounded p-1">
                            <button onClick={()=>setCalendarViewMode('month')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${calendarViewMode==='month'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>月視圖</button>
                            <button onClick={()=>setCalendarViewMode('day')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${calendarViewMode==='day'?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>日視圖</button>
                        </div>
                        <div className="flex items-center gap-1 bg-white border p-1 rounded-lg">
                            <button onClick={() => { const d = new Date(calendarDate); if(calendarViewMode==='month') d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-1); setCalendarDate(d); }} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button>
                            <span className="px-3 font-mono font-bold text-sm min-w-[100px] text-center">{calendarViewMode==='month' ? calendarDate.toLocaleDateString('zh-HK',{year:'numeric',month:'long'}) : calendarDate.toLocaleDateString()}</span>
                            <button onClick={() => { const d = new Date(calendarDate); if(calendarViewMode==='month') d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+1); setCalendarDate(d); }} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button>
                        </div>
                    </div>
                    <div className="flex gap-3 text-[10px] font-medium">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-400 rounded-full"></div> 競價中</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> 待審核</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> 待排片</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Ready</span>
                    </div>
                </div>
                {calendarViewMode === 'month' && (
                    <div className="flex-1 p-4 overflow-auto">
                        <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">{d}</div>)}
                            {Array.from({length: new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay()}).map((_,i)=><div key={`empty-${i}`} className="bg-white min-h-[100px]"></div>)}
                            {Object.entries(monthViewData).map(([dateStr, data]) => (
                                <div key={dateStr} onClick={()=>{setCalendarDate(new Date(dateStr)); setCalendarViewMode('day');}} className="bg-white min-h-[100px] p-2 hover:bg-blue-50 cursor-pointer transition-colors relative group">
                                    <div className="text-xs font-bold text-slate-700 mb-2">{dateStr.split('-')[2]}</div>
                                    <div className="space-y-1">
                                        {data.pending > 0 && <div className="text-[10px] bg-red-100 text-red-700 px-1 rounded font-bold flex justify-between"><span>待審核</span><span>{data.pending}</span></div>}
                                        {data.scheduled > 0 && <div className="text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold flex justify-between"><span>Ready</span><span>{data.scheduled}</span></div>}
                                        {data.bidding > 0 && <div className="text-[10px] bg-yellow-50 text-yellow-600 px-1 rounded font-bold flex justify-between"><span>競價</span><span>{data.bidding}</span></div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {calendarViewMode === 'day' && (
                    <div className="flex-1 overflow-auto flex flex-col min-h-0">
                        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                            <div className="w-12 shrink-0 border-r border-slate-200 p-2 text-center text-[10px] font-bold text-slate-400 bg-slate-50 sticky left-0 z-20">Time</div>
                            {screens.sort((a,b)=>Number(a.id)-Number(b.id)).map(s => (<div key={s.id} className="flex-1 min-w-[120px] border-r border-slate-200 p-2 text-center text-xs font-bold truncate">{s.name}</div>))}
                        </div>
                        {Array.from({length: 24},(_,i)=>i).map(h => (
                            <div key={h} className="flex h-12 border-b border-slate-100 hover:bg-slate-50/50">
                                <div className="w-12 shrink-0 border-r border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-400 bg-slate-50 sticky left-0 z-10">{String(h).padStart(2,'0')}:00</div>
                                {screens.map(s => {
                                    const key = `${h}-${s.id}`; const slotGroup = dayViewGrid[key]; const bidCount = slotGroup?.length || 0; const topSlot = slotGroup ? slotGroup[0] : null; 
                                    let colorClass = 'bg-white'; if(topSlot) { if(topSlot.displayStatus==='scheduled') colorClass='bg-emerald-100 text-emerald-700 border-emerald-200'; else if(topSlot.displayStatus==='action_needed') colorClass='bg-blue-100 text-blue-700 border-blue-200'; else if(topSlot.displayStatus==='review_needed') colorClass='bg-red-100 text-red-700 border-red-200 font-bold'; else if(topSlot.displayStatus==='bidding') colorClass='bg-yellow-50 text-yellow-600 border-yellow-200'; }
                                    return (
                                        <div key={key} className={`flex-1 min-w-[120px] border-r border-slate-100 p-1 cursor-pointer transition-all ${colorClass}`} onClick={()=>slotGroup && setSelectedSlotGroup(slotGroup)}>
                                            {topSlot && (<div className="w-full h-full flex flex-col justify-center px-1 text-[10px] leading-tight relative">{bidCount > 1 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm z-10">{bidCount}</span>}<div className="font-bold truncate">{topSlot.userEmail}</div><div className="flex justify-between mt-0.5 opacity-80"><span>{topSlot.price === 'Buyout' ? 'Buy' : `$${topSlot.price}`}</span>{topSlot.displayStatus==='review_needed' && <AlertCircle size={10}/>}{topSlot.displayStatus==='action_needed' && <UploadCloud size={10}/>}{topSlot.displayStatus==='scheduled' && <CheckCircle size={10}/>}</div></div>)}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* --- ORDERS --- */}
        {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2 flex-1">
                        <Search className="text-slate-400" size={16}/>
                        <input type="text" placeholder="搜尋 ID / Email..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-2 border rounded px-2 py-1 text-sm outline-none w-64"/>
                        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="all">所有狀態</option><option value="paid_pending_selection">競價中</option><option value="won">成功 (Won)</option><option value="paid">已完成 (Paid)</option><option value="cancelled">已取消</option></select>
                    </div>
                    {selectedOrderIds.size > 0 && <button onClick={() => handleBulkAction('cancel')} className="text-red-600 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 animate-pulse"><Trash2 size={14}/> 批量取消 ({selectedOrderIds.size})</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4 w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}/></th><th className="p-4">時間</th><th className="p-4 w-1/3">訂單詳情 / 聯絡客戶</th><th className="p-4 text-right">金額</th><th className="p-4 text-center">狀態</th><th className="p-4 text-right">操作</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map(order => {
                                const isRepeat = customerHistory[order.userEmail] > 1;
                                return (
                                    <tr key={order.id} className={`hover:bg-slate-50 ${selectedOrderIds.has(order.id) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-4 text-center"><input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} /></td>
                                        <td className="p-4 text-slate-500 whitespace-nowrap align-top">{order.createdAtDate ? order.createdAtDate.toLocaleString('zh-HK') : 'N/A'}</td>
                                        <td className="p-4 align-top">
                                            <div className="font-mono text-xs font-bold text-slate-700">#{order.id.slice(0,8)}</div>
                                            <div className="my-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                                <div className="text-xs text-slate-700 font-bold flex items-center gap-2 mb-1">{order.userEmail}{isRepeat && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5"><Star size={10} fill="currentColor"/> VIP</span>}</div>
                                                <div className="flex flex-wrap gap-2 mt-2"><a href={`mailto:${order.userEmail}?subject=DOOH廣告訂單 #${order.id} 跟進`} className="text-[10px] px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-600 flex items-center gap-1 transition-colors"><Mail size={12}/> Email</a>{(order.mobile || order.phone) && <a href={`https://wa.me/${(order.mobile || order.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-1 bg-green-50 border border-green-200 rounded hover:bg-green-100 text-green-700 flex items-center gap-1 transition-colors"><MessageCircle size={12}/> WhatsApp</a>}</div>
                                            </div>
                                            <div className="mb-2">{order.hasVideo ? <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-100"><CheckCircle size={12}/> 影片已上傳 ({order.videoName?.slice(0, 15)}...)</span> : <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-100 animate-pulse"><AlertTriangle size={12}/> ⚠️ 尚未上傳影片 (請追片)</span>}</div>
                                            <div className="text-xs text-slate-500 font-bold mb-1">購買時段:</div>
                                            <div className="bg-white border border-slate-200 rounded p-2 text-xs space-y-1 max-h-32 overflow-y-auto">{order.detailedSlots && order.detailedSlots.map((slot, idx) => (<div key={idx} className="flex gap-2 text-slate-600"><span className="font-mono bg-slate-100 px-1 rounded">{slot.date}</span><span className="font-bold text-slate-800">{String(slot.hour).padStart(2,'0')}:00</span><span className="text-slate-400">@ Screen {slot.screenId}</span></div>))}</div>
                                        </td>
                                        <td className="p-4 text-right font-bold align-top">HK$ {order.amount?.toLocaleString()}</td>
                                        <td className="p-4 text-center align-top"><StatusBadge status={order.status} /></td>
                                        <td className="p-4 text-right align-top">{order.status !== 'cancelled' && <button onClick={async () => { if(window.confirm("取消此訂單？")) await updateDoc(doc(db, "orders", order.id), { status: 'cancelled', cancelledAt: new Date(), cancelledBy: user.email }) }} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-transparent hover:border-red-200">取消</button>}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- REVIEW --- */}
        {activeTab === 'review' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
                {filteredOrders.length === 0 ? <div className="col-span-full text-center p-10 text-slate-400">✅ 暫無待審核影片</div> : 
                filteredOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl shadow-md border border-orange-200 overflow-hidden flex flex-col">
                        <div className="bg-orange-50 p-3 border-b border-orange-100 flex justify-between items-center"><span className="text-xs font-bold text-orange-700 flex items-center gap-1"><Video size={14}/> 待審核</span><span className="text-[10px] text-slate-500">{order.createdAtDate ? order.createdAtDate.toLocaleDateString() : 'N/A'}</span></div>
                        <div className="relative bg-black aspect-video w-full">{order.videoUrl ? <video controls src={order.videoUrl} className="w-full h-full object-contain" /> : <div className="flex items-center justify-center h-full text-white/50 text-xs">No Video File</div>}</div>
                        <div className="p-4 space-y-3 flex-1 flex flex-col">
                            <div><p className="text-xs text-slate-400">客戶</p><p className="font-bold text-sm">{order.userEmail}</p></div>
                            <div className="text-xs text-slate-500">檔案: {order.videoName || 'Unknown'}</div>
                            <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
                                <button onClick={() => handleReview(order.id, 'approve')} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"><CheckCircle size={16}/> 通過並發送 Email</button>
                                <div className="flex gap-2"><input type="text" placeholder="拒絕原因..." className="flex-1 border rounded px-3 py-1.5 text-xs bg-slate-50" onChange={e => setReviewNote(e.target.value)} /><button onClick={() => handleReview(order.id, 'reject')} className="bg-white text-red-600 border border-red-200 px-3 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center gap-1"><XCircle size={14}/> 拒絕</button></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- RULES --- */}
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
                                <div className="flex items-center gap-2"><span className={`text-xs font-bold px-2 py-0.5 rounded border ${rule.type === 'lock' ? 'bg-red-50 border-red-200 text-red-600' : rule.type === 'disable_buyout' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-green-50 border-green-200 text-green-600'}`}>{rule.type === 'lock' ? '🔒 鎖定' : rule.type === 'disable_buyout' ? '🚫 禁買斷' : `💰 底價 $${rule.value}`}</span><span className="text-xs text-slate-500">時段: {rule.hours.length === 24 ? '全日' : rule.hours.join(', ')}</span></div>
                                {rule.note && <div className="text-xs text-slate-400 mt-1">備註: {rule.note}</div>}
                            </div>
                            <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- SCREENS --- */}
        {activeTab === 'screens' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold flex items-center gap-2"><Monitor size={20}/> 屏幕管理 ({screens.length})</h3>
                    <button onClick={handleAddScreen} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700">
                        <Plus size={14}/> 新增屏幕
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th className="p-4">ID</th><th className="p-4">資料</th><th className="p-4">Bundle</th><th className="p-4 text-center">狀態</th><th className="p-4">底價</th><th className="p-4 text-right">操作</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {screens.map(s => {
                                 const isEditingSimple = editingScreens[s.firestoreId];
                                 const currentPrice = isEditingSimple?.basePrice ?? s.basePrice;
                                 return (
                                    <tr key={s.firestoreId} className="hover:bg-slate-50">
                                        <td className="p-4 font-mono text-slate-500">#{s.id}</td>
                                        <td className="p-4">
                                            <div className="font-bold">{s.name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {s.location}</div>
                                        </td>
                                        <td className="p-4">
                                            {/* 🔥 FIX 3: Bundle Group Compatibility */}
                                            {s.bundleGroup || s.bundlegroup ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-200">{s.bundleGroup || s.bundlegroup}</span> : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="p-4 text-center"><button onClick={()=>toggleScreenActive(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold w-full ${s.isActive!==false?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{s.isActive!==false?<><Unlock size={12} className="inline"/> 上架中</>:<><Lock size={12} className="inline"/> 已鎖定</>}</button></td>
                                        <td className="p-4"><div className="flex items-center gap-1 bg-white border rounded px-2 py-1"><span className="text-slate-400">$</span><input type="number" value={currentPrice} onChange={(e)=>handleScreenChange(s.firestoreId, 'basePrice', e.target.value)} className="w-full font-bold outline-none"/></div></td>
                                        <td className="p-4 text-right flex items-center justify-end gap-2">
                                            {isEditingSimple && <button onClick={()=>saveScreenSimple(s)} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-700"><CheckCircle size={14}/></button>}
                                            <button onClick={()=>handleEditScreenFull(s)} className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded hover:bg-slate-50"><Edit size={14}/></button>
                                        </td>
                                    </tr>
                                 )
                            })}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

        {/* --- ANALYTICS --- */}
        {activeTab === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
                {/* ... (Analytics Code Kept Same) ... */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4"><div><h3 className="font-bold flex items-center gap-2"><TrendingUp size={18}/> 真實成交數據</h3><p className="text-xs text-slate-500">已選: {selectedStatScreens.size === 0 ? "全部 (All)" : `${selectedStatScreens.size} 部`}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setSelectedStatScreens(new Set())} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.size === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>全部</button>{screens.map(s => (<button key={s.id} onClick={() => {const n=new Set(selectedStatScreens); n.has(String(s.id))?n.delete(String(s.id)):n.add(String(s.id)); setSelectedStatScreens(n);}} className={`px-3 py-1 rounded text-xs font-bold border ${selectedStatScreens.has(String(s.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>{s.name}</button>))}</div></div><div className="flex flex-wrap gap-1 items-center mb-4"><span className="text-xs font-bold text-slate-500 uppercase w-12">Hours:</span><button onClick={() => setSelectedAnalyticsHours(new Set())} className={`w-8 h-8 rounded text-xs font-bold border ${selectedAnalyticsHours.size===0?'bg-slate-800 text-white':'bg-white text-slate-600'}`}>All</button>{Array.from({length:24},(_,i)=>i).map(h => (<button key={h} onClick={() => toggleAnalyticsHour(h)} className={`w-8 h-8 rounded text-xs border font-bold transition-all ${selectedAnalyticsHours.has(h)?'bg-orange-500 text-white border-orange-500':'bg-white text-slate-600 hover:bg-slate-100'}`}>{h}</button>))}</div><div className="mb-4 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white flex justify-between items-center shadow-lg"><div><h3 className="font-bold text-lg mb-1">所選組合平均成交價 (Average Price)</h3><p className="text-blue-100 text-sm">範圍: {selectedStatScreens.size===0?'全部屏幕':selectedStatScreens.size+' 個屏幕'} × {selectedAnalyticsHours.size===0?'24小時':selectedAnalyticsHours.size+' 個時段'}</p></div><div className="text-right"><div className="text-3xl font-bold">HK$ {realMarketStats.summary.avgPrice.toLocaleString()}</div><div className="text-xs text-blue-200">基於 {realMarketStats.summary.totalBids} 次出價</div></div></div><div className="overflow-x-auto h-[400px] border rounded-lg"><table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0 z-10"><tr><th className="p-3 text-left">星期</th><th className="p-3 text-left">時段</th><th className="p-3 text-right">平均成交價</th><th className="p-3 text-right">出價次數</th><th className="p-3 text-left pl-6">建議</th></tr></thead><tbody className="divide-y divide-slate-100">{realMarketStats.rows.sort((a,b)=>(a.dayOfWeek-b.dayOfWeek)||(a.hour-b.hour)).map((m,i)=>(<tr key={i} className="hover:bg-slate-50"><td className="p-3 text-slate-600 font-medium">{WEEKDAYS[m.dayOfWeek]}</td><td className="p-3">{String(m.hour).padStart(2,'0')}:00</td><td className="p-3 text-right font-bold text-slate-700">${m.averagePrice}</td><td className="p-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.totalBids>0?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-400'}`}>{m.totalBids}</span></td><td className="p-3 pl-6">{m.totalBids>3?<span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUp size={12}/> 加價</span>:m.totalBids===0?<span className="text-red-500 text-xs font-bold flex items-center gap-1"><ArrowDown size={12}/> 減價</span>:<span className="text-slate-300">-</span>}</td></tr>))}</tbody></table></div>
            </div>
        )}

        {/* --- CONFIG --- */}
        {activeTab === 'config' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in">
                <div className="flex justify-between items-center mb-6 border-b pb-4"><div><h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> 價格公式設定</h3><p className="text-xs text-slate-500 mt-1">您可以設定全局預設值，或針對個別屏幕設定不同的倍率。</p></div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-600">編輯對象:</span><select value={selectedConfigTarget} onChange={e => setSelectedConfigTarget(e.target.value)} className="border-2 border-blue-100 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-800 outline-none focus:border-blue-500"><option value="global">🌍 Global System Default (全局)</option><option disabled>──────────</option>{screens.map(s => <option key={s.id} value={String(s.id)}>🖥️ {s.name}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ConfigSection title="時段倍率 (Time Multipliers)"><ConfigInput label="Prime Hour (18:00-23:00)" val={activeConfig.primeMultiplier} onChange={v=>handleConfigChange('primeMultiplier',v)} desc="預設 3.5x"/><ConfigInput label="Gold Hour (12:00-14:00)" val={activeConfig.goldMultiplier} onChange={v=>handleConfigChange('goldMultiplier',v)} desc="預設 1.8x"/><ConfigInput label="週末倍率 (Fri/Sat)" val={activeConfig.weekendMultiplier} onChange={v=>handleConfigChange('weekendMultiplier',v)} desc="預設 1.5x"/></ConfigSection><ConfigSection title="附加費率 (Surcharges)"><ConfigInput label="聯播網 (Bundle)" val={activeConfig.bundleMultiplier} onChange={v=>handleConfigChange('bundleMultiplier',v)} desc="預設 1.25x"/><ConfigInput label="急單 (24h內)" val={activeConfig.urgentFee24h} onChange={v=>handleConfigChange('urgentFee24h',v)} desc="預設 1.5x (+50%)"/><ConfigInput label="極速 (1h內)" val={activeConfig.urgentFee1h} onChange={v=>handleConfigChange('urgentFee1h',v)} desc="預設 2.0x (+100%)"/></ConfigSection></div>
                
                {/* 🔥🔥🔥 Bundle Rules UI (Added) 🔥🔥🔥 */}
                <div className="border-t pt-6 mt-6">
                    <h3 className="font-bold text-lg flex items-center gap-2 mb-4"><Layers size={20}/> 聯播網組合規則 (Bundle Rules)</h3>
                    <div className="space-y-3">
                        {localBundleRules.map((rule, index) => (
                            <div key={index} className="flex items-center gap-3 bg-slate-50 p-3 rounded border">
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase">屏幕 IDs (逗號分隔)</label><input type="text" value={rule.screensStr} onChange={(e) => handleBundleRuleChange(index, 'screensStr', e.target.value)} className="w-full border rounded px-2 py-1 text-sm font-mono" placeholder="e.g. 1,2,3"/></div>
                                <div className="w-24"><label className="text-[10px] font-bold text-slate-500 uppercase">倍率</label><input type="number" step="0.05" value={rule.multiplier} onChange={(e) => handleBundleRuleChange(index, 'multiplier', e.target.value)} className="w-full border rounded px-2 py-1 text-sm font-bold text-blue-600"/></div>
                                <button onClick={() => handleRemoveBundleRule(index)} className="mt-4 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddBundleRule} className="mt-3 text-sm font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded"><Plus size={16}/> 新增組合規則</button>
                    <p className="text-xs text-slate-400 mt-2">* 優先級：完全匹配 ID > 相同 Bundle Group > 預設倍率</p>
                </div>

                <div className="mt-6 flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200"><div className="text-xs text-slate-500 flex items-center gap-2"><AlertTriangle size={14}/> {selectedConfigTarget === 'global' ? "修改此處將影響所有沒有自定義設定的屏幕。" : `此設定只會影響 ${screens.find(s=>String(s.id)===selectedConfigTarget)?.name}。`}</div><button onClick={savePricingConfig} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"><Save size={18}/> 儲存設定</button></div>
            </div>
        )}

      </div>

      {/* --- ADD/EDIT SCREEN MODAL (Enhanced) --- */}
      {isAddScreenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col h-[90vh] animate-in zoom-in duration-200">
                <div className="p-4 border-b bg-slate-900 text-white rounded-t-xl flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Monitor size={20}/> {editingScreenId ? '編輯屏幕' : '新增屏幕'}</h3><button onClick={() => setIsAddScreenModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X size={20}/></button></div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">屏幕名稱</label><input type="text" value={newScreenData.name} onChange={e => setNewScreenData({...newScreenData, name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 中環旗艦店 A"/></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">底價 (Base Price)</label><div className="flex items-center gap-2 border rounded px-3 py-2"><span className="text-slate-400">$</span><input type="number" value={newScreenData.basePrice} onChange={e => setNewScreenData({...newScreenData, basePrice: e.target.value})} className="w-full text-sm outline-none font-bold"/></div></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">位置</label><div className="flex items-center gap-2 border rounded px-3 py-2"><MapPin size={14} className="text-slate-400"/><input type="text" value={newScreenData.location} onChange={e => setNewScreenData({...newScreenData, location: e.target.value})} className="w-full text-sm outline-none" placeholder="e.g. 皇后大道中 100號"/></div></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">區域 (District)</label><input type="text" value={newScreenData.district} onChange={e => setNewScreenData({...newScreenData, district: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Central"/></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Bundle Group (Optional)</label><div className="flex items-center gap-2 border rounded px-3 py-2"><Layers size={14} className="text-slate-400"/><input type="text" value={newScreenData.bundleGroup} onChange={e => setNewScreenData({...newScreenData, bundleGroup: e.target.value})} className="w-full text-sm outline-none" placeholder="e.g. central_network"/></div><p className="text-[10px] text-slate-400 mt-1">相同 Bundle Group ID 的屏幕會自動組成聯播網。</p></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">圖片集 (最多 3 張)</label><div className="space-y-2">{newScreenData.images.map((url, index) => (<div key={index} className="flex items-center gap-2 border rounded px-3 py-2"><ImageIcon size={14} className="text-slate-400"/><input type="text" value={url} onChange={e => handleImageChange(index, e.target.value)} className="w-full text-sm outline-none" placeholder={`Image URL ${index + 1} (https://...)`}/></div>))}</div></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Google Map Link</label><div className="flex items-center gap-2 border rounded px-3 py-2"><Map size={14} className="text-slate-400"/><input type="text" value={newScreenData.mapUrl} onChange={e => setNewScreenData({...newScreenData, mapUrl: e.target.value})} className="w-full text-sm outline-none" placeholder="https://maps.google.com/..."/></div></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">屏幕規格 (Specifications)</label><div className="flex items-start gap-2 border rounded px-3 py-2"><FileText size={14} className="text-slate-400 mt-1"/><textarea rows="3" value={newScreenData.specifications} onChange={e => setNewScreenData({...newScreenData, specifications: e.target.value})} className="w-full text-sm outline-none resize-none" placeholder="e.g. 1920x1080px, 55 inch, LED..."/></div></div>
                    
                    {/* 🔥🔥🔥 在這裡插入你的代碼 🔥🔥🔥 */}
        <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">營銷數據 (Marketing Data)</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">每日人流 (Footfall)</label>
                    <input type="text" value={newScreenData.footfall} onChange={e => setNewScreenData({...newScreenData, footfall: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 50,000+ / day"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">受眾類型 (Audience)</label>
                    <input type="text" value={newScreenData.audience} onChange={e => setNewScreenData({...newScreenData, audience: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. OL, Tourists"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">播放時間 (Operating Hours)</label>
                    <input type="text" value={newScreenData.operatingHours} onChange={e => setNewScreenData({...newScreenData, operatingHours: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 08:00 - 23:00"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">解析度 (Resolution)</label>
                    <input type="text" value={newScreenData.resolution} onChange={e => setNewScreenData({...newScreenData, resolution: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 1080x1920"/>
                </div>
            </div>
        </div>
        {/* 🔥🔥🔥 插入結束 🔥🔥🔥 */}
                    
                    
                    
                    
                    
                    
                    
                    
                    </div>
                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-slate-700 flex items-center gap-2"><Clock size={16}/> 時段設定</h4><button onClick={handleApplyToAllDays} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-100 flex items-center gap-1"><Copy size={12}/> 複製至所有日子</button></div>
                        <div className="flex gap-1 mb-4 border-b border-slate-200">{WEEKDAYS.map((day, idx) => (<button key={idx} onClick={() => setActiveDayTab(idx)} className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors ${activeDayTab === idx ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{day}</button>))}</div>
                        <div className="space-y-4">
                            <div><span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">🔥 Prime Time (3.5x)</span><div className="flex flex-wrap gap-1 mt-2">{Array.from({length: 24}, (_, i) => i).map(h => (<button key={h} onClick={() => toggleTierHour('prime', h)} className={`w-8 h-8 text-xs font-bold rounded border ${newScreenData.tierRules[activeDayTab]?.prime?.includes(h) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{h}</button>))}</div></div>
                            <div><span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">⭐ Gold Time (1.8x)</span><div className="flex flex-wrap gap-1 mt-2">{Array.from({length: 24}, (_, i) => i).map(h => (<button key={h} onClick={() => toggleTierHour('gold', h)} className={`w-8 h-8 text-xs font-bold rounded border ${newScreenData.tierRules[activeDayTab]?.gold?.includes(h) ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>{h}</button>))}</div></div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3"><button onClick={() => setIsAddScreenModalOpen(false)} className="px-4 py-2 rounded text-sm font-bold text-slate-500 hover:bg-slate-200">取消</button><button onClick={saveScreenFull} className="px-6 py-2 rounded text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2"><Save size={16}/> {editingScreenId ? '儲存變更' : '建立屏幕'}</button></div>
            </div>
        </div>
      )}
      {/* ... MultiBid Modal (No Change) ... */}
      {selectedSlotGroup && selectedSlotGroup.length > 0 && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]"><div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0"><h3 className="font-bold flex items-center gap-2 text-sm"><Clock size={16}/> 時段詳情: {selectedSlotGroup[0].date} {selectedSlotGroup[0].hour}:00<span className="bg-blue-600 px-2 py-0.5 rounded text-xs ml-2">{selectedSlotGroup.length} 個出價</span></h3><button onClick={() => setSelectedSlotGroup(null)} className="hover:bg-slate-700 p-1 rounded"><span className="text-xl">×</span></button></div><div className="flex-1 overflow-y-auto p-4 space-y-4">{selectedSlotGroup.map((slot, index) => (<div key={slot.orderId} className={`border rounded-lg p-4 flex gap-4 ${index===0 ? 'border-yellow-400 bg-yellow-50 ring-1 ring-yellow-200' : 'border-slate-200'}`}><div className="flex flex-col items-center justify-center min-w-[50px] border-r border-slate-200 pr-4">{index === 0 ? <Trophy className="text-yellow-500 mb-1" size={24}/> : <span className="text-slate-400 font-bold text-lg">#{index+1}</span>}<div className="text-xs font-bold text-slate-500">{slot.price === 'Buyout' ? 'Buyout' : `$${slot.price}`}</div></div><div className="flex-1 min-w-0"><div className="flex justify-between items-start mb-2"><div><div className="font-bold text-slate-800 text-sm">{slot.userEmail}</div><div className="text-xs text-slate-500 font-mono">#{slot.orderId.slice(0,8)}</div></div><StatusBadge status={slot.status} /></div><div className="flex gap-4 mt-3"><div className="w-32 aspect-video bg-black rounded flex items-center justify-center overflow-hidden shrink-0">{slot.videoUrl ? <video src={slot.videoUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] text-white/50">No Video</span>}</div><div className="flex-1 flex flex-col justify-center gap-2">{slot.displayStatus === 'review_needed' && (<button onClick={() => handleReview(slot.orderId, 'approve')} className="w-full bg-red-600 hover:bg-red-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2"><CheckCircle size={14}/> 審核通過</button>)}{slot.displayStatus === 'action_needed' && (<button onClick={() => handleMarkAsScheduled(slot.orderId)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2"><UploadCloud size={14}/> 確認已編排</button>)}{slot.displayStatus === 'bidding' && (<div className="text-xs text-yellow-600 font-bold flex items-center gap-1"><Clock size={12}/> 等待結算中...</div>)}{slot.displayStatus === 'scheduled' && (<div className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> Ready</div>)}</div></div></div></div>))}</div></div></div>)}
    </div>
  );
};

// --- Sub-Components ---
const ConfigSection = ({title, children}) => (<div className="space-y-3"><h4 className="text-sm font-bold text-slate-700 border-b pb-1">{title}</h4><div className="space-y-2">{children}</div></div>);
const ConfigInput = ({ label, val, onChange, desc }) => { const percentage = val ? Math.round((parseFloat(val) - 1) * 100) : 0; const sign = percentage > 0 ? '+' : ''; return (<div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-1"><div className="text-xs font-bold text-slate-600">{label} <span className="text-[10px] font-normal text-slate-400 block">{desc}</span></div><div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${percentage > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>{sign}{percentage}%</span><input type="number" step="0.05" value={val||0} onChange={e=>onChange(e.target.value)} className="w-16 border rounded px-2 py-1 text-sm font-bold text-right outline-none focus:ring-2 focus:ring-blue-500"/></div></div>); };
const StatCard = ({ title, value, icon, bg, border }) => (<div className={`p-4 rounded-xl border ${bg} ${border} flex items-center justify-between shadow-sm`}><div><p className="text-xs font-bold text-slate-500 mb-1 uppercase">{title}</p><p className="text-xl font-bold text-slate-800">{value}</p></div><div className="bg-white p-2 rounded-full shadow-sm">{icon}</div></div>);
const StatusBadge = ({ status }) => { const map = { paid_pending_selection: { label: '競價中', cls: 'bg-purple-100 text-purple-700 border-purple-200' }, won: { label: '競價成功', cls: 'bg-green-100 text-green-700 border-green-200' }, paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700 border-blue-200' }, cancelled: { label: '已取消', cls: 'bg-red-50 text-red-500 border-red-100 line-through' } }; const s = map[status] || { label: status, cls: 'bg-gray-100' }; return <span className={`text-[10px] px-2 py-1 rounded border font-bold ${s.cls}`}>{s.label}</span>; };

export default AdminPanel;