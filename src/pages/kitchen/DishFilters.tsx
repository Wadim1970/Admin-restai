import { Input, Select, Space, Switch, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { Dish } from './types'

const { Text } = Typography

export interface Filters { q: string; section: string | null; onlyMarked: boolean }

// Поиск по названию, раздел меню и «только отмеченные» — общие для вкладок.
export function applyFilters(dishes: Dish[], f: Filters, marked: (d: Dish) => boolean) {
  const q = f.q.trim().toLowerCase().replace(/ё/g, 'е')
  return dishes.filter((d) => (!q || d.name.toLowerCase().replace(/ё/g, 'е').includes(q))
    && (!f.section || d.sections.includes(f.section))
    && (!f.onlyMarked || marked(d)))
}

export default function DishFilters({ value, onChange, sections, markedLabel }: {
  value: Filters; onChange: (f: Filters) => void; sections: string[]; markedLabel: string
}) {
  return (
    <Space wrap style={{ marginBottom: 12 }}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Найти блюдо"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        style={{ width: 240 }}
      />
      <Select
        allowClear
        placeholder="Все разделы"
        value={value.section}
        onChange={(s) => onChange({ ...value, section: s ?? null })}
        options={sections.map((s) => ({ value: s, label: s }))}
        style={{ width: 220 }}
        showSearch
      />
      <span>
        <Switch size="small" checked={value.onlyMarked} onChange={(v) => onChange({ ...value, onlyMarked: v })} />{' '}
        <Text>{markedLabel}</Text>
      </span>
    </Space>
  )
}
