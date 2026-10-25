// Ответы /api/admin/kitchen и /api/admin/kitchen-slow (Waiter-app, api/_lib/kitchenService.js).
import type { Restaurant } from '../hall/types'

export interface Dish {
  key: string
  ids: string[]
  name: string
  sections: string[]
  price: number
  cookTimeMin: number | null
  hidden: boolean
  available: boolean
  stopUntil: string | null // ISO или 'forever'
  stopNote: string | null
  urgentUntil: string | null
  urgentNote: string | null
  priority: number
  priorityReason: string | null
  marginAbs: number | null
  marginPct: number | null
  selfCost: number | null
  sold30: number
}

export interface KitchenResponse {
  restaurant: Restaurant
  now: string
  dayEnd: string
  sections: string[]
  dishes: Dish[]
}

export interface SlowResponse {
  restaurant: Restaurant
  today: string
  period: { from: string; to: string; days: number }
  summary: { measured: number; late: number; latePct: number; avgDelayMin: number; noNorm: number; skipped: number }
  dishes: { dish: string; normMin: number; count: number; late: number; latePct: number; avgActualMin: number; maxActualMin: number }[]
  lateItems: { itemId: string; dish: string; sentAt: string; readyAt: string; actualMin: number; normMin: number; delayMin: number; tableNumber: string | null; quantity: number }[]
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'Обычное',
  1: 'По возможности',
  2: 'Рекомендовать',
  3: 'В первую очередь',
}
