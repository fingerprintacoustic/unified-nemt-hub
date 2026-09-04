import { FirebaseError } from 'firebase/app'

/** Maps Firebase error codes to user-friendly, non-sensitive messages. */
export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.'
      case 'auth/invalid-email':
        return 'Please enter a valid email address.'
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact your administrator.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.'
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.'
      case 'permission-denied':
        return 'You do not have permission to perform this action.'
      case 'unavailable':
        return 'Service temporarily unavailable. Please try again shortly.'
      default:
        return fallback
    }
  }
  return fallback
}