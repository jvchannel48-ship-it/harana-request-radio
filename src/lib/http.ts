export const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } })
}

export function jsonError(error: string, status = 500) {
  return json({ error }, status)
}

export async function readBody<T>(request: Request): Promise<Partial<T>> {
  return (await request.json().catch(() => ({}))) as Partial<T>
}
