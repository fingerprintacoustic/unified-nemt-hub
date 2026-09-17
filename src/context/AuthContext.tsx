import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { hasFirebaseConfig } from '../config/env'
import { getFirebaseAuth, getFirestore } from '../lib/firebase'
import { loginWithEmail, logout, type FirebaseUser } from '../services/auth'
import { observeOrganization } from '../services/organizations'
import { observeUserRecord } from '../services/users'
import type { OrganizationRecord, UserRecord } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unconfigured'

export interface AuthContextValue {
  status: AuthStatus
  user: FirebaseUser | null
  userRecord: UserRecord | null
  organization: OrganizationRecord | null
  isBooting: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const USE_AUTH_DEMO_MODE = 'You can run the app without Firebase configured yet.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    hasFirebaseConfig() ? 'loading' : 'unconfigured',
  )
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [organization, setOrganization] = useState<OrganizationRecord | null>(null)

  const handleUser = useCallback((user: FirebaseUser | null) => {
    setFirebaseUser(user)
    setUserRecord(null)
    setOrganization(null)
    if (user) {
      // Observe the Firestore user record for the signed-in UID..
      const unsubscribe = observeUserRecord(
        user.uid,
        (record) => {
          setUserRecord(record)
          if (record) {
            setStatus('authenticated')
          } else if (user.emailVerified || user.email) {
            // Signed into Auth but no user doc yet — keep unauthenticated until roles resolve..
            setStatus('unauthenticated')
          }
        },
        (error) => {
          console.error('Failed to observe user record:', error)
        },
      )
      return unsubscribe
    }
    setStatus('unauthenticated')
    return undefined
  }, [])

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    getFirestore() // ensure emulator wiring happens before auth listener
    const unsubscribe = observeAuthUser(handleUser)
    return () => unsubscribe?.()
  }, [handleUser])

  useEffect(() => {
    if (!userRecord?.organizationId) return
    return observeOrganization(userRecord.organizationId, setOrganization, (error) => {
      console.error('Failed to load organization record:', error)
      setOrganization(null)
    })
  }, [userRecord?.organizationId])

  const login = useCallback(async (email: string, password: string) => {
    const user = await loginWithEmail(email, password)
    handleUser(user)
  }, [handleUser])

  const logoutUser = useCallback(async () => {
    await logout()
    setFirebaseUser(null)
    setUserRecord(null)
    setOrganization(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: firebaseUser,
      userRecord,
      organization,
      isBooting: status === 'loading',
      login,
      logout: logoutUser,
    }),
    [status, firebaseUser, userRecord, organization, login, logoutUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Firebase Auth state observer — thin wrapper around onAuthStateChanged. */
function observeAuthUser(onUser: (user: FirebaseUser | null) => void): () => void {
  const auth = getFirebaseAuth()
  return onAuthStateChanged(auth, onUser)
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}