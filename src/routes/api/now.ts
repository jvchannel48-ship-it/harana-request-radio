import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'

export const Route = createFileRoute('/api/now')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getNowPlaying } = await import('@/lib/station')
          return json(await getNowPlaying())
        } catch (error) {
          console.error('[morefm] now playing failed', error)
          return jsonError('Station unavailable')
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await readBody<{ uid: string }>(request)
          const uid = typeof body.uid === 'string' ? body.uid.slice(0, 200) : ''
          if (!uid) return jsonError('Missing track id.', 400)
          const { recoverFailedTrack } = await import('@/lib/station')
          return json(await recoverFailedTrack(uid))
        } catch (error) {
          console.error('[morefm] failed track recovery', error)
          return jsonError('Station recovery failed')
        }
      },
    },
  },
})
