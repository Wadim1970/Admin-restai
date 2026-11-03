import { Button, Checkbox, Input, InputNumber, Radio, Select, Space, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { DONENESS_LABELS, WEIGHT_UNITS, YES_NO_LABELS, type FactType, type FactValue } from './types'

const { Text } = Typography

// Пустое значение для редактора, пока факта ещё нет.
export function emptyValue(type: FactType): FactValue {
  switch (type) {
    case 'weight': return { value: null, unit: 'г' }
    case 'cooking_time_min': return { minutes: null }
    case 'ingredients': return { items: [] }
    case 'allergens':
    case 'may_contain': return { codes: [] }
    case 'sauce': return { text: '' }
    case 'doneness_recommended': return { value: null }
    case 'gluten_free_possible':
    case 'dairy_free_possible': return { value: null, note: '' }
    case 'modifications': return { items: [] }
    case 'wine_pairing': return { item_ids: [] }
    case 'wine_grape': return { grapes: [] }
    case 'wine_vintage': return { year: null }
    default: return { text: '' }
  }
}

interface Props {
  type: FactType
  value: FactValue
  onChange: (v: FactValue) => void
  allergens: { code: string; name: string }[]
  alcohol: { id: string; name: string }[]
}

export default function FactEditor({ type, value, onChange, allergens, alcohol }: Props) {
  switch (type) {
    case 'weight':
      return (
        <Space.Compact>
          <InputNumber min={0} value={value.value} onChange={(v) => onChange({ ...value, value: v })} style={{ width: 120 }} placeholder="320" />
          <Select value={value.unit || 'г'} onChange={(unit) => onChange({ ...value, unit })} options={WEIGHT_UNITS.map((u) => ({ value: u, label: u }))} style={{ width: 80 }} />
        </Space.Compact>
      )
    case 'cooking_time_min':
      return (
        <Space>
          <InputNumber min={0} max={300} value={value.minutes} onChange={(v) => onChange({ minutes: v })} style={{ width: 110 }} />
          <Text type="secondary">мин</Text>
        </Space>
      )
    case 'ingredients': {
      const items: { name: string; is_key: boolean }[] = value.items || []
      const set = (next: typeof items) => onChange({ items: next })
      return (
        <div>
          {items.length === 0 && <Text type="secondary">Состав пуст — добавьте ингредиенты.</Text>}
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <Input value={it.name} onChange={(e) => set(items.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))} placeholder="Ингредиент" />
              <Checkbox checked={it.is_key} onChange={(e) => set(items.map((x, n) => (n === i ? { ...x, is_key: e.target.checked } : x)))} style={{ whiteSpace: 'nowrap' }}>ключевой</Checkbox>
              <Button type="text" danger icon={<DeleteOutlined />} aria-label="Убрать" onClick={() => set(items.filter((_, n) => n !== i))} />
            </div>
          ))}
          <Space wrap>
            <Button size="small" icon={<PlusOutlined />} onClick={() => set([...items, { name: '', is_key: false }])}>Ингредиент</Button>
            {items.length > 0 && (
              <Button size="small" onClick={() => set(items.map((x, n) => ({ ...x, is_key: n < 5 })))}>Первые 5 — ключевые</Button>
            )}
          </Space>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Ключевые — те, что официант должен знать наверняка (в упражнениях проверяются только они).</Text></div>
        </div>
      )
    }
    case 'allergens':
    case 'may_contain':
      return (
        <div>
          <Checkbox.Group
            value={value.codes || []}
            onChange={(codes) => onChange({ codes })}
            options={allergens.map((a) => ({ value: a.code, label: a.name }))}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4 }}
          />
          {type === 'allergens' && (value.codes || []).length === 0 && (
            <div style={{ marginTop: 6 }}><Text type="secondary" style={{ fontSize: 12 }}>Ничего не отмечено = «аллергенов в блюде нет». Подтверждайте только если уверены.</Text></div>
          )}
        </div>
      )
    case 'sauce':
      return (
        <Space orientation="vertical" style={{ width: '100%' }} size={4}>
          <Input value={value.none ? '' : value.text} disabled={!!value.none} onChange={(e) => onChange({ text: e.target.value })} placeholder="Например: сливочно-грибной" />
          <Checkbox checked={!!value.none} onChange={(e) => onChange(e.target.checked ? { none: true } : { text: '' })}>Без соуса</Checkbox>
        </Space>
      )
    case 'doneness_recommended':
      return <Select value={value.value} onChange={(v) => onChange({ value: v })} placeholder="Выберите" style={{ width: 280 }} options={Object.entries(DONENESS_LABELS).map(([v, label]) => ({ value: v, label }))} />
    case 'gluten_free_possible':
    case 'dairy_free_possible':
      return (
        <Space orientation="vertical" style={{ width: '100%' }} size={6}>
          <Radio.Group value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} options={Object.entries(YES_NO_LABELS).map(([v, label]) => ({ value: v, label }))} />
          <Input value={value.note || ''} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="Что заменить или убрать (необязательно)" />
        </Space>
      )
    case 'modifications': {
      const items: string[] = value.items || []
      return (
        <Input.TextArea
          rows={Math.min(Math.max(items.length, 2), 8)}
          value={items.join('\n')}
          onChange={(e) => onChange({ items: e.target.value.split('\n') })}
          placeholder="По одной замене или добавке в строке"
        />
      )
    }
    case 'wine_grape': {
      const grapes: string[] = value.grapes || []
      return (
        <div>
          <Input.TextArea
            rows={Math.min(Math.max(grapes.length + 1, 2), 6)}
            value={grapes.join('\n')}
            onChange={(e) => onChange({ grapes: e.target.value.split('\n') })}
            placeholder="По одному сорту в строке, например: Мерло"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>Для купажа — каждый сорт с новой строки. Пишите так, как в винной карте.</Text>
        </div>
      )
    }
    case 'wine_vintage':
      return (
        <Space>
          <InputNumber min={1900} max={2100} precision={0} value={value.year} onChange={(v) => onChange({ year: v })} style={{ width: 130 }} placeholder="2021" />
          <Text type="secondary">год урожая</Text>
        </Space>
      )
    case 'wine_pairing':
      return (
        <Select
          mode="multiple"
          value={value.item_ids || []}
          onChange={(ids) => onChange({ item_ids: ids })}
          options={alcohol.map((a) => ({ value: a.id, label: a.name }))}
          placeholder={alcohol.length ? 'Выберите из винной карты' : 'В меню нет алкогольных позиций'}
          optionFilterProp="label"
          style={{ width: '100%' }}
        />
      )
    default:
      return <Input.TextArea rows={3} maxLength={type === 'guest_description' ? 500 : 300} showCount value={value.text || ''} onChange={(e) => onChange({ text: e.target.value })} />
  }
}
