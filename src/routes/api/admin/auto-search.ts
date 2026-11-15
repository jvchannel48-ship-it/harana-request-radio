import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError } from '@/lib/http'
import { isAdmin } from '@/lib/auth'

// Admin "Search next songs now": runs AutoDJ immediately instead of waiting for the next listener poll.
export const Route = createFileRoute('/api/admin/auto-search')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const { getAdminStatus, retryPendingRequests, runQueueFill } = await import('@/lib/station')
          await retryPendingRequests()
          await runQueueFill()
          return json({ ...(await getAdminStatus()), persistenceConfigured: true })
        } catch (error) {
          console.error('[morefm] admin auto search failed', error)
          return jsonError('Automatic song search failed. Please try again.')
        }
      },
    },
  },
})
