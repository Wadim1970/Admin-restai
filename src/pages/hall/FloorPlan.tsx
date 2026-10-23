import { useRef } from 'react'
import { Tooltip } from 'antd'
import type { HallTable, Layout, Mode, Shape } from './types'
import { STATUS, money, moneyShort, timeIn, shortName, plural } from './format'

// Схема зала: столы стоят в процентах от размеров зала (16:10), поэтому
// схема одинакова на любом экране. В режиме редактирования столы
// перетаскиваются и меняют размер; изменения копятся в draft до «Сохранить».

export const PLAN_RATIO = 16 / 10

export function defaultShape(capacity: number): Shape {
  return capacity <= 2 ? 'round' : capacity <= 4 ? 'square' : 'rect'
}

// Ширина — % ширины зала, высота — % высоты: круг и квадрат с учётом 16:10.
export function defaultSize(shape: Shape) {
  return shape === 'rect' ? { w: 12, h: 11.2 } : { w: 7, h: 11.2 }
}

// Нерасставленные столы — сеткой, по номерам.
export function effectiveLayouts(tables: HallTable[], draft: Map<string, Layout>) {
  const out = new Map<string, Required<{ [K in keyof Layout]: NonNullable<Layout[K]> }>>()
  let free = 0
  for (const t of [...tables].sort((a, b) => a.number - b.number)) {
    const l = draft.get(t.id) || t.layout
    const shape = l?.shape || defaultShape(t.capacity)
    const size = defaultSize(shape)
    if (l) {
      out.set(t.id, { x: l.x, y: l.y, w: l.w ?? size.w, h: l.h ?? size.h, shape, rotation: l.rotation || 0 })
    } else {
      const i = free++
      out.set(t.id, { x: 3 + (i % 6) * 16, y: 6 + Math.floor(i / 6) * 22, w: size.w, h: size.h, shape, rotation: 0 })
    }
  }
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const snap = (v: number) => Math.round(v * 2) / 2

interface Props {
  tables: HallTable[]
  mode: Mode
  tz: string
  editing: boolean
  draft: Map<string, Layout>
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, layout: Layout) => void
}

// Ближайшая активная бронь стола (сегодня — в ближайшие 2 часа или идущая).
function upcoming(t: HallTable, mode: Mode, now: number) {
  const active = t.reservations.filter((r) => r.status === 'confirmed' || r.status === 'seated')
  if (mode === 'future') return active[0] || null
  if (mode !== 'today') return null
  return active.find((r) => r.status === 'confirmed'
    && new Date(r.startsAt).getTime() - now < 2 * 3600_000
    && new Date(r.endsAt).getTime() > now) || null
}

function tileLook(t: HallTable, mode: Mode, maxSessions: number) {
  if (mode === 'today' && t.live) {
    const c = STATUS[t.live.status]?.color || STATUS.occupied.color
    return { bg: c, border: c, text: '#fff' }
  }
  if (mode === 'past' && t.day.sessions > 0) {
    const a = 0.25 + 0.6 * (t.day.sessions / Math.max(1, maxSessions))
    return { bg: `rgba(61, 106, 250, ${a.toFixed(2)})`, border: '#3d6afa', text: a > 0.55 ? '#fff' : '#1f2a44' }
  }
  if (mode === 'future' && t.reservations.some((r) => r.status === 'confirmed')) {
    return { bg: '#fff7e6', border: '#fa8c16', text: '#873800' }
  }
  return { bg: '#f4f5f7', border: '#c5c8d0', text: '#3a3d45' }
}

