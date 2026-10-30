// Ответы /api/admin/bookings и /api/admin/booking-guest (Waiter-app, api/_lib/bookingsService.js).
import type { Layout, Reservation, Restaurant } from '../hall/types'

export interface GuestBadges {
  known: boolean; app: boolean; regular: boolean; loyalty: string | null
  birthdayIn: number | null; noShows: number; visits: number; name?: string | null
}

export type BookingReservation = Reservation & { guest: GuestBadges; tableNumber?: number | null }

export interface BookingTable {
  id: string; number: number; zone: string; capacity: number; layout: Layout | null
  reservations: BookingReservation[]
}

export interface BookingsResponse {
  restaurant: Restaurant
  today: string; maxDate: string; date: string
  calendar: { date: string; reservations: number; guests: number; known: number }[]
  zones: string[]
  zoneNames?: Record<string, string>
  tables: BookingTable[]
  reservations: BookingReservation[]
}

export interface GuestVisit {
  id: string; sessionId: string | null; startedAt: string; date: string; tableNumber: number | null
  waiterId: string | null; waiterName: string | null; guestCount: number | null; spent: number
  items: { name: string; quantity: number }[]; scope: 'seat' | 'table'
}

export interface GuestCard {
  restaurant: Restaurant
  found: boolean
  phone: string
  name?: string | null
  app?: { guestId: number; name: string | null; since: string | null; points: number; birthdayDay: number | null; birthdayMonth: number | null; dislikes: string | null } | null
  tastes?: string[]
  history?: {
    visits: number; firstVisit: string | null; lastVisit: string | null; spent: number; avgCheck: number; avgParty: number | null
    topDishes: { name: string; times: number; visits: number }[]
    favoriteTables: { number: number; times: number }[]
    waiters: { id: string; times: number; name: string | null }[]
    reservations: { total: number; came: number; noShow: number; cancelled: number }
  }
  visits?: GuestVisit[]
  upcoming?: Reservation[]
  reservations?: Reservation[]
  reviews?: { id: number; createdAt: string; food: number | null; service: number | null; comment: string | null }[]
  loyalty?: {
    demo: boolean; member: boolean
    level: { key: string; name: string; cashbackPct: number } | null
    next: { name: string; visitsLeft: number } | null
    balance: number
  } | null
}
