import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'

export const Route = createFileRoute('/api/listeners')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readBody<{ id: string; active: boolean }>(request)
          if (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.id) || typeof body.active !== 'boolean') {
            return jsonError('Invalid listener heartbeat', 400)
          }
          const { getSettings, registerListener } = await import('@/lib/storage')
          const settings = await getSettings()
          const result = await registerListener(body.id, body.active, settings.listenerLimit)
          return json({
            accepted: result.accepted,
            listenersNow: result.listenersNow,
            listenerLimit: settings.listenerLimit,
            message: result.accepted ? undefined : 'THIS STATION HAS REACHED ITS LISTENER LIMIT. Sorry, please try again later.',
          })
        } catch (error) {
          console.error('[morefm] listener heartbeat failed', error)
          return jsonError('Could not check station listener capacity.', 503)
        }
      },
    },
  },
})
