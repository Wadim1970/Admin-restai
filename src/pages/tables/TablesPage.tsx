import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Spin, Statistic, Tabs,
  Tooltip, Typography, message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, RotateLeftOutlined, RotateRightOutlined } from '@ant-design/icons'
import { adminFetch } from '../../lib/adminApi'
import type { Layout, Shape } from '../hall/types'
import { plural, rememberZoneNames } from '../hall/format'
import { PLAN_RATIO, defaultShape, defaultSize, effectiveLayouts } from '../hall/planGeometry'
import Chairs from '../hall/Chairs'

const { Title, Text } = Typography

interface Zone { id: string | null; key: string; name: string; order: number }
interface PlanTable { id: string; number: number; zone: string; capacity: number; layout: Layout | null }
interface TablesResponse { restaurant: { id: string; name: string }; zones: Zone[]; zonesEditable: boolean; tables: PlanTable[] }
type Full = ReturnType<typeof effectiveLayouts> extends Map<string, infer L> ? L : never

const SHAPES: { value: Shape; label: string }[] = [
  { value: 'round', label: 'Круглый' },
  { value: 'square', label: 'Квадратный' },
  { value: 'rect', label: 'Прямоугольный' },
]

// Для узкой панели стола.
const SHAPES_SHORT: { value: Shape; label: string }[] = [
  { value: 'round', label: 'Круг' },
  { value: 'square', label: 'Квадрат' },
  { value: 'rect', label: 'Прямоуг.' },
]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// Поворот — в пределах −180…180°.
const turn = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180
const snap = (v: number) => Math.round(v * 2) / 2

// Размер стола по числу мест: на 2 — маленький, на 8 — длинный.
function sizeFor(shape: Shape, capacity: number) {
  const base = defaultSize(shape)
  if (shape === 'rect') return { w: clamp(6 + capacity * 1.6, 10, 30), h: base.h }
  const k = capacity <= 2 ? 1 : capacity <= 4 ? 1.1 : 1.3
  return { w: snap(base.w * k), h: snap(base.h * k) }
}

// Свободное место в зале для нового стола: сетка с шагом, первая клетка,
// которая ни с кем не пересекается.
function freeSpot(taken: Full[], w: number, h: number) {
  for (let y = 6; y + h <= 96; y += 4) {
    for (let x = 4; x + w <= 96; x += 3) {
      const hit = taken.some((l) => x < l.x + l.w + 3 && x + w + 3 > l.x && y < l.y + l.h + 6 && y + h + 6 > l.y)
      if (!hit) return { x, y }
    }
  }
  return { x: 4, y: 6 }
}

// Редактор схемы одного зала: перетащить стол, потянуть уголок — размер.
function PlanEditor({ tables, layouts, selectedId, onSelect, onDrag, onDrop }: {
  tables: PlanTable[]
  layouts: Map<string, Full>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDrag: (id: string, l: Full) => void
  onDrop: (id: string, l: Full) => void
}) {
  const planRef = useRef<HTMLDivElement>(null)

  const start = (e: React.PointerEvent, id: string, kind: 'move' | 'resize') => {
    if (!planRef.current) return
    e.preventDefault()
    e.stopPropagation()
    onSelect(id)
    const rect = planRef.current.getBoundingClientRect()
    const from = layouts.get(id)!
    const sx = e.clientX
    const sy = e.clientY
    let last = from
    const keepRatio = from.shape !== 'rect'
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100
      const dy = ((ev.clientY - sy) / rect.height) * 100
      if (kind === 'move') {
        last = { ...from, x: snap(clamp(from.x + dx, 0, 100 - from.w)), y: snap(clamp(from.y + dy, 0, 100 - from.h)) }
      } else {
        const w = snap(clamp(from.w + dx, 3, 45))
        const h = keepRatio ? snap(w * PLAN_RATIO) : snap(clamp(from.h + dy, 3, 70))
        last = { ...from, w: Math.min(w, 100 - from.x), h: Math.min(h, 100 - from.y) }
      }
      onDrag(id, last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (last !== from) onDrop(id, last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="hall-plan-scroll">
      <div ref={planRef} className="hall-plan hall-plan--editing" style={{ aspectRatio: `${PLAN_RATIO}` }} onPointerDown={() => onSelect(null)}>
        {tables.map((t) => {
          const l = layouts.get(t.id)!
          const selected = selectedId === t.id
          return (
            <div
              key={t.id}
              className="hall-table"
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }}
              onPointerDown={(e) => start(e, t.id, 'move')}
              data-testid={`plan-table-${t.number}`}
            >
              <div className="hall-table__chairs" style={{ transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined }}>
                <Chairs shape={l.shape} capacity={t.capacity} w={l.w} h={l.h} />
                <div
                  className="hall-table__shape"
                  style={{
                    background: selected ? '#e6f0ff' : '#fff', borderColor: selected ? '#1677ff' : '#9aa0ab',
                    borderRadius: l.shape === 'round' ? '50%' : 8,
                  }}
                />
              </div>
              <div className="hall-table__text" style={{ color: '#2b2f38' }}>
                <div className="hall-table__number">{t.number}</div>
                <div className="hall-table__line">{t.capacity} {plural(t.capacity, 'место', 'места', 'мест')}</div>
              </div>
              {selected && <div className="hall-table__resize" onPointerDown={(e) => start(e, t.id, 'resize')} title="Потяните, чтобы изменить размер" />}
            </div>
          )
        })}
        {tables.length === 0 && <div className="hall-plan__empty">В этом зале пока нет столов — нажмите «Добавить стол»</div>}
      </div>
    </div>
  )
}

