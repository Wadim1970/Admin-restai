import { Tooltip } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'

export function reactionShort(sec: number | null) {
  if (sec == null) return '—'
  if (sec < 60) return `${sec} с`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} мин ${s} с` : `${m} мин`
}

// «▲ 12% к среднему по ресторану». better: 'higher' — больше лучше (чек),
// 'lower' — меньше лучше (время реакции). Цвет — по тому, хорошо ли это,
// а стрелка — по направлению, чтобы смысл читался не только по цвету.
export function Compare({ value, base, better = 'higher', format }: {
  value: number | null; base: number | null; better?: 'higher' | 'lower'; format: (v: number) => string
}) {
  if (value == null || base == null || base === 0) return null
  const diff = Math.round(((value - base) / base) * 100)
  if (diff === 0) return <Tooltip title={`В среднем по ресторану: ${format(base)}`}><span style={{ fontSize: 12, color: '#8c8f97' }}>как в среднем</span></Tooltip>
  const good = better === 'higher' ? diff > 0 : diff < 0
  return (
    <Tooltip title={`В среднем по ресторану: ${format(base)}`}>
      <span className={good ? 'cmp-up' : 'cmp-down'} style={{ fontSize: 12 }}>
        {diff > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(diff)}% к среднему
      </span>
    </Tooltip>
  )
}
