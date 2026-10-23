import { Button, DatePicker, Segmented, Space } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { periodCaption, periodFor, shiftPeriod, type Period, type PeriodKind } from '../lib/period'

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'custom', label: 'Период' },
]

// Выбор периода: день / неделя / месяц / свои даты и стрелки «‹ ›».
export default function PeriodPicker({ value, today, onChange }: { value: Period; today: string; onChange: (p: Period) => void }) {
  const todayIn = value.from <= today && today <= value.to
  return (
    <Space wrap>
      <Segmented
        value={value.kind}
        options={KINDS}
        onChange={(k) => {
          const kind = k as PeriodKind
          if (kind === 'custom') onChange({ kind, from: value.from, to: value.to })
          else onChange(periodFor(kind, todayIn ? today : value.from))
        }}
      />
      <Button icon={<LeftOutlined />} onClick={() => onChange(shiftPeriod(value, -1))} aria-label="Предыдущий период" />
      {value.kind === 'custom' ? (
        <DatePicker.RangePicker
          value={[dayjs(value.from), dayjs(value.to)]}
          allowClear={false}
          format="D MMM YYYY"
          onChange={(r) => r && r[0] && r[1] && onChange({ kind: 'custom', from: r[0].format('YYYY-MM-DD'), to: r[1].format('YYYY-MM-DD') })}
        />
      ) : (
        <DatePicker
          value={dayjs(value.from)}
          picker={value.kind === 'month' ? 'month' : value.kind === 'week' ? 'week' : 'date'}
          allowClear={false}
          format={() => periodCaption(value, today)}
          onChange={(d) => d && onChange(periodFor(value.kind, d.format('YYYY-MM-DD')))}
          style={{ width: 200 }}
        />
      )}
      <Button icon={<RightOutlined />} onClick={() => onChange(shiftPeriod(value, 1))} aria-label="Следующий период" />
      <Button disabled={todayIn && value.kind !== 'custom'} onClick={() => onChange(periodFor(value.kind === 'custom' ? 'day' : value.kind, today))}>
        Сейчас
      </Button>
    </Space>
  )
}
