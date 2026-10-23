import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, DatePicker, Form, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Spin,
  Statistic, Typography, message,
} from 'antd'
import {
  EditOutlined, LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined, RotateLeftOutlined, RotateRightOutlined, SaveOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AccessGate from '../../components/AccessGate'
import { adminFetch, ApiError, type Access } from '../../lib/adminApi'
import type { HallResponse, Layout, Shape } from './types'
import { STATUS, ZONE_LABELS, dateCaption, duration, money, zoneLabel } from './format'
import FloorPlan, { defaultSize, effectiveLayouts } from './FloorPlan'
import TableDrawer from './TableDrawer'

const { Title, Text } = Typography

const SHAPES: { value: Shape; label: string }[] = [
  { value: 'round', label: 'Круг' },
  { value: 'square', label: 'Квадрат' },
  { value: 'rect', label: 'Прямоуг.' },
]

function Legend({ mode }: { mode: HallResponse['mode'] }) {
  const chip = (bg: string, border: string, label: string, extra: React.CSSProperties = {}) => (
    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 16, fontSize: 12, color: '#5c6070' }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `2px solid ${border}`, ...extra }} />
      {label}
    </span>
  )
  return (
    <div style={{ marginTop: 28 }}>
      {mode === 'today' && <>
        {chip('#f4f5f7', '#c5c8d0', 'Свободен')}
        {['occupied', 'preparing', 'resting', 'bill_requested'].map((k) => chip(STATUS[k].color, STATUS[k].color, STATUS[k].label))}
        {chip('#f4f5f7', '#d30000', 'Вызов официанта')}
        {chip('#f4f5f7', '#fa8c16', 'Бронь в ближайшие 2 часа')}
      </>}
      {mode === 'past' && <>
        {chip('#f4f5f7', '#c5c8d0', 'Не занимали')}
        {chip('rgba(61,106,250,0.35)', '#3d6afa', 'Мало посадок')}
        {chip('rgba(61,106,250,0.85)', '#3d6afa', 'Много посадок')}
      </>}
      {mode === 'future' && chip('#fff7e6', '#fa8c16', 'Есть бронь')}
      {mode !== 'past' && chip('#fff', '#fff', 'Нет официанта', { outline: '2px dashed #ff4d4f' })}
    </div>
  )
}

