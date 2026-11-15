import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError } from '@/lib/http'

// Minute-level RJ FM SONG SYNC tick for an external scheduler. Requires `Authorization: Bearer <CRON_SECRET>`.
export const Route = createFileRoute('/api/public/cron/mor-sync')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET
        if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return jsonError('Unauthorized', 401)
        try {
          const { getNowPlaying, runMorSyncTick, runQueueFill } = await import('@/lib/station')
          const morSync = await runMorSyncTick()
          await runQueueFill()
          const station = await getNowPlaying()
          return json({ ok: true, serverTime: station.serverTime, offAir: station.offAir, queuedTracks: station.tracks.length, morSyncStatus: morSync.syncStatus })
        } catch (error) {
          console.error('[morefm] MOR sync cron failed', error)
          return jsonError('MOR sync update failed')
        }
      },
    },
  },
})
