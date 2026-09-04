/**
 * Typed access to environment variables.
 * All Firebase config values are optional at build time so the app can start
 * in local development before a Firebase project is connected. A `.env`
 * file is never committed — copy `.env.example` to `.env` and fill in real values.
 */

interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId: string
}

const read = (key: string): string => import.meta.env[key] ?? ''

export const firebaseEnv: FirebaseEnv = {
  apiKey: read('VITE_FIREBASE_API_KEY'),
  authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: read('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: read('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: read('VITE_FIREBASE_APP_ID'),
  measurementId: read('VITE_FIREBASE_MEASUREMENT_ID'),
}

export const hasFirebaseConfig = (): boolean =>
  firebaseEnv.apiKey.length > 0 && firebaseEnv.projectId.length > 0

export const appName = 'Unified NEMT Operations Hub'