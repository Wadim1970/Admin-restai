import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

// Период аналитики: день, календарная неделя (пн–вс), календарный месяц
// или свои даты. Хранится в адресе страницы (?p=week&from=…&to=…), чтобы
// ссылкой можно было поделиться и «назад» в браузере работал.

export type PeriodKind = 'day' | 'week' | 'month' | 'custom'
export interface Period { kind: PeriodKind; from: string; to: string }

const F = 'YYYY-MM-DD'

export function periodFor(kind: PeriodKind, anchor: string): Period {
  const d = dayjs(anchor)
  if (kind === 'week') {
    const monday = d.subtract((d.day() + 6) % 7, 'day')
    return { kind, from: monday.format(F), to: monday.add(6, 'day').format(F) }
  }
  if (kind === 'month') return { kind, from: d.startOf('month').format(F), to: d.endOf('month').format(F) }
  return { kind: 'day', from: d.format(F), to: d.format(F) }
}

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  if (p.kind === 'custom') {
    const len = dayjs(p.to).diff(dayjs(p.from), 'day') + 1
    return { kind: 'custom', from: dayjs(p.from).add(dir * len, 'day').format(F), to: dayjs(p.to).add(dir * len, 'day').format(F) }
  }
  const unit = p.kind === 'day' ? 'day' : p.kind === 'week' ? 'week' : 'month'
  return periodFor(p.kind, dayjs(p.from).add(dir, unit).format(F))
}

export function readPeriod(params: URLSearchParams): Period {
  const kind = (params.get('p') as PeriodKind) || 'week'
  const from = params.get('from')
  const to = params.get('to')
  if (kind === 'custom' && from && to) return { kind, from, to }
  return periodFor(kind === 'custom' ? 'week' : kind, from || dayjs().format(F))
}

export function writePeriod(params: URLSearchParams, p: Period) {
  const next = new URLSearchParams(params)
  next.set('p', p.kind)
  next.set('from', p.from)
  if (p.kind === 'custom') next.set('to', p.to)
  else next.delete('to')
  return next
}

export function periodCaption(p: Period, today: string) {
  const f = dayjs(p.from)
  const t = dayjs(p.to)
  if (p.kind === 'day') {
    const diff = f.diff(dayjs(today), 'day')
    const label = f.format('D MMMM')
    return diff === 0 ? `Сегодня, ${label}` : diff === -1 ? `Вчера, ${label}` : `${f.format('dd')}, ${label}`
  }
  if (p.kind === 'month') {
    const s = f.format('MMMM YYYY')
    return s[0].toUpperCase() + s.slice(1)
  }
  if (f.month() === t.month()) return `${f.format('D')}–${t.format('D MMMM')}`
  return `${f.format('D MMM')} – ${t.format('D MMM')}`
}
