import { useMemo, useState } from 'react'
import { Button, Dropdown, Empty, Input, Segmented, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownOutlined, FireOutlined } from '@ant-design/icons'
import type { Dish } from './types'
import { PRIORITY_LABELS } from './types'
import DishFilters, { applyFilters, type Filters } from './DishFilters'
import { money } from '../hall/format'

const { Text, Paragraph } = Typography

type Act = (action: string, ids: string[], extra?: Record<string, unknown>) => Promise<void>

const LEVELS = [0, 1, 2, 3].map((p) => ({
  value: p,
  label: <Tooltip title={PRIORITY_LABELS[p]}>{p === 0 ? '—' : '★'.repeat(p)}</Tooltip>,
}))

// Причина приоритета — то, что официант увидит в подсказке («почему»).
function ReasonInput({ dish, act }: { dish: Dish; act: Act }) {
  const [v, setV] = useState(dish.priorityReason || '')
  if (!dish.priority) return <Text type="secondary">—</Text>
  const save = () => { if (v.trim() !== (dish.priorityReason || '')) act('priority', dish.ids, { priority: dish.priority, reason: v.trim() }) }
  return (
    <Input
      size="small"
      value={v}
      placeholder="Почему (видит официант)"
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onPressEnter={save}
      maxLength={200}
    />
  )
}

// Какие блюда рекомендовать в первую очередь — гостю (пары в меню, голосовой
// помощник) и официанту (подсказки ИИ). Постоянный приоритет по марже +
// «срочно продать сегодня».
export default function PriorityTab({ dishes, sections, act }: { dishes: Dish[]; sections: string[]; act: Act }) {
  const [filters, setFilters] = useState<Filters>({ q: '', section: null, onlyMarked: false })
  const [selected, setSelected] = useState<string[]>([])
  const rows = useMemo(() => applyFilters(dishes, filters, (d) => d.priority > 0 || !!d.urgentUntil), [dishes, filters])
  const byKey = useMemo(() => new Map(dishes.map((d) => [d.key, d])), [dishes])
  const idsOf = (keys: string[]) => keys.flatMap((k) => byKey.get(k)?.ids || [])
  const urgentCount = dishes.filter((d) => d.urgentUntil).length
  const priorityCount = dishes.filter((d) => d.priority >= 2).length

  const columns: ColumnsType<Dish> = [
    {
      title: 'Блюдо', dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name, 'ru'),
      render: (name: string, d) => (
        <div>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {d.stopUntil && <Tag color="red" style={{ marginLeft: 6 }}>в стопе</Tag>}
          <div><Text type="secondary" style={{ fontSize: 12 }}>{d.sections.join(', ')}</Text></div>
        </div>
      ),
    },
    { title: 'Цена', dataIndex: 'price', width: 90, align: 'right', render: money },
    {
      title: <Tooltip title="Цена минус себестоимость (из калькуляции)">Маржа</Tooltip>,
      dataIndex: 'marginAbs', width: 120, align: 'right',
      defaultSortOrder: 'descend',
      sorter: (a, b) => (a.marginAbs ?? -1e9) - (b.marginAbs ?? -1e9),
      render: (v: number | null, d) => (v == null ? <Text type="secondary">нет данных</Text>
        : <span>{money(v)}{d.marginPct != null && <Text type="secondary"> · {Math.round(d.marginPct * 100)}%</Text>}</span>),
    },
    { title: 'Продано за 30 дн.', dataIndex: 'sold30', width: 130, align: 'right', sorter: (a, b) => a.sold30 - b.sold30 },
    {
      title: <Tooltip title="— обычное · ★ по возможности · ★★ рекомендовать · ★★★ в первую очередь">Приоритет</Tooltip>,
      dataIndex: 'priority', width: 190,
      sorter: (a, b) => a.priority - b.priority,
      render: (p: number, d) => (
        <Segmented className={`prio-seg prio-seg--${p}`} size="small" value={p} options={LEVELS} onChange={(v) => act('priority', d.ids, { priority: v, reason: d.priorityReason || '' })} />
      ),
    },
    { title: 'Почему', key: 'reason', width: 220, render: (_, d) => <ReasonInput key={`${d.key}:${d.priority}:${d.priorityReason}`} dish={d} act={act} /> },
    {
      title: <Tooltip title="Например, последний день реализации. Сегодня — в рекомендации в первую очередь; в 06:00 снимется само.">Срочно продать сегодня</Tooltip>,
      key: 'urgent', width: 140, align: 'center',
      render: (_, d) => <Switch checked={!!d.urgentUntil} onChange={(v) => act(v ? 'urgent' : 'unurgent', d.ids)} />,
    },
  ]

  const levelMenu = {
    items: [3, 2, 1, 0].map((p) => ({ key: String(p), label: `${p === 0 ? 'Снять приоритет' : `${'★'.repeat(p)} ${PRIORITY_LABELS[p]}`}` })),
    onClick: async ({ key }: { key: string }) => { await act('priority', idsOf(selected), { priority: Number(key) }); setSelected([]) },
  }

  return (
    <div>
      <Paragraph type="secondary" style={{ maxWidth: 860 }}>
        Отмеченные блюда первыми попадают в рекомендации: в подсказки официанту, в пары блюд в меню гостя и в советы голосового
        помощника — когда они уместны к заказу. ★★ и ★★★ гость и официант увидят первыми, ★ — при прочих равных. «Срочно продать
        сегодня» — на один день, в первую очередь. Гостю про выгоду ресторана ничего не говорится.
      </Paragraph>
      <Space style={{ marginBottom: 12 }} wrap>
        <Tag icon={<FireOutlined />} color={urgentCount ? 'volcano' : 'default'}>Срочно продать сегодня: {urgentCount}</Tag>
        <Tag color={priorityCount ? 'gold' : 'default'}>В приоритете (★★ и ★★★): {priorityCount}</Tag>
      </Space>

      <DishFilters value={filters} onChange={setFilters} sections={sections} markedLabel="Только отмеченные" />

      {selected.length > 0 && (
        <Space wrap style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbe6', borderRadius: 8, width: '100%' }}>
          <Text strong>Выбрано: {selected.length}</Text>
          <Dropdown menu={levelMenu} trigger={['click']}>
            <Button type="primary">Приоритет <DownOutlined /></Button>
          </Dropdown>
          <Button icon={<FireOutlined />} onClick={async () => { await act('urgent', idsOf(selected)); setSelected([]) }}>Срочно продать сегодня</Button>
          <Button onClick={async () => { await act('unurgent', idsOf(selected)); setSelected([]) }}>Снять «срочно»</Button>
          <Button type="link" onClick={() => setSelected([])}>Снять выбор</Button>
        </Space>
      )}

      <Table<Dish>
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={rows}
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as string[]), preserveSelectedRowKeys: true }}
        pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Ничего не найдено" /> }}
        scroll={{ x: 1050 }}
      />
    </div>
  )
}
