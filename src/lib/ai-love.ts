import { createOpenAI } from '@ai-sdk/openai'
import { NoObjectGeneratedError, Output, streamText } from 'ai'
import { z } from 'zod'
import { parseSongMessage, type ParsedSong } from './song-message'

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1'
const MODEL = 'openai/gpt-6-astra'
// After a credit/permission failure, pause automatic AI picks for a while instead of retrying every fill.
let aiPausedUntil = 0

export class AiUnavailableError extends Error {}

async function structured<T>(instructions: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY
  if (!apiKey) throw new AiUnavailableError('AI is not configured.')
  if (Date.now() < aiPausedUntil) throw new AiUnavailableError('AI is paused after a credit or permission error.')
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
  })
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: 'user', content: prompt }],
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: 'low',
        reasoningSummary: 'auto',
        include: ['reasoning.encrypted_content'],
      },
    },
  })
  try {
    return (await result.output) as T
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode
    if (status === 402 || status === 403) aiPausedUntil = Date.now() + 30 * 60_000
    if (status === 429) aiPausedUntil = Date.now() + 60_000
    if (NoObjectGeneratedError.isInstance(error)) throw new AiUnavailableError('AI returned an unreadable answer.')
    throw new AiUnavailableError(error instanceof Error ? error.message : 'AI request failed.')
  }
}

const requestSchema = z.object({
  songs: z.array(z.object({ title: z.string(), artist: z.string() })),
})

/**
 * Read every requested song (title + artist) from a listener message. Works with Tagalog,
 * English and Taglish. Falls back to simple pattern matching when AI is unavailable.
 */
export async function readSongRequests(message: string): Promise<{ songs: ParsedSong[]; usedAi: boolean }> {
  const text = message.trim().slice(0, 2000)
  try {
    const result = await structured(
      'You read song requests sent to RJ FM, a Filipino radio station. Messages may be Tagalog, English or Taglish and may include greetings or dedications. Return each requested song with its official title and the original recording artist. If the listener named only the title, fill in the best-known original artist. If the listener named only an artist, leave title empty. Return at most 5 songs. Return an empty list when the message is not a song request.',
      text,
      requestSchema,
    )
    const songs = result.songs
      .map((song) => ({ title: song.title.trim().slice(0, 200), artist: song.artist.trim().slice(0, 120) }))
      .filter((song) => song.title.length > 0 && song.artist.length > 0)
      .slice(0, 5)
    return { songs, usedAi: true }
  } catch {
    const parsed = parseSongMessage(text)
    return { songs: parsed ? [parsed] : [], usedAi: false }
  }
}

export interface LoveSongSuggestion {
  title: string
  artist: string
  decade: string
  language: 'Tagalog' | 'English'
}

const suggestionSchema = z.object({
  songs: z.array(z.object({
    title: z.string(),
    artist: z.string(),
    decade: z.string(),
    language: z.enum(['Tagalog', 'English']),
  })),
})

/** Ask AI for the next classic love songs (1960s–2000s), alternating Tagalog and English, skipping recent plays. */
export async function suggestLoveSongs(input: { exclude: string[]; count: number; tagalogOnly: boolean; nightMood: boolean }): Promise<LoveSongSuggestion[]> {
  const exclude = input.exclude.slice(-120).join('; ')
  const languageRule = input.tagalogOnly
    ? 'Only Tagalog OPM love songs.'
    : 'Alternate strictly: 2 English, then 2 Tagalog OPM, and repeat.'
  const result = await structured(
    'You are the music director of RJ FM, a Filipino radio station that plays old love songs. Pick well-known original studio recordings of love songs and ballads from the 1960s, 1970s, 1980s, 1990s and 2000s. Mix the decades. No Christmas songs, no covers, no remixes, no live versions, no rock or dance tracks. Use each song\'s official title and original artist exactly as listed on YouTube.',
    `Suggest ${input.count} songs. ${languageRule}${input.nightMood ? ' It is late night: keep them slow and soft.' : ''} Never pick any of these recently played songs: ${exclude || 'none'}.`,
    suggestionSchema,
  )
  return result.songs
    .map((song) => ({ ...song, title: song.title.trim().slice(0, 200), artist: song.artist.trim().slice(0, 120), decade: song.decade.trim().slice(0, 10) }))
    .filter((song) => song.title && song.artist && (!input.tagalogOnly || song.language === 'Tagalog'))
}
