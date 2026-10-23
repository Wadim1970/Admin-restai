// Ответы /api/admin/staff и /api/admin/waiter (Waiter-app, api/_lib/staffService.js).
import type { Restaurant, TableSession } from '../hall/types'

export interface UpsellGroup { key: string; label: string; offered: number; accepted: number; rate: number }
export interface Upsell {
  offered: number; accepted: number; rate: number; revenue: number
  byTechnique?: UpsellGroup[]; byCategory?: UpsellGroup[]
  topDishes?: { name: string; accepted: number; revenue: number }[]
}

export interface Metrics {
  sessions: number; guests: number; revenue: number; avgCheck: number; avgGuestCheck: number
  avgDurationMin: number | null
  calls: number; unansweredCalls: number; avgReactionSec: number | null
  avgFirstOrderMin: number | null
  serviceRating: number | null; reviews: number
  upsell: Upsell; upsellPerSession: number; revenuePerDay: number
}

export interface WaiterRow extends Metrics {
  id: string; name: string; workDays: number; rating: number | null; tables: number[]
}

export interface Period { from: string; to: string; days: number }

export interface StaffResponse {
  restaurant: Restaurant; today: string; period: Period
  restaurantTotals: Metrics & { unattributed: { sessions: number; revenue: number } }
  waiters: WaiterRow[]
}

export interface StaffSession extends TableSession { date: string; tableId: string; tableNumber: number | null }

export interface WaiterResponse {
  restaurant: Restaurant; today: string; period: Period
  waiter: { id: string; name: string; employmentType: string | null; staff: boolean; photo: string | null; hireDate: string | null }
  totals: Omit<WaiterRow, 'id' | 'name'>
  restaurantTotals: Metrics
  byDay: { date: string; sessions: number; guests: number; revenue: number; avgCheck: number; offered: number; accepted: number }[]
  tables: { tableId: string; number: number; sessions: number; guests: number; revenue: number }[]
  sessions: StaffSession[]
}
