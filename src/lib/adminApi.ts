// Доступ админки к серверу официанта (waiter.restai.pro, api/admin/*).
// Входа в админку пока нет: ID ресторана и токен админки вводятся один раз —
// ID хранится в браузере, токен только в этой вкладке. Ключи — те же, что у
// раздела «Пары блюд», чтобы не вводить дважды.

export const API = (import.meta.env.VITE_WAITER_API_URL || 'https://waiter.restai.pro').replace(/\/$/, '')

const RESTAURANT_KEY = 'pairings_restaurant_id'
const TOKEN_KEY = 'pairings_admin_token'

function read(storage: Storage, key: string) {
  try { return storage.getItem(key) || '' } catch { return '' }
}
function write(storage: Storage, key: string, value: string) {
  try {
    if (value) storage.setItem(key, value)
    else storage.removeItem(key)
  } catch { /* приватный режим */ }
}

export interface Access { restaurantId: string; token: string }

export function loadAccess(): Access {
  return { restaurantId: read(localStorage, RESTAURANT_KEY), token: read(sessionStorage, TOKEN_KEY) }
}

export function saveAccess(a: Access) {
  write(localStorage, RESTAURANT_KEY, a.restaurantId.trim())
  write(sessionStorage, TOKEN_KEY, a.token.trim())
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Запрос к /api/admin/*: restaurantId подставляется сам (в query для GET,
// в тело для остальных).
export async function adminFetch<T>(access: Access, path: string, opts: { method?: string; query?: Record<string, string | undefined>; body?: Record<string, unknown> } = {}): Promise<T> {
  const method = opts.method || 'GET'
  const params = new URLSearchParams()
  if (method === 'GET') {
    params.set('restaurantId', access.restaurantId)
    for (const [k, v] of Object.entries(opts.query || {})) if (v) params.set(k, v)
  }
  const res = await fetch(`${API}${path}${params.size ? `?${params}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': access.token },
    body: method === 'GET' ? undefined : JSON.stringify({ restaurantId: access.restaurantId, ...opts.body }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error || `Ошибка ${res.status}`, res.status)
  return json as T
}
