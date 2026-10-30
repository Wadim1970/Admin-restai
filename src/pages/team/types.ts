// Ответы /api/admin/team, jobs, freelancers, schedule (Waiter-app, api/_lib/teamService.js).
import type { Restaurant } from '../hall/types'

export interface Person { id: string | null; name: string; phone: string | null; verified: boolean; rating: number | null }

export type Role = 'waiter' | 'senior_waiter' | 'manager'
export const ROLE_LABELS: Record<Role, string> = { waiter: 'Официант', senior_waiter: 'Старший официант', manager: 'Менеджер' }

export interface StaffMember extends Person {
  id: string // строка штата (restaurant_staff)
  waiterId: string
  role: Role
  hireDate: string
  dismissalDate: string | null
  lastName: string
  firstName: string
  middleName: string
  registered: boolean
}
export interface TeamResponse { restaurant: Restaurant; staff: StaffMember[]; dismissed: StaffMember[] }

// Условия смены — как в карточке смены у официанта.
export interface JobConditions {
  startTime: string
  endTime: string
  slots: number
  pay: number
  dressCode: string
  tipsDistribution: string
  nutrition: string
  requiredDocuments: string
  responsibilityZone: string
  duties: string
  requiredTechnologies: string
}
export type BookingStatus = 'applied' | 'approved' | 'confirmed' | 'rejected' | 'cancelled'
export interface JobBooking { id: string; status: BookingStatus; createdAt: string; waiter: Person }
export interface Job extends JobConditions { id: string; date: string; slotsFree: number; createdAt: string; bookings: JobBooking[] }
export interface JobsResponse { restaurant: Restaurant; today: string; upcoming: Job[]; past: Job[]; template: (JobConditions & { id: null; date: null }) | null }

export const BOOKING_LABELS: Record<BookingStatus, { label: string; color: string }> = {
  applied: { label: 'Откликнулся', color: 'blue' },
  approved: { label: 'Одобрен — ждём подтверждения', color: 'gold' },
  confirmed: { label: 'Подтвердил выход', color: 'green' },
  rejected: { label: 'Отклонён', color: 'default' },
  cancelled: { label: 'Отменён', color: 'default' },
}

export interface FreelanceShift {
  bookingId: string; date: string; startTime: string; endTime: string; status: BookingStatus; done: boolean; checkedIn: boolean
  review: { rating: number; comment: string; at: string } | null
}
export interface Freelancer extends Person { shiftsDone: number; upcoming: number; lastDate: string | null; myRating: number | null; shifts: FreelanceShift[] }
export interface FreelancersResponse {
  restaurant: Restaurant; today: string; reviewsEnabled: boolean; freelancers: Freelancer[]
  toReview: (FreelanceShift & { waiter: { id: string; name: string } })[]
}

export interface ScheduleShift { id: string; waiterId: string; date: string; startTime: string; endTime: string; note: string }
export interface ScheduleResponse {
  restaurant: Restaurant; today: string; days: string[]; enabled: boolean
  staff: (Person & { role: Role })[]
  shifts: ScheduleShift[]
  freelance: { bookingId: string; waiter: Person; date: string; startTime: string; endTime: string; status: BookingStatus }[]
}

// +79991234567 → +7 999 123-45-67
export function formatPhone(p: string | null) {
  const m = String(p || '').match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/)
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : p || ''
}
