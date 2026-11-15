import { supabaseAdmin } from '@/integrations/supabase/client.server'

const BUCKET = 'more-fm-media'
const MAX_FILE_SIZE = 4 * 1024 * 1024

export function hasSupabaseStorageConfig() {
  return true
}

export async function uploadSupabaseAudio(pathname: string, file: File, contentType: string) {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error('Audio must be under 4 MB.')
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(pathname, await file.arrayBuffer(), { contentType, upsert: true })
  if (error) throw new Error(`Audio upload failed (${error.message}).`)
}

export async function deleteSupabaseAudio(pathname: string) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([pathname])
  if (error) throw new Error(`Audio delete failed (${error.message}).`)
}

/** Stream a private station clip through a short-lived signed URL, forwarding Range for seeking. */
export async function fetchSupabaseAudio(pathname: string, range?: string | null) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(pathname, 120)
  if (error || !data?.signedUrl) return new Response(null, { status: 404 })
  return fetch(data.signedUrl, { headers: range ? { Range: range } : {} })
}
