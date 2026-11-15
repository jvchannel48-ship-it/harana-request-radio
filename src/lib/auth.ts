export const ADMIN_COOKIE = 'morefm_admin'
const SESSION_DAYS = 30
const encoder = new TextEncoder()

function adminPassword() {
  return process.env.ADMIN_PASSWORD ?? '09485054936'
}

function secret() {
  return process.env.ADMIN_SECRET ?? `${adminPassword()}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'morefm'}`
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

export function checkPassword(input: string) {
  return safeEqual(input.trim(), adminPassword())
}

export async function createSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = `admin.${exp}`
  return { token: `${payload}.${await sign(payload)}`, maxAge: SESSION_DAYS * 24 * 60 * 60 }
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(/;\s*/)) {
    const index = part.indexOf('=')
    if (index > 0 && part.slice(0, index) === name) return decodeURIComponent(part.slice(index + 1))
  }
  return null
}

export function sessionCookie(token: string, maxAge: number) {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`
}

export function clearSessionCookie() {
  return `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`
}

export async function isAdmin(request: Request) {
  const token = readCookie(request, ADMIN_COOKIE)
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [role, exp, sig] = parts
  if (role !== 'admin' || Number(exp) < Date.now()) return false
  return safeEqual(sig, await sign(`${role}.${exp}`))
}
