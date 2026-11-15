import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'

// Listener song requests. Send a free-text `message` (title and artist are read automatically),
// or explicit `title` + `artist`.
export const Route = createFileRoute('/api/requests')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readBody<{ name: string; message: string; song_title: string; title: string; artist: string }>(request)
          const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Listener'
          const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
          const station = await import('@/lib/station')
          if (message) {
            if (message.length < 3) return jsonError('Isulat po ang title at artist ng kanta.', 400)
            return json(await station.submitSongMessage(message, name))
          }
          const titleValue = body.song_title ?? body.title
          const title = typeof titleValue === 'string' ? titleValue.trim().slice(0, 200) : ''
          const artist = typeof body.artist === 'string' ? body.artist.trim().slice(0, 120) : ''
          if (!title || !artist) return jsonError('Enter your song title and artist.', 400)
          const result = await station.submitSongRequest(title, artist, name)
          return json({ ...result, reason: result.reason?.replace(/AutoDJ/gi, 'station queue') })
        } catch (error) {
          console.error('[morefm] song request failed', error)
          return jsonError('The song request could not be saved.')
        }
      },
    },
  },
})
