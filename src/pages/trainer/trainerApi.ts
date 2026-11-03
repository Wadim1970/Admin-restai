// Запросы админки к серверу ТРЕНАЖЁРА (отдельный продукт Trainer-RestAI, его собственный api/).
// Адрес — VITE_TRAINER_API_URL в сборке. Ресторан кабинета — как у остальной админки.
import { currentRestaurantId, ApiError } from '../../lib/adminApi'

export const TRAINER_API = ((import.meta.env.VITE_TRAINER_API_URL as string | undefined) || '').replace(/\/$/, '')

const TOKEN_KEY = 'restai_admin_token'
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }

export async function trainerFetch<T>(path: string, opts: { method?: string; query?: Record<string, string | undefined>; body?: Record<string, unknown> } = {}): Promise<T> {
  if (!TRAINER_API) throw new ApiError('Не задан адрес сервера тренажёра (VITE_TRAINER_API_URL).', 0)
  const method = opts.method || 'GET'
  const restaurantId = currentRestaurantId()
  const params = new URLSearchParams()
  if (method !== 'POST') {
    params.set('restaurantId', restaurantId)
    for (const [k, v] of Object.entries(opts.query || {})) if (v) params.set(k, v)
  }
  const token = readToken()
  let res: Response
  try {
    res = await fetch(`${TRAINER_API}${path}${params.size ? `?${params}` : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Admin-Token': token } : {}) },
      body: method === 'POST' ? JSON.stringify({ restaurantId, ...opts.body }) : undefined,
    })
  } catch {
    throw new ApiError('Сервер тренажёра не ответил. Проверьте интернет и попробуйте ещё раз.', 0)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((json as { error?: string }).error || `Ошибка ${res.status}`, res.status)
  return json as T
}

export type EnrollmentStatus = 'invited' | 'active' | 'closed'

// Доступ официанта к тренажёру (api/admin/enrollments): один email = одно оплаченное место на курс.
export interface Enrollment {
  id: string
  email: string
  name: string | null
  status: EnrollmentStatus
  closedReason: 'admin' | 'completed' | null
  createdAt: string
  firstLoginAt: string | null
  closedAt: string | null
  points: number
  levelPoints: Record<string, number>
  streak: number
  lastActive: string | null
}

export type AddStatus = 'added' | 'exists' | 'other_restaurant' | 'invalid' | 'error'
export interface AddResult { line?: string; email: string | null; status: AddStatus; message: string }
