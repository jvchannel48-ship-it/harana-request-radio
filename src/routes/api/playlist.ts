import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'
import type { YouTubeSearchResult } from '@/lib/youtube-search'

function artistFromResult(item: YouTubeSearchResult) {
  const parts = item.title.split(/\s+[-–—|:]\s+/, 2).map((part) => part.trim())
  return parts.length === 2 ? parts[0] : item.channel ?? item.author ?? 'YouTube artist'
}

export const Route = createFileRoute('/api/playlist')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? ''
          const { getRjFmPlaylistTracks, searchYouTube } = await import('@/lib/youtube-search')
          if (query) {
            const results = (await searchYouTube(`${query} official audio`, 12))
              .filter((item) => !item.live)
              .map((item) => ({ id: item.id, title: item.title, artist: artistFromResult(item), url: item.url, duration: item.duration, channel: item.channel }))
            return json({ query, results })
          }
          const { getNowPlaying } = await import('@/lib/station')
          const [playlist, now] = await Promise.all([getRjFmPlaylistTracks(), getNowPlaying()])
          const nowMs = now.serverTime
          const topSongs = playlist.filter((track) => track.playlistGroup === 'RJ TOP SONGS')
          const playedSongs = playlist.filter((track) => track.playlistGroup === 'RJ PLAYED')
          const hasGroups = topSongs.length > 0 || playedSongs.length > 0
          const queue = now.tracks
            .filter((track) => track.startAt + track.duration * 1000 > nowMs)
            .sort((a, b) => a.startAt - b.startAt)
            .slice(0, 12)
            .map((track) => ({ uid: track.uid, title: track.title ?? 'Untitled track', artist: track.artist ?? track.sourceChannel ?? 'RJ FM', startAt: track.startAt, active: track.startAt <= nowMs }))
          return json({
            name: 'RJ SONGS',
            sections: [
              { id: 'top-songs', label: 'RJ TOP SONGS', tracks: hasGroups ? topSongs : playlist.slice(0, 30) },
              { id: 'played', label: 'RJ PLAYED', tracks: hasGroups ? playedSongs : playlist.slice(30) },
            ],
            queue,
            fetchedAt: Date.now(),
          })
        } catch (error) {
          console.error('[morefm] playlist read failed', error)
          return jsonError('Playlist is temporarily unavailable.', 502)
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await readBody<{ name: string; title: string; artist: string }>(request)
          const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : 'Listener'
          const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
          const artist = typeof body.artist === 'string' ? body.artist.trim().slice(0, 120) : ''
          if (!title || !artist) return jsonError('Choose a song and artist first.', 400)
          const { submitSongRequest } = await import('@/lib/station')
          const result = await submitSongRequest(title, artist, name || 'Listener')
          return json({ ...result, reason: result.reason?.replace(/AutoDJ/gi, 'station queue') })
        } catch (error) {
          console.error('[morefm] playlist add failed', error)
          return jsonError('The song could not be added to the playlist.')
        }
      },
    },
  },
})
