import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, DatePicker, Row, Segmented, Space, Spin, Statistic, Typography } from 'antd'
import { EditOutlined, LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import type { HallResponse } from './types'
import { STATUS, dateCaption, duration, money, rememberZoneNames, zoneLabel } from './format'
import FloorPlan from './FloorPlan'
import TableDrawer from './TableDrawer'

const { Title } = Typography

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

export default function HallPage() {
  const [params, setParams] = useSearchParams()
  const [hall, setHall] = useState<HallResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zone, setZone] = useState<string | null>(null)
  const [openTable, setOpenTable] = useState<string | null>(null)
  const navigate = useNavigate()
  const date = params.get('date') || ''
  const reqId = useRef(0)

  const call = adminFetch

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const h = await call<HallResponse>('/api/admin/hall', { query: { date } })
      if (id !== reqId.current) return
      rememberZoneNames(h.zoneNames)
      setHall(h)
      setError('')
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [call, date])

  useEffect(() => { load() }, [load])

  // ?table=<id> — пришли из другого раздела (жалобы): открыть историю стола.
  const tableParam = params.get('table')
  useEffect(() => {
    if (!tableParam || !hall) return
    const t = hall.tables.find((x) => x.id === tableParam)
    if (t) { setZone(t.zone); setOpenTable(t.id) }
    const next = new URLSearchParams(params)
    next.delete('table')
    setParams(next, { replace: true })
  }, [tableParam, hall, params, setParams])

  // Сегодня — обновляем каждые 30 секунд.
  useEffect(() => {
    if (hall?.mode !== 'today') return
    const t = window.setInterval(load, 30_000)
    return () => window.clearInterval(t)
  }, [hall?.mode, load])

  // Залы — в порядке из «Ресторан → Столы»; пустые (без столов) не показываем.
  const zones = useMemo(() => {
    const withTables = new Set((hall?.tables || []).map((t) => t.zone))
    const z = (hall?.zones || []).filter((k) => withTables.has(k))
    return z.length ? z : ['main']
  }, [hall])
  const currentZone = zone && zones.includes(zone) ? zone : zones[0]
  const zoneTables = useMemo(() => (hall?.tables || []).filter((t) => t.zone === currentZone), [hall, currentZone])

  const goDate = (d: string | null) => {
    const next = new URLSearchParams(params)
    if (d && d !== hall?.today) next.set('date', d)
    else next.delete('date')
    setParams(next)
    setOpenTable(null)
  }
  const shift = (n: number) => goDate(dayjs(hall?.date || undefined).add(n, 'day').format('YYYY-MM-DD'))

  if (!hall) {
    return error ? <Alert type="error" showIcon title="Не удалось загрузить зал" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />
  }

  const s = hall.summary
  const unassigned = hall.mode !== 'past' ? hall.tables.filter((t) => t.assigned.length === 0) : []
  const bookings = hall.tables.flatMap((t) => t.reservations).filter((r) => r.status !== 'cancelled')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Зал · {hall.restaurant.name}</Title>
        <Space wrap>
          <Button icon={<LeftOutlined />} onClick={() => shift(-1)} aria-label="Предыдущий день" />
          <DatePicker
            value={dayjs(hall.date)}
            onChange={(d) => d && goDate(d.format('YYYY-MM-DD'))}
            allowClear={false}
           
            format={() => dateCaption(hall.date, hall.today)}
            style={{ width: 220 }}
          />
          <Button icon={<RightOutlined />} onClick={() => shift(1)} aria-label="Следующий день" />
          <Button onClick={() => goDate(null)} disabled={hall.date === hall.today}>Сегодня</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} aria-label="Обновить" />
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

      {unassigned.length > 0 && (
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
          ? <Segmented value={currentZone} onChange={(v) => setZone(String(v))} options={zones.map((z) => ({ value: z, label: zoneLabel(z) }))} />
          : zoneLabel(currentZone)}
        extra={<Button icon={<EditOutlined />} onClick={() => navigate(`/restaurant/tables?zone=${currentZone}`)}>Изменить схему</Button>}
      >
        <FloorPlan
          tables={zoneTables}
          mode={hall.mode}
          tz={hall.restaurant.timezone}
          editing={false}
          draft={new Map()}
          selectedId={null}
          onSelect={setOpenTable}
          onMove={() => {}}
        />
        <Legend mode={hall.mode} />
      </Card>

      <TableDrawer
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
