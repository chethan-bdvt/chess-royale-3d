import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, signInAnonymously, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId && config.appId);

const app = cloudEnabled ? (getApps().length ? getApp() : initializeApp(config)) : null;
let auth: Auth | null = null;

if (app) {
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    auth = getAuth(app);
  }
}

export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app) : null;

export async function currentUserId(): Promise<string> {
  if (!auth) throw new Error('Online play is not configured. Add Firebase values to .env.');
  if (!auth.currentUser) await signInAnonymously(auth);
  if (!auth.currentUser) throw new Error('Could not create a player session.');
  return auth.currentUser.uid;
}
