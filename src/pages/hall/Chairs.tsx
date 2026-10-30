import type { Shape } from './types'
import { PLAN_RATIO } from './planGeometry'

// Стулья вокруг стола — по числу мест, чтобы схема была похожа на зал:
// у круглого — по кругу, у квадратного — по сторонам по очереди, у
// прямоугольного — вдоль длинных сторон (нечётный — один в торце, от 10
// мест — по одному в каждом торце). Положение — в % от коробки стола,
// размер — от ширины схемы (cqw), поэтому на любом экране одинаково.

type Side = 'top' | 'bottom' | 'left' | 'right'
interface Seat { x: number; y: number; dx: number; dy: number; turn: number }

const MAX_CHAIRS = 16

function along(side: Side, k: number): Seat[] {
  return Array.from({ length: k }, (_, i) => {
    const t = ((i + 1) / (k + 1)) * 100
    if (side === 'top') return { x: t, y: 0, dx: 0, dy: -1, turn: 0 }
    if (side === 'bottom') return { x: t, y: 100, dx: 0, dy: 1, turn: 0 }
    if (side === 'left') return { x: 0, y: t, dx: -1, dy: 0, turn: 90 }
    return { x: 100, y: t, dx: 1, dy: 0, turn: 90 }
  })
}

export function seatsOf(shape: Shape, capacity: number, w: number, h: number): Seat[] {
  const n = Math.max(0, Math.min(MAX_CHAIRS, capacity))
  if (shape === 'round') {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2
      return { x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a), dx: Math.cos(a), dy: Math.sin(a), turn: (a * 180) / Math.PI + 90 }
    })
  }
  if (shape === 'square') {
    const count: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 }
    const order: Side[] = ['top', 'bottom', 'left', 'right']
    for (let i = 0; i < n; i++) count[order[i % 4]]++
    return order.flatMap((s) => along(s, count[s]))
  }
  // Прямоугольный: длинная сторона — по реальным пропорциям на схеме.
  const wide = w * PLAN_RATIO >= h
  const ends = n <= 4 ? n % 2 : n % 2 === 1 ? 1 : n >= 10 ? 2 : 0
  const long = n - ends
  const [a, b]: Side[] = wide ? ['top', 'bottom'] : ['left', 'right']
  const [e1, e2]: Side[] = wide ? ['left', 'right'] : ['top', 'bottom']
  return [...along(a, Math.ceil(long / 2)), ...along(b, Math.floor(long / 2)), ...along(e1, ends >= 1 ? 1 : 0), ...along(e2, ends >= 2 ? 1 : 0)]
}

export default function Chairs({ shape, capacity, w, h }: { shape: Shape; capacity: number; w: number; h: number }) {
  return (
    <>
      {seatsOf(shape, capacity, w, h).map((s, i) => (
        <span
          key={i}
          className="plan-chair"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `translate(-50%, -50%) translate(calc(${s.dx.toFixed(3)} * 1.5cqw), calc(${s.dy.toFixed(3)} * 1.5cqw)) rotate(${Math.round(s.turn)}deg)`,
          }}
        />
      ))}
    </>
  )
}
