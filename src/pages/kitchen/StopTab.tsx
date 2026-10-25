import { useMemo, useState } from 'react'
import { Alert, Button, Dropdown, Empty, Input, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons'
import type { Dish } from './types'
import DishFilters, { applyFilters, type Filters } from './DishFilters'
import { dateIn, money, timeIn } from '../hall/format'

const { Text, Paragraph } = Typography

// Срок стопа по часам ресторана: «до отмены», «до конца дня» или «до <дата, время>».
export function stopLabel(d: Dish, dayEnd: string, tz: string) {
  if (!d.stopUntil) return ''
  if (d.stopUntil === 'forever') return 'до отмены'
  if (d.stopUntil === dayEnd) return 'до конца дня'
  return `до ${dateIn(d.stopUntil, tz)}, ${timeIn(d.stopUntil, tz)}`
}

type Act = (action: string, ids: string[], extra?: Record<string, unknown>) => Promise<void>

// Стоп-лист: найти блюдо → «В стоп» (до конца дня или до отмены); сверху —
// что сейчас в стопе, с быстрым возвратом. Массовые действия — галочками.
export default function StopTab({ dishes, sections, act, dayEnd, tz }: { dishes: Dish[]; sections: string[]; act: Act; dayEnd: string; tz: string }) {
  const label = (d: Dish) => stopLabel(d, dayEnd, tz)
  const [filters, setFilters] = useState<Filters>({ q: '', section: null, onlyMarked: false })
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const stopped = useMemo(() => dishes.filter((d) => d.stopUntil), [dishes])
  const rows = useMemo(() => applyFilters(dishes, filters, (d) => !!d.stopUntil), [dishes, filters])
  const byKey = useMemo(() => new Map(dishes.map((d) => [d.key, d])), [dishes])
  const idsOf = (keys: string[]) => keys.flatMap((k) => byKey.get(k)?.ids || [])

  const stopMenu = (keys: string[]) => ({
    items: [
      { key: 'day', label: 'До конца дня' },
      { key: 'forever', label: 'До отмены' },
    ],
    onClick: async ({ key }: { key: string }) => {
      await act('stop', idsOf(keys), { until: key, note: note.trim() || undefined })
      setSelected([])
      setNote('')
    },
  })

  const columns: ColumnsType<Dish> = [
    {
      title: 'Блюдо', dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name, 'ru'),
      render: (name: string, d) => (
        <div>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {d.hidden && <Tag style={{ marginLeft: 6 }}>скрыто от гостей</Tag>}
          <div><Text type="secondary" style={{ fontSize: 12 }}>{d.sections.join(', ')}</Text></div>
        </div>
      ),
    },
    { title: 'Цена', dataIndex: 'price', width: 100, align: 'right', render: money },
    { title: 'Продано за 30 дней', dataIndex: 'sold30', width: 150, align: 'right', sorter: (a, b) => a.sold30 - b.sold30 },
    {
      title: 'Статус', key: 'status', width: 230,
      render: (_, d) => (d.stopUntil
        ? <div><Tag color="red">В стопе {label(d)}</Tag>{d.stopNote && <div><Text type="secondary" style={{ fontSize: 12 }}>{d.stopNote}</Text></div>}</div>
        : <Tag color="green">В меню</Tag>),
    },
    {
      title: '', key: 'act', width: 150, align: 'right',
      render: (_, d) => (d.stopUntil
        ? <Button size="small" icon={<UndoOutlined />} onClick={() => act('unstop', d.ids)}>Вернуть</Button>
        : (
          <Dropdown menu={stopMenu([d.key])} trigger={['click']}>
            <Button size="small" danger icon={<StopOutlined />}>В стоп <DownOutlined /></Button>
          </Dropdown>
        )),
    },
  ]

  return (
    <div>
      <Paragraph type="secondary" style={{ maxWidth: 820 }}>
        Блюдо в стопе гость видит с пометкой «Нет в наличии» и заказать не может; официант видит «стоп»; голосовой помощник
        и подсказки его не предлагают. «До конца дня» — стоп сам снимется в 06:00, «до отмены» — пока не вернёте.
      </Paragraph>

      {stopped.length > 0 ? (
        <Alert
          type="error"
          showIcon
          icon={<StopOutlined />}
          style={{ marginBottom: 16 }}
          title={`Сейчас в стопе: ${stopped.length}`}
          description={(
            <Space size={[6, 6]} wrap>
              {stopped.map((d) => (
                <Tag key={d.key} closable color="red" onClose={(e) => { e.preventDefault(); act('unstop', d.ids) }}>
                  {d.name} · {label(d)}
                </Tag>
              ))}
              <Popconfirm title="Вернуть в меню все блюда из стопа?" okText="Вернуть" cancelText="Нет" onConfirm={() => act('unstop', stopped.flatMap((d) => d.ids))}>
                <Button size="small" type="link">Вернуть все</Button>
              </Popconfirm>
            </Space>
          )}
        />
      ) : (
        <Alert type="success" showIcon style={{ marginBottom: 16 }} title="Стоп-лист пуст — все блюда в наличии" />
      )}

      <DishFilters value={filters} onChange={setFilters} sections={sections} markedLabel="Только в стопе" />

      {selected.length > 0 && (
        <Space wrap style={{ marginBottom: 12, padding: '8px 12px', background: '#fff1f0', borderRadius: 8, width: '100%' }}>
          <Text strong>Выбрано: {selected.length}</Text>
          <Input placeholder="Причина (необязательно), например: закончилась свёкла" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 340 }} maxLength={200} />
          <Dropdown menu={stopMenu(selected)} trigger={['click']}>
            <Button danger type="primary" icon={<StopOutlined />}>В стоп <DownOutlined /></Button>
          </Dropdown>
          <Button icon={<UndoOutlined />} onClick={async () => { await act('unstop', idsOf(selected)); setSelected([]) }}>Вернуть в меню</Button>
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
        rowClassName={(d) => (d.stopUntil ? 'row-stopped' : '')}
        locale={{ emptyText: <Empty description="Ничего не найдено" /> }}
        scroll={{ x: 760 }}
      />
    </div>
  )
}
