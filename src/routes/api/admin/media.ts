import { createFileRoute } from '@tanstack/react-router'
import { json, jsonError } from '@/lib/http'
import { isAdmin } from '@/lib/auth'
import type { AudioAsset } from '@/lib/types'

const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac'])
const MIME_BY_EXTENSION: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac' }

export const Route = createFileRoute('/api/admin/media')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdmin(request))) return jsonError('Unauthorized', 401)
        try {
          const form = await request.formData().catch(() => null)
          if (!form) return jsonError('Please select an audio file.', 400)
          const file = form.get('file')
          const kind = String(form.get('kind') ?? '')
          const slot = Number(form.get('slot'))
          const duration = Number(form.get('duration'))
          if (!(file instanceof File) || !['jingle', 'commercial', 'golden-sunday', 'dj-mic', 'auto-voice'].includes(kind)) return jsonError('Invalid audio upload.', 400)
          const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
          const reportedType = (file.type || '').split(';')[0].trim().toLowerCase()
          const normalizedType = reportedType === 'audio/mp3' ? 'audio/mpeg' : reportedType
          const contentType = AUDIO_TYPES.has(normalizedType) ? normalizedType : MIME_BY_EXTENSION[extension] ?? normalizedType
          if (!AUDIO_TYPES.has(contentType) || file.size === 0 || file.size > 4 * 1024 * 1024) return jsonError('Use a supported audio file under 4 MB.', 400)
          if (!Number.isFinite(duration) || duration < 1 || duration > 900) return jsonError('Audio duration must be between 1 second and 15 minutes.', 400)
          if (kind === 'commercial' && (!Number.isInteger(slot) || slot < 0 || slot > 2)) return jsonError('Choose commercial slot 1, 2, or 3.', 400)
          const ext = extension.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'audio'
          const slotSuffix = kind === 'commercial' ? `-${slot + 1}` : ''
          const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
          const contentHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
          const pathname = `station/audio/${kind}${slotSuffix}-${contentHash}.${ext}`
          const { deleteSupabaseAudio, uploadSupabaseAudio } = await import('@/lib/supabase-media')
          await uploadSupabaseAudio(pathname, file, contentType)
          const asset: AudioAsset = { url: `/api/audio/${pathname.split('/').map(encodeURIComponent).join('/')}`, pathname, name: file.name.slice(0, 120), duration }
          const { getSettings, SETTINGS_PATH, writeJson } = await import('@/lib/storage')
          const settings = await getSettings()
          const previousPathname = kind === 'jingle' ? settings.jingle?.pathname
            : kind === 'commercial' ? settings.commercials[slot]?.pathname
            : kind === 'golden-sunday' ? settings.goldenSunday?.pathname
            : kind === 'auto-voice' ? settings.autoVoiceAnnouncement?.pathname
            : settings.djMic?.pathname
          if (kind === 'jingle') { settings.jingle = asset; settings.jingleEnabled = true }
          else if (kind === 'commercial') settings.commercials[slot] = asset
          else if (kind === 'golden-sunday') settings.goldenSunday = asset
          else if (kind === 'auto-voice') settings.autoVoiceAnnouncement = asset
          else settings.djMic = asset
          await writeJson(SETTINGS_PATH, settings)
          if (previousPathname && previousPathname !== pathname) await deleteSupabaseAudio(previousPathname).catch(() => undefined)
          const station = await import('@/lib/station')
          if (kind === 'dj-mic' && settings.djMicEnabled) await station.queueDjMic(asset)
          return json({ asset, status: await station.getAdminStatus() })
        } catch (error) {
          console.error('[morefm] audio upload failed', error)
          return jsonError(`Audio upload failed: ${error instanceof Error ? error.message.slice(0, 180) : 'Unknown storage error'}`)
        }
      },
    },
  },
})
