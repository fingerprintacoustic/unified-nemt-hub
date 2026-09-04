import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore as firebaseGetFirestore, type Firestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage'
import { firebaseEnv, hasFirebaseConfig } from '../config/env'

const EMULATOR_HOST = '127.0.0.1'
const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199 } as const

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null
let storage: FirebaseStorage | null = null

const useEmulators = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true'

export function getFirebaseApp(): FirebaseApp {
  if (app) return app
  if (!hasFirebaseConfig()) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env and fill in your Firebase web app credentials.',
    )
  }
  app = initializeApp({
    apiKey: firebaseEnv.apiKey,
    authDomain: firebaseEnv.authDomain,
    projectId: firebaseEnv.projectId,
    storageBucket: firebaseEnv.storageBucket,
    messagingSenderId: firebaseEnv.messagingSenderId,
    appId: firebaseEnv.appId,
    measurementId: firebaseEnv.measurementId || undefined,
  })
  return app
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth
  auth = getAuth(getFirebaseApp())
  if (useEmulators) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`)
  }
  return auth
}

export function getFirestore(): Firestore {
  if (firestore) return firestore
  firestore = firebaseGetFirestore(getFirebaseApp())
  if (useEmulators) {
    connectFirestoreEmulator(firestore, EMULATOR_HOST, EMULATOR_PORTS.firestore)
  }
  return firestore
}

export function getFirebaseStorage(): FirebaseStorage {
  if (storage) return storage
  storage = getStorage(getFirebaseApp())
  if (useEmulators) {
    connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage)
  }
  return storage
}