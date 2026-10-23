import { Tooltip } from 'antd'

// Столбики одного показателя по дням (один ряд — одна ось, без легенды:
// показатель называет заголовок). Подсказка при наведении на весь столбец,
// подпись значения — только у максимума.
export interface Bar { key: string; label: string; value: number; tip: string }

export default function BarChart({ bars, height = 140, format }: { bars: Bar[]; height?: number; format: (v: number) => string }) {
  const max = Math.max(0, ...bars.map((b) => b.value))
  const maxIdx = bars.findIndex((b) => b.value === max && max > 0)
  const every = Math.max(1, Math.ceil(bars.length / 10)) // не больше ~10 подписей по оси
  return (
    <div className="bar-chart" style={{ height: height + 22 }}>
      <div className="bar-chart__plot" style={{ height }}>
        {bars.map((b, i) => (
          <Tooltip key={b.key} title={b.tip}>
            <div className="bar-chart__col">
              {i === maxIdx && <div className="bar-chart__value">{format(b.value)}</div>}
              <div
                className={`bar-chart__bar${b.value === 0 ? ' bar-chart__bar--zero' : ''}`}
                style={{ height: max ? `${Math.max(b.value ? 2 : 0, (b.value / max) * 100)}%` : 0 }}
              />
            </div>
          </Tooltip>
        ))}
      </div>
      <div className="bar-chart__axis">
        {bars.map((b, i) => <div key={b.key} className="bar-chart__tick">{i % every === 0 ? b.label : ''}</div>)}
      </div>
    </div>
  )
}
