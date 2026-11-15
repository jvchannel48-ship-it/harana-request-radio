import { createFileRoute } from '@tanstack/react-router'
import { json } from '@/lib/http'

export const Route = createFileRoute('/api/top-played')({
  server: {
    handlers: {
      GET: async () => {
        const { getTopPlayed } = await import('@/lib/radio-catalog')
        return json({ songs: await getTopPlayed(25).catch(() => []) })
      },
    },
  },
})
