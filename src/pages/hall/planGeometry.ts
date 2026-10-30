// Геометрия схемы зала: столы стоят в процентах от размеров зала (16:10),
// поэтому схема одинакова на любом экране. Общая для «Зала», «Броней» и
// редактора «Ресторан → Столы».
import type { HallTable, Layout, Shape } from './types'

export const PLAN_RATIO = 16 / 10

export function defaultShape(capacity: number): Shape {
  return capacity <= 2 ? 'round' : capacity <= 4 ? 'square' : 'rect'
}

// Ширина — % ширины зала, высота — % высоты: круг и квадрат с учётом 16:10.
export function defaultSize(shape: Shape) {
  return shape === 'rect' ? { w: 12, h: 11.2 } : { w: 7, h: 11.2 }
}

// Нерасставленные столы — сеткой, по номерам.
export function effectiveLayouts(tables: Pick<HallTable, 'id' | 'number' | 'capacity' | 'layout'>[], draft: Map<string, Layout>) {
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

