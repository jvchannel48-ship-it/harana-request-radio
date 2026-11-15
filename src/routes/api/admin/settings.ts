import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError, readBody } from '@/lib/http'
import { isAdmin } from '@/lib/auth'
import type { StationSettings } from '@/lib/types'

async function status() {
  const { getAdminStatus } = await import('@/lib/station')
  return json({ ...(await getAdminStatus()), persistenceConfigured: true })
}

export const Route = createFileRoute('/api/admin/settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          return await status()
        } catch (error) {
          console.error('[morefm] admin settings GET failed', error)
          return jsonError('Could not load admin settings.')
        }
      },
      PUT: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const body = await readBody<Record<keyof StationSettings, unknown>>(request)
          const { getSettings, SETTINGS_PATH, writeJson } = await import('@/lib/storage')
          const { refreshQueue } = await import('@/lib/station')
          const current = await getSettings()
          const hour = (value: unknown, fallback: number) => typeof value === 'number' && value >= 0 && value <= 23 ? value : fallback
          const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
          const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
          const signOffHour = hour(body.signOffHour, current.signOffHour)
          const signOnHour = hour(body.signOnHour, current.signOnHour)
          const discoStartHour = hour(body.discoStartHour, current.discoStartHour)
          const discoEndHour = hour(body.discoEndHour, current.discoEndHour)
          const rjMakatiScheduleStartHour = hour(body.rjMakatiScheduleStartHour, current.rjMakatiScheduleStartHour)
          const rjMakatiScheduleEndHour = hour(body.rjMakatiScheduleEndHour, current.rjMakatiScheduleEndHour)
          const crossfaderCurves = ['transition', 'smooth', 'constant-power', 'dipped', 'slow-fade', 'slow-cut', 'fast-fade', 'fast-cut', 'full-cut', 'scratch-cut'] as const
          if (body.rotationPoolSize !== undefined && (typeof body.rotationPoolSize !== 'number' || !Number.isInteger(body.rotationPoolSize) || body.rotationPoolSize < 50 || body.rotationPoolSize > 300)) return jsonError('Song rotation pool must be between 50 and 300.', 400)
          if (body.listenerLimit !== undefined && (typeof body.listenerLimit !== 'number' || !Number.isInteger(body.listenerLimit) || body.listenerLimit < 0 || body.listenerLimit > 1000)) return jsonError('Listener limit must be between 0 and 1,000; use 0 for unlimited.', 400)
          if (signOffHour === signOnHour) return jsonError('Sign-off and sign-on must be different.', 400)
          if (discoStartHour === discoEndHour) return jsonError('Disco start and end must be different.', 400)
          if (rjMakatiScheduleStartHour === rjMakatiScheduleEndHour) return jsonError('Makati schedule start and end must be different.', 400)
          const next: StationSettings = {
            ...current,
            broadcastEnabled: bool(body.broadcastEnabled, current.broadcastEnabled),
            rjMakatiEnabled: bool(body.rjMakatiEnabled, current.rjMakatiEnabled),
            rjMakatiScheduleEnabled: bool(body.rjMakatiScheduleEnabled, current.rjMakatiScheduleEnabled),
            rjMakatiScheduleStartHour,
            rjMakatiScheduleEndHour,
            boardOperatorEnabled: bool(body.boardOperatorEnabled, current.boardOperatorEnabled),
            noRepeatEnabled: true,
            autoDjEnabled: bool(body.autoDjEnabled, current.autoDjEnabled),
            morSyncEnabled: bool(body.morSyncEnabled, current.morSyncEnabled),
            shuffleEnabled: false,
            goodVibesEnabled: bool(body.goodVibesEnabled, current.goodVibesEnabled),
            rotationPoolSize: typeof body.rotationPoolSize === 'number' ? body.rotationPoolSize : current.rotationPoolSize,
            listenerLimit: typeof body.listenerLimit === 'number' ? body.listenerLimit : current.listenerLimit,
            tagalogOnlyEnabled: bool(body.tagalogOnlyEnabled, current.tagalogOnlyEnabled),
            autoLoveSongsEnabled: bool(body.autoLoveSongsEnabled, current.autoLoveSongsEnabled),
            transmitterWatts: typeof body.transmitterWatts === 'number' && [0, 5000, 20000, 100000].includes(body.transmitterWatts) ? body.transmitterWatts as StationSettings['transmitterWatts'] : current.transmitterWatts,
            signOffHour, signOnHour, discoStartHour, discoEndHour,
            masterVolume: 80, nightVolumePercent: 70, bassGainDb: 12,
            crossfaderEnabled: bool(body.crossfaderEnabled, current.crossfaderEnabled),
            crossfaderCurve: crossfaderCurves.includes(body.crossfaderCurve as typeof crossfaderCurves[number]) ? body.crossfaderCurve as StationSettings['crossfaderCurve'] : current.crossfaderCurve,
            crossfadeSeconds: bounded(body.crossfadeSeconds, current.crossfadeSeconds, 0, 30),
            replayGainEnabled: bool(body.replayGainEnabled, current.replayGainEnabled),
            replayGainTargetLufs: bounded(body.replayGainTargetLufs, current.replayGainTargetLufs, -24, -5),
            christmasEnabled: false,
            autoVoiceEnabled: false,
            djMicEnabled: bool(body.djMicEnabled, current.djMicEnabled),
            newsEnabled: bool(body.newsEnabled, current.newsEnabled),
            nightVolumeEnabled: true,
            nightVolumeStartHour: 22, nightVolumeEndHour: 6,
            jingleEnabled: bool(body.jingleEnabled, current.jingleEnabled),
            commercialEnabled: bool(body.commercialEnabled, current.commercialEnabled),
          }
          await writeJson(SETTINGS_PATH, next)
          const queueKeys: Array<keyof StationSettings> = ['morSyncEnabled', 'tagalogOnlyEnabled', 'autoLoveSongsEnabled', 'goodVibesEnabled', 'jingleEnabled', 'commercialEnabled', 'crossfaderEnabled', 'crossfadeSeconds', 'signOffHour', 'signOnHour', 'discoStartHour', 'discoEndHour']
          if (queueKeys.some((key) => next[key] !== current[key])) await refreshQueue()
          return await status()
        } catch (error) {
          console.error('[morefm] admin settings PUT failed', error)
          return jsonError('Could not update settings. Please retry.')
        }
      },
      POST: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const { refreshQueue } = await import('@/lib/station')
          await refreshQueue()
          return await status()
        } catch (error) {
          console.error('[morefm] admin rotation refresh failed', error)
          return jsonError('Could not refresh rotation.')
        }
      },
    },
  },
})
