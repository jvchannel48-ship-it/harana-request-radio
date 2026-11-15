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
