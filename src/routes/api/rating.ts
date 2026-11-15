import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'

export const Route = createFileRoute('/api/rating')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getRatings } = await import('@/lib/storage')
          return json({ total: (await getRatings()).total })
        } catch {
          return jsonError('Could not load ratings.')
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await readBody<{ voterId: string }>(request)
          const voterId = typeof body.voterId === 'string' ? body.voterId.trim().slice(0, 120) : ''
          if (!voterId) return jsonError('Missing voter id.', 400)
          const { addRating, getRatings } = await import('@/lib/storage')
          const current = await getRatings()
          if (current.voterIds.includes(voterId)) return json({ total: current.total, alreadyRated: true })
          const ratings = await addRating(voterId)
          return json({ total: ratings.total, alreadyRated: false })
        } catch {
          return jsonError('Could not save your rating.')
        }
      },
    },
  },
})