function HallInner({ access, deny }: { access: Access; deny: () => void }) {
  const [params, setParams] = useSearchParams()
  const [hall, setHall] = useState<HallResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zone, setZone] = useState<string | null>(null)
  const [openTable, setOpenTable] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Map<string, Layout>>(new Map())
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addForm] = Form.useForm()
  const [propsForm] = Form.useForm()
  const date = params.get('date') || ''
  const reqId = useRef(0)

  const call = useCallback(async <T,>(path: string, opts?: Parameters<typeof adminFetch>[2]) => {
    try {
      return await adminFetch<T>(access, path, opts)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) deny()
      throw e
    }
  }, [access, deny])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const h = await call<HallResponse>('/api/admin/hall', { query: { date } })
      if (id !== reqId.current) return
      setHall(h)
      setError('')
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [call, date])

  useEffect(() => { load() }, [load])

  // Сегодня — обновляем каждые 30 секунд (кроме режима редактирования).
  useEffect(() => {
    if (hall?.mode !== 'today' || editing) return
    const t = window.setInterval(load, 30_000)
    return () => window.clearInterval(t)
  }, [hall?.mode, editing, load])

  const zones = useMemo(() => {
    const z = hall?.zones.length ? hall.zones : ['main']
    return [...z].sort((a, b) => Object.keys(ZONE_LABELS).indexOf(a) - Object.keys(ZONE_LABELS).indexOf(b))
  }, [hall])
  const currentZone = zone && zones.includes(zone) ? zone : zones[0]
  const zoneTables = useMemo(() => (hall?.tables || []).filter((t) => t.zone === currentZone), [hall, currentZone])
  const selectedTable = hall?.tables.find((t) => t.id === selected) || null

  useEffect(() => {
    if (selectedTable) propsForm.setFieldsValue({ number: selectedTable.number, capacity: selectedTable.capacity, zone: selectedTable.zone })
  }, [selectedTable, propsForm])

  const goDate = (d: string | null) => {
    const next = new URLSearchParams(params)
    if (d && d !== hall?.today) next.set('date', d)
    else next.delete('date')
    setParams(next)
    setOpenTable(null)
  }
  const shift = (n: number) => goDate(dayjs(hall?.date || undefined).add(n, 'day').format('YYYY-MM-DD'))

  const startEdit = () => { setDraft(new Map()); setSelected(null); setEditing(true); setOpenTable(null) }
  const cancelEdit = () => { setDraft(new Map()); setSelected(null); setEditing(false) }

  const saveLayout = async () => {
    const layouts = effectiveLayouts(zoneTables, draft)
    setSaving(true)
    try {
      await call('/api/admin/tables', { method: 'PATCH', body: { layout: [...layouts.entries()].map(([id, l]) => ({ id, ...l })) } })
      message.success('Схема зала сохранена')
      setEditing(false)
      setDraft(new Map())
      setSelected(null)
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const patchSelected = (patch: Partial<Layout>) => {
    if (!selectedTable) return
    const cur = effectiveLayouts(zoneTables, draft).get(selectedTable.id)!
    let next = { ...cur, ...patch }
    if (patch.shape && patch.shape !== cur.shape) next = { ...next, ...defaultSize(patch.shape) }
    setDraft(new Map(draft).set(selectedTable.id, next))
  }

  const saveProps = async () => {
    if (!selectedTable) return
    const v = await propsForm.validateFields()
    try {
      await call('/api/admin/tables', { method: 'PATCH', body: { id: selectedTable.id, number: v.number, capacity: v.capacity, zone: v.zone } })
      message.success('Стол обновлён')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const removeSelected = async () => {
    if (!selectedTable) return
    try {
      await call('/api/admin/tables', { method: 'PATCH', body: { id: selectedTable.id, isActive: false } })
      message.success(`Стол ${selectedTable.number} убран со схемы`)
      setSelected(null)
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const addTable = async () => {
    const v = await addForm.validateFields()
    try {
      await call('/api/admin/tables', { method: 'POST', body: { number: v.number, capacity: v.capacity, zone: v.zone } })
      message.success(`Стол ${v.number} добавлен — расставьте его на схеме`)
      setAdding(false)
      addForm.resetFields()
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  if (!hall) {
    return error ? <Alert type="error" showIcon title="Не удалось загрузить зал" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />
  }

  const s = hall.summary
  const unassigned = hall.mode !== 'past' ? hall.tables.filter((t) => t.assigned.length === 0) : []
  const bookings = hall.tables.flatMap((t) => t.reservations).filter((r) => r.status !== 'cancelled')
  const zoneOptions = [...new Set([...Object.keys(ZONE_LABELS), ...hall.zones])].map((z) => ({ value: z, label: zoneLabel(z) }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Зал · {hall.restaurant.name}</Title>
        <Space wrap>
          <Button icon={<LeftOutlined />} onClick={() => shift(-1)} disabled={editing} aria-label="Предыдущий день" />
          <DatePicker
            value={dayjs(hall.date)}
            onChange={(d) => d && goDate(d.format('YYYY-MM-DD'))}
            allowClear={false}
            disabled={editing}
            format={() => dateCaption(hall.date, hall.today)}
            style={{ width: 220 }}
          />
          <Button icon={<RightOutlined />} onClick={() => shift(1)} disabled={editing} aria-label="Следующий день" />
          <Button onClick={() => goDate(null)} disabled={editing || hall.date === hall.today}>Сегодня</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} disabled={editing} aria-label="Обновить" />
        </Space>
      </div>

      {s ? (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title="Посадок" value={s.sessions} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="Гостей" value={s.guests} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="Выручка" value={money(s.revenue)} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="Средний чек стола" value={money(s.avgCheck)} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="Посадок на стол" value={s.turnsPerTable} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="Средняя посадка" value={s.avgDurationMin ? duration(s.avgDurationMin) : '—'} /></Card></Col>
        </Row>
      ) : (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Броней" value={bookings.length} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Гостей по броням" value={bookings.reduce((n, r) => n + r.guestCount, 0)} /></Card></Col>
        </Row>
      )}

      {unassigned.length > 0 && !editing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`Без официанта: ${unassigned.map((t) => `№ ${t.number}`).join(', ')}`}
          description="Нажмите на стол, чтобы закрепить официанта."
        />
      )}

      <Card
        size="small"
        title={zones.length > 1
          ? <Segmented value={currentZone} onChange={(v) => { setZone(String(v)); setSelected(null) }} options={zones.map((z) => ({ value: z, label: zoneLabel(z) }))} />
          : zoneLabel(currentZone)}
        extra={editing ? (
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={() => {
              addForm.setFieldsValue({ number: Math.max(0, ...hall.tables.map((t) => t.number)) + 1, capacity: 4, zone: currentZone })
              setAdding(true)
            }}>Стол</Button>
            <Button onClick={cancelEdit}>Отмена</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveLayout}>Сохранить схему</Button>
          </Space>
        ) : (
          <Button icon={<EditOutlined />} onClick={startEdit}>Редактировать схему</Button>
        )}
      >
        <Row gutter={16}>
          <Col xs={24} lg={editing ? 18 : 24}>
            {editing && <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Перетаскивайте столы мышкой; синий уголок выбранного стола меняет размер. Расстановка сохранится по кнопке «Сохранить схему».
            </Text>}
            <FloorPlan
              tables={zoneTables}
              mode={hall.mode}
              tz={hall.restaurant.timezone}
              editing={editing}
              draft={draft}
              selectedId={editing ? selected : null}
              onSelect={(id) => (editing ? setSelected(id) : setOpenTable(id))}
              onMove={(id, l) => setDraft((d) => new Map(d).set(id, l))}
            />
            {!editing && <Legend mode={hall.mode} />}
          </Col>
          {editing && (
            <Col xs={24} lg={6}>
              {!selectedTable ? <Text type="secondary">Выберите стол на схеме</Text> : (
                <div>
                  <Title level={5}>Стол {selectedTable.number}</Title>
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary">Форма</Text>
                    <Segmented
                      block
                      size="small"
                      value={effectiveLayouts(zoneTables, draft).get(selectedTable.id)?.shape}
                      onChange={(v) => patchSelected({ shape: v as Shape })}
                      options={SHAPES}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">Поворот </Text>
                    <Space>
                      <Button size="small" icon={<RotateLeftOutlined />} onClick={() => patchSelected({ rotation: ((effectiveLayouts(zoneTables, draft).get(selectedTable.id)?.rotation || 0) - 15) })} />
                      <Button size="small" icon={<RotateRightOutlined />} onClick={() => patchSelected({ rotation: ((effectiveLayouts(zoneTables, draft).get(selectedTable.id)?.rotation || 0) + 15) })} />
                    </Space>
                  </div>
                  <Form form={propsForm} layout="vertical" size="small">
                    <Form.Item label="Номер" name="number" rules={[{ required: true }]}><InputNumber min={1} max={9999} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item label="Мест" name="capacity" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
                    <Form.Item label="Зона" name="zone" rules={[{ required: true }]}><Select options={zoneOptions} /></Form.Item>
                    <Space wrap>
                      <Button size="small" onClick={saveProps}>Применить</Button>
                      <Popconfirm title={`Убрать стол ${selectedTable.number} со схемы?`} description="История стола сохранится." okText="Убрать" cancelText="Нет" onConfirm={removeSelected}>
                        <Button size="small" danger>Убрать стол</Button>
                      </Popconfirm>
                    </Space>
                  </Form>
                </div>
              )}
            </Col>
          )}
        </Row>
      </Card>

      <Modal open={adding} title="Новый стол" okText="Добавить" cancelText="Отмена" onOk={addTable} onCancel={() => setAdding(false)}>
        <Form form={addForm} layout="vertical">
          <Form.Item label="Номер" name="number" rules={[{ required: true, message: 'Укажите номер' }]}><InputNumber min={1} max={9999} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Мест" name="capacity" rules={[{ required: true, message: 'Сколько мест' }]}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Зона" name="zone" rules={[{ required: true, message: 'Выберите зону' }]}>
            <Select options={zoneOptions} showSearch />
          </Form.Item>
        </Form>
      </Modal>

      <TableDrawer
        access={access}
        deny={deny}
        tableId={openTable}
        date={hall.date}
        dayRange={hall.day}
        waiters={hall.waiters}
        onClose={() => setOpenTable(null)}
        onChanged={load}
      />
    </div>
  )
}

export default function HallPage() {
  return (
    <AccessGate title="Зал">
      {(access, deny) => <HallInner access={access} deny={deny} />}
    </AccessGate>
  )
}
