// Ответ /api/admin/reviews (Waiter-app, api/_lib/reviewsService.js).
import type { Restaurant, TableSession } from '../hall/types'

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
  byDay: { date: string; reviews: number; complaints: number; foodAvg: number | null; foodCount: number; serviceAvg: number | null; serviceCount: number }[]
  reviews: Review[]
}

// Кто сидел на месте: заказывал со своего телефона; verified — гость
// приложения, подтвердивший номер по SMS (с именем и телефоном).
export interface SeatGuest { seat: number | null; verified: boolean; guestId: string | null; name: string | null; phone: string | null }

// Ответ /api/admin/reviews?id=… — визит, за который оставили отзыв.
export interface ReviewVisit {
  restaurant: Restaurant
  review: Omit<Review, 'session' | 'waiter'>
  session: TableSession | null
  guests: SeatGuest[]
}
