// Запросы админки к серверу официанта (waiter.restai.pro, api/admin/*).
// Ресторан кабинета — пока учебная «Сыроварня» (входа в личный кабинет ещё
// нет; VITE_RESTAURANT_ID в сборке меняет ресторан). Когда появится вход,
// ресторан будет браться из него.

export const API = (import.meta.env.VITE_WAITER_API_URL || 'https://waiter.restai.pro').replace(/\/$/, '')

const DEMO_RESTAURANT_ID = 'dd89773c-0952-4fd1-9510-514094a928ee'

export function currentRestaurantId(): string {
  return import.meta.env.VITE_RESTAURANT_ID || DEMO_RESTAURANT_ID
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface FetchOpts { method?: string; query?: Record<string, string | undefined>; body?: Record<string, unknown> }

// restaurantId подставляется сам: в query для GET, в тело для остальных.
export async function adminFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const method = opts.method || 'GET'
  const restaurantId = currentRestaurantId()
  const params = new URLSearchParams()
  if (method === 'GET') {
    params.set('restaurantId', restaurantId)
    for (const [k, v] of Object.entries(opts.query || {})) if (v) params.set(k, v)
  }
  const res = await fetch(`${API}${path}${params.size ? `?${params}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify({ restaurantId, ...opts.body }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error || `Ошибка ${res.status}`, res.status)
  return json as T
}
