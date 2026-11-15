import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'
import { isAdmin } from '@/lib/auth'

export const Route = createFileRoute('/api/admin/requests')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const { getRecentSongRequests } = await import('@/lib/storage')
          return json({ requests: await getRecentSongRequests(60) })
        } catch (error) {
          console.error('[morefm] admin song request list failed', error)
          return jsonError('Could not load song requests.')
        }
      },
      // Paste a message you received (Facebook, text, etc.): title and artist are read and queued automatically.
      // `{ retry: true }` searches again for every pending request.
      POST: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const body = await readBody<{ message: string; name: string; retry: boolean }>(request)
          const station = await import('@/lib/station')
          if (body.retry === true) return json({ retried: await station.retryPendingRequests() })
          const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
          if (message.length < 3) return jsonError('Paste the song request message first.', 400)
          const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Message'
          return json(await station.submitSongMessage(message, name))
        } catch (error) {
          console.error('[morefm] admin message request failed', error)
          return jsonError('Could not read that song request.')
        }
      },
      PATCH: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const body = await readBody<{ id: string; status: string }>(request)
          if (typeof body.id !== 'string' || !['played', 'skipped', 'pending'].includes(String(body.status))) return jsonError('Invalid request update.', 400)
          const { updateSongRequest } = await import('@/lib/storage')
          const updated = await updateSongRequest(body.id, body.status as 'played' | 'skipped' | 'pending')
          if (!updated) return jsonError('Request not found.', 404)
          return json({ request: updated })
        } catch (error) {
          console.error('[morefm] admin song request update failed', error)
          return jsonError('Could not update song request.')
        }
      },
    },
  },
})
