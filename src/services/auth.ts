import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from '../lib/firebase'

export type { User as FirebaseUser } from 'firebase/auth'

export const AUTH_PERSISTENCE_KEY = 'nemt.authStatus'

export async function initAuthListener(onUser: (user: User | null) => void): Promise<void> {
  const auth = getFirebaseAuth()
  await setPersistence(auth, browserLocalPersistence)
  onAuthStateChanged(auth, onUser)
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth()
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export async function logout(): Promise<void> {
  const auth = getFirebaseAuth()
  await signOut(auth)
}

/**
 * Sends Firebase Auth's own hosted password-reset email -- no third-party
 * mail vendor needed, works out of the box from Firebase's own sending
 * infrastructure. Callers should show the same generic confirmation
 * regardless of success or failure (including auth/user-not-found) so this
 * can't be used to enumerate which emails have accounts.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth()
  await sendPasswordResetEmail(auth, email.trim())
}

/**
 * Convenience for service workers / PWA bootstrap: reports whether a user was
 * signed in before this page loaded. Backed by Firebase Auth session state.
 */
export function hasStoredAuthSession(): boolean {
  return localStorage.getItem(AUTH_PERSISTENCE_KEY) === 'true'
}