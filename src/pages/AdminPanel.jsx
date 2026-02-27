import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, writeBatch, setDoc, getDoc, deleteDoc, addDoc, serverTimestamp, where 
} from "firebase/firestore";
import { 
  ref, uploadBytes, getDownloadURL 
} from "firebase/storage"; 
import { 
  LayoutDashboard, List, Settings, Video, Monitor, TrendingUp, Calendar, Gavel, Flag, Globe, Plus, DollarSign, Briefcase 
} from 'lucide-react';
import { db, auth, storage } from '../firebase'; 
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { sendBidConfirmation, sendBidLostEmail } from '../utils/emailService';
import { useLanguage } from '../context/LanguageContext';

import { LoadingScreen, ScreenModal, SlotGroupModal } from '../components/AdminUI';
import { 
  DashboardView, OrdersView, ReviewView, AnalyticsView, ConfigView, CalendarView, RulesView, ScreensView,
  FinancialConfigView, PlatformOwnerSettlementView, MerchantSettlementView 
} from '../components/AdminTabs';
import AdminManualOrder from '../components/AdminManualOrder';

// --- 👑 權限及常數設定 ---
const ADMIN_EMAILS = ["hauyeeee@gmail.com"];
const PLATFORM_BOSS_EMAILS = ["powerbankboss@gmail.com"]; // 充電寶老闆專用登入
const EMPTY_DAY_RULE = { prime: [], gold: [] };
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminPanel = () => {
  const { t, lang, toggleLanguage } = useLanguage(); 
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); // 'admin' | 'boss' | 'merchant'
  
  // --- Data States ---
  const [orders, setOrders] = useState([]);
  const [screens, setScreens] = useState([]);
  const [specialRules, setSpecialRules] = useState([]);
  
  // --- Config States ---
  const [globalPricingConfig, setGlobalPricingConfig] = useState({});
  const [activeConfig, setActiveConfig] = useState({}); 
  const [selectedConfigTarget, setSelectedConfigTarget] = useState('global'); 
  const [localBundleRules, setLocalBundleRules] = useState([]); 

  // --- UI States ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState("");
  
  const [selectedStatScreens, setSelectedStatScreens] = useState(new Set()); 
  const [selectedAnalyticsHours, setSelectedAnalyticsHours] = useState(new Set()); 
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());        
  const [editingScreens, setEditingScreens] = useState({});
  
  // --- Modals States ---
  const [isAddScreenModalOpen, setIsAddScreenModalOpen] = useState(false);
  const [editingScreenId, setEditingScreenId] = useState(null);
  const [activeDayTab, setActiveDayTab] = useState(1);
  const [selectedSlotGroup, setSelectedSlotGroup] = useState(null); 
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // --- 財務配置 State ---
  const [financialConfig, setFinancialConfig] = useState({
    costFactor: 0.5,        
    partnerPoolRatio: 0.3,  
    merchantRatioOfPool: 0.5,
    screenOverrides: {}
  });
  
  const [newScreenData, setNewScreenData] = useState({
    name: '', location: '', district: '', basePrice: 50, images: ['', '', ''], specifications: '', mapUrl: '', bundleGroup: '',
    merchantEmail: '', // 綁定商家專用電郵
    footfall: '', audience: '', operatingHours: '', resolution: '', lat: '', lng: '', 
    tierRules: { 0: {...EMPTY_DAY_RULE}, 1: {...EMPTY_DAY_RULE}, 2: {...EMPTY_DAY_RULE}, 3: {...EMPTY_DAY_RULE}, 4: {...EMPTY_DAY_RULE}, 5: {...EMPTY_DAY_RULE}, 6: {...EMPTY_DAY_RULE} }
  });

  const [calendarDate, setCalendarDate] = useState(new Date()); 
  const [calendarViewMode, setCalendarViewMode] = useState('month'); 
  const [newRule, setNewRule] = useState({ screenId: 'all', date: '', hoursStr: '', action: 'price_override', overridePrice: '', note: '' });

  // --- 1. 權限認證與資料讀取 ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) { navigate("/"); return; }
      
      const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
      
      // 判斷身份
      let role = 'merchant'; 
      if (ADMIN_EMAILS.includes(userEmail)) {
          role = 'admin';
      } else if (PLATFORM_BOSS_EMAILS.includes(userEmail)) {
          role = 'boss';
      }
      
      setUserRole(role);
      setUser(currentUser);
      
      // 根據身份跳轉去對應嘅 Tab
      if (role === 'boss') setActiveTab('platform_settle');
      if (role === 'merchant') setActiveTab('merchant_settle');
      
      fetchAllData();
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllData = () => {
      setLoading(true);

      // 🔥 讀取 Orders (加入 Error 攔截，防止 Firebase Block 導致卡死)
      const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), 
      (snap) => {
          setOrders(snap.docs.map(d => ({ 
              id: d.id, 
              ...d.data(), 
              createdAtDate: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date() 
          })));
          setLoading(false);
      }, 
      (error) => {
          console.error("Firebase Orders Error:", error);
          alert("⚠️ 無法讀取訂單數據！如果持續發生，請檢查 Firebase Security Rules 權限設定。");
          setLoading(false); // 發生錯誤都要解除 Loading！
      });

      // 讀取財務配置
      getDoc(doc(db, "system_config", "financials"))
          .then(docSnap => {
              if (docSnap.exists()) {
                  setFinancialConfig(docSnap.data());
              }
          })
          .catch(err => console.error("Financial Config Error:", err));

      // 讀取 Screens
      const unsubScreens = onSnapshot(query(collection(db, "screens"), orderBy("id")), 
      (snap) => {
          const sorted = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a,b) => Number(a.id) - Number(b.id));
          setScreens(sorted);
      }, 
      (error) => console.error("Screens Error:", error));

      // 讀取特殊規則
      const unsubRules = onSnapshot(collection(db, "special_rules"), 
      (snap) => { 
          setSpecialRules(snap.docs.map(d => ({ id: d.id, ...d.data() }))); 
      }, 
      (error) => console.error("Rules Error:", error));

      // 讀取定價設定
      getDoc(doc(db, "system_config", "pricing_rules"))
          .then(docSnap => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  setGlobalPricingConfig(data);
                  setActiveConfig(data);
                  if (data.bundleRules) {
                      setLocalBundleRules(data.bundleRules.map(r => ({ screensStr: r.screens.join(','), multiplier: r.multiplier })));
                  }
              }
          })
          .catch(err => console.error("Pricing Config Error:", err));

      return () => { unsubOrders(); unsubScreens(); unsubRules(); };
  };

  // --- API Handlers ---
  const saveFinancialConfig = async () => {
      try {
          await setDoc(doc(db, "system_config", "financials"), financialConfig);
          alert("✅ 財務分成比例已成功更新並儲存！");
      } catch (e) {
          console.error(e);
          alert("❌ 儲存失敗：" + e.message);
      }
  };

  const handleWithdrawRequest = async (requestData) => {
      try {
          await addDoc(collection(db, "withdrawal_requests"), {
              ...requestData,
              userEmail: user.email,
              status: 'pending',
              createdAt: serverTimestamp()
          });
          alert("✅ 提現申請已提交，請耐心等候至少 3 個工作天處理轉帳。");
      } catch (e) {
          console.error(e);
          alert("❌ 提交失敗，請檢查網絡連線");
      }
  };

  // --- Logic Helpers (已還原為易讀格式) ---
  const customerHistory = useMemo(() => { 
      const h = {}; 
      if (orders) {
          orders.forEach(o => { 
              if (o.userEmail) { 
                  if(!h[o.userEmail]) h[o.userEmail] = 0; 
                  h[o.userEmail]++; 
              }
          }); 
      }
      return h; 
  }, [orders]);
  
  const stats = useMemo(() => {
    let totalRevenue = 0, validOrders = 0, pendingReview = 0, dailyRevenue = {}, statusCount = {};
    if (orders) {
        orders.forEach(order => {
            statusCount[order.status || 'unknown'] = (statusCount[order.status || 'unknown'] || 0) + 1;
            
            const needsReview = order.creativeStatus === 'pending_review' || 
                (order.hasVideo && !order.creativeStatus && !order.isApproved && !order.isRejected && order.status !== 'cancelled');
            
            if (needsReview) pendingReview++;
            
            if (['paid', 'won', 'completed', 'paid_pending_selection', 'partially_outbid', 'partially_won'].includes(order.status)) {
                totalRevenue += Number(order.amount) || 0; 
                validOrders++;
                if (order.createdAtDate) {
                    const dateKey = order.createdAtDate.toISOString().split('T')[0];
                    dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + Number(order.amount);
                }
            }
        });
    }
    return { 
        totalRevenue, 
        totalOrders: orders.length, 
        validOrders, 
        pendingReview, 
        dailyChartData: Object.keys(dailyRevenue).sort().map(d => ({ date: d.substring(5), amount: dailyRevenue[d] })), 
        statusChartData: Object.keys(statusCount).map(k => ({ name: k, value: statusCount[k] })) 
    };
  }, [orders]);

  const realMarketStats = useMemo(() => {
      const statsMap = {}; 
      for(let d=0; d<7; d++) { 
          for(let h=0; h<24; h++) { 
              statsMap[`${d}-${h}`] = { dayOfWeek: d, hour: h, totalAmount: 0, totalBids: 0 }; 
          } 
      }

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
      
      return { 
          rows: displayRows, 
          summary: { 
              avgPrice: selectionTotalBids > 0 ? Math.round(selectionTotalAmount / selectionTotalBids) : 0, 
              totalBids: selectionTotalBids 
          } 
      };
  }, [orders, selectedStatScreens, selectedAnalyticsHours]);

  const monthViewData = useMemo(() => {
      const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1); 
      const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0); 
      const days = {}; 
      
      for(let d = 1; d <= endOfMonth.getDate(); d++) { 
          const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; 
          days[dateStr] = { count: 0, pending: 0, scheduled: 0, bidding: 0, action: 0 }; 
      }

      orders.forEach(order => { 
          if (!['paid', 'won', 'paid_pending_selection', 'partially_outbid', 'partially_won'].includes(order.status) || !order.detailedSlots) return; 
          
          order.detailedSlots.forEach(slot => { 
              if(days[slot.date]) { 
                  days[slot.date].count++; 
                  const isBidding = ['paid_pending_selection', 'partially_outbid'].includes(order.status);
                  const isReview = order.creativeStatus === 'pending_review' || (order.hasVideo && !order.creativeStatus && !order.isApproved && !order.isRejected && order.status !== 'cancelled');
                  const isScheduled = order.isScheduled;
                  const isWon = ['won', 'paid', 'partially_won'].includes(order.status);

                  if (isBidding) days[slot.date].bidding++;
                  else if (isReview) days[slot.date].pending++;
                  else if (isScheduled) days[slot.date].scheduled++;
                  else if (isWon) days[slot.date].action++;
              } 
          }); 
      });
      return days;
  }, [orders, calendarDate]);

  const dayViewGrid = useMemo(() => {
    const grid = {}; 
    const targetDateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(calendarDate.getDate()).padStart(2,'0')}`;
    
    orders.forEach(order => { 
        if (!['paid', 'won', 'paid_pending_selection', 'partially_outbid', 'partially_won'].includes(order.status) || !order.detailedSlots) return; 
        
        order.detailedSlots.forEach(slot => { 
            if (slot.date !== targetDateStr) return; 
            
            const key = `${slot.hour}-${slot.screenId}`; 
            let status = 'normal'; 
            
            if (order.status === 'paid_pending_selection') status = 'bidding'; 
            else if (order.creativeStatus === 'pending_review' || (order.hasVideo && !order.creativeStatus && !order.isApproved)) status = 'review_needed'; 
            else if (order.isScheduled) status = 'scheduled'; 
            else if (order.status === 'won' || order.status === 'paid' || order.status === 'partially_won') status = 'action_needed'; 
            
            const slotData = { 
                ...slot, 
                orderId: order.id, 
                userEmail: order.userEmail, 
                videoUrl: order.videoUrl, 
                status: order.status, 
                creativeStatus: order.creativeStatus, 
                isScheduled: order.isScheduled, 
                displayStatus: status, 
                price: order.type === 'bid' ? (slot.bidPrice || 0) : 'Buyout', 
                priceVal: order.type === 'bid' ? (parseInt(slot.bidPrice) || 0) : 999999 
            }; 
            
            if (!grid[key]) grid[key] = []; 
            grid[key].push(slotData); 
        }); 
    });

    Object.keys(grid).forEach(key => { 
        grid[key].sort((a, b) => b.priceVal - a.priceVal); 
    });

    return grid;
  }, [orders, calendarDate]);

  const filteredOrders = useMemo(() => { 
      return orders.filter(o => { 
          if (activeTab === 'review') { 
              return o.creativeStatus === 'pending_review' || (o.hasVideo && !o.creativeStatus && !o.isApproved && !o.isRejected && o.status !== 'cancelled'); 
          } 
          const matchesSearch = (o.id||'').toLowerCase().includes(searchTerm.toLowerCase()) || (o.userEmail||'').toLowerCase().includes(searchTerm.toLowerCase()); 
          const matchesStatus = statusFilter === 'all' || o.status === statusFilter; 
          return matchesSearch && matchesStatus; 
      }); 
  }, [orders, activeTab, searchTerm, statusFilter]);


  // --- Event Handlers (完全展開版) ---
  
  const handleScreenImageUpload = async (file, index) => {
      if (!file) return;
      setIsUploadingImage(true);
      try {
          const storageRef = ref(storage, `screen_images/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          
          const newImages = [...newScreenData.images];
          newImages[index] = downloadURL;
          setNewScreenData({ ...newScreenData, images: newImages });
          
          alert("✅ 圖片上傳成功！");
      } catch (error) {
          console.error("Upload Error:", error);
          alert("❌ 上傳失敗: " + error.message);
      } finally { 
          setIsUploadingImage(false); 
      }
  };

  const handleAutoResolve = async () => {
      if (!confirm(t('alert_confirm_resolve'))) return;
      setLoading(true);

      try {
          const q = query(collection(db, "orders"), where("status", "in", ["paid_pending_selection", "partially_outbid", "outbid_needs_action", "won", "lost"]));
          const snapshot = await getDocs(q);
          const allOrders = snapshot.docs.map(d => {
              const data = d.data();
              let timeVal;
              if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
                  timeVal = data.createdAt.toMillis();
              } else if (data.createdAt instanceof Date) {
                  timeVal = data.createdAt.getTime();
              } else {
                  timeVal = Date.now(); 
              }
              return { id: d.id, ...data, timeVal };
          });

          const slotWars = {};

          allOrders.forEach(order => {
              if(!order.detailedSlots || !Array.isArray(order.detailedSlots)) return;
              
              order.detailedSlots.forEach(slot => {
                  if (!slot.date || !slot.screenId) return;

                  const hourInt = parseInt(slot.hour);
                  const screenIdStr = String(slot.screenId);
                  const key = `${slot.date}-${hourInt}-${screenIdStr}`;
                  
                  const myPrice = parseInt(slot.bidPrice) || 0;
                  const myTime = order.timeVal;

                  if (!slotWars[key]) {
                      slotWars[key] = { maxPrice: myPrice, timeVal: myTime, winnerOrderId: order.id, winnerEmail: order.userEmail };
                  } else {
                      const currentKing = slotWars[key];
                      if (myPrice > currentKing.maxPrice) {
                          slotWars[key] = { maxPrice: myPrice, timeVal: myTime, winnerOrderId: order.id, winnerEmail: order.userEmail };
                      } 
                      else if (myPrice === currentKing.maxPrice) {
                          if (myTime < currentKing.timeVal) {
                              slotWars[key] = { maxPrice: myPrice, timeVal: myTime, winnerOrderId: order.id, winnerEmail: order.userEmail };
                          }
                      }
                  }
              });
          });

          const batch = writeBatch(db);
          let updateCount = 0;

          allOrders.forEach(order => {
              if(!order.detailedSlots || !Array.isArray(order.detailedSlots)) return;
              
              let winCount = 0;
              let loseCount = 0;
              let newDetailedSlots = [...order.detailedSlots];
              let hasChange = false;

              newDetailedSlots = newDetailedSlots.map(slot => {
                  const hourInt = parseInt(slot.hour);
                  const screenIdStr = String(slot.screenId);
                  const key = `${slot.date}-${hourInt}-${screenIdStr}`;
                  
                  const winner = slotWars[key];
                  let newSlotStatus = 'normal';

                  if (winner) {
                      if (winner.winnerOrderId !== order.id) { 
                          loseCount++; 
                          newSlotStatus = 'outbid'; 
                      } else { 
                          winCount++; 
                          newSlotStatus = 'winning'; 
                      }
                  }
                  if (slot.slotStatus !== newSlotStatus) { 
                      hasChange = true; 
                  }
                  return { ...slot, slotStatus: newSlotStatus };
              });

              let newStatus = order.status;
              if (loseCount > 0 && winCount === 0) {
                  newStatus = 'outbid_needs_action'; 
              } else if (loseCount > 0 && winCount > 0) {
                  newStatus = 'partially_outbid'; 
              } else if (loseCount === 0 && winCount > 0) {
                  if (newStatus !== 'paid' && newStatus !== 'completed' && newStatus !== 'won') {
                      newStatus = 'paid_pending_selection'; 
                  }
              }

              if (hasChange || newStatus !== order.status) {
                  const orderRef = doc(db, "orders", order.id);
                  batch.update(orderRef, { detailedSlots: newDetailedSlots, status: newStatus, lastUpdated: serverTimestamp() });
                  updateCount++;
              }
          });

          await batch.commit();
          alert(t('alert_resolve_success'));

      } catch (error) { 
          console.error("Auto Resolve Error:", error); 
          alert(`Error: ${error.message}`); 
      } finally { 
          setLoading(false); 
      }
  };

  const handleFinalizeAuction = async () => {
      if(!confirm(t('alert_confirm_finalize'))) return; 
      setLoading(true);
      try {
          const q = query(collection(db, "orders"), where("status", "==", "outbid_needs_action"));
          const snapshot = await getDocs(q); 
          const batch = writeBatch(db); 
          let count = 0; 
          const now = new Date();
          
          for(const d of snapshot.docs) {
              const o = d.data();
              if(o.detailedSlots && o.detailedSlots.length > 0) {
                  const allSlotsExpired = o.detailedSlots.every(s => { 
                      const slotTime = new Date(`${s.date} ${String(s.hour).padStart(2,'0')}:00`); 
                      return now > slotTime; 
                  });
                  if (allSlotsExpired) {
                      batch.update(doc(db,"orders",d.id), {status:'lost', finalizedAt: serverTimestamp()});
                      await sendBidLostEmail({email:o.userEmail, displayName:o.userName}, {id:d.id});
                      count++;
                  }
              }
          }
          if(count > 0) { 
              await batch.commit(); 
              alert(t('alert_finalize_success')); 
          } else {
              alert(t('alert_no_expired'));
          }
      } catch(e) { 
          console.error(e); 
          alert("Failed"); 
      } finally { 
          setLoading(false); 
      }
  };

  const handleReview = async (id, action) => { 
      if(!confirm(`Confirm ${action}?`)) return; 
      try { 
          await updateDoc(doc(db,"orders",id), { 
              creativeStatus: action === 'approve' ? 'approved' : 'rejected', 
              isApproved: action === 'approve', 
              isRejected: action !== 'approve', 
              reviewNote: action !== 'approve' ? reviewNote : '' 
          }); 
          
          const o = orders.find(x=>x.id===id);
          const userInfo = {email: o.userEmail, displayName: o.userName};

          if(action === 'approve') { 
              await sendBidConfirmation(userInfo, o, 'video_approved'); 
          } else {
              await sendBidConfirmation(userInfo, o, 'video_rejected', reviewNote);
          }
          alert("Processed successfully"); 
      } catch(e){ 
          console.error(e);
          alert("Error processing review"); 
      } 
  };

  const handleMarkAsScheduled = async (id) => { 
      if(confirm("Mark as scheduled?")) {
          await updateDoc(doc(db,"orders",id), {isScheduled:true, scheduledAt: new Date()}); 
          alert("Scheduled");
      }
  };

  const handleBulkAction = async (act) => { 
      if(confirm('Confirm bulk action?')) { 
          const b = writeBatch(db); 
          selectedOrderIds.forEach(id => {
              if(act === 'cancel') b.update(doc(db,"orders",id),{status:'cancelled'});
          }); 
          await b.commit(); 
          alert("Done"); 
          setSelectedOrderIds(new Set()); 
      }
  };

  const handleDeleteOrder = async (id) => { 
      if(confirm("Cancel order?")) {
          await updateDoc(doc(db,"orders",id),{status:'cancelled'}); 
      }
  };
  
  const handleAddRule = async () => { 
      if(!newRule.date) return alert("Date is required"); 
      let hours = []; 
      if(!newRule.hoursStr) {
          hours = Array.from({length:24},(_,i)=>i); 
      } else {
          hours = newRule.hoursStr.split(',').map(Number); 
      }
      
      await addDoc(collection(db,"special_rules"),{
          ...newRule, 
          hours, 
          type: newRule.action, 
          value: parseFloat(newRule.overridePrice)
      }); 
      alert("Done"); 
  };

  const handleDeleteRule = async (id) => { 
      if(confirm("Delete rule?")) {
          await deleteDoc(doc(db,"special_rules",id)); 
      }
  };

  const savePricingConfig = async () => { 
      const rules = localBundleRules.map(r => ({
          screens: r.screensStr.split(','), 
          multiplier: parseFloat(r.multiplier)
      })); 
      
      if (selectedConfigTarget === 'global') {
          await setDoc(doc(db,"system_config","pricing_rules"), {...activeConfig, bundleRules:rules}); 
          setGlobalPricingConfig(activeConfig);
      } else {
          const s = screens.find(x => String(x.id) === selectedConfigTarget); 
          await updateDoc(doc(db,"screens",s.firestoreId), {customPricing:activeConfig});
      } 
      alert(t('alert_saved')); 
  };

  const handleAddBundleRule = () => {
      setLocalBundleRules([...localBundleRules, {screensStr:"", multiplier:1.2}]);
  };
  
  const handleBundleRuleChange = (i,f,v) => { 
      const n = [...localBundleRules]; 
      n[i][f] = v; 
      setLocalBundleRules(n); 
  };
  
  const handleRemoveBundleRule = (i) => { 
      const n = [...localBundleRules]; 
      n.splice(i,1); 
      setLocalBundleRules(n); 
  };
  
  const handleCopyScreen = (screenToCopy) => { 
      const copiedData = JSON.parse(JSON.stringify(screenToCopy)); 
      delete copiedData.firestoreId; 
      delete copiedData.id; 
      copiedData.name = `${copiedData.name} (Copy)`; 
      copiedData.isActive = true; 
      setNewScreenData(copiedData); 
      setEditingScreenId(null); 
      setIsAddScreenModalOpen(true); 
  };

  const handleAddScreen = () => { 
      setIsAddScreenModalOpen(true); 
      setEditingScreenId(null); 
      setNewScreenData({
          name: '', location: '', district: '', basePrice: 50, images: ['', '', ''], specifications: '', mapUrl: '', bundleGroup: '', merchantEmail: '', footfall: '', audience: '', operatingHours: '', resolution: '', lat: '', lng: '', 
          tierRules: { 0: {...EMPTY_DAY_RULE}, 1: {...EMPTY_DAY_RULE}, 2: {...EMPTY_DAY_RULE}, 3: {...EMPTY_DAY_RULE}, 4: {...EMPTY_DAY_RULE}, 5: {...EMPTY_DAY_RULE}, 6: {...EMPTY_DAY_RULE} }
      }); 
  };

  const handleEditScreenFull = (s) => { 
      let rules = s.tierRules || {}; 
      if (rules.default && !rules[0]) { 
          let r = rules.default; 
          rules = {}; 
          for(let i=0; i<7; i++) rules[i] = r; 
      } 
      setNewScreenData({ ...s, tierRules: rules, images: s.images||['','',''] }); 
      setEditingScreenId(s.firestoreId); 
      setIsAddScreenModalOpen(true); 
  };

  // 🔥 已修正的 saveScreenFull (強制轉 String ID)
  const saveScreenFull = async () => { 
      try {
          const p = { 
              ...newScreenData, 
              merchantEmail: (newScreenData.merchantEmail || '').toLowerCase().trim(),
              basePrice: parseFloat(newScreenData.basePrice), 
              lat: parseFloat(newScreenData.lat) || null, 
              lng: parseFloat(newScreenData.lng) || null, 
              images: newScreenData.images.filter(x=>x), 
              lastUpdated: serverTimestamp() 
          };
          delete p.firestoreId; 
          
          if(editingScreenId) { 
              // 確保編輯時更新的 ID 也是 String
              p.id = String(p.id || editingScreenId.replace('screen_', ''));
              await setDoc(doc(db,"screens",editingScreenId), p, { merge: true }); 
          } else {
              const existingIds = screens.map(s => { 
                  const internalId = parseInt(s.id); 
                  const docId = s.firestoreId && s.firestoreId.startsWith('screen_') ? parseInt(s.firestoreId.replace('screen_', '')) : 0; 
                  return Math.max(isNaN(internalId)?0:internalId, isNaN(docId)?0:docId); 
              });
              const nextId = (existingIds.length > 0 ? Math.max(...existingIds) : 0) + 1;
              const newDocId = `screen_${String(nextId).padStart(3, '0')}`;
              
              await setDoc(doc(db, "screens", newDocId), { 
                  ...p, 
                  id: String(nextId), // 強制 String
                  createdAt: serverTimestamp(), 
                  isActive: true 
              });
          }
          alert(t('alert_saved')); 
          setIsAddScreenModalOpen(false); 
      } catch (e) { 
          console.error("Save Error", e); 
          alert("Save Failed: " + e.message); 
      }
  };

  const toggleScreenActive = async (s) => { 
      if(confirm("Toggle Active Status?")) {
          await updateDoc(doc(db,"screens",s.firestoreId),{isActive:!s.isActive}); 
      }
  };

  const handleScreenChange = (fid,f,v) => {
      setEditingScreens(p=>({...p, [fid]:{...p[fid], [f]:v}}));
  };

  const saveScreenSimple = async (s) => { 
      const d = editingScreens[s.firestoreId]; 
      if(d){ 
          if(d.basePrice) d.basePrice = parseFloat(d.basePrice); 
          await updateDoc(doc(db,"screens",s.firestoreId), d); 
          alert(t('alert_saved')); 
          setEditingScreens(p => { 
              const n={...p}; 
              delete n[s.firestoreId]; 
              return n; 
          }); 
      }
  };

  if (loading) return <LoadingScreen />;

  // 🔥 權限隔離：定義所有的 Tabs 導航
  const ADMIN_TABS = [
      { id: 'dashboard', icon: <LayoutDashboard size={16}/>, label: t('tab_dashboard') },
      { id: 'financial_config', icon: <Briefcase size={16}/>, label: '財務分成配置' }, 
      { id: 'platform_settle', icon: <DollarSign size={16}/>, label: '平台分成結算' }, 
      { id: 'merchant_settle', icon: <Briefcase size={16}/>, label: '商家專屬結算' }, 
      { id: 'orders', icon: <List size={16}/>, label: t('tab_orders') },
      { id: 'review', icon: <Video size={16}/>, label: `${t('tab_review')} (${stats.pendingReview})`, alert: stats.pendingReview > 0 },
      { id: 'screens', icon: <Monitor size={16}/>, label: t('tab_screens') },
      { id: 'calendar', icon: <Calendar size={16}/>, label: t('tab_calendar') },
      { id: 'manualOrder', icon: <Plus size={16}/>, label: '手動加單/排期' },
      { id: 'analytics', icon: <TrendingUp size={16}/>, label: t('tab_analytics') },
      { id: 'rules', icon: <Settings size={16}/>, label: t('tab_rules') },
      { id: 'config', icon: <Settings size={16}/>, label: t('tab_config') }
  ];

  // 🔥 權限隔離：過濾用戶可見的 Tabs
  const VISIBLE_TABS = ADMIN_TABS.filter(tab => {
      if (userRole === 'admin') return true; 
      if (userRole === 'boss') return tab.id === 'platform_settle'; 
      if (userRole === 'merchant') return tab.id === 'merchant_settle'; 
      return false;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="bg-slate-900 text-white px-2 py-1 rounded text-xs">ADMIN</span> DOOH {t('admin_title')}
            </h1>
            <div className="flex gap-2">
                <button onClick={toggleLanguage} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded font-bold flex items-center gap-1 hover:bg-slate-200">
                    <Globe size={16}/> {lang === 'zh' ? 'EN' : '繁'}
                </button>
                {userRole === 'admin' && (
                    <button onClick={handleAutoResolve} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-purple-700 shadow-lg">
                        <Gavel size={16}/> {t('btn_smart_resolve')}
                    </button>
                )}
                {userRole === 'admin' && (
                    <button onClick={handleFinalizeAuction} className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-red-700 shadow-lg">
                        <Flag size={16}/> {t('btn_finalize')}
                    </button>
                )}
                <button onClick={() => signOut(auth)} className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded hover:bg-red-100 transition-colors">
                    {t('logout')}
                </button>
            </div>
        </div>

        {/* Tab 導航按鈕 */}
        <div className="flex flex-wrap gap-2">
            {VISIBLE_TABS.map(tab => (
                <button 
                    key={tab.id} 
                    onClick={() => { setActiveTab(tab.id); setSelectedOrderIds(new Set()); }} 
                    className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border'}`}
                >
                    {tab.icon} {tab.label} 
                    {tab.alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
            ))}
        </div>

        {/* 渲染各個 Views */}
        {activeTab === 'dashboard' && <DashboardView stats={stats} COLORS={COLORS} />}
        
        {/* 新增財務相關 Views */}
        {activeTab === 'financial_config' && <FinancialConfigView config={financialConfig} setConfig={setFinancialConfig} onSave={saveFinancialConfig} screens={screens} />}
        
        {activeTab === 'platform_settle' && <PlatformOwnerSettlementView stats={stats} config={financialConfig} orders={orders} screens={screens} onWithdrawRequest={handleWithdrawRequest} />}
        
        {/* 商家專屬結算視圖：傳遞過濾後的 Screens */}
        {activeTab === 'merchant_settle' && (
            <MerchantSettlementView 
                stats={stats} 
                config={financialConfig} 
                orders={orders} 
                screens={userRole === 'admin' ? screens : screens.filter(s => s.merchantEmail === user.email)} 
                userRole={userRole}
                onWithdrawRequest={handleWithdrawRequest} 
            />
        )}
        
        {/* 原有 Views */}
        {activeTab === 'orders' && <OrdersView orders={filteredOrders} selectedIds={selectedOrderIds} onSelect={setSelectedOrderIds} onBulkAction={handleBulkAction} customerHistory={customerHistory} statusFilter={statusFilter} setStatusFilter={setStatusFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onDeleteOrder={handleDeleteOrder} />}
        
        {activeTab === 'review' && <ReviewView orders={filteredOrders} onReview={handleReview} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
        
        {activeTab === 'analytics' && <AnalyticsView stats={realMarketStats} screens={screens} selectedScreens={selectedStatScreens} setSelectedScreens={setSelectedStatScreens} selectedHours={selectedAnalyticsHours} setSelectedHours={setSelectedAnalyticsHours} />}
        
        {activeTab === 'config' && <ConfigView config={activeConfig} setConfig={setActiveConfig} globalConfig={globalPricingConfig} setGlobal={setGlobalPricingConfig} target={selectedConfigTarget} setTarget={setSelectedConfigTarget} screens={screens} localRules={localBundleRules} setLocalRules={setLocalBundleRules} onSave={savePricingConfig} onAddRule={handleAddBundleRule} onRuleChange={handleBundleRuleChange} onRemoveRule={handleRemoveBundleRule} />}
        
        {activeTab === 'rules' && <RulesView rules={specialRules} screens={screens} newRule={newRule} setNewRule={setNewRule} onAdd={handleAddRule} onDelete={handleDeleteRule} />}
        
        {activeTab === 'screens' && <ScreensView screens={screens} editingScreens={editingScreens} onAdd={handleAddScreen} onEditFull={handleEditScreenFull} onCopy={handleCopyScreen} onSaveSimple={saveScreenSimple} onChange={handleScreenChange} onToggle={toggleScreenActive} />}
        
        {activeTab === 'calendar' && <CalendarView date={calendarDate} setDate={setCalendarDate} mode={calendarViewMode} setMode={setCalendarViewMode} monthData={monthViewData} dayGrid={dayViewGrid} screens={screens} onSelectSlot={setSelectedSlotGroup} onPrev={() => { const d = new Date(calendarDate); if(calendarViewMode==='month') d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-1); setCalendarDate(d); }} onNext={() => { const d = new Date(calendarDate); if(calendarViewMode==='month') d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+1); setCalendarDate(d); }} />}
        
        {activeTab === 'manualOrder' && <AdminManualOrder screens={screens} />}

        {/* Modals */}
        <ScreenModal 
            isOpen={isAddScreenModalOpen} 
            onClose={() => setIsAddScreenModalOpen(false)} 
            isEdit={!!editingScreenId} 
            data={newScreenData} 
            setData={setNewScreenData} 
            handleApplyToAllDays={() => {
                const r = newScreenData.tierRules; 
                for(let i=0; i<7; i++) r[i] = JSON.parse(JSON.stringify(r[activeDayTab])); 
                setNewScreenData({...newScreenData, tierRules:r});
            }} 
            toggleTierHour={(t,h) => {
                const r = {...newScreenData.tierRules}; 
                const d = r[activeDayTab][t]; 
                if(d.includes(h)) {
                    r[activeDayTab][t] = d.filter(x => x !== h); 
                } else {
                    r[activeDayTab][t] = [...d,h]; 
                }
                setNewScreenData({...newScreenData, tierRules:r});
            }} 
            activeDayTab={activeDayTab} 
            setActiveDayTab={setActiveDayTab} 
            onSave={saveScreenFull} 
            onImageUpload={handleScreenImageUpload} 
            isUploading={isUploadingImage} 
        />
        
        <SlotGroupModal 
            group={selectedSlotGroup} 
            onClose={() => setSelectedSlotGroup(null)} 
            onReview={handleReview} 
            onMarkScheduled={handleMarkAsScheduled} 
        />
      
      </div>
    </div>
  );
};

export default AdminPanel;