import { auth } from './firebase'

// Returns an Authorization header with the current user's Firebase ID token,
// or an empty object if signed out. Spread into fetch headers for API routes.
export async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