// Ресторан → Столы: залы (свои названия: Основной, Веранда, ВИП…) и
// расстановка столов в каждом — форма, размер, число мест, поворот.
export default function TablesPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<TablesResponse | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Map<string, Full>>(new Map())
  const [selected, setSelected] = useState<string | null>(null)
  const [zoneDialog, setZoneDialog] = useState<{ mode: 'add' } | { mode: 'rename'; zone: Zone } | null>(null)
  const [adding, setAdding] = useState(false)
  const [zoneForm] = Form.useForm()
  const [addForm] = Form.useForm()
  const [propsForm] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const d = await adminFetch<TablesResponse>('/api/admin/tables')
      rememberZoneNames(Object.fromEntries(d.zones.map((z) => [z.key, z.name])))
      setData(d)
      setDraft(new Map())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const zones = data?.zones || []
  const zoneKey = zones.some((z) => z.key === params.get('zone')) ? params.get('zone')! : zones[0]?.key
  const zone = zones.find((z) => z.key === zoneKey) || null
  const setZone = (key: string) => { const n = new URLSearchParams(params); n.set('zone', key); setParams(n, { replace: true }); setSelected(null) }

  const zoneTables = useMemo(() => (data?.tables || []).filter((t) => t.zone === zoneKey), [data, zoneKey])
  const layouts = useMemo(() => effectiveLayouts(zoneTables, draft as Map<string, Layout>) as Map<string, Full>, [zoneTables, draft])
  const selectedTable = zoneTables.find((t) => t.id === selected) || null

  useEffect(() => {
    if (selectedTable) propsForm.setFieldsValue({ number: selectedTable.number, capacity: selectedTable.capacity, zone: selectedTable.zone })
  }, [selectedTable, propsForm])

  const fail = (e: unknown) => message.error(e instanceof Error ? e.message : String(e))

  // Расстановка сохраняется сразу, как отпустили стол.
  const saveLayout = async (id: string, l: Full) => {
    setDraft((d) => new Map(d).set(id, l))
    try {
      await adminFetch('/api/admin/tables', { method: 'PATCH', body: { layout: [{ id, ...l }] } })
      setData((d) => d && { ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, layout: l } : t)) })
    } catch (e) {
      fail(e)
      setDraft((d) => { const n = new Map(d); n.delete(id); return n })
    }
  }

  const patchLayout = (patch: Partial<Full>) => {
    if (!selectedTable) return
    const cur = layouts.get(selectedTable.id)!
    let next = { ...cur, ...patch }
    if (patch.shape && patch.shape !== cur.shape) next = { ...next, ...sizeFor(patch.shape, selectedTable.capacity) }
    next.w = Math.min(next.w, 100 - next.x)
    next.h = Math.min(next.h, 100 - next.y)
    saveLayout(selectedTable.id, next)
  }

  const saveProps = async () => {
    if (!selectedTable) return
    const v = await propsForm.validateFields()
    try {
      await adminFetch('/api/admin/tables', { method: 'PATCH', body: { id: selectedTable.id, number: v.number, capacity: v.capacity, zone: v.zone } })
      message.success(v.zone !== selectedTable.zone ? 'Стол перенесён в другой зал' : 'Стол сохранён')
      if (v.zone !== selectedTable.zone) setSelected(null)
      await load()
    } catch (e) { fail(e) }
  }

  const removeTable = async () => {
    if (!selectedTable) return
    try {
      await adminFetch('/api/admin/tables', { method: 'PATCH', body: { id: selectedTable.id, isActive: false } })
      message.success(`Стол ${selectedTable.number} убран со схемы`)
      setSelected(null)
      await load()
    } catch (e) { fail(e) }
  }

  const openAdd = () => {
    addForm.resetFields()
    addForm.setFieldsValue({ number: Math.max(0, ...(data?.tables || []).map((t) => t.number)) + 1, capacity: 4, shape: 'square' })
    setAdding(true)
  }

  const addTable = async () => {
    const v = await addForm.validateFields()
    const size = sizeFor(v.shape, v.capacity)
    const spot = freeSpot([...layouts.values()], size.w, size.h)
    try {
      const r = await adminFetch<{ id: string; restored?: boolean }>('/api/admin/tables', {
        method: 'POST', body: { number: v.number, capacity: v.capacity, zone: zoneKey, layout: { ...spot, ...size, shape: v.shape, rotation: 0 } },
      })
      message.success(r.restored ? `Стол ${v.number} возвращён на схему` : `Стол ${v.number} добавлен — перетащите его на место`)
      setAdding(false)
      await load()
      setSelected(r.id)
    } catch (e) { fail(e) }
  }

  const submitZone = async () => {
    const v = await zoneForm.validateFields()
    try {
      if (zoneDialog?.mode === 'add') {
        const z = await adminFetch<{ key: string }>('/api/admin/zones', { method: 'POST', body: { name: v.name } })
        message.success(`Зал «${v.name.trim()}» добавлен`)
        setZoneDialog(null)
        await load()
        setZone(z.key)
      } else if (zoneDialog?.mode === 'rename') {
        await adminFetch('/api/admin/zones', { method: 'PATCH', body: { id: zoneDialog.zone.id, name: v.name } })
        message.success('Зал переименован')
        setZoneDialog(null)
        await load()
      }
    } catch (e) { fail(e) }
  }

  const removeZone = async (z: Zone) => {
    try {
      await adminFetch('/api/admin/zones', { method: 'DELETE', query: { id: z.id! } })
      message.success(`Зал «${z.name}» удалён`)
      await load()
    } catch (e) { fail(e) }
  }

  const moveZone = async (z: Zone, dir: -1 | 1) => {
    const ids = zones.filter((x) => x.id).map((x) => x.id!)
    const i = ids.indexOf(z.id!)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try {
      await adminFetch('/api/admin/zones', { method: 'PATCH', body: { order: ids } })
      await load()
    } catch (e) { fail(e) }
  }

  if (!data) return error ? <Alert type="error" showIcon title="Не удалось загрузить столы" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />

  const seats = data.tables.reduce((n, t) => n + t.capacity, 0)
  const zoneSeats = zoneTables.reduce((n, t) => n + t.capacity, 0)
  const sel = selectedTable ? layouts.get(selectedTable.id)! : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Столы · {data.restaurant.name}</Title>
        <Space wrap>
          {data.zonesEditable && <Button icon={<PlusOutlined />} onClick={() => { zoneForm.resetFields(); setZoneDialog({ mode: 'add' }) }}>Зал</Button>}
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={!zone}>Добавить стол</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Залов" value={zones.length} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Столов" value={data.tables.length} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Мест" value={seats} /></Card></Col>
      </Row>

      {!data.zonesEditable && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          title="Свои залы появятся после обновления базы"
          description="Пока доступны залы «Основной», «Веранда» и «Банкетный». Чтобы добавлять, переименовывать и удалять залы, нужно применить миграцию 20261031010000_zones_staff.sql на сервере базы."
        />
      )}

      <Card size="small" styles={{ body: { paddingTop: 0 } }}>
        <Tabs
          activeKey={zoneKey}
          onChange={setZone}
          items={zones.map((z) => ({ key: z.key, label: `${z.name} · ${data.tables.filter((t) => t.zone === z.key).length}` }))}
          tabBarExtraContent={zone && data.zonesEditable && zone.id ? (
            <Space size={0}>
              <Tooltip title="Левее"><Button type="text" size="small" onClick={() => moveZone(zone, -1)} disabled={zones[0]?.key === zone.key}>←</Button></Tooltip>
              <Tooltip title="Правее"><Button type="text" size="small" onClick={() => moveZone(zone, 1)} disabled={zones[zones.length - 1]?.key === zone.key}>→</Button></Tooltip>
              <Tooltip title="Переименовать зал">
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { zoneForm.setFieldsValue({ name: zone.name }); setZoneDialog({ mode: 'rename', zone }) }} />
              </Tooltip>
              {zoneTables.length > 0 ? (
                <Tooltip title="В зале есть столы — перенесите их в другой зал или уберите со схемы"><Button type="text" size="small" icon={<DeleteOutlined />} disabled /></Tooltip>
              ) : (
                <Popconfirm title={`Удалить зал «${zone.name}»?`} okText="Удалить" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => removeZone(zone)} disabled={zones.length <= 1}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={zones.length <= 1} />
                </Popconfirm>
              )}
            </Space>
          ) : null}
        />
        {zone && <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {zoneTables.length} {plural(zoneTables.length, 'стол', 'стола', 'столов')}, {zoneSeats} {plural(zoneSeats, 'место', 'места', 'мест')}.
          {' '}Перетаскивайте столы мышью или пальцем, синий уголок выбранного стола меняет размер — всё сохраняется сразу.
        </Text>}
        <Row gutter={16}>
          <Col xs={24} lg={18}>
            <PlanEditor
              tables={zoneTables}
              layouts={layouts}
              selectedId={selected}
              onSelect={setSelected}
              onDrag={(id, l) => setDraft((d) => new Map(d).set(id, l))}
              onDrop={saveLayout}
            />
          </Col>
          <Col xs={24} lg={6}>
            {!selectedTable || !sel ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нажмите на стол, чтобы изменить его" style={{ marginTop: 32 }} />
            ) : (
              <div style={{ marginTop: 8 }}>
                <Title level={5} style={{ marginTop: 0 }}>Стол {selectedTable.number}</Title>
                <Text type="secondary">Форма</Text>
                <Segmented block size="small" value={sel.shape} onChange={(v) => patchLayout({ shape: v as Shape })} options={SHAPES_SHORT} style={{ marginBottom: 12 }} />
                <Text type="secondary">Поворот </Text>
                <Space style={{ marginBottom: 16 }}>
                  <Button size="small" icon={<RotateLeftOutlined />} onClick={() => patchLayout({ rotation: turn(sel.rotation - 15) })} />
                  <Button size="small" icon={<RotateRightOutlined />} onClick={() => patchLayout({ rotation: turn(sel.rotation + 15) })} />
                  <Button size="small" onClick={() => patchLayout({ rotation: Math.abs(sel.rotation) === 90 ? 0 : 90 })}>90°</Button>
                </Space>
                <Form form={propsForm} layout="vertical" size="small">
                  <Form.Item label="Номер" name="number" rules={[{ required: true, message: 'Номер' }]}><InputNumber min={1} max={9999} style={{ width: '100%' }} /></Form.Item>
                  <Form.Item label="Мест" name="capacity" rules={[{ required: true, message: 'Сколько мест' }]}><InputNumber min={1} max={40} style={{ width: '100%' }} /></Form.Item>
                  <Form.Item label="Зал" name="zone" rules={[{ required: true }]}>
                    <Select options={zones.map((z) => ({ value: z.key, label: z.name }))} />
                  </Form.Item>
                  <Space wrap>
                    <Button type="primary" size="small" onClick={saveProps}>Сохранить</Button>
                    <Popconfirm
                      title={`Убрать стол ${selectedTable.number} со схемы?`}
                      description="История стола сохранится; добавите стол с тем же номером — он вернётся."
                      okText="Убрать" cancelText="Нет" onConfirm={removeTable}
                    >
                      <Button size="small" danger>Убрать</Button>
                    </Popconfirm>
                  </Space>
                </Form>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      <Modal open={adding} title={`Новый стол${zone ? ` · ${zone.name}` : ''}`} okText="Добавить" cancelText="Отмена" onOk={addTable} onCancel={() => setAdding(false)}>
        <Form form={addForm} layout="vertical" onValuesChange={(ch) => { if ('capacity' in ch && ch.capacity) addForm.setFieldValue('shape', defaultShape(ch.capacity)) }}>
          <Row gutter={12}>
            <Col span={12}><Form.Item label="Номер" name="number" rules={[{ required: true, message: 'Номер' }]}><InputNumber min={1} max={9999} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="Мест" name="capacity" rules={[{ required: true, message: 'Сколько мест' }]}><InputNumber min={1} max={40} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item label="Форма" name="shape"><Segmented block options={SHAPES} /></Form.Item>
          <Text type="secondary">Стол появится на свободном месте — потом перетащите его куда нужно.</Text>
        </Form>
      </Modal>

      <Modal
        open={!!zoneDialog}
        title={zoneDialog?.mode === 'add' ? 'Новый зал' : 'Переименовать зал'}
        okText={zoneDialog?.mode === 'add' ? 'Добавить' : 'Сохранить'}
        cancelText="Отмена"
        onOk={submitZone}
        onCancel={() => setZoneDialog(null)}
      >
        <Form form={zoneForm} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}>
            <Input maxLength={60} placeholder="ВИП зал" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
