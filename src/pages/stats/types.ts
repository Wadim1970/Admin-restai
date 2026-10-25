// Ответ /api/admin/stats (Waiter-app, api/_lib/statsService.js).
import type { Restaurant } from '../hall/types'

export interface Kpi { value: number | null; prev: number | null; delta: number | null }
export type KpiKey = 'revenue' | 'sessions' | 'guests' | 'avgCheck' | 'avgGuestCheck' | 'avgDurationMin'

interface Upsell { offered: number; accepted: number; rate: number; revenue: number }
interface Group { key: string; label: string; offered: number; accepted: number; rate: number }
interface TopDish { name: string; accepted: number; revenue: number }

export interface DishRow { name: string; section: string | null; quantity: number; revenue: number; orders: number; share: number }

export interface StatsResponse {
  restaurant: Restaurant
  today: string
  period: { from: string; to: string; days: number }
  previous: { from: string; to: string; hasData: boolean }
  partial: boolean
  kpi: Record<KpiKey, Kpi>
  totals: { sessions: number; guests: number; revenue: number; avgCheck: number; avgGuestCheck: number; avgDurationMin: number | null; calls: number }
  byDay: { date: string; sessions: number; guests: number; revenue: number; avgCheck: number; offered: number; accepted: number }[]
  byHour: { hour: number; sessions: number; guests: number; revenue: number; avgSessions: number; avgRevenue: number }[]
  byWeekday: { weekday: number; days: number; sessions: number; revenue: number; avgSessions: number; avgRevenue: number }[] | null
  dishes: {
    total: number
    top: DishRow[]
    bottom: DishRow[]
    dishesSold: number
    sections: { section: string; quantity: number; revenue: number; dishes: number; share: number }[]
    unsold: { name: string; section: string | null; price: number }[]
  }
  tables: { tableId: string; number: number; zone: string; capacity: number | null; sessions: number; guests: number; revenue: number; hoursPerDay: number; sessionsPerDay: number; avgCheck: number; seatFill: number | null }[]
  ai: {
    waiter: Upsell & { byTechnique: Group[]; byCategory: Group[]; topDishes: TopDish[] }
    guestMenu: Upsell & { topDishes: TopDish[] }
    revenue: number
    share: number
  }
  guestApp: { calls: number; answered: number; avgReactionSec: number | null; slowCalls: number; sessionsWithCalls: number; sessionsWithCallsPct: number; reviews: number; reviewsPct: number }
}
