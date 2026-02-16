// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCcHkOYa7cMORGOGZDLO02yZ-YagZoVNPY", 
  authDomain: "lkf-ad-bid.firebaseapp.com",
  projectId: "lkf-ad-bid",
  storageBucket: "lkf-ad-bid.firebasestorage.app",
  messagingSenderId: "198839759397",
  appId: "1:198839759397:web:c6d8835754159a564605cc",
  measurementId: "G-BQHMNDZT2C"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
// 設定 Long Polling 以避免部分網絡環境 (如公司 Wifi) 的連線問題
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();