import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

export const ZONE_LABELS: Record<string, string> = {
  main: 'Основной зал',
  veranda: 'Веранда',
  banquet: 'Банкетный зал',
}
export const zoneLabel = (z: string) => ZONE_LABELS[z] || z

// Статусы посадки — как в приложении официанта.
export const STATUS: Record<string, { label: string; color: string }> = {
  free: { label: 'Свободен', color: '#8e9096' },
  occupied: { label: 'Гости сели', color: '#227B8F' },
  preparing: { label: 'Готовится', color: '#3d6afa' },
  resting: { label: 'Отдыхают', color: '#15b200' },
  bill_requested: { label: 'Ждут счёт', color: '#ae3bfb' },
  call: { label: 'Вызов', color: '#d30000' },
}

export const RES_STATUS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Ждём', color: 'orange' },
  seated: { label: 'Пришли', color: 'green' },
  cancelled: { label: 'Отменена', color: 'default' },
  no_show: { label: 'Не пришли', color: 'red' },
}

// Вызов официанта: причина — свободный текст гостя; age_check — проверка возраста.
export function callLabel(kind: string | null, reason: string | null) {
  if (kind === 'age_check') return 'Подтвердить возраст'
  return reason || 'Вызов официанта'
}

export const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`

// Коротко для схемы: 15 180 → «15,2 т ₽».
export const moneyShort = (n: number) => (n >= 10_000 ? `${(n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} т ₽` : money(n))

export function timeIn(iso: string, tz: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function dateIn(iso: string, tz: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: 'numeric', month: 'long', weekday: 'short' }).format(new Date(iso))
}

export function duration(min: number) {
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

export function reaction(sec: number | null) {
  if (sec == null) return 'без ответа'
  if (sec < 60) return `${sec} с`
  return `${Math.floor(sec / 60)} мин ${sec % 60 ? `${sec % 60} с` : ''}`.trim()
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export function shortName(name: string | null) {
  if (!name) return ''
  const [first, last] = name.split(' ')
  return last ? `${first} ${last[0]}.` : first
}

// Подпись даты в шапке: «Сегодня, 23 октября», «Вчера, …», «пт, 25 октября».
export function dateCaption(date: string, today: string) {
  const d = dayjs(date)
  const diff = d.diff(dayjs(today), 'day')
  const label = d.format('D MMMM')
  if (diff === 0) return `Сегодня, ${label}`
  if (diff === -1) return `Вчера, ${label}`
  if (diff === 1) return `Завтра, ${label}`
  return `${d.format('dd')}, ${label}`
}

// Местное время ресторана «дата + ЧЧ:ММ» → ISO (UTC). Как zonedTime на сервере.
export function zonedIso(date: string, hhmm: string, tz: string) {
  const naive = Date.parse(`${date}T${hhmm}:00Z`)
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(t))
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    return Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second) - t
  }
  let t = naive - offset(naive)
  t = naive - offset(t)
  return new Date(t).toISOString()
}

// Обратно: ISO → { date, time } по времени ресторана (для формы брони).
export function localParts(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso))
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` }
}
