import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'
import { isAdmin } from '@/lib/auth'

function durationSeconds(value: string) {
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return 0
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0
}

function artistFromTitle(title: string, channel?: string) {
  const parts = title.split(/\s+[-–—|:]\s+/, 2).map((part) => part.trim())
  return parts.length === 2 ? parts[0] : channel ?? 'YouTube artist'
}

export const Route = createFileRoute('/api/admin/playlist')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? ''
          if (query) {
            const { searchYouTube } = await import('@/lib/youtube-search')
            const results = (await searchYouTube(`${query} official audio`, 12))
              .filter((item) => !item.live)
              .map((item) => ({
                id: item.id,
                title: item.title,
                artist: artistFromTitle(item.title, item.channel ?? item.author),
                url: item.url,
                duration: item.duration,
                durationSeconds: durationSeconds(item.duration),
                channel: item.channel,
                picture: `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/hqdefault.jpg`,
              }))
              .filter((item) => item.durationSeconds >= 60 && item.durationSeconds <= 540)
            return json({ query, results })
          }
          const { getRadioCatalogSongs } = await import('@/lib/radio-catalog')
          return json({ songs: (await getRadioCatalogSongs()) ?? [] })
        } catch (error) {
          console.error('[morefm] admin playlist read failed', error)
          return jsonError(error instanceof Error ? error.message : 'Could not load the songs playlist.')
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const body = await readBody<{ title: string; artist: string; youtubeId: string; durationSeconds: number; playlistGroup: string; category: string; picture: string }>(request)
          const youtubeId = typeof body.youtubeId === 'string' ? body.youtubeId.trim() : ''
          const title = typeof body.title === 'string' ? body.title.trim() : ''
          const artist = typeof body.artist === 'string' ? body.artist.trim() : ''
          const duration = Number(body.durationSeconds)
          if (!/^[\w-]{6,32}$/.test(youtubeId) || !title || !artist || !Number.isFinite(duration) || !['RJ TOP SONGS', 'RJ PLAYED'].includes(String(body.playlistGroup))) {
            return jsonError('Choose a valid YouTube song and playlist group.', 400)
          }
          const { upsertRadioCatalogSong } = await import('@/lib/radio-catalog')
          const song = await upsertRadioCatalogSong({ title, artist, youtubeId, durationSeconds: duration, playlistGroup: body.playlistGroup as 'RJ TOP SONGS' | 'RJ PLAYED', category: typeof body.category === 'string' ? body.category : 'english', picture: typeof body.picture === 'string' ? body.picture : null })
          return json({ song })
        } catch (error) {
          console.error('[morefm] admin playlist add failed', error)
          return jsonError(error instanceof Error ? error.message : 'Could not save the song.')
        }
      },
      DELETE: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const body = await readBody<{ youtubeId: string }>(request)
          const youtubeId = typeof body.youtubeId === 'string' ? body.youtubeId.trim() : ''
          if (!/^[\w-]{6,32}$/.test(youtubeId)) return jsonError('Invalid YouTube song.', 400)
          const { deactivateRadioCatalogSong } = await import('@/lib/radio-catalog')
          if (!(await deactivateRadioCatalogSong(youtubeId))) return jsonError('Song not found in the playlist.', 404)
          return json({ removed: true })
        } catch (error) {
          console.error('[morefm] admin playlist remove failed', error)
          return jsonError(error instanceof Error ? error.message : 'Could not remove the song.')
        }
      },
    },
  },
})
