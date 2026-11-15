import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError } from '@/lib/http'

// The player calls this when the upcoming queue is short, so AutoDJ searches the next songs.
export const Route = createFileRoute('/api/tick')({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runQueueFill } = await import('@/lib/station')
          await runQueueFill()
          return json({ ok: true })
        } catch (error) {
          console.error('[morefm] AutoDJ refill failed', error)
          return jsonError('AutoDJ refill failed')
        }
      },
    },
  },
})
