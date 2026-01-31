import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage, googleProvider } from './firebase'; 

// Components
import Header from './components/Header';
import InfoBox from './components/InfoBox';
import ScreenSelector from './components/ScreenSelector';
import DateSelector from './components/DateSelector';
import TimeSlotSelector from './components/TimeSlotSelector';
import PricingSummary from './components/PricingSummary';
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
                    canBid = false;
                    warning = "急單 (限買斷)"; 
                    
                    // 🔥 修正：急單即使是 Prime Time，也可以 Buyout
                    if (basePricing.isPrime) {
                        isBuyoutDisabled = false; // 允許 Buyout
                    }
                }
                
                // --- 2. 遠期 (> 7天) ---
                else if (slotTime > sevenDaysLater) {
                    canBid = false;
                    warning = "遠期 (限買斷)";
                    // Prime Time 本身 isBuyoutDisabled=true，所以結果是：canBid=false AND isBuyoutDisabled=true -> 無法交易
                    if (isBuyoutDisabled) {
                        warning = "遠期 Prime (暫未開放，請於7天內競價)";
                    }
                }
                
                // --- 3. 競價區 (24h - 7d) ---
                // 這裡保持 pricingEngine 的設定

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
    let hasPrimeFarFutureLock = false;

    availableSlots.forEach(slot => {
        // 如果完全鎖死 (不能 Bid 也不能 Buyout)，不算入價格計算
        if (!slot.canBid && slot.isBuyoutDisabled) {
            hasPrimeFarFutureLock = true;
            return;
        }

        buyoutTotal += slot.buyoutPrice; minBidTotal += slot.minBid; 
        
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
        totalSlots: availableSlots.length, buyoutTotal, currentBidTotal, minBidTotal,
        conflicts, missingBids, invalidBids, soldOutCount: generateAllSlots.length - availableSlots.length, urgentCount,
        canStartBidding: availableSlots.length > 0 && !hasRestrictedBid,
        isReadyToSubmit: missingBids === 0 && invalidBids === 0,
        hasRestrictedBuyout, hasRestrictedBid, hasUrgentRisk, hasDateRestrictedBid, hasPrimeFarFutureLock
    };
  }, [generateAllSlots, slotBids]);

  const handleBatchBid = () => { const val = parseInt(batchBidInput); if (!val) return; const newBids = { ...slotBids }; generateAllSlots.forEach(slot => { if (!slot.isSoldOut) newBids[slot.key] = val; }); setSlotBids(newBids); showToast(`已將 HK$${val} 應用到所有可用時段`); };
  const handleSlotBidChange = (key, val) => setSlotBids(prev => ({ ...prev, [key]: val }));
  const toggleScreen = (id) => { const newSet = new Set(selectedScreens); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedScreens(newSet); };
  const toggleHour = (val) => { const newSet = new Set(selectedHours); if (newSet.has(val)) newSet.delete(val); else newSet.add(val); setSelectedHours(newSet); };
  const toggleWeekday = (d) => { const newSet = new Set(selectedWeekdays); newSet.has(d) ? newSet.delete(d) : newSet.add(d); setSelectedWeekdays(newSet); };
  const toggleDate = (y, m, d) => { const key = formatDateKey(y, m, d); setPreviewDate(new Date(y, m, d)); if(!isDateAllowed(y, m, d)) return; const newSet = new Set(selectedSpecificDates); newSet.has(key) ? newSet.delete(key) : newSet.add(key); setSelectedSpecificDates(newSet); };

  const initiateTransaction = async (type = 'bid') => {
    const validSlots = generateAllSlots.filter(s => !s.isSoldOut);
    if (type === 'bid' && pricing.missingBids > 0) { showToast(`❌ 尚有 ${pricing.missingBids} 個時段未出價`); return; }
    if (type === 'bid' && pricing.invalidBids > 0) { showToast(`❌ 有 ${pricing.invalidBids} 個時段出價低於現有最高價`); return; }
    if (!termsAccepted) { showToast('❌ 請先同意條款'); return; }
    
    const detailedSlots = validSlots.map(slot => ({
        date: slot.dateStr, hour: slot.hour, screenId: slot.screenId, screenName: slot.screenName,
        bidPrice: type === 'buyout' ? slot.buyoutPrice : (parseInt(slotBids[slot.key]) || 0), isBuyout: type === 'buyout'
    }));

    let slotSummary = mode === 'specific' ? `日期: [${Array.from(selectedSpecificDates).join(', ')}]` : `週期: 週[${Array.from(selectedWeekdays).map(d=>WEEKDAYS_LABEL[d]).join(',')}] x ${weekCount}`;
    const txnData = {
      amount: type === 'buyout' ? pricing.buyoutTotal : pricing.currentBidTotal, 
      type, detailedSlots, targetDate: detailedSlots[0]?.date, isBundle: isBundleMode, slotCount: pricing.totalSlots, 
      creativeStatus, conflicts: pricing.conflicts, userId: user.uid, userEmail: user.email, userName: user.displayName, 
      createdAt: serverTimestamp(), status: 'pending_auth', hasVideo: false, emailSent: false, 
      screens: Array.from(selectedScreens).map(id => screens.find(s => s.id === id)?.name || 'Unknown'), timeSlotSummary: slotSummary
    };

    setIsBidModalOpen(false); setIsBuyoutModalOpen(false);
    try {
        setTransactionStep('processing');
        const docRef = await addDoc(collection(db, "orders"), txnData);
        localStorage.setItem('temp_order_id', docRef.id); localStorage.setItem('temp_txn_time', new Date().getTime().toString()); 
        setPendingTransaction({ ...txnData, id: docRef.id }); setCurrentOrderId(docRef.id); setTransactionStep('summary');
    } catch (error) { showToast("建立訂單失敗"); setTransactionStep('idle'); }
  };

  const processPayment = async () => {
    setTransactionStep('processing');
    const targetId = localStorage.getItem('temp_order_id') || currentOrderId;
    if (!targetId) { showToast("訂單 ID 錯誤"); return; }
    try {
        const res = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                amount: pendingTransaction.amount, productName: `${pendingTransaction.type === 'buyout' ? '買斷' : '競價'} - ${pendingTransaction.slotCount} 時段`, 
                orderId: targetId, successUrl: `${window.location.origin}${window.location.pathname}?success=true&order_id=${targetId}`, 
                cancelUrl: `${window.location.origin}${window.location.pathname}?canceled=true`, customerEmail: user.email, 
                orderType: pendingTransaction.type 
            }),
        });
        const data = await res.json();
        if (res.ok && data.url) window.location.href = data.url; else throw new Error(data.error);
    } catch (error) { showToast(`❌ 系統錯誤`); setTransactionStep('summary'); }
  };

  const handleBidClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } setTermsAccepted(false); setIsBidModalOpen(true); };
  const handleBuyoutClick = () => { if (!user) { setIsLoginModalOpen(true); return; } if (pricing.totalSlots === 0) { showToast('❌ 請先選擇'); return; } if (pricing.hasRestrictedBuyout && !pricing.hasPrimeFarFutureLock) { showToast('❌ Prime 時段限競價'); return; } setTermsAccepted(false); setIsBuyoutModalOpen(true); };

  const renderCalendar = () => { 
    const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const daysInMonth = getDaysInMonth(year, month); const firstDayIdx = getFirstDayOfMonth(year, month); const days = []; 
    for (let i = 0; i < firstDayIdx; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>); 
    for (let d = 1; d <= daysInMonth; d++) { 
        const dateKey = formatDateKey(year, month, d); const isAllowed = isDateAllowed(year, month, d); const isSelected = mode === 'specific' ? selectedSpecificDates.has(dateKey) : false; 
        let isPreview = false; if (mode === 'recurring' && isAllowed && selectedWeekdays.has(new Date(year, month, d).getDay())) isPreview = true;
        days.push(<button key={dateKey} onClick={() => toggleDate(year, month, d)} disabled={!isAllowed || (mode === 'recurring' && !isPreview)} className={`h-10 w-full rounded-md text-sm font-medium transition-all ${!isAllowed ? 'text-slate-300 cursor-not-allowed bg-slate-50' : isSelected ? 'bg-blue-600 text-white shadow-md' : isPreview ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}>{d}</button>); 
    } 
    return days; 
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 relative pt-8">
      {/* Header (Components) */}
      <Header user={user} onLoginClick={() => setIsLoginModalOpen(true)} onProfileClick={() => setIsProfileModalOpen(true)} />

      <main className="max-w-5xl mx-auto p-3 md:p-4 space-y-4 md:space-y-6">
        <InfoBox />

        <ScreenSelector 
          selectedScreens={selectedScreens} 
          screenSearchTerm={screenSearchTerm} 
          setScreenSearchTerm={setScreenSearchTerm} 
          isScreensLoading={isScreensLoading} 
          filteredScreens={filteredScreens} 
          toggleScreen={toggleScreen} 
          setViewingScreen={setViewingScreen} 
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <DateSelector 
            mode={mode} setMode={setMode} setSelectedSpecificDates={setSelectedSpecificDates}
            currentDate={currentDate} setCurrentDate={setCurrentDate}
            selectedWeekdays={selectedWeekdays} toggleWeekday={toggleWeekday}
            weekCount={weekCount} setWeekCount={setWeekCount}
            renderCalendar={renderCalendar}
          />
          <TimeSlotSelector 
            HOURS={HOURS} previewDate={previewDate} selectedScreens={selectedScreens} occupiedSlots={occupiedSlots}
            getHourTier={getHourTier} selectedHours={selectedHours} toggleHour={toggleHour}
          />
        </div>

        <PricingSummary 
          pricing={pricing} 
          isBundleMode={isBundleMode} 
          handleBidClick={handleBidClick} 
          handleBuyoutClick={handleBuyoutClick} 
        />
      </main>

      {/* Modals */}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full z-50">{toast}</div>}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} handleGoogleLogin={handleGoogleLogin} isLoginLoading={isLoginLoading} />
      <ScreenDetailModal screen={viewingScreen} onClose={() => setViewingScreen(null)} />
      <MyOrdersModal isOpen={isProfileModalOpen} user={user} myOrders={myOrders} onClose={() => setIsProfileModalOpen(false)} onLogout={handleLogout} onUploadClick={(id) => { setCurrentOrderId(id); setIsUrgentUploadModalOpen(true); setIsProfileModalOpen(false); }} />
      {isBuyoutModalOpen && <BuyoutModal isOpen={isBuyoutModalOpen} onClose={() => setIsBuyoutModalOpen(false)} pricing={pricing} selectedSpecificDates={selectedSpecificDates} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('buyout')} hasUrgentRisk={pricing.hasUrgentRisk} />}
      {isBidModalOpen && <BiddingModal isOpen={isBidModalOpen} onClose={() => setIsBidModalOpen(false)} generateAllSlots={generateAllSlots} slotBids={slotBids} handleSlotBidChange={handleSlotBidChange} batchBidInput={batchBidInput} setBatchBidInput={setBatchBidInput} handleBatchBid={handleBatchBid} isBundleMode={isBundleMode} pricing={pricing} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onConfirm={() => initiateTransaction('bid')} />}
      {isUrgentUploadModalOpen && <UrgentUploadModal isOpen={isUrgentUploadModalOpen} modalPaymentStatus={modalPaymentStatus} creativeStatus={creativeStatus} isUploadingReal={isUploadingReal} uploadProgress={uploadProgress} handleRealUpload={handleRealUpload} emailStatus={emailStatus} onClose={() => { setIsUrgentUploadModalOpen(false); closeTransaction(); }} />}
      {transactionStep !== 'idle' && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6 text-center">{transactionStep === 'summary' && pendingTransaction ? (<><h3 className="text-lg font-bold mb-4">訂單摘要</h3><p className="mb-4">{pendingTransaction.type === 'buyout' ? '買斷 (即扣款)' : '競價 (預授權)'}</p><p className="text-xl font-bold text-blue-600 mb-6">HK$ {pendingTransaction.amount}</p><button onClick={processPayment} className="w-full bg-slate-900 text-white py-3 rounded font-bold">前往付款</button></>) : <><Loader2 className="animate-spin mx-auto mb-4"/><p>處理中...</p></>}</div></div>)}
    </div>
  );
};
export default DOOHBiddingSystem;