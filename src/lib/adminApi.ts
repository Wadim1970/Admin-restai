// Запросы админки к серверу официанта (waiter.restai.pro, api/admin/*).
// Ресторан кабинета — пока учебная «Сыроварня» (входа в личный кабинет ещё
// нет; VITE_RESTAURANT_ID в сборке меняет ресторан). Когда появится вход,
// ресторан будет браться из него.

// Сервер: на нашем домене (admin.restai.pro) — тот же адрес, nginx отдаёт
// /api/ серверу официанта; иначе (временная копия на Vercel) — waiter.restai.pro.
// VITE_WAITER_API_URL в сборке перекрывает оба варианта.
function apiBase() {
  const env = import.meta.env.VITE_WAITER_API_URL
  if (env) return env.replace(/\/$/, '')
  return window.location.hostname.endsWith('restai.pro') ? '' : 'https://waiter.restai.pro'
}
export const API = apiBase()

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

export interface FetchOpts {
  method?: string
  query?: Record<string, string | undefined>
  body?: Record<string, unknown>
  // Токен администратора (X-Admin-Token) — для разделов, закрытых даже у учебного ресторана.
  token?: string
}

// restaurantId подставляется сам: в query для GET, в тело для остальных.
export async function adminFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const method = opts.method || 'GET'
  const restaurantId = currentRestaurantId()
  const params = new URLSearchParams()
  if (method === 'GET') {
    params.set('restaurantId', restaurantId)
    for (const [k, v] of Object.entries(opts.query || {})) if (v) params.set(k, v)
  }
  let res: Response
  try {
    res = await fetch(`${API}${path}${params.size ? `?${params}` : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { 'X-Admin-Token': opts.token } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify({ restaurantId, ...opts.body }),
    })
  } catch {
    // Браузер не достучался до сервера: нет интернета, сервер перезапускается
    // после обновления или запрос заблокировало расширение браузера.
    throw new ApiError('Сервер не ответил. Проверьте интернет и нажмите «Ещё раз»; если не поможет — отключите блокировщик рекламы для этого сайта.', 0)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(json.error || `Ошибка ${res.status}`, res.status)
  return json as T
}

// Картинка (PNG) с сервера как Blob — для страниц, где нужен файл, а не JSON.
export async function adminBlob(path: string, opts: { query?: Record<string, string | undefined>; token?: string } = {}): Promise<Blob> {
  const params = new URLSearchParams({ restaurantId: currentRestaurantId() })
  for (const [k, v] of Object.entries(opts.query || {})) if (v) params.set(k, v)
  let res: Response
  try {
    res = await fetch(`${API}${path}?${params}`, { headers: opts.token ? { 'X-Admin-Token': opts.token } : {} })
  } catch {
    throw new ApiError('Сервер не ответил. Проверьте интернет и попробуйте ещё раз.', 0)
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new ApiError(json.error || `Ошибка ${res.status}`, res.status)
  }
  return res.blob()
}
