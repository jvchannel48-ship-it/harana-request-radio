import { supabaseAdmin } from '@/integrations/supabase/client.server'
import type { CrossfaderCurve, MorSyncRecord, SongRequest, StationSettings } from './types'

// All station state lives in Lovable Cloud and is reached only from server routes
// through the service-role client, so browsers can never read or write it directly.
export const hasFilesystemPersistence = false
export const hasPersistentStorage = true
export const hasSettingsPersistence = true
export const hasQueuePersistence = true
const SETTINGS_CACHE_TTL_MS = 2_000
const settingsObjectCache = new Map<string, { value: unknown; expiresAt: number }>()
const STATION_STATE_PATH = 'station/state-v2.json'

export async function ensureDatabaseTables() {
  // Tables are created by migrations.
}

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  const cached = settingsObjectCache.get(pathname)
  if (isPersistentSettingsPath(pathname) && cached && cached.expiresAt > Date.now()) return JSON.parse(JSON.stringify(cached.value)) as T
  const { data, error } = await supabaseAdmin.from('morefm_state').select('value').eq('storage_key', pathname).maybeSingle()
  if (error) throw new Error(`Station state read failed: ${error.message}`)
  if (!data) return fallback
  if (isPersistentSettingsPath(pathname)) settingsObjectCache.set(pathname, { value: data.value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
  return (data.value as T) ?? fallback
}

export async function writeJson(pathname: string, data: unknown) {
  const serialized = JSON.stringify(data)
  if (serialized === undefined) throw new Error('State value could not be serialized as JSON.')
  const value = JSON.parse(serialized)
  const { error } = await supabaseAdmin.from('morefm_state').upsert({ storage_key: pathname, value, updated_at: new Date().toISOString() }, { onConflict: 'storage_key' })
  if (error) throw new Error(`Station state write failed: ${error.message}`)
  if (isPersistentSettingsPath(pathname)) settingsObjectCache.set(pathname, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
}

export interface StationLease {
  pathname: string
  owner: string
}

/** Atomically acquire a time-limited lease so simultaneous requests serialize queue changes. */
export async function acquireStationLease(pathname: string, leaseMs: number): Promise<StationLease | null> {
  const owner = crypto.randomUUID()
  const now = Date.now()
  const { data, error } = await supabaseAdmin.rpc('morefm_acquire_lease', { _key: pathname, _owner: owner, _expires_at: now + leaseMs, _now: now })
  if (error) throw new Error(`Queue lease failed: ${error.message}`)
  return data === true ? { pathname, owner } : null
}

/** Delete only the lease owned by the caller; a newer lease is never disturbed. */
export async function releaseStationLease(lease: StationLease) {
  await supabaseAdmin.rpc('morefm_release_lease', { _key: lease.pathname, _owner: lease.owner })
}

/** Extend only a still-live lease owned by this operation. */
export async function renewStationLease(lease: StationLease, leaseMs: number): Promise<boolean> {
  const now = Date.now()
  const { data, error } = await supabaseAdmin.rpc('morefm_renew_lease', { _key: lease.pathname, _owner: lease.owner, _expires_at: now + leaseMs, _now: now })
  if (error) return false
  return data === true
}

export async function registerListener(id: string, active: boolean, listenerLimit: number) {
  const { data, error } = await supabaseAdmin.rpc('morefm_register_listener', { _id: id, _active: active, _limit: listenerLimit })
  if (error) throw new Error(`Listener heartbeat failed: ${error.message}`)
  const result = (data ?? {}) as { accepted?: boolean; listenersNow?: number }
  return { accepted: result.accepted !== false, listenersNow: Number(result.listenersNow ?? 0) }
}

export async function getStoredListenerCount() {
  const { data, error } = await supabaseAdmin.rpc('morefm_listener_count')
  if (error) return 0
  return Number(data ?? 0)
}

export async function getStorageUsage() {
  const { data, error } = await supabaseAdmin.rpc('morefm_storage_usage')
  if (error) throw new Error(`Storage usage unavailable: ${error.message}`)
  const row = (data ?? {}) as { databaseBytes?: number; audioBytes?: number; audioFiles?: number }
  return {
    provider: 'Lovable Cloud',
    databaseBytes: Number(row.databaseBytes ?? 0),
    stationAudioBytes: Number(row.audioBytes ?? 0),
    stationAudioFiles: Number(row.audioFiles ?? 0),
    measuredAt: Date.now(),
  }
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = STATION_STATE_PATH
export const LISTENERS_PATH = 'station/listeners-v1.json'
export const RATINGS_PATH = 'station/ratings-v1.json'
export const REQUESTS_PATH = 'station/requests-v1.json'
export const MOR_SYNC_PATH = 'station/mor-sync-v1.json'
export const QUEUE_LOCK_PATH = 'station/queue-lock-v1.json'
const SETTINGS_MIGRATIONS_PATH = 'station/settings-migrations-v1.json'
function isPersistentSettingsPath(pathname: string) {
  return pathname === SETTINGS_PATH || pathname === SETTINGS_MIGRATIONS_PATH
}
export const EMPTY_MOR_SYNC_RECORD: MorSyncRecord = {
  metadata: null,
  syncStatus: 'HINDI NAKITA YUNG KANTA',
  lastProcessedKey: null,
  lastProcessedMatched: null,
  queuedTitle: null,
  updatedAt: null,
}

function isLegacyShowtimeAsset(asset: { url?: unknown; name?: unknown }) {
  const value = `${typeof asset.url === 'string' ? asset.url : ''} ${typeof asset.name === 'string' ? asset.name : ''}`.toLowerCase()
  return value.includes('my-only-radio-for-life') || value.includes('myonlyradioforlife') || /it['’]?s[\s_-]*show[\s_-]*time/.test(value)
}

const CROSSFADER_CURVES: readonly CrossfaderCurve[] = ['transition', 'smooth', 'constant-power', 'dipped', 'slow-fade', 'slow-cut', 'fast-fade', 'fast-cut', 'full-cut', 'scratch-cut']
const isCrossfaderCurve = (value: unknown): value is CrossfaderCurve => CROSSFADER_CURVES.includes(value as CrossfaderCurve)

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  rjMakatiEnabled: false,
  rjMakatiScheduleEnabled: false,
  rjMakatiScheduleStartHour: 0,
  rjMakatiScheduleEndHour: 6,
  boardOperatorEnabled: false,
  noRepeatEnabled: true,
  autoDjEnabled: true,
  morSyncEnabled: false,
  shuffleEnabled: false,
  goodVibesEnabled: false,
  rotationPoolSize: 100,
  listenerLimit: 2,
  tagalogOnlyEnabled: false,
  autoLoveSongsEnabled: true,
  transmitterWatts: 100000,
  signOffHour: 1,
  signOnHour: 4,
  discoStartHour: 16,
  discoEndHour: 19,
  christmasEnabled: false,
  autoVoiceEnabled: false,
  autoVoiceAnnouncement: null,
  djMicEnabled: false,
  newsEnabled: true,
  nightVolumeEnabled: true,
  nightVolumeStartHour: 22,
  nightVolumeEndHour: 6,
  masterVolume: 80,
  nightVolumePercent: 70,
  bassGainDb: 12,
  crossfaderEnabled: true,
  crossfaderCurve: 'constant-power',
  crossfadeSeconds: 8,
  replayGainEnabled: false,
  replayGainTargetLufs: -14,
  jingleEnabled: false,
  commercialEnabled: false,
  jingle: {
    url: '/rj-fm-jingle.mp3',
    name: 'RjFm-usesuno.com.mp3',
    duration: 8.04,
  },
  commercials: [null, null, null],
  goldenSunday: null,
  news: null,
  djMic: null,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  const migrations = await readJson<{ tagalogLoveRotation?: number; crossfaderCurve?: number; listenerLimit?: number }>(SETTINGS_MIGRATIONS_PATH, {})
  const needsTagalogMigration = migrations.tagalogLoveRotation !== 2
  const needsCrossfaderMigration = migrations.crossfaderCurve !== 1
  const needsListenerLimitMigration = migrations.listenerLimit !== 1
  if (hasSettingsPersistence && (needsTagalogMigration || needsCrossfaderMigration || needsListenerLimitMigration)) {
    const migrated = {
      ...saved,
      ...(needsTagalogMigration ? {
        tagalogOnlyEnabled: typeof saved.tagalogOnlyEnabled === 'boolean' ? saved.tagalogOnlyEnabled : false,
        noRepeatEnabled: typeof saved.noRepeatEnabled === 'boolean' ? saved.noRepeatEnabled : true,
        shuffleEnabled: false,
      } : {}),
      ...(needsCrossfaderMigration ? {
        crossfaderCurve: isCrossfaderCurve(saved.crossfaderCurve) && saved.crossfaderCurve !== 'smooth'
          ? saved.crossfaderCurve
          : 'constant-power',
      } : {}),
      ...(needsListenerLimitMigration ? {
        listenerLimit: typeof saved.listenerLimit === 'number' && saved.listenerLimit > 0 ? saved.listenerLimit : DEFAULT_SETTINGS.listenerLimit,
      } : {}),
    }
    const nextMigrations = {
      ...migrations,
      ...(needsTagalogMigration ? { tagalogLoveRotation: 2 } : {}),
      ...(needsCrossfaderMigration ? { crossfaderCurve: 1 } : {}),
      ...(needsListenerLimitMigration ? { listenerLimit: 1 } : {}),
    }
    try {
      await writeJson(SETTINGS_PATH, migrated)
      await writeJson(SETTINGS_MIGRATIONS_PATH, nextMigrations)
      Object.assign(saved, migrated)
    } catch (error) {
      console.error('[morefm] could not apply station settings migrations', error)
    }
  }
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    rjMakatiEnabled: typeof saved.rjMakatiEnabled === 'boolean' ? saved.rjMakatiEnabled : DEFAULT_SETTINGS.rjMakatiEnabled,
    rjMakatiScheduleEnabled: typeof saved.rjMakatiScheduleEnabled === 'boolean' ? saved.rjMakatiScheduleEnabled : DEFAULT_SETTINGS.rjMakatiScheduleEnabled,
    rjMakatiScheduleStartHour: typeof saved.rjMakatiScheduleStartHour === 'number' && saved.rjMakatiScheduleStartHour >= 0 && saved.rjMakatiScheduleStartHour <= 23 ? Math.round(saved.rjMakatiScheduleStartHour) : DEFAULT_SETTINGS.rjMakatiScheduleStartHour,
    rjMakatiScheduleEndHour: typeof saved.rjMakatiScheduleEndHour === 'number' && saved.rjMakatiScheduleEndHour >= 0 && saved.rjMakatiScheduleEndHour <= 23 ? Math.round(saved.rjMakatiScheduleEndHour) : DEFAULT_SETTINGS.rjMakatiScheduleEndHour,
    boardOperatorEnabled: typeof saved.boardOperatorEnabled === 'boolean' ? saved.boardOperatorEnabled : false,
    // Keep song rotation from repeating titles across the active daily history.
    noRepeatEnabled: true,
    autoDjEnabled: true,
    morSyncEnabled: typeof saved.morSyncEnabled === 'boolean' ? saved.morSyncEnabled : false,
    shuffleEnabled: false,
    goodVibesEnabled: typeof saved.goodVibesEnabled === 'boolean' ? saved.goodVibesEnabled : false,
    rotationPoolSize: typeof saved.rotationPoolSize === 'number' ? Math.max(50, Math.min(300, Math.round(saved.rotationPoolSize))) : 100,
    listenerLimit: typeof saved.listenerLimit === 'number' ? Math.max(0, Math.min(1000, Math.round(saved.listenerLimit))) : DEFAULT_SETTINGS.listenerLimit,
    tagalogOnlyEnabled: typeof saved.tagalogOnlyEnabled === 'boolean' ? saved.tagalogOnlyEnabled : false,
    autoLoveSongsEnabled: typeof saved.autoLoveSongsEnabled === 'boolean' ? saved.autoLoveSongsEnabled : true,
    transmitterWatts: [0, 5000, 20000, 100000].includes(saved.transmitterWatts as number) ? saved.transmitterWatts as StationSettings['transmitterWatts'] : 100000,
    signOffHour: typeof saved.signOffHour === 'number' && saved.signOffHour >= 0 && saved.signOffHour <= 23 ? Math.round(saved.signOffHour) : DEFAULT_SETTINGS.signOffHour,
    signOnHour: typeof saved.signOnHour === 'number' && saved.signOnHour >= 0 && saved.signOnHour <= 23 ? Math.round(saved.signOnHour) : DEFAULT_SETTINGS.signOnHour,
    discoStartHour: typeof saved.discoStartHour === 'number' && saved.discoStartHour >= 0 && saved.discoStartHour <= 23 ? Math.round(saved.discoStartHour) : DEFAULT_SETTINGS.discoStartHour,
    discoEndHour: typeof saved.discoEndHour === 'number' && saved.discoEndHour >= 0 && saved.discoEndHour <= 23 ? Math.round(saved.discoEndHour) : DEFAULT_SETTINGS.discoEndHour,
    christmasEnabled: false,
    autoVoiceEnabled: false,
    autoVoiceAnnouncement: saved.autoVoiceAnnouncement && typeof saved.autoVoiceAnnouncement.url === 'string' ? saved.autoVoiceAnnouncement : null,
    djMicEnabled: typeof saved.djMicEnabled === 'boolean' ? saved.djMicEnabled : false,
    newsEnabled: typeof saved.newsEnabled === 'boolean' ? saved.newsEnabled : true,
    // Automatic audio profile: 80% daytime, 70% from 10 PM–6 AM, maximum bass.
    nightVolumeEnabled: true,
    nightVolumeStartHour: 22,
    nightVolumeEndHour: 6,
    masterVolume: 80,
    nightVolumePercent: 70,
    bassGainDb: 12,
    crossfaderEnabled: typeof saved.crossfaderEnabled === 'boolean' ? saved.crossfaderEnabled : true,
    crossfaderCurve: needsCrossfaderMigration && saved.crossfaderCurve === 'smooth'
      ? DEFAULT_SETTINGS.crossfaderCurve
      : isCrossfaderCurve(saved.crossfaderCurve) ? saved.crossfaderCurve : DEFAULT_SETTINGS.crossfaderCurve,
    crossfadeSeconds: typeof saved.crossfadeSeconds === 'number' && Number.isFinite(saved.crossfadeSeconds)
      ? Math.max(0, Math.min(30, saved.crossfadeSeconds))
      : DEFAULT_SETTINGS.crossfadeSeconds,
    replayGainEnabled: typeof saved.replayGainEnabled === 'boolean' ? saved.replayGainEnabled : false,
    replayGainTargetLufs: typeof saved.replayGainTargetLufs === 'number' ? Math.max(-24, Math.min(-5, saved.replayGainTargetLufs)) : -14,
    jingleEnabled: saved.jingle ? (typeof saved.jingleEnabled === 'boolean' ? saved.jingleEnabled : true) : true,
    commercialEnabled: typeof saved.commercialEnabled === 'boolean' ? saved.commercialEnabled : false,
    jingle: saved.jingle && typeof saved.jingle.url === 'string' ? saved.jingle : DEFAULT_SETTINGS.jingle,
    commercials: Array.from({ length: 3 }, (_, i) => {
      const asset = saved.commercials?.[i]
      return asset && typeof asset.url === 'string' ? asset : null
    }),
    goldenSunday: null,
    news: saved.news && typeof saved.news.url === 'string' ? saved.news : null,
    djMic: saved.djMic && typeof saved.djMic.url === 'string' ? saved.djMic : null,
  }
}

interface RatingState { total: number; voterIds: string[] }
export async function getRatings() {
  const saved = await readJson<Partial<RatingState>>(RATINGS_PATH, {})
  return {
    total: typeof saved.total === 'number' ? saved.total : 0,
    voterIds: Array.isArray(saved.voterIds) ? saved.voterIds.filter((id): id is string => typeof id === 'string').slice(-10000) : [],
  }
}
export async function addRating(voterId: string) {
  const ratings = await getRatings()
  if (ratings.voterIds.includes(voterId)) return ratings
  const next = { total: ratings.total + 1, voterIds: [...ratings.voterIds, voterId].slice(-10000) }
  await writeJson(RATINGS_PATH, next)
  return next
}

type RequestRow = { id: string; name: string; song_title: string; artist: string | null; message: string | null; note: string | null; created_at: string; status: string }
const REQUEST_COLUMNS = 'id, name, song_title, artist, message, note, created_at, status'
function toSongRequest(row: RequestRow): SongRequest {
  return {
    id: row.id,
    name: row.name,
    title: row.song_title,
    artist: row.artist || 'Unknown artist',
    message: row.message ?? undefined,
    note: row.note ?? undefined,
    requestedAt: new Date(row.created_at).getTime(),
    status: (['pending', 'played', 'skipped'].includes(row.status) ? row.status : 'pending') as SongRequest['status'],
  }
}

export async function getSongRequests() {
  const { data, error } = await supabaseAdmin.from('requests').select(REQUEST_COLUMNS)
    .in('status', ['pending', 'skipped']).order('created_at', { ascending: false }).limit(200)
  if (error) throw new Error(`Song requests read failed: ${error.message}`)
  return (data as RequestRow[]).map(toSongRequest)
}

export async function getRecentSongRequests(limit = 60) {
  const { data, error } = await supabaseAdmin.from('requests').select(REQUEST_COLUMNS)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(`Song requests read failed: ${error.message}`)
  return (data as RequestRow[]).map(toSongRequest)
}

export async function addSongRequest(title: string, artist: string, name = 'Listener', message?: string) {
  const { data, error } = await supabaseAdmin.from('requests')
    .insert({ name, song_title: title.slice(0, 200), artist: artist ? artist.slice(0, 120) : null, message: message?.slice(0, 2000) ?? null })
    .select(REQUEST_COLUMNS).single()
  if (error) throw new Error(`Song request save failed: ${error.message}`)
  return toSongRequest(data as RequestRow)
}

export async function setSongRequestNote(id: string, note: string | null) {
  await supabaseAdmin.from('requests').update({ note: note?.slice(0, 300) ?? null }).eq('id', id)
}

export async function updateSongRequest(id: string, status: SongRequest['status']) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await supabaseAdmin.from('requests').update({ status }).eq('id', id).select(REQUEST_COLUMNS).maybeSingle()
  if (error) throw new Error(`Song request update failed: ${error.message}`)
  return data ? toSongRequest(data as RequestRow) : null
}
