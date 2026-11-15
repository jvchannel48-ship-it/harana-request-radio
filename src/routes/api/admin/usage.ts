import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError } from '@/lib/http'
import { isAdmin } from '@/lib/auth'

export const Route = createFileRoute('/api/admin/usage')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const { getStorageUsage } = await import('@/lib/storage')
          return json({ usage: await getStorageUsage() })
        } catch {
          return json({ usage: null, unavailable: true, error: 'Storage usage is unavailable.' })
        }
      },
    },
  },
})
