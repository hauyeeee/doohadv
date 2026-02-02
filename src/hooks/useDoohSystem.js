import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  signInWithPopup, signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, getDoc, getDocs 
} from "firebase/firestore";
import { 
  ref, uploadBytesResumable, getDownloadURL 
} from "firebase/storage";
import { auth, db, storage, googleProvider } from '../firebase';
import { initEmailService, sendBidConfirmation } from '../utils/emailService';
import { calculateDynamicPrice } from '../utils/pricingEngine';

export const useDoohSystem = () => {
  // --- States ---
  const [user, setUser] = useState(null); 
  const [isAuthReady, setIsAuthReady] = useState(false); 
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  
  const [screens, setScreens] = useState([]);
  const [isScreensLoading, setIsScreensLoading] = useState(true);
  const [pricingConfig, setPricingConfig] = useState(null); // Init as null to detect loading
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
  const [modalPaymentStatus, setModalPaymentStatus] = useState('pending'); 
  
  // Modal Flags
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isBuyoutModalOpen, setIsBuyoutModalOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false); 
  const [emailStatus, setEmailStatus] = useState('idle'); 
  
  const emailSentRef = useRef(false);

  // --- Constants ---
  const HOURS = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${String(i).padStart(2, '0')}:00` }));
  const WEEKDAYS_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

  // --- Helper Functions ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); 
  const formatDateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
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

  // --- Effects (Data Fetching) ---
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
        onSnapshot(collection(db, "special_rules"), (snap) => setSpecialRules(snap.docs.map(d => d.data())));
        onSnapshot(doc(db, "system_config", "pricing_rules"), (docSnap) => {
            if (docSnap.exists()) setPricingConfig(docSnap.data());
            else setPricingConfig({}); // Empty fallback
        });
    };
    fetchScreens(); fetchConfig();
  }, []);

  useEffect(() => {
      const fetchStats = async () => {
          try {
              const snapshot = await getDocs(collection(db, "market_stats"));
              const statsMap = {};
              snapshot.forEach(doc => { statsMap[doc.id] = doc.data().averagePrice; });
              setMarketStats(statsMap);
          } catch (e) { console.error("Error fetching stats:", e); }
      };
      fetchStats();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email, photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=0D8ABC&color=fff` });
        const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
          setMyOrders(snapshot.docs.map(doc => {
            const data = doc.data();
            let displayTime = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toLocaleString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            return { id: doc.id, ...data, displayTime };
          }));
        });
      } else { setUser(null); setMyOrders([]); }
      setIsAuthReady(true);
    });
  }, []);

  useEffect(() => {
      const qSold = query(collection(db, "orders"), where("status", "in", ["won", "paid", "completed"]));
      const qBidding = query(collection(db, "orders"), where("status", "==", "paid_pending_selection"));

      const unsubSold = onSnapshot(qSold, (snapshot) => {
          const sold = new Set();
          snapshot.docs.forEach(doc => {
              if (doc.data().detailedSlots) doc.data().detailedSlots.forEach(s => sold.add(`${s.date}-${s.hour}-${s.screenId}`));
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
                      if (!bids[key] || thisBid > bids[key]) bids[key] = thisBid;
                  });
              }
          });
          setExistingBids(bids);
      });
      return () => { unsubSold(); unsubBidding(); };
  }, []);

  // --- Handlers ---
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };
  
  const handleGoogleLogin = async () => { 
    setIsLoginLoading(true); 
    try { 
        await signInWithPopup(auth, googleProvider); 
        setIsLoginModalOpen(false); 
        showToast(`👋 歡迎回來`); 
    } catch (error) { 
        console.error("Login Error", error);
        showToast(`❌ 登入失敗: ${error.message}`); 
    } finally { 
        setIsLoginLoading(false); 
    } 
  };
  
  const handleLogout = async () => { try { await signOut(auth); setUser(null); setTransactionStep('idle'); setIsProfileModalOpen(false); showToast("已登出"); } catch (error) { showToast("❌ 登出失敗"); } };
  
  const callEmailService = async (id, data, isManual = false) => {
      setEmailStatus('sending'); 
      console.log(`📧 Sending Email for ID: ${id}`);

      let targetUser = { 
          email: data.userEmail || user?.email, 
          displayName: data.userName || user?.displayName || 'Customer' 
      };

      let templateType = data.type === 'bid' ? 'bid_submission' : 'buyout';

      try {
          const success = await sendBidConfirmation(targetUser, { id, ...data }, templateType);
          if (success) { 
              setEmailStatus('sent'); 
              await updateDoc(doc(db, "orders", id), { emailSent: true }).catch(e=>console.error(e)); 
          } else { 
              setEmailStatus('error'); 
          }
      } catch(e) { console.error(e); setEmailStatus('error'); }
  };

  const fetchAndFinalizeOrder = async (orderId, isUrlSuccess) => {
    if (!orderId) return;
    const orderRef = doc(db, "orders", orderId);
    
    if (isUrlSuccess) { 
        setModalPaymentStatus('paid'); 
        setTimeout(async () => { 
            try { 
                const docSnap = await getDoc(orderRef); 
                if (docSnap.exists() && !docSnap.data().emailSent) {
                     callEmailService(docSnap.id, docSnap.data(), false); 
                }
            } catch(e) { console.error(e); } 
        }, 1500); 
    }

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
        if (docSnap.exists()) {
            const orderData = docSnap.data();
            setCreativeStatus(orderData.hasVideo ? 'approved' : 'empty');
            setCreativeName(orderData.videoName || ''); 
            const isPaid = ['won', 'paid_pending_selection', 'completed', 'paid'].includes(orderData.status);
            if (isPaid) { setModalPaymentStatus('paid'); localStorage.removeItem('temp_txn_time'); } 
            else { if (!isUrlSuccess) setModalPaymentStatus('verifying'); }
        }
    });
    return unsubscribe;
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    let urlId = queryParams.get('order_id') || queryParams.get('orderId');
    const isSuccess = queryParams.get('success') === 'true'; 
    const isCanceled = queryParams.get('canceled') === 'true'; 
    if (isCanceled) { showToast("❌ 付款已取消"); setModalPaymentStatus('failed'); return; }
    if (isSuccess) { setModalPaymentStatus('paid'); }
    if (urlId) { setCurrentOrderId(urlId); setIsUrgentUploadModalOpen(true); fetchAndFinalizeOrder(urlId, isSuccess); }
  }, []); 

  const handleRealUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      let targetId = currentOrderId || localStorage.getItem('temp_order_id') || new URLSearchParams(window.location.search).get('order_id');
      if (!targetId) { showToast("❌ 錯誤：找不到訂單 ID"); return; }
      
      setIsUploadingReal(true); 
      setCreativeStatus('uploading');
      
      try {
          const storageRef = ref(storage, `uploads/${targetId}/${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          uploadTask.on('state_changed', (snapshot) => { 
              setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); 
          }, 
          (error) => { showToast("❌ 上傳失敗"); setIsUploadingReal(false); setCreativeStatus('empty'); }, 
          async () => { 
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); 
              await updateDoc(doc(db, "orders", targetId), { 
                  hasVideo: true, videoUrl: downloadURL, videoName: file.name, uploadedAt: serverTimestamp(), creativeStatus: 'pending_review'
              }); 
              setCreativeName(file.name); setCreativeStatus('approved'); setIsUploadingReal(false); showToast("✅ 上傳成功！等待審核"); localStorage.removeItem('temp_order_id'); 
          });
      } catch (error) { console.error(error); showToast("上傳錯誤"); setIsUploadingReal(false); }
  };

  const closeTransaction = () => { setTransactionStep('idle'); setPendingTransaction(null); setCurrentOrderId(null); };

  const filteredScreens = useMemo(() => {
    return screens.filter(s => {
      const term = screenSearchTerm.toLowerCase();
      return (s.name||'').toLowerCase().includes(term) || (s.location||'').toLowerCase().includes(term) || (s.district||'').toLowerCase().includes(term);
    });
  }, [screenSearchTerm, screens]);

  const availableBundles = useMemo(() => {
      const groups = {};
      screens.forEach(s => { const gName = s.bundlegroup || s.bundleGroup; if (gName) { if (!groups[gName]) groups[gName] = []; groups[gName].push(s); } });
      return groups;
  }, [screens]);

  const isBundleMode = useMemo(() => {
    if (selectedScreens.size < 2) return false;
    const selectedIdsStr = new Set(Array.from(selectedScreens).map(id => String(id)));
    for (const [groupName, groupScreens] of Object.entries(availableBundles)) {
        if (groupScreens.length > 1 && groupScreens.filter(s => selectedIdsStr.has(String(s.id))).length === groupScreens.length) return true;
    }
    return false;
  }, [selectedScreens, availableBundles]);

  const selectGroup = (groupScreens) => {
      const groupIds = groupScreens.map(s => s.id);
      setSelectedScreens(new Set(groupIds));
      showToast(`🔥 已選取聯播組合 (${groupScreens.length}屏)`);
  };

  // 🔥🔥🔥 核心生成邏輯 (Crash Protection Added) 🔥🔥🔥
  const generateAllSlots = useMemo(() => {
    // ⚠️ 防崩潰：如果數據未準備好，直接回傳空，防止計算錯誤
    if (selectedScreens.size === 0 || selectedHours.size === 0 || screens.length === 0 || !pricingConfig) return [];
    
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
                const d = new Date(today); d.setDate(today.getDate() + i);
                if (selectedWeekdays.has(d.getDay())) datesToProcess.push(d);
            }
        }
    }

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
                const isSoldOut = occupiedSlots.has(key);
                
                const basePricing = calculateDynamicPrice(new Date(d), h, isBundleMode, screen, pricingConfig, specialRules);
                
                const slotTime = new Date(d); slotTime.setHours(h, 0, 0, 0);
                const now = new Date();
                const hoursUntil = (slotTime - now) / (1000 * 60 * 60);
                
                let canBid = basePricing.canBid && !basePricing.isLocked && !isSoldOut;
                let isBuyoutDisabled = basePricing.isBuyoutDisabled; 
                let warning = basePricing.warning;
                
                if (hoursUntil < 24 && hoursUntil > 0) {
                    canBid = false; warning = "急單 (限買斷)"; 
                    if (basePricing.isPrime) isBuyoutDisabled = false; 
                } else if (slotTime > sevenDaysLater) {
                    canBid = false; warning = "遠期 (限買斷)";
                    if (isBuyoutDisabled) warning = "Prime 遠期 (無法交易)";
                }

                let currentHighestBid = existingBids[key] || 0;
                
                const finalMinBid = basePricing.minBid;
                const finalBuyout = basePricing.buyoutPrice;
                const isLocked = basePricing.isLocked || isSoldOut;

                slots.push({ 
                    key, dateStr, hour: h, screenId, screenName: screen.name, location: screen.location, 
                    minBid: finalMinBid, buyoutPrice: finalBuyout,
                    marketAverage: marketStats[`${screenId}_${dayOfWeek}_${h}`] || Math.ceil(finalMinBid * 1.5), 
                    isPrime: basePricing.isPrime, isBuyoutDisabled: isBuyoutDisabled,
                    canBid, hoursUntil, isUrgent: hoursUntil > 0 && hoursUntil <= 24, 
                    competitorBid: currentHighestBid, isSoldOut: isLocked, warning
                });
            });
        });
    });
    return slots.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.hour - b.hour || a.screenId - b.screenId);
  }, [selectedScreens, selectedHours, selectedSpecificDates, selectedWeekdays, weekCount, mode, existingBids, isBundleMode, screens, occupiedSlots, marketStats, pricingConfig, specialRules]);

  const pricing = useMemo(() => {
    const availableSlots = generateAllSlots.filter(s => !s.isSoldOut);
    const totalSlots = availableSlots.length; 
    
    let buyoutTotal = 0, currentBidTotal = 0, minBidTotal = 0, urgentCount = 0; 
    let conflicts = [], missingBids = 0, invalidBids = 0; 
    let hasRestrictedBuyout = false, hasRestrictedBid = false, hasUrgentRisk = false;
    let hasDateRestrictedBid = false; 
    let hasPrimeFarFutureLock = false; 

    availableSlots.forEach(slot => {
        // 🔥 Logic Fix: Just Check, Don't Stop
        if (!slot.canBid && slot.isBuyoutDisabled) {
            hasPrimeFarFutureLock = true;
        }

        // Only add to Total if NOT completely locked
        if (!(!slot.canBid && slot.isBuyoutDisabled)) {
             buyoutTotal += slot.buyoutPrice; 
             minBidTotal += slot.minBid; 
        }

        if (slot.isBuyoutDisabled) hasRestrictedBuyout = true;
        
        if (!slot.canBid) {
            hasRestrictedBid = true;
            if (slot.warning === "遠期 (限買斷)" || slot.warning === "急單 (限買斷)") hasDateRestrictedBid = true;
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
        totalSlots, 
        buyoutTotal, currentBidTotal, minBidTotal,
        conflicts, missingBids, invalidBids, urgentCount,
        canStartBidding: totalSlots > 0 && !hasRestrictedBid && !hasPrimeFarFutureLock, 
        isReadyToSubmit: missingBids === 0 && invalidBids === 0,
        hasRestrictedBuyout, hasRestrictedBid, hasUrgentRisk, hasDateRestrictedBid, hasPrimeFarFutureLock
    };
  }, [generateAllSlots, slotBids]);

  const handleBatchBid = () => { const val = parseInt(batchBidInput); if (!val) return; const newBids = { ...slotBids }; generateAllSlots.forEach(slot => { if (!slot.isSoldOut) newBids[slot.key] = val; }); setSlotBids(newBids); showToast(`已將 HK$${val} 應用到所有可用時段`); };
  const handleSlotBidChange = (key, val) => setSlotBids(prev => ({ ...prev, [key]: val }));
  const toggleScreen = (id) => { const newSet = new Set(selectedScreens); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedScreens(newSet); };
  const toggleHour = (val) => { const newSet = new Set(selectedHours); if (newSet.has(val)) newSet.delete(val); else newSet.add(val); setSelectedHours(newSet); };
  const toggleWeekday = (dayIdx) => { const newSet = new Set(selectedWeekdays); if (newSet.has(dayIdx)) newSet.delete(dayIdx); else newSet.add(dayIdx); setSelectedWeekdays(newSet); const d = new Date(); const diff = (dayIdx - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); setPreviewDate(d); };
  const toggleDate = (year, month, day) => { const key = formatDateKey(year, month, day); setPreviewDate(new Date(year, month, day)); if(!isDateAllowed(year, month, day)) return; if (mode === 'recurring') { /* Optional */ } const newSet = new Set(selectedSpecificDates); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); setSelectedSpecificDates(newSet); };
  
  const initiateTransaction = async (type = 'bid') => {
    // Basic validations...
    if (!user) { showToast("請先登入"); return; }
    if (type === 'bid' && pricing.missingBids > 0) { showToast(`❌ 尚有 ${pricing.missingBids} 個時段未出價`); return; }
    if (type === 'bid' && pricing.invalidBids > 0) { showToast(`❌ 有 ${pricing.invalidBids} 個時段出價低於現有最高價`); return; }
    if (!termsAccepted) { showToast('❌ 請先同意條款'); return; }
    
    // Create detailed slots
    const validSlots = generateAllSlots.filter(s => !s.isSoldOut);
    const detailedSlots = validSlots.map(slot => ({
        date: slot.dateStr, hour: slot.hour, screenId: slot.screenId, screenName: slot.screenName,
        bidPrice: type === 'buyout' ? slot.buyoutPrice : (parseInt(slotBids[slot.key]) || 0), isBuyout: type === 'buyout'
    }));

    let slotSummary = mode === 'specific' ? `日期: [${Array.from(selectedSpecificDates).join(', ')}]` : `週期: 逢星期[${Array.from(selectedWeekdays).map(d=>WEEKDAYS_LABEL[d]).join(',')}] x ${weekCount}週`;
    
    // Construct DB Object
    const txnData = {
      amount: type === 'buyout' ? pricing.buyoutTotal : pricing.currentBidTotal, 
      type, detailedSlots, 
      targetDate: detailedSlots[0]?.date || '', 
      isBundle: isBundleMode, 
      slotCount: pricing.totalSlots, 
      creativeStatus: 'empty', 
      conflicts: [], 
      userId: user.uid, userEmail: user.email, userName: user.displayName || 'Guest', 
      createdAt: serverTimestamp(), status: 'pending_auth', 
      hasVideo: false, emailSent: false, 
      screens: Array.from(selectedScreens).map(id => { const s = screens.find(sc => sc.id === id); return s ? s.name : String(id); }), 
      timeSlotSummary: slotSummary
    };

    setIsBidModalOpen(false); setIsBuyoutModalOpen(false);
    
    try {
        setTransactionStep('processing'); // Show spinner
        const docRef = await addDoc(collection(db, "orders"), txnData);
        
        // Save ID for next steps
        localStorage.setItem('temp_order_id', docRef.id); 
        localStorage.setItem('temp_txn_time', new Date().getTime().toString()); 
        setPendingTransaction({ ...txnData, id: docRef.id }); 
        setCurrentOrderId(docRef.id); 
        
        // 🔥 CRITICAL FIX: Update UI immediately
        setTransactionStep('summary'); 

        // 🔥 CRITICAL FIX: Send Email in Background (Non-blocking)
        if (type === 'bid') {
             callEmailService(docRef.id, txnData, false).catch(e => console.warn("Email bg trigger failed:", e));
        }

    } catch (error) { 
        console.error("❌ AddDoc Error:", error);
        showToast("建立訂單失敗"); setTransactionStep('idle'); 
    }
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
    } catch (error) { console.error("❌ Payment Error:", error); showToast(`❌ 系統錯誤: ${error.message}`); setTransactionStep('summary'); }
  };

  const handleBidClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } setTermsAccepted(false); setIsBidModalOpen(true); };
  const handleBuyoutClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } if (pricing.hasRestrictedBuyout && !pricing.hasPrimeFarFutureLock) { showToast('❌ Prime 時段限競價'); return; } setTermsAccepted(false); setIsBuyoutModalOpen(true); };

  // --- Return Objects for View ---
  return {
    user, isAuthReady, isLoginModalOpen, isLoginLoading, isProfileModalOpen, myOrders,
    screens, isScreensLoading, filteredScreens,
    currentDate, previewDate, mode, selectedWeekdays, weekCount, selectedSpecificDates,
    selectedScreens, selectedHours, screenSearchTerm,
    pricing, isBundleMode, generateAllSlots,
    toast, transactionStep, pendingTransaction,
    modalPaymentStatus, creativeStatus, creativeName, isUrgentUploadModalOpen, uploadProgress, isUploadingReal, emailStatus,
    occupiedSlots, 
    
    isBuyoutModalOpen, isBidModalOpen, slotBids, batchBidInput, termsAccepted,
    
    setIsLoginModalOpen, setIsProfileModalOpen, setIsBuyoutModalOpen, setIsBidModalOpen, setIsUrgentUploadModalOpen,
    setCurrentDate, setMode, setSelectedSpecificDates, setSelectedWeekdays, setWeekCount, setScreenSearchTerm, setViewingScreen,
    setBatchBidInput, setTermsAccepted,
    setCurrentOrderId, // Export for App.jsx
    
    handleGoogleLogin, handleLogout,
    toggleScreen, toggleHour, toggleWeekday, toggleDate,
    handleBatchBid, handleSlotBidChange,
    handleBidClick, handleBuyoutClick,
    initiateTransaction, processPayment, handleRealUpload, closeTransaction,
    viewingScreen,
    
    HOURS, WEEKDAYS_LABEL,
    getDaysInMonth, getFirstDayOfMonth, formatDateKey, isDateAllowed, getHourTier
  };
};