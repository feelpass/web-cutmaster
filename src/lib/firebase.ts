// Firebase 초기화. NEXT_PUBLIC_FIREBASE_* env가 없으면 클라우드 기능이
// 비활성화된 채로 앱이 동작한다 (로컬 전용 모드).

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;

function getApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase가 설정되지 않았습니다. .env.local의 NEXT_PUBLIC_FIREBASE_* 값을 확인하세요.');
  }
  if (app == null) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(getApp());
}

export function firestore(): Firestore {
  return getFirestore(getApp());
}

export const googleProvider = new GoogleAuthProvider();