export default function FloorPlan({ tables, mode, tz, editing, draft, selectedId, onSelect, onMove }: Props) {
  const planRef = useRef<HTMLDivElement>(null)
  const layouts = effectiveLayouts(tables, draft)
  const now = Date.now()
  const maxSessions = Math.max(0, ...tables.map((t) => t.day.sessions))

  // Перетаскивание и изменение размера — через pointer-события (мышь и палец).
  const startDrag = (e: React.PointerEvent, id: string, kind: 'move' | 'resize') => {
    if (!editing || !planRef.current) return
    e.preventDefault()
    e.stopPropagation()
    onSelect(id)
    const rect = planRef.current.getBoundingClientRect()
    const start = layouts.get(id)!
    const sx = e.clientX
    const sy = e.clientY
    const keepRatio = start.shape !== 'rect'
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100
      const dy = ((ev.clientY - sy) / rect.height) * 100
      if (kind === 'move') {
        onMove(id, { ...start, x: snap(clamp(start.x + dx, 0, 100 - start.w)), y: snap(clamp(start.y + dy, 0, 100 - start.h)) })
      } else {
        const w = snap(clamp(start.w + dx, 3, 40))
        const h = keepRatio ? snap(w * PLAN_RATIO) : snap(clamp(start.h + dy, 3, 60))
        onMove(id, { ...start, w: Math.min(w, 100 - start.x), h: Math.min(h, 100 - start.y) })
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="hall-plan-scroll">
    <div
      ref={planRef}
      className={`hall-plan${editing ? ' hall-plan--editing' : ''}`}
      style={{ aspectRatio: `${PLAN_RATIO}` }}
    >
      {tables.map((t) => {
        const l = layouts.get(t.id)!
        const look = tileLook(t, mode, maxSessions)
        const res = upcoming(t, mode, now)
        const noWaiter = mode !== 'past' && t.assigned.length === 0
        const radius = l.shape === 'round' ? '50%' : 10
        const selected = selectedId === t.id

        // Две короткие строки — помещаются и в маленький круглый стол.
        let lines = [`${t.capacity} ${plural(t.capacity, 'место', 'места', 'мест')}`]
        if (mode === 'today' && t.live) lines = [`${t.live.guestCount || '—'} гост.`, `с ${timeIn(t.live.startedAt, tz)}`]
        else if (mode === 'past') lines = t.day.sessions ? [`${t.day.sessions} пос.`, moneyShort(t.day.revenue)] : ['не занимали']
        else if (res) lines = [timeIn(res.startsAt, tz), `${res.guestCount} чел.`]

        const tip = [
          `Стол ${t.number}, ${t.capacity} ${plural(t.capacity, 'место', 'места', 'мест')}`,
          mode === 'today' && t.live ? `${STATUS[t.live.status]?.label || 'Занят'}: ${t.live.guestCount || '—'} гост. с ${timeIn(t.live.startedAt, tz)}, ${money(t.live.total)}` : null,
          res ? `Бронь ${timeIn(res.startsAt, tz)}–${timeIn(res.endsAt, tz)}, ${res.guestCount} чел.${res.guestName ? `, ${res.guestName}` : ''}` : null,
          t.pendingCall ? 'Гость вызывает официанта' : null,
          noWaiter ? 'За столом никто не закреплён' : `Официант: ${t.assigned.map((a) => a.name).join(', ')}`,
        ].filter(Boolean).join('\n')

        return (
          <div
            key={t.id}
            className="hall-table"
            style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }}
            onPointerDown={(e) => startDrag(e, t.id, 'move')}
            onClick={() => !editing && onSelect(t.id)}
            data-testid={`table-${t.number}`}
          >
            <Tooltip title={editing ? null : <span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}>
              <div
                className={`hall-table__shape${t.pendingCall ? ' hall-table__shape--call' : ''}`}
                style={{
                  background: look.bg,
                  borderColor: res && mode === 'today' ? '#fa8c16' : look.border,
                  borderRadius: radius,
                  transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
                  outline: selected ? '3px solid #1677ff' : noWaiter ? '2px dashed #ff4d4f' : undefined,
                  outlineOffset: 3,
                }}
              />
            </Tooltip>
            <div className="hall-table__text" style={{ color: look.text }}>
              <div className="hall-table__number">{t.number}</div>
              {lines.map((l) => <div key={l} className="hall-table__line">{l}</div>)}
            </div>
            {res && mode === 'today' && <div className="hall-table__badge">{timeIn(res.startsAt, tz)}</div>}
            <div className={`hall-table__waiter${noWaiter ? ' hall-table__waiter--none' : ''}`}>
              {noWaiter ? 'нет официанта' : mode === 'past' ? '' : shortName(t.assigned[0]?.name || null)}
            </div>
            {editing && selected && (
              <div className="hall-table__resize" onPointerDown={(e) => startDrag(e, t.id, 'resize')} title="Потяните, чтобы изменить размер" />
            )}
          </div>
        )
      })}
      {tables.length === 0 && <div className="hall-plan__empty">В этой зоне пока нет столов</div>}
    </div>
    </div>
  )
}
