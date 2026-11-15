import { supabaseAdmin } from '@/integrations/supabase/client.server'

export type RadioCatalogSong = {
  title: string
  artist: string
  youtube_id: string
  category: string
  language: 'Tagalog' | 'English' | null
  decade: string | null
  picture: string | null
  duration_seconds: number
  playlist_group: 'RJ TOP SONGS' | 'RJ PLAYED'
  sort_order: number
}

const COLUMNS = 'title, artist, youtube_id, category, language, decade, picture, duration_seconds, playlist_group, sort_order'
let catalogCache: { rows: RadioCatalogSong[] | null; expiresAt: number } | null = null
let lastCatalogWarningAt = 0

export async function getRadioCatalogSongs(): Promise<RadioCatalogSong[] | null> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.rows
  const { data, error } = await supabaseAdmin.from('songs').select(COLUMNS).eq('is_active', true)
    .order('playlist_group', { ascending: false }).order('sort_order').order('created_at').limit(1000)
  if (error) {
    if (Date.now() - lastCatalogWarningAt > 60_000) {
      lastCatalogWarningAt = Date.now()
      console.warn('[morefm] song catalog unavailable; using bundled playlists', error.message)
    }
    catalogCache = { rows: null, expiresAt: Date.now() + 15_000 }
    return null
  }
  const rows = (data ?? []) as RadioCatalogSong[]
  // 'RJ TOP SONGS' sorts before 'RJ PLAYED' when ordered descending.
  catalogCache = { rows, expiresAt: Date.now() + 60_000 }
  return rows
}

export async function upsertRadioCatalogSong(input: {
  title: string
  artist: string
  youtubeId: string
  durationSeconds: number
  playlistGroup: RadioCatalogSong['playlist_group']
  category?: string
  picture?: string | null
}) {
  const { data: last } = await supabaseAdmin.from('songs').select('sort_order').eq('playlist_group', input.playlistGroup)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { data: existing } = await supabaseAdmin.from('songs').select('sort_order').eq('youtube_id', input.youtubeId).maybeSingle()
  const { data, error } = await supabaseAdmin.from('songs').upsert({
    title: input.title.slice(0, 200),
    artist: input.artist.slice(0, 120),
    youtube_id: input.youtubeId,
    category: input.category ?? 'english',
    picture: input.picture ?? null,
    duration_seconds: Math.max(60, Math.min(540, Math.round(input.durationSeconds))),
    playlist_group: input.playlistGroup,
    sort_order: existing?.sort_order ?? (last ? last.sort_order + 1 : 0),
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'youtube_id' }).select(COLUMNS).single()
  if (error) throw new Error(`Could not save the song: ${error.message}`)
  catalogCache = null
  return data as RadioCatalogSong
}

export async function deactivateRadioCatalogSong(youtubeId: string) {
  const { data, error } = await supabaseAdmin.from('songs').update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('youtube_id', youtubeId).select('youtube_id')
  if (error) throw new Error(`Could not remove the song: ${error.message}`)
  catalogCache = null
  return (data ?? []).length > 0
}

export async function incrementTopPlayed(input: { youtubeId?: string; title: string; artist: string }) {
  const youtubeId = input.youtubeId?.trim()
  if (!youtubeId || !/^[\w-]{6,32}$/.test(youtubeId)) return
  try {
    const { data: current } = await supabaseAdmin.from('top_played').select('play_count').eq('youtube_id', youtubeId).maybeSingle()
    const { data: song } = await supabaseAdmin.from('songs').select('id').eq('youtube_id', youtubeId).maybeSingle()
    await supabaseAdmin.from('top_played').upsert({
      youtube_id: youtubeId,
      song_id: song?.id ?? null,
      title: input.title.slice(0, 200),
      artist: input.artist.slice(0, 120),
      play_count: Number(current?.play_count ?? 0) + 1,
      last_played_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'youtube_id' })
  } catch (error) {
    console.warn('[morefm] could not update top-played count', error)
  }
}

export async function getTopPlayed(limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)))
  const { data, error } = await supabaseAdmin.from('top_played').select('youtube_id, title, artist, play_count, last_played_at')
    .order('play_count', { ascending: false }).order('last_played_at', { ascending: false }).limit(safeLimit)
  if (error) return []
  return data ?? []
}
