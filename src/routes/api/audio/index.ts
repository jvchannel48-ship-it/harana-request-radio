import { createFileRoute } from '@tanstack/react-router'
import { jsonError } from '@/lib/http'

// Allow the short-lived media hosts returned by the configured song search provider.
const ALLOWED_HOST = /(^|\.)(savetube\.vip|savetube\.me|savetube\.io|save\.tube|cdn\.savetube\.|rapidcdn\.|ytmp3\.|y2mate\.|googlevideo\.com)$/i

export const Route = createFileRoute('/api/audio/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rawUrl = new URL(request.url).searchParams.get('url')
        if (!rawUrl) return jsonError('Missing audio URL.', 400)
        let target: URL
        try {
          target = new URL(rawUrl)
        } catch {
          return jsonError('Invalid audio URL.', 400)
        }
        if (target.protocol !== 'https:' || !ALLOWED_HOST.test(target.hostname)) return jsonError('Audio source is not allowed.', 403)
        try {
          const range = request.headers.get('range')
          const upstream = await fetch(target, {
            headers: {
              Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.5',
              Referer: 'https://www.youtube.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              ...(range ? { Range: range } : {}),
            },
            redirect: 'follow',
          })
          if (!upstream.ok || !upstream.body) return jsonError('Audio source unavailable.', 502)
          const contentType = upstream.headers.get('content-type')?.split(';')[0] || 'audio/mpeg'
          if (contentType.includes('text/html') || contentType.includes('application/json')) return jsonError('Audio source unavailable.', 502)
          const headers = new Headers({
            'Cache-Control': 'public, max-age=3600, immutable',
            'Content-Type': contentType,
            'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
            'Content-Disposition': 'inline',
            Vary: 'Range',
          })
          for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
            const value = upstream.headers.get(name)
            if (value) headers.set(name, value)
          }
          return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
        } catch (error) {
          console.error('[morefm] audio proxy failed', target.hostname, error)
          return jsonError('Audio source unavailable.', 502)
        }
      },
    },
  },
})
