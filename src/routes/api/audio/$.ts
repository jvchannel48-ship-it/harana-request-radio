import { createFileRoute } from '@tanstack/react-router'
import { jsonError } from '@/lib/http'

const AUDIO_PATH_PATTERN = /^[a-zA-Z0-9._-]+$/

// Only audio files listed in the saved station settings can be streamed.
export const Route = createFileRoute('/api/audio/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const path = (params._splat ?? '').split('/').map((part) => decodeURIComponent(part))
        if (path.length !== 3 || path[0] !== 'station' || path[1] !== 'audio' || path.some((segment) => !AUDIO_PATH_PATTERN.test(segment))) {
          return jsonError('Audio not found.', 404)
        }
        try {
          const pathname = path.join('/')
          const { getSettings } = await import('@/lib/storage')
          const settings = await getSettings()
          const configured = [settings.jingle, ...settings.commercials, settings.goldenSunday, settings.news, settings.djMic, settings.autoVoiceAnnouncement]
          if (!configured.some((asset) => asset?.pathname === pathname)) return jsonError('Audio not found.', 404)
          const { fetchSupabaseAudio } = await import('@/lib/supabase-media')
          const audio = await fetchSupabaseAudio(pathname, request.headers.get('range'))
          if (audio.status === 404) return jsonError('Audio not found.', 404)
          if (!audio.ok || !audio.body) return jsonError('Audio could not be loaded.', 502)
          const headers = new Headers({
            'Content-Type': audio.headers.get('content-type') || 'application/octet-stream',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
            'Accept-Ranges': 'bytes',
          })
          for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
            const value = audio.headers.get(name)
            if (value) headers.set(name, value)
          }
          return new Response(audio.body, { status: audio.status, statusText: audio.statusText, headers })
        } catch (error) {
          console.error('[morefm] private audio playback failed', error)
          return jsonError('Audio could not be loaded.', 502)
        }
      },
    },
  },
})
