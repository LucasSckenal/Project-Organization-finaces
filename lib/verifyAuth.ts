// ─── Server-side Firebase ID token verification ─────────────────────────────
// Verifies the caller's Firebase ID token against Google's public keys (JWKS)
// using only the public project id — no service-account secrets required.

import { createRemoteJWKSet, jwtVerify } from 'jose'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

// Google's public JWKs for Firebase Auth (Secure Token Service)
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

export interface AuthedUser { uid: string; email?: string }

// Returns the authenticated user, or null if the token is missing/invalid.
export async function verifyRequest(req: Request): Promise<AuthedUser | null> {
  if (!PROJECT_ID) return null

  const header = req.headers.get('authorization') ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer:   `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    })
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    return { uid: payload.sub, email: payload.email as string | undefined }
  } catch {
    return null
  }
}
