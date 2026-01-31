import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Monitor, 
  DollarSign, Loader2, MapPin, 
  TrendingUp, Search, LogIn,
  Zap, Layers, Sparkles, Ban, HelpCircle, Gavel, CalendarDays, Repeat, Map as MapIcon, Lock, Info, AlertTriangle
} from 'lucide-react';

// 🔥 清理：移除多餘的 initializeApp import，只保留需要的 SDK 方法
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// Imports
import { auth, db, storage, googleProvider } from './firebase'; 
import ScreenDetailModal from './components/ScreenDetailModal';
import MyOrdersModal from './components/MyOrdersModal';
import BiddingModal from './components/BiddingModal';
import BuyoutModal from './components/BuyoutModal';
import LoginModal from './components/LoginModal';
import UrgentUploadModal from './components/UrgentUploadModal';

// Utils
import { initEmailService, sendBidConfirmation } from './utils/emailService';
import { calculateDynamicPrice } from './utils/pricingEngine';

const DOOHBiddingSystem = () => {
  // --- States ---
  const [user, setUser] = useState(null); 
  const [isAuthReady, setIsAuthReady] = useState(false); 
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  
  const [screens, setScreens] = useState([]);
  const [isScreensLoading, setIsScreensLoading] = useState(true);

  // Pricing Config & Special Rules States
  const [pricingConfig, setPricingConfig] = useState({}); 
  const [specialRules, setSpecialRules] = useState([]);

  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [previewDate, setPreviewDate] = useState(new Date()); 

  const [selectedScreens, setSelectedScreens] = useState(new Set([1])); 
  const [selectedHours, setSelectedHours] = useState(new Set());
  
  const [mode, setMode] = useState('specific'); 
  const [selectedWeekdays, setSelectedWeekdays] = useState(new Set()); 
  const [weekCount, setWeekCount] = useState(4); 
  const [selectedSpecificDates, setSelectedSpecificDates] = useState(new Set()); 

  const [existingBids, setExistingBids] = useState({});
  const [slotBids, setSlotBids] = useState({}); 
  const [batchBidInput, setBatchBidInput] = useState(''); 
  const [screenSearchTerm, setScreenSearchTerm] = useState(''); 
  const [viewingScreen, setViewingScreen] = useState(null);

  // Global Lock & Market Stats
  const [occupiedSlots, setOccupiedSlots] = useState(new Set());
  const [marketStats, setMarketStats] = useState({}); 

  const [toast, setToast] = useState(null);
  const [transactionStep, setTransactionStep] = useState('idle');
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [creativeStatus, setCreativeStatus] = useState('empty');
  const [creativeName, setCreativeName] = useState('');
  const [isUrgentUploadModalOpen, setIsUrgentUploadModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingReal, setIsUploadingReal] = useState(false);
  
  // Payment Status Logic
  const [modalPaymentStatus, setModalPaymentStatus] = useState('pending'); 
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isBuyoutModalOpen, setIsBuyoutModalOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false); 
  const [emailStatus, setEmailStatus] = useState('idle'); 
  
  // Ref to prevent duplicate emails locally
  const emailSentRef = useRef(false);

  const HOURS = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${String(i).padStart(2, '0')}:00` }));
  const WEEKDAYS_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

  // --- Helper Functions ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); 
  const formatDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // 預訂期由 90 天縮短為 60 天
  const isDateAllowed = (year, month, day) => { 
      const checkDate = new Date(year, month, day); 
      const today = new Date(); today.setHours(0,0,0,0); 
      const maxDate = new Date(); maxDate.setDate(today.getDate() + 60); 
      return checkDate >= today && checkDate <= maxDate; 
  };

  const getHourTier = (h) => {
      let hasPrime = false;
      let hasGold = false;
      if (selectedScreens.size === 0) return 'normal';
      const currentDayKey = String(previewDate.getDay());
      selectedScreens.forEach(id => {
          const s = screens.find(sc => sc.id == id);
          if (s && s.tierRules) {
              let rules = s.tierRules[currentDayKey];
              if (!rules) rules = s.tierRules["default"];
              if (rules) {
                  if (rules.prime?.includes(h)) hasPrime = true;
                  if (rules.gold?.includes(h)) hasGold = true;
              }
          } else {
              if (h >= 22 || h < 2) hasPrime = true;
              else if (h >= 18 && h < 22) hasGold = true;
          }
      });
      if (hasPrime) return 'prime';
      if (hasGold) return 'gold';
      return 'normal';
  };

  // --- Effects ---
  useEffect(() => {
    initEmailService(); 
    
    const fetchScreens = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "screens"));
        const screensData = querySnapshot.docs.map(doc => ({ id: doc.data().id, ...doc.data() }));
        screensData.sort((a, b) => a.id - b.id);
        setScreens(screensData.filter(s => s.isActive !== false));
      } catch (error) { console.error("Error fetching screens:", error); showToast("❌ 無法載入屏幕資料"); } finally { setIsScreensLoading(false); }
    };

    const fetchConfig = () => {
        onSnapshot(collection(db, "special_rules"), (snap) => {
            const rules = snap.docs.map(d => d.data());
            setSpecialRules(rules);
        });
        onSnapshot(doc(db, "system_config", "pricing_rules"), (docSnap) => {
            if (docSnap.exists()) {
                setPricingConfig(docSnap.data());
            }
        });
    };

    fetchScreens();
    fetchConfig();
  }, []);

  useEffect(() => {
      const fetchStats = async () => {
          try {
              const snapshot = await getDocs(collection(db, "market_stats"));
              const statsMap = {};
              snapshot.forEach(doc => {
                  statsMap[doc.id] = doc.data().averagePrice;
              });
              setMarketStats(statsMap);
          } catch (e) { console.error("Error fetching stats:", e); }
      };
      fetchStats();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email, photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=0D8ABC&color=fff` });
        const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          setMyOrders(snapshot.docs.map(doc => {
            const data = doc.data();
            let displayTime = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            return { id: doc.id, ...data, displayTime };
          }));
        });
        return () => unsubscribeSnapshot(); 
      } else { setUser(null); setMyOrders([]); }
      setIsAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
      const qSold = query(collection(db, "orders"), where("status", "in", ["won", "paid", "completed"]));
      const qBidding = query(collection(db, "orders"), where("status", "==", "paid_pending_selection"));

      const unsubSold = onSnapshot(qSold, (snapshot) => {
          const sold = new Set();
          snapshot.docs.forEach(doc => {
              if (doc.data().detailedSlots) {
                  doc.data().detailedSlots.forEach(s => sold.add(`${s.date}-${s.hour}-${s.screenId}`));
              }
          });
          setOccupiedSlots(sold);
      });

      const unsubBidding = onSnapshot(qBidding, (snapshot) => {
          const bids = {};
          snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.detailedSlots) {
                  data.detailedSlots.forEach(s => {
                      const key = `${s.date}-${s.hour}-${s.screenId}`;
                      const thisBid = s.bidPrice || 0;
                      if (!bids[key] || thisBid > bids[key]) {
                          bids[key] = thisBid;
                      }
                  });
              }
          });
          setExistingBids(bids);
      });

      return () => {
          unsubSold();
          unsubBidding();
      };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };
  const handleGoogleLogin = async () => { setIsLoginLoading(true); try { await signInWithPopup(auth, googleProvider); setIsLoginModalOpen(false); showToast(`👋 歡迎回來`); } catch (error) { showToast(`❌ 登入失敗: ${error.message}`); } finally { setIsLoginLoading(false); } };
  const handleLogout = async () => { try { await signOut(auth); setUser(null); setTransactionStep('idle'); setIsProfileModalOpen(false); showToast("已登出"); } catch (error) { showToast("❌ 登出失敗"); } };

  // Bundle Logic (Hidden Buttons)
  const availableBundles = useMemo(() => {
      const groups = {};
      screens.forEach(s => {
          const gName = s.bundlegroup || s.bundleGroup;
          if (gName) {
              if (!groups[gName]) groups[gName] = [];
              groups[gName].push(s);
          }
      });
      return groups;
  }, [screens]);

  // Auto-Detect Bundle Mode
  const isBundleMode = useMemo(() => {
    if (selectedScreens.size < 2) return false;
    const selectedIdsStr = new Set(Array.from(selectedScreens).map(id => String(id)));
    for (const [groupName, groupScreens] of Object.entries(availableBundles)) {
        const groupTotal = groupScreens.length;
        const groupSelected = groupScreens.filter(s => selectedIdsStr.has(String(s.id))).length;
        if (groupTotal > 1 && groupSelected === groupTotal) return true;
    }
    return false;
  }, [selectedScreens, availableBundles]);

  const selectGroup = (groupScreens) => {
      const groupIds = groupScreens.map(s => s.id);
      setSelectedScreens(new Set(groupIds));
      showToast(`🔥 已選取聯播組合 (${groupScreens.length}屏)`);
  };

  const callEmailService = async (id, data, isManual = false) => {
      if (emailSentRef.current && !isManual) return;
      if (data.emailSent && !isManual) return;

      setEmailStatus('sending'); 
      emailSentRef.current = true;
      
      let targetUser = {
          email: data.userEmail || user?.email,
          displayName: data.userName || user?.displayName || 'Customer'
      };

      if (!targetUser.email) {
          setEmailStatus('error');
          showToast("❌ 找不到 Email 地址");
          return;
      }

      let templateType = 'buyout';
      if (data.type === 'bid') {
          templateType = 'bid_submission';
      } 

      const success = await sendBidConfirmation(targetUser, { id, ...data }, templateType);
      
      if (success) { 
          setEmailStatus('sent'); 
          showToast("✅ 確認信已發送"); 
          try {
            await updateDoc(doc(db, "orders", id), { emailSent: true });
          } catch (e) { console.error("Failed to update emailSent flag:", e); }
      } else { 
          setEmailStatus('error'); 
          emailSentRef.current = false; 
      }
  };

  const fetchAndFinalizeOrder = async (orderId, isUrlSuccess) => {
    if (!orderId) return;
    const orderRef = doc(db, "orders", orderId);
    
    if (isUrlSuccess) {
        setModalPaymentStatus('paid'); 
        setTimeout(async () => {
            try {
                const docSnap = await getDoc(orderRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    callEmailService(docSnap.id, data, false);
                }
            } catch(e) { console.error("Auto Fetch Error:", e); }
        }, 1500); 
    }

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
        if (docSnap.exists()) {
            const orderData = docSnap.data();
            setCreativeStatus(orderData.hasVideo ? 'approved' : 'empty');
            setCreativeName(orderData.videoName || ''); 
            
            const isPaid = ['won', 'paid_pending_selection', 'completed', 'paid'].includes(orderData.status);
            
            if (isPaid) { 
                setModalPaymentStatus('paid'); 
                localStorage.removeItem('temp_txn_time'); 
            } else { 
                if (!isUrlSuccess) setModalPaymentStatus('verifying'); 
            }
        }
    });
    return unsubscribe;
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    let urlId = queryParams.get('order_id') || queryParams.get('orderId');
    const isSuccess = queryParams.get('success') === 'true'; 
    const isCanceled = queryParams.get('canceled') === 'true'; 

    if (isCanceled) {
        showToast("❌ 付款已取消");
        setModalPaymentStatus('failed'); 
        return;
    }

    if (isSuccess) { 
        setModalPaymentStatus('paid'); 
    }

    if (urlId) { 
        setCurrentOrderId(urlId); 
        setIsUrgentUploadModalOpen(true); 
        fetchAndFinalizeOrder(urlId, isSuccess); 
    }
  }, []); 

  const handleRealUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      let targetId = currentOrderId || localStorage.getItem('temp_order_id') || new URLSearchParams(window.location.search).get('order_id');
      if (!targetId) { showToast("❌ 錯誤：找不到訂單 ID"); return; }
      setIsUploadingReal(true); setCreativeStatus('uploading');
      try {
          const storageRef = ref(storage, `uploads/${targetId}/${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', (snapshot) => { setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); }, (error) => { showToast("❌ 上傳失敗"); setIsUploadingReal(false); setCreativeStatus('empty'); }, async () => { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); await updateDoc(doc(db, "orders", targetId), { hasVideo: true, videoUrl: downloadURL, videoName: file.name, uploadedAt: serverTimestamp() }); setCreativeName(file.name); setCreativeStatus('approved'); setIsUploadingReal(false); showToast("✅ 上傳成功！"); localStorage.removeItem('temp_order_id'); localStorage.removeItem('temp_txn_time'); });
      } catch (error) { console.error(error); showToast("上傳錯誤"); setIsUploadingReal(false); }
  };

  const closeTransaction = () => { 
      setTransactionStep('idle'); 
      setPendingTransaction(null); 
      setCurrentOrderId(null); 
  };

  const filteredScreens = useMemo(() => {
    return screens.filter(s => {
      const term = screenSearchTerm.toLowerCase();
      return (s.name||'').toLowerCase().includes(term) || (s.location||'').toLowerCase().includes(term) || (s.district||'').toLowerCase().includes(term);
    });
  }, [screenSearchTerm, screens]);

  // 🔥🔥🔥 核心生成邏輯 (已修正所有時間規則)
  const generateAllSlots = useMemo(() => {
    if (selectedScreens.size === 0 || selectedHours.size === 0 || screens.length === 0) return [];
    
    let slots = [];
    let datesToProcess = [];

    if (mode === 'specific') {
        datesToProcess = Array.from(selectedSpecificDates).map(dateStr => {
            const [y, m, d] = dateStr.split('-');
            return new Date(y, m-1, d);
        });
    } else {
        const today = new Date();
        if (selectedWeekdays.size > 0) {
            for (let i = 0; i < weekCount * 7; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                if (selectedWeekdays.has(d.getDay())) {
                    datesToProcess.push(d);
                }
            }
        }
    }

    // 🔥 7 天界線
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    datesToProcess.forEach(d => {
        const dateStr = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const dayOfWeek = new Date(d).getDay(); 

        selectedHours.forEach(h => {
            selectedScreens.forEach(screenId => {
                const screen = screens.find(s => s.id === screenId);
                if (!screen) return;
                
                const key = `${dateStr}-${h}-${screenId}`; 
                // 只檢查 "真正已售"
                const isSoldOut = occupiedSlots.has(key);
                
                const basePricing = calculateDynamicPrice(
                    new Date(d), 
                    h, 
                    isBundleMode, 
                    screen, 
                    pricingConfig, 
                    specialRules
                );
                
                const slotTime = new Date(d);
                slotTime.setHours(h, 0, 0, 0);
                const now = new Date();
                const hoursUntil = (slotTime - now) / (1000 * 60 * 60);
                
                let canBid = basePricing.canBid && !basePricing.isLocked && !isSoldOut;
                let isBuyoutDisabled = basePricing.isBuyoutDisabled; // Prime Time 默認 disable buyout
                let warning = basePricing.warning;
                
                // --- 1. 急單 (< 24h) ---
                if (hoursUntil < 24 && hoursUntil > 0) {
                    // 急單不允許競價，只能買斷
                    canBid = false;
                    warning = "急單 (限買斷)"; 
                    
                    // 🔥 修正：急單即使是 Prime Time，也可以 Buyout
                    if (basePricing.isPrime) {
                        isBuyoutDisabled = false; // 允許 Buyout
                    }
                }
                
                // --- 2. 遠期 (> 7天) ---
                else if (slotTime > sevenDaysLater) {
                    // 遠期不允許競價，只能買斷
                    canBid = false; 
                    warning = "遠期 (限買斷)";
                    
                    // 如果是 Prime Time，本身被 pricingEngine 設為 isBuyoutDisabled=true
                    // 結果：既不能 Bid，又不能 Buyout -> 無法交易
                    if (basePricing.isPrime) {
                        warning = "遠期 Prime (暫未開放，請於7天內競價)";
                        // 此時 canBid=false 且 isBuyoutDisabled=true，按鈕會全灰
                    }
                }
                
                // --- 3. 競價區 (24h - 7d) ---
                // 這裡保持 pricingEngine 的設定：
                // - Normal/Gold: canBid=true, isBuyoutDisabled=false (可Bid可Buy)
                // - Prime: canBid=true, isBuyoutDisabled=true (只可Bid)

                let currentHighestBid = existingBids[key] || 0;

                slots.push({ 
                    key, dateStr, hour: h, screenId, 
                    screenName: screen.name, location: screen.location, 
                    minBid: basePricing.minBid,       
                    buyoutPrice: finalBuyout,
                    marketAverage: marketStats[`${screenId}_${dayOfWeek}_${h}`] || Math.ceil(basePricing.minBid * 1.5), 
                    isPrime: basePricing.isPrime,
                    isBuyoutDisabled: isBuyoutDisabled,
                    canBid, 
                    hoursUntil,
                    isUrgent, 
                    competitorBid: currentHighestBid, 
                    isSoldOut: basePricing.isLocked || isSoldOut, 
                    warning
                });
            });
        });
    });

    return slots.sort((a, b) => { 
        if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr); 
        if (a.hour !== b.hour) return a.hour - b.hour; 
        return a.screenId - b.screenId; 
    });
  }, [selectedScreens, selectedHours, selectedSpecificDates, selectedWeekdays, weekCount, mode, existingBids, isBundleMode, screens, occupiedSlots, marketStats, pricingConfig, specialRules]);

  const pricing = useMemo(() => {
    const availableSlots = generateAllSlots.filter(s => !s.isSoldOut);
    let buyoutTotal = 0, currentBidTotal = 0, minBidTotal = 0, urgentCount = 0; 
    let conflicts = [], missingBids = 0, invalidBids = 0; 
    let hasRestrictedBuyout = false, hasRestrictedBid = false, hasUrgentRisk = false;
    let hasDateRestrictedBid = false; 
    let hasPrimeFarFutureLock = false; // 新增：Prime + 遠期鎖死

    availableSlots.forEach(slot => {
        // 如果完全鎖死 (不能 Bid 也不能 Buyout)，不算入價格計算
        if (!slot.canBid && slot.isBuyoutDisabled) {
            hasPrimeFarFutureLock = true;
            return;
        }

        buyoutTotal += slot.buyoutPrice; 
        minBidTotal += slot.minBid; 

        if (slot.isBuyoutDisabled) hasRestrictedBuyout = true;
        if (!slot.canBid) {
            hasRestrictedBid = true;
            if (slot.warning === "遠期 (限買斷)" || slot.warning === "急單 (限買斷)") {
                hasDateRestrictedBid = true;
            }
        }
        if (slot.hoursUntil < 1) hasUrgentRisk = true; 
        if (slot.isUrgent) urgentCount++; 

        const userPrice = slotBids[slot.key]; 
        if (userPrice) { 
            currentBidTotal += parseInt(userPrice); 
            if (parseInt(userPrice) < slot.minBid) invalidBids++;
            if (parseInt(userPrice) <= slot.competitorBid) conflicts.push({ ...slot, userPrice }); 
        } else { missingBids++; }
    });
    
    return { 
        totalSlots, buyoutTotal, currentBidTotal, minBidTotal,
        conflicts, missingBids, invalidBids, soldOutCount, urgentCount,
        canStartBidding: totalSlots > 0 && !hasRestrictedBid,
        isReadyToSubmit: missingBids === 0 && invalidBids === 0,
        hasRestrictedBuyout, hasRestrictedBid, hasUrgentRisk, hasDateRestrictedBid, hasPrimeFarFutureLock
    };
  }, [generateAllSlots, slotBids]);

  const handleBatchBid = () => { const val = parseInt(batchBidInput); if (!val) return; const newBids = { ...slotBids }; generateAllSlots.forEach(slot => { if (!slot.isSoldOut) newBids[slot.key] = val; }); setSlotBids(newBids); showToast(`已將 HK$${val} 應用到所有可用時段`); };
  const handleSlotBidChange = (key, val) => setSlotBids(prev => ({ ...prev, [key]: val }));
  const toggleScreen = (id) => { const newSet = new Set(selectedScreens); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedScreens(newSet); };
  const toggleHour = (val) => { const newSet = new Set(selectedHours); if (newSet.has(val)) newSet.delete(val); else newSet.add(val); setSelectedHours(newSet); };
  
  const toggleWeekday = (dayIdx) => { 
      const newSet = new Set(selectedWeekdays); 
      if (newSet.has(dayIdx)) newSet.delete(dayIdx); else newSet.add(dayIdx); 
      setSelectedWeekdays(newSet);
      const d = new Date();
      const currentDay = d.getDay();
      const diff = (dayIdx - currentDay + 7) % 7;
      d.setDate(d.getDate() + diff);
      setPreviewDate(d);
  };

  const toggleDate = (year, month, day) => { 
      const key = formatDateKey(year, month, day); 
      setPreviewDate(new Date(year, month, day));
      if (!isDateAllowed(year, month, day)) return; 
      if (mode === 'recurring') { /* Optional switch logic */ }
      const newSet = new Set(selectedSpecificDates); 
      if (newSet.has(key)) newSet.delete(key); else newSet.add(key); 
      setSelectedSpecificDates(newSet); 
  };
  
  const initiateTransaction = async (type = 'bid') => {
    const validSlots = generateAllSlots.filter(s => !s.isSoldOut);
    
    if (type === 'bid' && pricing.missingBids > 0) { showToast(`❌ 尚有 ${pricing.missingBids} 個時段未出價`); return; }
    if (!termsAccepted) { showToast('❌ 請先同意條款'); return; }
    
    const detailedSlots = validSlots.map(slot => ({
        date: slot.dateStr,
        hour: slot.hour,
        screenId: slot.screenId,
        screenName: slot.screenName,
        bidPrice: type === 'buyout' ? slot.buyoutPrice : (parseInt(slotBids[slot.key]) || 0),
        isBuyout: type === 'buyout'
    }));

    let slotSummary = mode === 'specific' ? `日期: [${Array.from(selectedSpecificDates).join(', ')}]` : `週期: 逢星期[${Array.from(selectedWeekdays).map(d=>WEEKDAYS_LABEL[d]).join(',')}] x ${weekCount}週`;

    const txnData = {
      amount: type === 'buyout' ? pricing.buyoutTotal : pricing.currentBidTotal, 
      type, 
      detailedSlots, 
      targetDate: detailedSlots[0]?.date, 
      isBundle: isBundleMode, 
      slotCount: pricing.totalSlots, 
      creativeStatus, 
      conflicts: pricing.conflicts, 
      userId: user.uid, 
      userEmail: user.email, 
      userName: user.displayName, 
      createdAt: serverTimestamp(), 
      status: 'pending_auth', 
      hasVideo: false,
      emailSent: false, 
      screens: Array.from(selectedScreens).map(id => screens.find(s => s.id === id)?.name || 'Unknown'),
      timeSlotSummary: slotSummary
    };

    setIsBidModalOpen(false); setIsBuyoutModalOpen(false);
    try {
        setTransactionStep('processing');
        const docRef = await addDoc(collection(db, "orders"), txnData);
        localStorage.setItem('temp_order_id', docRef.id);
        localStorage.setItem('temp_txn_time', new Date().getTime().toString()); 
        setPendingTransaction({ ...txnData, id: docRef.id });
        setCurrentOrderId(docRef.id);
        setTransactionStep('summary');
    } catch (error) { console.error(error); showToast("建立訂單失敗"); setTransactionStep('idle'); }
  };

  const processPayment = async () => {
    setTransactionStep('processing');
    const targetId = localStorage.getItem('temp_order_id') || currentOrderId;
    if (!targetId) { showToast("訂單 ID 錯誤"); setTransactionStep('summary'); return; }
    const currentUrl = window.location.origin + window.location.pathname;
    const captureMethod = pendingTransaction && pendingTransaction.type === 'buyout' ? 'automatic' : 'manual';
    try {
        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                amount: pendingTransaction ? pendingTransaction.amount : pricing.buyoutTotal, 
                productName: `${pendingTransaction && pendingTransaction.type === 'buyout' ? '買斷' : '競價'} - ${pendingTransaction ? pendingTransaction.slotCount : 0} 時段`, 
                orderId: targetId, 
                successUrl: `${currentUrl}?success=true&order_id=${targetId}`, 
                cancelUrl: `${currentUrl}?canceled=true`, 
                customerEmail: user.email, 
                captureMethod: captureMethod,
                orderType: pendingTransaction.type 
            }),
        });
        const data = await response.json();
        if (response.ok && data.url) { window.location.href = data.url; } else { throw new Error(data.error); }
    } catch (error) { console.error(error); showToast(`❌ 系統錯誤: ${error.message}`); setTransactionStep('summary'); }
  };

  const handleBidClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } setTermsAccepted(false); setIsBidModalOpen(true); };
  const handleBuyoutClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } if (pricing.hasRestrictedBuyout) { showToast('❌ Prime 時段限競價'); return; } setTermsAccepted(false); setIsBuyoutModalOpen(true); };

  const renderCalendar = () => { 
    const year = currentDate.getFullYear(); 
    const month = currentDate.getMonth(); 
    const daysInMonth = getDaysInMonth(year, month); 
    const firstDayIdx = getFirstDayOfMonth(year, month); 
    const days = []; 
    for (let i = 0; i < firstDayIdx; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>); 
    for (let d = 1; d <= daysInMonth; d++) { 
        const dateKey = formatDateKey(year, month, d); 
        const isAllowed = isDateAllowed(year, month, d); 
        const isSelected = mode === 'specific' ? selectedSpecificDates.has(dateKey) : false; 
        let isPreview = false;
        if (mode === 'recurring') {
            const thisDay = new Date(year, month, d);
            if (selectedWeekdays.has(thisDay.getDay()) && isAllowed) isPreview = true;
        }
        days.push(
            <button key={dateKey} onClick={() => toggleDate(year, month, d)} disabled={!isAllowed || (mode === 'recurring' && !isPreview)} 
                className={`h-10 w-full rounded-md text-sm font-medium transition-all relative 
                ${!isAllowed ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 
                  isSelected ? 'bg-blue-600 text-white shadow-md' : 
                  isPreview ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'hover:bg-gray-100 text-gray-700'}`}
            >
                {d}
            </button>
        ); 
    } 
    return days; 
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 relative pt-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-8 z-30 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg"><Monitor size={20} /></div>
            <div className="flex flex-col">
                <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">DOOHadv</h1>
                <span className="text-[10px] text-slate-500 font-bold">自己廣告自己投 Bid your own adv here!</span>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            {user ? (<button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded-lg transition-colors"><img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" /></button>) : (<button onClick={() => setIsLoginModalOpen(true)} className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"><LogIn size={16} /> 登入</button>)}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-50"></div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2 relative z-10"><HelpCircle size={16}/> 玩法說明 How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold"><Gavel size={18}/> 競價投標 (Bidding)</div>
                    <ul className="space-y-2 text-xs text-slate-600">
                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span> <span><strong>價高者得：</strong> 自由出價，適合預算有限或爭奪黃金時段。</span></li>
                        <li className="flex items-start gap-2"><span className="text-orange-500 font-bold">•</span> <span className="text-orange-700 font-medium"><strong>限制：</strong> 僅開放予 24小時 至 7天 內的時段。</span></li>
                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span> <span><strong>預授權機制：</strong> 提交時只凍結額度 (Pre-auth)，不即時扣款。</span></li>
                    </ul>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold"><Zap size={18}/> 直接買斷 (Buyout)</div>
                    <ul className="space-y-2 text-xs text-slate-600">
                        <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>即時鎖定：</strong> 付出一口價，立即確保獲得該時段。</span></li>
                        <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>遠期預訂：</strong> 支援 7 至 60 天後的預訂 (Prime Time 除外)。</span></li>
                        <li className="flex items-start gap-2"><span className="text-emerald-400">•</span> <span><strong>即時扣款：</strong> 交易確認後立即從信用卡扣除全數。</span></li>
                    </ul>
                </div>
            </div>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[350px]">
            <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Monitor size={16} /> 1. 選擇屏幕 ({selectedScreens.size})</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>
                    <div className="relative flex-1 w-full sm:w-48"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" placeholder="搜尋地點..." value={screenSearchTerm} onChange={(e) => setScreenSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"/></div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
                {isScreensLoading ? <div className="text-center p-10"><Loader2 className="animate-spin inline"/></div> : (
                    <table className="w-full text-left text-sm border-collapse table-fixed">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500 font-semibold">
                            <tr>
                                <th className="p-3 w-[15%] text-center">選取</th>
                                <th className="p-3 w-[60%] sm:w-[40%]">屏幕名稱</th>
                                <th className="p-3 hidden sm:table-cell sm:w-[15%]">區域</th>
                                <th className="p-3 hidden sm:table-cell sm:w-[15%]">規格</th>
                                <th className="p-3 w-[25%] sm:w-[15%] text-right">詳情</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredScreens.map(s => (
                                <tr key={s.id} className={`hover:bg-blue-50/50 ${selectedScreens.has(s.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input type="checkbox" checked={selectedScreens.has(s.id)} onChange={() => toggleScreen(s.id)} className="cursor-pointer w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                                    </td>
                                    <td className="p-3 overflow-hidden">
                                        <div className="font-bold truncate text-slate-800">{s.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 truncate"><MapPin size={10} className="shrink-0"/> {s.location}</div>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell">
                                        <span className="bg-slate-100 px-2 py-1 rounded-full text-xs text-slate-600">{s.district}</span>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell text-slate-500 text-xs">{s.size}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => setViewingScreen(s)} className="text-blue-600 text-xs flex items-center justify-end gap-1 ml-auto font-bold hover:underline bg-blue-50 sm:bg-transparent px-2 py-1 sm:p-0 rounded">
                                            <MapIcon size={14}/> 詳情
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2"><CalendarIcon size={16}/> 2. 選擇日期</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => { setMode('specific'); setSelectedSpecificDates(new Set()); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>指定日期</button>
                    <button onClick={() => { setMode('recurring'); setSelectedSpecificDates(new Set()); }} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'recurring' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>週期模式</button>
                </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
                <div className="text-center">
                    <div className="text-sm text-slate-500 font-medium">年份</div>
                    <div className="text-2xl font-extrabold text-blue-600 bg-blue-50 px-6 py-2 rounded-xl shadow-sm border border-blue-100">
                        {currentDate.getFullYear()}年 {currentDate.getMonth()+1}月
                    </div>
                    <div className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">⚠️ 請核對年份月份</div>
                </div>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
            </div>

            {mode === 'recurring' && (
                <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-blue-700 flex items-center gap-1"><Repeat size={12}/> 重複星期</span><div className="flex gap-1">{WEEKDAYS_LABEL.map((d, i) => (<button key={d} onClick={() => toggleWeekday(i)} className={`w-6 h-6 text-[10px] rounded-full font-bold transition-all ${selectedWeekdays.has(i) ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border hover:border-blue-300'}`}>{d}</button>))}</div></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-blue-700 flex items-center gap-1"><CalendarDays size={12}/> 持續週數</span><select value={weekCount} onChange={(e) => setWeekCount(Number(e.target.value))} className="text-xs border border-blue-200 rounded px-2 py-1 bg-white outline-none">{Array.from({length: 8}, (_, i) => i + 1).map(w => <option key={w} value={w}>{w} 週</option>)}</select></div>
                </div>
            )}
            
            <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 mb-1">{WEEKDAYS_LABEL.map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1 flex-1 content-start">{renderCalendar()}</div>
          </section>

          <section className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2"><Clock size={16}/> 3. 選擇時段</h2>
              <div className="flex gap-3 text-[10px] mb-3"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Prime</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Gold</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Normal</span></div>
              <div className="grid grid-cols-4 gap-1.5 overflow-y-auto max-h-[300px]">
                  {HOURS.map(h => {
                      const dateStr = formatDateKey(previewDate.getFullYear(), previewDate.getMonth(), previewDate.getDate());
                      
                      let isSoldOut = false;
                      selectedScreens.forEach(screenId => {
                          const key = `${dateStr}-${h.val}-${screenId}`;
                          if (occupiedSlots.has(key)) {
                              isSoldOut = true;
                          }
                      });

                      const tier = getHourTier(h.val);
                      let tierClass = 'border-slate-200 text-slate-600 hover:bg-slate-50';
                      
                      if (isSoldOut) {
                          tierClass = 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed decoration-slice'; 
                      } else if (selectedHours.has(h.val)) {
                          tierClass = 'bg-blue-600 text-white border-blue-600';
                      } else if (tier === 'prime') {
                          tierClass = 'border-red-200 bg-red-50 text-red-700 font-bold';
                      } else if (tier === 'gold') {
                          tierClass = 'border-orange-200 bg-orange-50 text-orange-700 font-medium';
                      }

                      return (
                          <button 
                              key={h.val} 
                              onClick={() => !isSoldOut && toggleHour(h.val)} 
                              disabled={isSoldOut} 
                              className={`text-xs py-2 rounded border transition-all ${tierClass}`}
                          >
                              {h.label}
                              {isSoldOut && <span className="block text-[8px] font-normal">已售</span>}
                          </button>
                      );
                  })}
              </div>
          </section>
        </div>

        <section className="bg-slate-900 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between border-t-4 border-blue-500">
            <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2"><DollarSign size={16}/> 價格預覽 {isBundleMode && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Sparkles size={10}/> Bundle Active</span>}</h2>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">共 {pricing.totalSlots} 個可用時段</span>
                </div>
                <div className="flex items-center justify-between gap-4 mt-1">
                    <div><p className="text-xs text-slate-400 mb-0.5">最低起標總額</p><div className="flex items-baseline gap-1"><span className="text-sm text-orange-500 font-bold">HK$</span><span className="text-2xl font-bold text-orange-400 tracking-tight">{pricing.minBidTotal.toLocaleString()}</span><span className="text-xs text-slate-500">起</span></div></div>
                    <div className="w-px h-10 bg-slate-700"></div>
                    <div className="text-right"><p className="text-xs text-slate-400 mb-0.5">直接買斷總額</p>{pricing.hasRestrictedBuyout ? (<div className="text-red-400 text-sm font-bold flex items-center justify-end gap-1"><Lock size={14}/> 不適用</div>) : (<div className="flex items-baseline justify-end gap-1"><span className="text-sm text-emerald-600 font-bold">HK$</span><span className="text-2xl font-bold text-emerald-500 tracking-tight">{pricing.buyoutTotal.toLocaleString()}</span></div>)}</div>
                </div>
                <div className="space-y-1 mt-3 min-h-[20px]">
                    {isBundleMode && (
                        <div className="text-xs text-purple-300 flex items-center gap-1 bg-purple-900/30 px-2 py-1 rounded border border-purple-800">
                            <Sparkles size={12} className="text-purple-400"/> 
                            <span>⚡ 已啟動聯播網模式 (Network Effect): 廣告將於同一區域同步播放，獲得最大曝光效益。 (溢價 +25%)</span>
                        </div>
                    )}
                    
                    {/* 🔥 遠期 Prime 鎖定警告 */}
                    {pricing.hasPrimeFarFutureLock && (
                        <div className="text-xs text-red-300 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded border border-red-800">
                            <Lock size={12}/> 
                            <span>遠期 Prime (暫未開放，請於7天內競價)</span>
                        </div>
                    )}

                    {pricing.urgentCount > 0 && (<div className="text-xs text-orange-400 flex items-center gap-1 bg-orange-900/30 px-2 py-1 rounded"><Zap size={12}/> 已包含 {pricing.urgentCount} 個急單時段 (附加費 +20%)</div>)}
                    {pricing.hasRestrictedBuyout && !pricing.hasPrimeFarFutureLock && <div className="text-xs text-red-400 flex items-center gap-1 bg-red-900/30 px-2 py-1 rounded"><Lock size={12}/> 包含 Prime 時段，無法直接買斷</div>}
                    {pricing.soldOutCount > 0 && <div className="text-xs text-slate-400 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"><Ban size={12}/> 已自動過濾 {pricing.soldOutCount} 個已售罄時段</div>}
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={handleBidClick} disabled={!pricing.canStartBidding} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${!pricing.canStartBidding ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-900/50'}`}>
                    <span>
                        {pricing.hasRestrictedBid 
                            ? '🚫 限買斷' 
                            : '出價競投'}
                    </span>
                    {!pricing.hasRestrictedBid && pricing.totalSlots > 0 && <span className="text-[10px] font-normal opacity-80">自由出價</span>}
                </button>
                <button onClick={handleBuyoutClick} disabled={pricing.hasRestrictedBuyout || pricing.totalSlots === 0} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-0.5 ${(pricing.hasRestrictedBuyout || pricing.totalSlots === 0) ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-900/50'}`}><span>直接買斷</span>{pricing.totalSlots > 0 && !pricing.hasRestrictedBuyout && <span className="text-[10px] font-normal opacity-80">即時確認</span>}</button>
            </div>
        </section>
      </main>

      {/* Modals */}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full z-50">{toast}</div>}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} handleGoogleLogin={handleGoogleLogin} isLoginLoading={isLoginLoading} />
      <ScreenDetailModal screen={viewingScreen} onClose={() => setViewingScreen(null)} />
      <MyOrdersModal isOpen={isProfileModalOpen} user={user} myOrders={myOrders} onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} onUploadClick={(id) => { setCurrentOrderId(id); setIsUrgentUploadModalOpen(true); setIsProfileModalOpen(false); }} />
      {isBuyoutModalOpen && <BuyoutModal isOpen={isBuyoutModalOpen} onClose={() => setIsBuyoutModalOpen(false)} pricing={pricing} selectedSpecificDates={selectedSpecificDates} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('buyout')} hasUrgentRisk={pricing.hasUrgentRisk} />}
      {isBidModalOpen && <BiddingModal isOpen={isBidModalOpen} onClose={() => setIsBidModalOpen(false)} generateAllSlots={generateAllSlots} slotBids={slotBids} handleSlotBidChange={handleSlotBidChange} batchBidInput={batchBidInput} setBatchBidInput={setBatchBidInput} handleBatchBid={handleBatchBid} isBundleMode={isBundleMode} pricing={pricing} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('bid')} />}
      {isUrgentUploadModalOpen && <UrgentUploadModal isOpen={isUrgentUploadModalOpen} modalPaymentStatus={modalPaymentStatus} creativeStatus={creativeStatus} isUploadingReal={isUploadingReal} uploadProgress={uploadProgress} handleRealUpload={handleRealUpload} emailStatus={emailStatus} onClose={() => { setIsUrgentUploadModalOpen(false); closeTransaction(); }} />}
      
      {transactionStep !== 'idle' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
            {transactionStep === 'summary' && pendingTransaction ? (
                <>
                    <h3 className="text-lg font-bold mb-4">訂單摘要</h3>
                    <p className="mb-4">類型: {pendingTransaction.type === 'buyout' ? '買斷 (即扣款)' : '競價 (預授權)'}</p>
                    <p className="text-xl font-bold text-blue-600 mb-6">HK$ {pendingTransaction.amount}</p>
                    <button onClick={processPayment} className="w-full bg-slate-900 text-white py-3 rounded font-bold">前往付款</button>
                </>
            ) : <><Loader2 className="animate-spin mx-auto mb-4"/><p>正在連接 Stripe...</p></>}
          </div>
        </div>
      )}
    </div>
  );
};
export default DOOHBiddingSystem;