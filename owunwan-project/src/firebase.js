// ============================================
// Firebase 설정 파일
// 아래 값들을 본인의 Firebase 프로젝트 정보로 교체하세요.
// 나비워십과 다른 새 Firebase 프로젝트를 만드세요!
// ============================================

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9loxjEqPEAiUTU5SDjFdsKecb0Qfuago",
  authDomain: "ownwan-prayer.firebaseapp.com",
  projectId: "ownwan-prayer",
  storageBucket: "ownwan-prayer.firebasestorage.app",
  messagingSenderId: "897042238952",
  appId: "1:897042238952:web:1ac63c3ddba6361a33e85d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);