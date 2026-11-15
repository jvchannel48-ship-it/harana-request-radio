export type TransmitterWatts = 0 | 5000 | 20000 | 100000
export type CrossfaderCurve = 'transition' | 'smooth' | 'constant-power' | 'dipped' | 'slow-fade' | 'slow-cut' | 'fast-fade' | 'fast-cut' | 'full-cut' | 'scratch-cut'

export interface Track {
  uid: string
  requestId?: string
  src: string
  startAt: number
  duration: number
  fadeIn: number
  fadeOut: number
  sourceUrl?: string
  youtubeId?: string
  sourceChannel?: string
  sourcePlaylist?: string
  sourceRefreshedAt?: number
  kind?: 'music' | 'mor-sync' | 'jingle' | 'commercial' | 'golden-sunday' | 'news' | 'dj-mic' | 'brigada-news' | 'rj-makati'
  title?: string
  artist?: string
  morKey?: string
  morExactMatch?: boolean
  /** How AutoDJ picked this track. */
  pickedBy?: 'request' | 'auto-love' | 'playlist' | 'rotation'
}

export interface AudioAsset {
  url: string
  pathname?: string
  name: string
  duration: number
}

export interface StationSettings {
  broadcastEnabled: boolean
  rjMakatiEnabled: boolean
  rjMakatiScheduleEnabled: boolean
  rjMakatiScheduleStartHour: number
  rjMakatiScheduleEndHour: number
  boardOperatorEnabled: boolean
  noRepeatEnabled: boolean
  autoDjEnabled: boolean
  morSyncEnabled: boolean
  shuffleEnabled: boolean
  goodVibesEnabled: boolean
  rotationPoolSize: number
  listenerLimit: number
  tagalogOnlyEnabled: boolean
  /** AutoDJ finds the next songs itself: classic 60s–2000s Tagalog and English love songs, never repeating. */
  autoLoveSongsEnabled: boolean
  transmitterWatts: TransmitterWatts
  signOffHour: number
  signOnHour: number
  discoStartHour: number
  discoEndHour: number
  christmasEnabled: boolean
  autoVoiceEnabled: boolean
  autoVoiceAnnouncement: AudioAsset | null
  djMicEnabled: boolean
  newsEnabled: boolean
  nightVolumeEnabled: boolean
  nightVolumeStartHour: number
  nightVolumeEndHour: number
  masterVolume: number
  nightVolumePercent: number
  bassGainDb: number
  crossfaderEnabled: boolean
  crossfaderCurve: CrossfaderCurve
  crossfadeSeconds: number
  replayGainEnabled: boolean
  replayGainTargetLufs: number
  jingleEnabled: boolean
  commercialEnabled: boolean
  jingle: AudioAsset | null
  commercials: Array<AudioAsset | null>
  goldenSunday: AudioAsset | null
  news: AudioAsset | null
  djMic: AudioAsset | null
}

export interface SongRequest {
  id: string
  title: string
  artist: string
  name?: string
  /** Original listener message the title and artist were read from. */
  message?: string
  /** Latest search result note shown to the admin. */
  note?: string
  /** The song exactly as the listener wrote it, before typo correction. */
  heard?: string
  /** How sure the reader was about the corrected title and artist. */
  confidence?: 'high' | 'medium' | 'low'
  /** Song found on YouTube that waits for admin confirmation (status 'review'). */
  candidate?: RequestCandidate
  requestedAt: number
  /** 'review' = a likely song was found but the match is not certain; the admin must confirm it. */
  status: 'pending' | 'review' | 'played' | 'skipped'
}

export interface RequestCandidate {
  youtubeId: string
  title: string
  url: string
  channel?: string
  duration: number
  /** 0–1 similarity between the request and this result. */
  score: number
}

export interface NowResponse {
  serverTime: number
  offAir: boolean
  boardOperatorEnabled: boolean
  nextOnAir: number | null
  signOffAt: number | null
  tracks: Track[]
  nightVolumeActive: boolean
  /** True when the upcoming queue is short; the player then asks the server to find more songs. */
  needsFill?: boolean
  audioConfig: Pick<StationSettings, 'masterVolume' | 'nightVolumePercent' | 'bassGainDb' | 'crossfaderEnabled' | 'crossfaderCurve' | 'crossfadeSeconds' | 'replayGainEnabled' | 'replayGainTargetLufs'>
}

export interface PlaybackStats {
  last24Hours: number
  last7Days: number
  topArtists: Array<{ artist: string; plays: number }>
  recentSongs: Array<{ title: string; artist: string; playedAt: number }>
}

export type MorMetadataStatus = 'music' | 'non-music' | 'unrecognized' | 'unavailable'
export type MorSyncStatus = 'SYNCED' | 'HINDI NAKITA YUNG KANTA' | 'MOR SYNC OFF' | 'AUTODJ OFF'

export interface MorNowPlaying {
  status: MorMetadataStatus
  raw: string | null
  title: string | null
  artist: string | null
  key: string | null
  checkedAt: number
}

export interface MorSyncRecord {
  metadata: MorNowPlaying | null
  syncStatus: MorSyncStatus
  lastProcessedKey: string | null
  lastProcessedMatched: boolean | null
  queuedTitle: string | null
  updatedAt: number | null
}

export interface AdminStatus extends StationSettings {
  persistenceConfigured?: boolean
  queuePersistenceConfigured?: boolean
  songsThisWeek: number
  artistsThisHour: number
  queued: number
  listenersNow: number
  totalRatings: number
  playbackStats: PlaybackStats
  storageUsage?: {
    provider: string
    databaseBytes: number
    stationAudioBytes: number
    stationAudioFiles: number
    measuredAt: number
  }
  morNowPlayingTitle: string | null
  morNowPlayingArtist: string | null
  morNowPlayingRaw: string | null
  morNowPlayingStatus: MorMetadataStatus | null
  moreFmNowPlaying: string | null
  morSyncStatus: MorSyncStatus
  morCheckedAt: number | null
  dailyPlayedTitles: Array<{ title: string; artist: string; playedAt: number }>
  dailyPlayedDate: string
  upcoming: Array<{ uid: string; title: string; artist: string; startAt: number; active: boolean; pickedBy: string }>
  autoLovePoolSize: number
}
