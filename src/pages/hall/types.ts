// Ответы /api/admin/hall и /api/admin/table (Waiter-app, api/_lib/hallService.js).

export type Mode = 'past' | 'today' | 'future'
export type Shape = 'round' | 'square' | 'rect'

export interface Layout { x: number; y: number; w: number | null; h: number | null; shape: Shape | null; rotation: number }
export interface WaiterRef { id: string | null; name: string | null; inferred: boolean }
export interface Assigned { id: string; waiterId: string; name: string | null; permanent: boolean }
export interface Reservation {
  id: string; tableId: string | null; startsAt: string; endsAt: string; guestCount: number
  guestName: string | null; guestPhone: string | null; comment: string | null
  status: 'confirmed' | 'seated' | 'cancelled' | 'no_show'
}

export interface HallTable {
  id: string; number: number; zone: string; capacity: number; layout: Layout | null
  assigned: Assigned[]
  live: { sessionId: string; status: string; guestCount: number | null; startedAt: string; billType: string | null; total: number; waiter: WaiterRef } | null
  pendingCall: boolean
  day: { sessions: number; guests: number; revenue: number }
  reservations: Reservation[]
}

export interface DaySummary {
  sessions: number; guests: number; revenue: number; avgCheck: number; avgGuestCheck: number
  turnsPerTable: number; avgDurationMin: number
}

export interface Restaurant { id: string; name: string; timezone: string }

export interface HallResponse {
  restaurant: Restaurant
  date: string; today: string; mode: Mode
  day: { from: string; to: string }
  zones: string[]
  zoneNames?: Record<string, string>
  tables: HallTable[]
  unassignedReservations: Reservation[]
  waiters: { id: string; name: string }[]
  summary: DaySummary | null
}

export interface SessionItem {
  name: string; seat: number | null; quantity: number; price: number; modifiers: string[]; comment: string | null; status: string | null
  // Ушло на кухню → готово; waitMin — сколько ждали, normMin — норматив блюда.
  sentAt?: string | null; readyAt?: string | null; waitMin?: number | null; normMin?: number | null
}
export interface SessionCall { at: string; reason: string | null; kind: string | null; reactionSec: number | null; acknowledgedBy: string | null }
export interface TableSession {
  id: string; startedAt: string; endedAt: string | null; active: boolean; status: string | null; billType: string | null
  durationMin: number; guestCount: number | null; firstOrderMin?: number | null; waiter: WaiterRef; total: number
  items: SessionItem[]; calls: SessionCall[]; upsell: { offered: number; accepted: number }
  review: { food: number | null; service: number | null; comment: string | null } | null
}

export interface TableDayResponse {
  restaurant: Restaurant
  date: string; today: string; mode: Mode
  table: { id: string; number: number; zone: string; capacity: number; layout: Layout | null }
  assigned: Assigned[]
  sessions: TableSession[]
  summary: DaySummary | null
  reservations: Reservation[]
}
