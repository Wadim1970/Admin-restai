// Ответ /api/admin/reviews (Waiter-app, api/_lib/reviewsService.js).
import type { Restaurant } from '../hall/types'

export interface Review {
  id: number
  createdAt: string
  date: string
  tableNumber: string | null
  tableId: string | null
  comment: string | null
  food: number | null
  service: number | null
  complaint: boolean
  severity: 'high' | 'medium' | null
  about: ('kitchen' | 'service')[]
  resolvedAt: string | null
  resolvedNote: string | null
  session: { id: string; startedAt: string; endedAt: string | null; guestCount: number | null } | null
  waiter: { id: string; name: string | null; inferred: boolean } | null
}

interface Scale { avg: number | null; count: number; distribution: Record<string, number> }

export interface ReviewsResponse {
  restaurant: Restaurant
  today: string
  period: { from: string; to: string; days: number }
  summary: { reviews: number; withComment: number; food: Scale; service: Scale; complaints: number; complaintsPct: number; unresolved: number }
  byWaiter: { id: string; name: string | null; reviews: number; complaints: number; serviceAvg: number | null }[]
  byDay: { date: string; reviews: number; complaints: number; foodAvg: number | null; serviceAvg: number | null }[]
  reviews: Review[]
}
