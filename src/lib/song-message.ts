/** Pure helpers for reading a song title and artist from a listener's free-text message. */

export interface ParsedSong {
  title: string
  artist: string
}

const FILLER = /\b(?:pa\s*-?\s*request(?:\s+po)?|request(?:\s+po)?|requesting|pwede\s+(?:po\s+)?(?:pa\s*)?(?:play|patugtog)|paki\s*(?:play|patugtog)|patugtog(?:\s+po)?|please\s+play|can\s+you\s+play|play(?:\s+po)?|song|kanta|ng|po|naman|please|pls|plz|salamat|thanks|thank\s+you)\b/gi

function clean(value: string) {
  return value
    .replace(/["“”'‘’]/g, '')
    .replace(FILLER, ' ')
    .replace(/[!?.,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string) {
  return value.replace(/\b([a-zà-ÿ])([a-zà-ÿ']*)/gi, (_, first: string, rest: string) => first.toUpperCase() + rest.toLowerCase())
}

/**
 * Best-effort fallback when AI is unavailable. Understands:
 * "Title - Artist", "Title by Artist", "Title ni Artist", "Artist: Title", and quoted titles.
 * Messages with a dedication ("para kay ...") keep only the song part.
 */
export function parseSongMessage(message: string): ParsedSong | null {
  const text = message
    .replace(/\s+/g, ' ')
    .replace(/\b(?:para\s+(?:kay|sa)|for|dedicated\s+to|dedicate\s+(?:ko|to))\b.*$/i, '')
    .trim()
  if (text.length < 3) return null

  const quoted = text.match(/["“]([^"”]{2,120})["”]/)
  const patterns: Array<[RegExp, 'title-artist' | 'artist-title']> = [
    [/^(.{2,120}?)\s+(?:by|ni|ng\s+grupong|from)\s+(.{2,80})$/i, 'title-artist'],
    [/^(.{2,120}?)\s+[-–—|]\s+(.{2,80})$/, 'title-artist'],
    [/^(.{2,80}?)\s*:\s*(.{2,120})$/, 'artist-title'],
  ]
  if (quoted) {
    const rest = clean(text.replace(quoted[0], ' ').replace(/\b(?:by|ni|from|-)\b/gi, ' '))
    const title = clean(quoted[1])
    if (title && rest) return { title: titleCase(title), artist: titleCase(rest) }
  }
  for (const [pattern, order] of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const first = clean(match[1])
    const second = clean(match[2])
    if (!first || !second) continue
    return order === 'title-artist'
      ? { title: titleCase(first), artist: titleCase(second) }
      : { title: titleCase(second), artist: titleCase(first) }
  }
  return null
}

export type MatchConfidence = 'high' | 'medium' | 'low'

function matchWords(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:official|music|video|lyrics?|audio|hd|hq|remastered|remaster|mv|full|version|feat|ft)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function editDistance(a: string, b: string) {
  if (a === b) return 0
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = saved
    }
  }
  return row[b.length]
}

/** Words count as the same when equal, or off by one letter (two for long words) — covers common typos. */
function similarWord(a: string, b: string) {
  if (a === b) return true
  const shorter = Math.min(a.length, b.length)
  if (shorter < 4) return false
  return editDistance(a, b) <= (shorter >= 8 ? 2 : 1)
}

/** Share of `wanted` words that appear (typo-tolerant) in `found`. */
function coverage(wanted: string[], found: string[]) {
  if (wanted.length === 0) return 0
  const pool = [...found]
  let hits = 0
  for (const word of wanted) {
    const index = pool.findIndex((candidate) => similarWord(word, candidate))
    if (index >= 0) { hits++; pool.splice(index, 1) }
  }
  return hits / wanted.length
}

/**
 * How well a search result matches the requested song, from 0 to 1.
 * Title words weigh 75%, artist words 25% (artist may appear in the video title or channel).
 */
export function songMatchScore(wanted: ParsedSong, found: { title: string; channel?: string }) {
  const titleWords = matchWords(wanted.title)
  const artistWords = matchWords(wanted.artist)
  const foundTitle = matchWords(found.title)
  const foundAll = [...foundTitle, ...matchWords(found.channel ?? '')]
  const titleScore = coverage(titleWords, foundTitle)
  const artistScore = artistWords.length ? coverage(artistWords, foundAll) : 0
  return Math.round((titleScore * 0.75 + artistScore * 0.25) * 100) / 100
}

/** Lowest match score that is queued without asking the admin. */
export const AUTO_QUEUE_MIN_SCORE = 0.8

/** A request waits for admin confirmation when the reader was unsure or the found song is not a close match. */
export function needsAdminReview(confidence: MatchConfidence | undefined, score: number) {
  return confidence === 'low' || score < AUTO_QUEUE_MIN_SCORE
}
