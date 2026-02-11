import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  signInWithPopup, signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, getDoc, getDocs, writeBatch 
} from "firebase/firestore";
import { 
  ref, uploadBytesResumable, getDownloadURL 
} from "firebase/storage";
import { auth, db, storage, googleProvider } from '../firebase';
import { 
    initEmailService, 
    sendBidReceivedEmail, 
    sendBuyoutSuccessEmail, 
    sendStandardOutbidEmail
} from '../utils/emailService';
import { calculateDynamicPrice } from '../utils/pricingEngine';

export const useDoohSystem = () => {
  const [user, setUser] = useState(null); 
  const [isAuthReady, setIsAuthReady] = useState(false); 
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  
  const [screens, setScreens] = useState([]);
  const [isScreensLoading, setIsScreensLoading] = useState(true);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [specialRules, setSpecialRules] = useState([]);
  const [bundleRules, setBundleRules] = useState([]);

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
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isBuyoutModalOpen, setIsBuyoutModalOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false); 
  
  // 🔥 Added missing state definition here
  const [isTimeMismatchModalOpen, setIsTimeMismatchModalOpen] = useState(false);

  const [emailStatus, setEmailStatus] = useState('idle'); 
  
  const [restrictionModalData, setRestrictionModalData] = useState(null);

  const HOURS = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${String(i).padStart(2, '0')}:00` }));
  const WEEKDAYS_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

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
      let hasPrime = false; let hasGold = false;
      if (selectedScreens.size === 0) return 'normal';
      const currentDayKey = String(previewDate.getDay());
      selectedScreens.forEach(id => {
          const s = screens.find(sc => sc.id == id);
          if (s && s.tierRules) {
              let rules = s.tierRules[currentDayKey];
              if (!rules) rules = s.tierRules["default"];
              if (rules) { if (rules.prime?.includes(h)) hasPrime = true; if (rules.gold?.includes(h)) hasGold = true; }
          } else {
              if (h >= 22 || h < 2) hasPrime = true; else if (h >= 18 && h < 22) hasGold = true;
          }
      });
      if (hasPrime) return 'prime'; if (hasGold) return 'gold'; return 'normal';
  };

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
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPricingConfig(data);
                setBundleRules(data.bundleRules || []);
            }
            else setPricingConfig({});
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

 // 只有真正 "Hold 左錢" (Stripe Webhook 確認) 的單，才有資格做 Highest Bid
  useEffect(() => {
      // 1. 已鎖定 (Sold) 的單
      const qSold = query(collection(db, "orders"), where("status", "in", ["won", "paid", "completed", "partially_won"]));
      
      // 2. 競價中 (Bidding) 的單 
      const qBidding = query(collection(db, "orders"), where("status", "in", [
          "paid_pending_selection", // ✅ Webhook 確認已付款
          "partially_outbid",       // ✅ 已付款但部分輸
          "outbid_needs_action",    // ✅ 已付款但全輸 (佢個價錢依然係有效參考)
          "won",                    // ✅ 已贏
          "partially_won",          // ✅ 部分贏
          "paid"                    // ✅ 已買斷
      ]));

      const unsubSold = onSnapshot(qSold, (snapshot) => {
          const sold = new Set();
          snapshot.docs.forEach(doc => { 
              const data = doc.data();
              if (data.detailedSlots) {
                  data.detailedSlots.forEach(s => {
                      if (['won', 'paid', 'completed'].includes(data.status) || (data.status === 'partially_won' && s.slotStatus === 'won')) {
                          sold.add(`${s.date}-${s.hour}-${s.screenId}`);
                      }
                  });
              }
          });
          setOccupiedSlots(sold);
      });

      const unsubBidding = onSnapshot(qBidding, (snapshot) => {
          const bids = {};
          let bidCount = 0;
          snapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.detailedSlots) {
                  data.detailedSlots.forEach(s => {
                      // Key 生成 (確保格式與 MyOrdersModal 一致)
                      const key = `${s.date}-${parseInt(s.hour)}-${String(s.screenId)}`;
                      const thisBid = parseInt(s.bidPrice) || 0;
                      
                      // 比較大小，保留最高價
                      if (!bids[key] || thisBid > bids[key]) {
                          bids[key] = thisBid;
                      }
                  });
              }
              bidCount++;
          });
          
          console.log(`📡 市場數據更新: 掃描了 ${bidCount} 張訂單，最新最高價分布:`, bids);
          
          setExistingBids(bids);
      }, (error) => {
          console.error("❌ 無法獲取市場出價 (可能是權限問題):", error);
      });
      return () => { unsubSold(); unsubBidding(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };
  
  const handleGoogleLogin = async () => { 
    setIsLoginLoading(true); 
    try { await signInWithPopup(auth, googleProvider); setIsLoginModalOpen(false); showToast(`👋 歡迎回來`); } 
    catch (error) { console.error("Login Error", error); showToast(`❌ 登入失敗: ${error.message}`); } 
    finally { setIsLoginLoading(false); } 
  };
  
  const handleLogout = async () => { try { await signOut(auth); setUser(null); setTransactionStep('idle'); setIsProfileModalOpen(false); showToast("已登出"); } catch (error) { showToast("❌ 登出失敗"); } };
  
  const checkAndNotifyLosers = async (buyoutOrder) => { /* ... */ };
  const checkAndNotifyStandardOutbid = async (newOrder) => { /* ... 保持原狀 ... */ };

const fetchAndFinalizeOrder = async (orderId, isUrlSuccess) => {
    if (!orderId) return;
    const orderRef = doc(db, "orders", orderId);

    if (isUrlSuccess) { 
        setModalPaymentStatus('verifying'); 
    }

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
        if (docSnap.exists()) {
            const orderData = docSnap.data();
            setCreativeStatus(orderData.hasVideo ? 'approved' : 'empty');
            setCreativeName(orderData.videoName || ''); 
            
            const isPaid = ['won', 'paid_pending_selection', 'completed', 'paid', 'partially_outbid', 'outbid_needs_action'].includes(orderData.status);
            
            if (isPaid) { 
                setModalPaymentStatus('paid'); 
                localStorage.removeItem('temp_txn_time'); 
                showToast("✅ 付款已確認！");
            } else { 
                if (isUrlSuccess) setModalPaymentStatus('verifying'); 
            }
        }
    });
    return unsubscribe;
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const qrScreenId = queryParams.get('screen_id');
    if (qrScreenId) {
        const id = parseInt(qrScreenId);
        if (!isNaN(id)) { setSelectedScreens(new Set([id])); showToast(`📍 歡迎！已自動定位到屏幕 #${id}`); }
    }
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
      setIsUploadingReal(true); setCreativeStatus('uploading');
      try {
          const storageRef = ref(storage, `uploads/${targetId}/${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', (snapshot) => { setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); }, 
          (error) => { showToast("❌ 上傳失敗"); setIsUploadingReal(false); setCreativeStatus('empty'); }, 
          async () => { 
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); 
              await updateDoc(doc(db, "orders", targetId), { hasVideo: true, videoUrl: downloadURL, videoName: file.name, uploadedAt: serverTimestamp(), creativeStatus: 'pending_review' }); 
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

  const getMultiplierForScreen = (screenId) => {
      const selectedIds = Array.from(selectedScreens).map(String); 
      let maxRuleMultiplier = 1.0;
      bundleRules.forEach(rule => {
          const ruleIds = rule.screens.map(String);
          if (ruleIds.every(rid => selectedIds.includes(rid)) && ruleIds.includes(String(screenId))) {
              const m = parseFloat(rule.multiplier);
              if (m > maxRuleMultiplier) maxRuleMultiplier = m;
          }
      });
      if (maxRuleMultiplier > 1.0) return maxRuleMultiplier;
      const currentScreen = screens.find(s => String(s.id) === String(screenId));
      if (!currentScreen) return 1.0;
      const myGroup = currentScreen.bundleGroup || currentScreen.bundlegroup;
      if (myGroup) {
          const countInGroup = Array.from(selectedScreens).filter(id => {
              const s = screens.find(sc => String(sc.id) === String(id));
              const g = s?.bundleGroup || s?.bundlegroup;
              return g === myGroup;
          }).length;
          if (countInGroup > 1) { return pricingConfig?.defaultBundleMultiplier || 1.25; }
      }
      return 1.0;
  };

  const isBundleMode = useMemo(() => { for (const id of selectedScreens) { if (getMultiplierForScreen(id) > 1.0) return true; } return false; }, [selectedScreens, screens, bundleRules, pricingConfig]);

  const generateAllSlots = useMemo(() => {
    if (selectedScreens.size === 0 || selectedHours.size === 0 || screens.length === 0 || !pricingConfig) return [];
    let slots = [];
    let datesToProcess = [];
    if (mode === 'specific') {
        datesToProcess = Array.from(selectedSpecificDates).map(dateStr => { const [y, m, d] = dateStr.split('-'); return new Date(y, m-1, d); });
    } else {
        const today = new Date();
        if (selectedWeekdays.size > 0) { for (let i = 0; i < weekCount * 7; i++) { const d = new Date(today); d.setDate(today.getDate() + i); if (selectedWeekdays.has(d.getDay())) datesToProcess.push(d); } }
    }
    datesToProcess.forEach(d => {
        const dateStr = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const dayOfWeek = new Date(d).getDay(); 
        selectedHours.forEach(h => {
            selectedScreens.forEach(screenId => {
                const screen = screens.find(s => s.id === screenId);
                if (!screen) return;
                const key = `${dateStr}-${h}-${screenId}`; 
                const isSoldOut = occupiedSlots.has(key);
                const screenMultiplier = getMultiplierForScreen(screenId);
                const basePricing = calculateDynamicPrice(new Date(d), h, screenMultiplier, screen, pricingConfig, specialRules);
                let currentHighestBid = existingBids[key] || 0;
                let finalBuyout = basePricing.buyoutPrice;
                if (currentHighestBid > 0) { const dynamicFloor = Math.ceil(currentHighestBid * 1.5); if (dynamicFloor > finalBuyout) { finalBuyout = dynamicFloor; } }
                let canBid = basePricing.canBid && !basePricing.isLocked && !isSoldOut;
                let isBuyoutDisabled = basePricing.isBuyoutDisabled; 
                let warning = basePricing.warning;
                const isLocked = basePricing.isLocked || isSoldOut;
                slots.push({ 
                    key, dateStr, hour: h, screenId, screenName: screen.name, location: screen.location, 
                    minBid: basePricing.minBid, buyoutPrice: finalBuyout, marketAverage: marketStats[`${screenId}_${dayOfWeek}_${h}`] || Math.ceil(basePricing.minBid * 1.5), 
                    isPrime: basePricing.isPrime, isBuyoutDisabled: isBuyoutDisabled, canBid, hoursUntil: basePricing.hoursUntil, 
                    isUrgent: basePricing.hoursUntil > 0 && basePricing.hoursUntil <= 24, competitorBid: currentHighestBid, 
                    isSoldOut: isLocked, warning, activeMultiplier: screenMultiplier 
                });
            });
        });
    });
    return slots.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.hour - b.hour || a.screenId - b.screenId);
  }, [selectedScreens, selectedHours, selectedSpecificDates, selectedWeekdays, weekCount, mode, existingBids, screens, occupiedSlots, marketStats, pricingConfig, specialRules, bundleRules]);

  const pricing = useMemo(() => {
    const availableSlots = generateAllSlots.filter(s => !s.isSoldOut);
    const totalSlots = availableSlots.length; 
    let buyoutTotal = 0, currentBidTotal = 0, minBidTotal = 0, urgentCount = 0; 
    let conflicts = [], missingBids = 0, invalidBids = 0; 
    let hasRestrictedBuyout = false, hasRestrictedBid = false, hasUrgentRisk = false;
    let hasDateRestrictedBid = false; let hasPrimeFarFutureLock = false; 
    let maxAppliedMultiplier = 1.0; let futureDateText = null; 
    availableSlots.forEach(slot => {
        if (slot.activeMultiplier > maxAppliedMultiplier) maxAppliedMultiplier = slot.activeMultiplier;
        if (!slot.canBid && slot.isBuyoutDisabled) hasPrimeFarFutureLock = true;
        if (!(!slot.canBid && slot.isBuyoutDisabled)) { buyoutTotal += slot.buyoutPrice; minBidTotal += slot.minBid; }
        if (slot.isBuyoutDisabled) hasRestrictedBuyout = true;
        if (!slot.canBid) {
            hasRestrictedBid = true;
            if (slot.warning && (slot.warning.includes("遠期") || slot.warning.includes("急單"))) {
                hasDateRestrictedBid = true;
                if (slot.warning.includes("遠期") && !futureDateText) futureDateText = slot.warning.replace('🔒 ', '');
            }
        }
        if (slot.hoursUntil < 1) hasUrgentRisk = true; 
        if (slot.isUrgent) urgentCount++; 
        const userPrice = slotBids[slot.key]; 
        if (userPrice) { currentBidTotal += parseInt(userPrice); if (parseInt(userPrice) < slot.minBid) invalidBids++; if (parseInt(userPrice) <= slot.competitorBid) conflicts.push({ ...slot, userPrice }); } else { missingBids++; }
    });
    return { 
        totalSlots, buyoutTotal, currentBidTotal, minBidTotal, conflicts, missingBids, invalidBids, urgentCount,
        canStartBidding: totalSlots > 0 && !hasRestrictedBid && !hasPrimeFarFutureLock, 
        isReadyToSubmit: missingBids === 0 && invalidBids === 0,
        hasRestrictedBuyout, hasRestrictedBid, hasUrgentRisk, hasDateRestrictedBid, hasPrimeFarFutureLock,
        currentBundleMultiplier: maxAppliedMultiplier, futureDateText 
    };
  }, [generateAllSlots, slotBids]);

  const handleBatchBid = () => { const val = parseInt(batchBidInput); if (!val) return; const newBids = { ...slotBids }; generateAllSlots.forEach(slot => { if (!slot.isSoldOut) newBids[slot.key] = val; }); setSlotBids(newBids); showToast(`已將 HK$${val} 應用到所有可用時段`); };
  const handleSlotBidChange = (key, val) => setSlotBids(prev => ({ ...prev, [key]: val }));
  const toggleScreen = (id) => { const newSet = new Set(selectedScreens); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedScreens(newSet); };
  const toggleHour = (val) => { const newSet = new Set(selectedHours); if (newSet.has(val)) newSet.delete(val); else newSet.add(val); setSelectedHours(newSet); };
  const toggleWeekday = (dayIdx) => { const newSet = new Set(selectedWeekdays); if (newSet.has(dayIdx)) newSet.delete(dayIdx); else newSet.add(dayIdx); setSelectedWeekdays(newSet); const d = new Date(); const diff = (dayIdx - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); setPreviewDate(d); };
  const toggleDate = (year, month, day) => { const key = formatDateKey(year, month, day); setPreviewDate(new Date(year, month, day)); if(!isDateAllowed(year, month, day)) return; const newSet = new Set(selectedSpecificDates); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); setSelectedSpecificDates(newSet); };
  
  const checkOrderRestrictions = (type) => {
      const selectedScreenIds = Array.from(selectedScreens);
      const restrictedScreens = screens.filter(s => selectedScreenIds.includes(String(s.id)) && s.restrictions && s.restrictions.trim().length > 0);
      if (restrictedScreens.length > 0) { setRestrictionModalData({ screens: restrictedScreens, type }); return false; }
      return true; 
  };

 const initiateTransaction = async (type = 'bid', forceProceed = false) => {
    if (!user) { showToast("請先登入"); return; }
    
    // 🔥 FIXED: Added backticks around the template strings below
    if (type === 'bid' && pricing.missingBids > 0) { showToast(`❌ 尚有 ${pricing.missingBids} 個時段未出價`); return; }
    if (type === 'bid' && pricing.invalidBids > 0) { showToast(`❌ 有 ${pricing.invalidBids} 個時段出價低於現有最高價`); return; }
    
    if (!termsAccepted) { showToast('❌ 請先同意條款'); return; }

    const validSlotsToCheck = generateAllSlots.filter(s => !s.isSoldOut);
    
    if (type === 'bid' && validSlotsToCheck.length > 0) {
        const firstSlot = validSlotsToCheck[0];
        
        const isAllSameTime = validSlotsToCheck.every(slot => 
            slot.dateStr === firstSlot.dateStr && slot.hour === firstSlot.hour
        );

        if (!isAllSameTime) {
            setIsTimeMismatchModalOpen(true);
            return; 
        }
    }

    if (!forceProceed && !checkOrderRestrictions(type)) return;

    const validSlots = generateAllSlots.filter(s => !s.isSoldOut);
    const detailedSlots = validSlots.map(slot => ({ date: slot.dateStr, hour: slot.hour, screenId: slot.screenId, screenName: slot.screenName, bidPrice: type === 'buyout' ? slot.buyoutPrice : (parseInt(slotBids[slot.key]) || 0), isBuyout: type === 'buyout' }));
    const hoursStr = Array.from(selectedHours).sort((a,b)=>a-b).map(h => `${String(h).padStart(2,'0')}:00`).join(', ');
    const screenNamesStr = Array.from(selectedScreens).map(id => { const s = screens.find(sc => sc.id === id); return s ? s.name : `Screen ${id}`; }).join(', ');
    let slotSummary = "";
    if (mode === 'specific') { const datesStr = Array.from(selectedSpecificDates).join(', '); slotSummary = `日期: [${datesStr}] | 時間: [${hoursStr}] | 屏幕: [${screenNamesStr}]`; } 
    else { const weekDaysStr = Array.from(selectedWeekdays).map(d=>WEEKDAYS_LABEL[d]).join(','); slotSummary = `週期: 逢星期[${weekDaysStr}] x ${weekCount}週 | 時間: [${hoursStr}] | 屏幕: [${screenNamesStr}]`; }
    
    const txnData = { amount: type === 'buyout' ? pricing.buyoutTotal : pricing.currentBidTotal, type, detailedSlots, targetDate: detailedSlots[0]?.date || '', isBundle: isBundleMode, slotCount: pricing.totalSlots, creativeStatus: 'empty', conflicts: [], userId: user.uid, userEmail: user.email, userName: user.displayName || 'Guest', createdAt: serverTimestamp(), status: 'pending_auth', hasVideo: false, emailSent: false, screens: Array.from(selectedScreens).map(id => { const s = screens.find(sc => sc.id === id); return s ? s.name : String(id); }), timeSlotSummary: slotSummary };
    
    setIsBidModalOpen(false); 
    setIsBuyoutModalOpen(false);
    setRestrictionModalData(null); 
    setTransactionStep('processing');
    
    try { 
        const docRef = await addDoc(collection(db, "orders"), txnData); 
        localStorage.setItem('temp_order_id', docRef.id); 
        localStorage.setItem('temp_txn_time', new Date().getTime().toString()); 
        setPendingTransaction({ ...txnData, id: docRef.id }); 
        setCurrentOrderId(docRef.id); 
        setTransactionStep('summary'); 
    } catch (error) { 
        console.error("❌ AddDoc Error:", error); 
        showToast("建立訂單失敗"); 
        setTransactionStep('idle'); 
    }
  };

  const resumePayment = (order) => {
      setPendingTransaction(order);
      setCurrentOrderId(order.id);
      localStorage.setItem('temp_order_id', order.id);
      setTransactionStep('summary');
      setIsProfileModalOpen(false);
  };

  const processPayment = async () => {
    setTransactionStep('processing');
    const targetId = localStorage.getItem('temp_order_id') || currentOrderId;
    if (!targetId) { showToast("訂單 ID 錯誤"); setTransactionStep('summary'); return; }
    const currentUrl = window.location.origin + window.location.pathname;
    const captureMethod = pendingTransaction && pendingTransaction.type === 'buyout' ? 'automatic' : 'manual';
    try { const response = await fetch('/.netlify/functions/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: pendingTransaction ? pendingTransaction.amount : pricing.buyoutTotal, productName: `${pendingTransaction && pendingTransaction.type === 'buyout' ? '買斷' : '競價'} - ${pendingTransaction ? pendingTransaction.slotCount : 0} 時段`, orderId: targetId, successUrl: `${currentUrl}?success=true&order_id=${targetId}`, cancelUrl: `${currentUrl}?canceled=true`, customerEmail: user.email, captureMethod: captureMethod, orderType: pendingTransaction.type }), }); const data = await response.json(); if (response.ok && data.url) { window.location.href = data.url; } else { throw new Error(data.error); } } catch (error) { console.error("❌ Payment Error:", error); showToast(`❌ 系統錯誤: ${error.message}`); setTransactionStep('summary'); }
  };

  const handleUpdateBid = async (orderId, slotIndex, newPrice, newTotalAmount) => {
      if (!user) return alert("請先登入");
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return alert("找不到訂單");
      const orderData = orderSnap.data();
      const oldSlots = [...orderData.detailedSlots];
      const targetSlot = oldSlots[slotIndex];
      const slotDateTimeStr = `${targetSlot.date} ${String(targetSlot.hour).padStart(2, '0')}:00`;
      const slotDateObj = new Date(slotDateTimeStr);
      if (new Date() >= slotDateObj) return alert(`❌ 截標失敗：時段已過期`);
      
      oldSlots[slotIndex] = { ...targetSlot, bidPrice: newPrice, slotStatus: 'normal' };
      
      try {
          await updateDoc(orderRef, { detailedSlots: oldSlots, amount: newTotalAmount, status: 'pending_reauth', lastUpdated: serverTimestamp() });
          
          const tempOrder = { ...orderData, detailedSlots: oldSlots, id: orderId };
          await checkAndNotifyStandardOutbid(tempOrder);

      } catch (e) { console.error("Update DB Error", e); return alert("更新失敗"); }
      
      setCurrentOrderId(orderId);
      localStorage.setItem('temp_order_id', orderId);
      setPendingTransaction({ id: orderId, amount: newTotalAmount, type: 'bid', slotCount: oldSlots.length });
      setIsProfileModalOpen(false);
      setTransactionStep('summary');
  };

  const recalculateAllBids = async () => { console.log("Recalc"); };

  const handleBidClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } setTermsAccepted(false); setIsBidModalOpen(true); };
  const handleBuyoutClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } if (pricing.hasRestrictedBuyout && !pricing.hasPrimeFarFutureLock) { showToast('❌ Prime 時段限競價'); return; } setTermsAccepted(false); setIsBuyoutModalOpen(true); };

  const handleProceedAfterRestriction = () => {
      const type = restrictionModalData?.type || 'bid';
      initiateTransaction(type, true);
  };

  return {
    user, isAuthReady, isLoginModalOpen, isLoginLoading, isProfileModalOpen, myOrders,
    screens, isScreensLoading, filteredScreens,
    currentDate, previewDate, mode, selectedWeekdays, weekCount, selectedSpecificDates,
    selectedScreens, selectedHours, screenSearchTerm,
    pricing, isBundleMode, generateAllSlots,
    toast, transactionStep, pendingTransaction,
    modalPaymentStatus, creativeStatus, creativeName, isUrgentUploadModalOpen, uploadProgress, isUploadingReal, emailStatus,
    occupiedSlots, isBuyoutModalOpen, isBidModalOpen, slotBids, batchBidInput, termsAccepted, 
    
    isTimeMismatchModalOpen,      
    setIsTimeMismatchModalOpen,   

    restrictionModalData, 
    setRestrictionModalData,
    handleProceedAfterRestriction,
    
    resumePayment,

    setIsLoginModalOpen, setIsProfileModalOpen, setIsBuyoutModalOpen, setIsBidModalOpen, setIsUrgentUploadModalOpen,
    setCurrentDate, setMode, setSelectedSpecificDates, setSelectedWeekdays, setWeekCount, setScreenSearchTerm, setViewingScreen,
    setBatchBidInput, setTermsAccepted, setCurrentOrderId, 
    handleGoogleLogin, handleLogout, toggleScreen, toggleHour, toggleWeekday, toggleDate, handleBatchBid, handleSlotBidChange, handleBidClick, handleBuyoutClick, initiateTransaction, processPayment, handleRealUpload, closeTransaction, viewingScreen,
    handleUpdateBid, 
    recalculateAllBids,
    HOURS, WEEKDAYS_LABEL, getDaysInMonth, getFirstDayOfMonth, formatDateKey, isDateAllowed, getHourTier,
    existingBids
  };
};