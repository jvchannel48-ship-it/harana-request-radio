import { createFileRoute } from '@tanstack/react-router'
import { json, readBody } from '@/lib/http'
import { checkPassword, clearSessionCookie, createSessionToken, isAdmin, sessionCookie } from '@/lib/auth'

export const Route = createFileRoute('/api/admin/session')({
  server: {
    handlers: {
      GET: async ({ request }) => json({ admin: await isAdmin(request) }),
      POST: async ({ request }) => {
        const body = await readBody<{ password: string }>(request)
        if (typeof body.password !== 'string' || !checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401)
        const { token, maxAge } = await createSessionToken()
        return json({ admin: true }, 200, { 'Set-Cookie': sessionCookie(token, maxAge) })
      },
      DELETE: async () => json({ admin: false }, 200, { 'Set-Cookie': clearSessionCookie() }),
    },
  },
})
