import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, DatePicker, Dropdown, Empty, Modal, Row, Segmented, Space, Spin, Tag, Tooltip, Typography, message } from 'antd'
import { LeftOutlined, MoreOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { effectiveLayouts } from '../hall/FloorPlan'
import ReservationModal from '../hall/ReservationModal'
import { RES_STATUS, ZONE_LABELS, plural, timeIn, zoneLabel } from '../hall/format'
import type { Reservation } from '../hall/types'
import GuestMarks, { guestIcons } from './GuestMarks'
import GuestCardDrawer from './GuestCardDrawer'
import type { BookingReservation, BookingTable, BookingsResponse } from './types'

const { Title, Text } = Typography

const active = (r: Reservation) => r.status === 'confirmed' || r.status === 'seated'

// Полоса дней: сегодня … +30, у каждого — сколько броней и знакомых гостей.
function DayStrip({ data, onPick }: { data: BookingsResponse; onPick: (d: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('.booking-day--active')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [data.date])
  return (
    <div className="booking-strip" ref={ref}>
      {data.calendar.map((d) => {
        const day = dayjs(d.date)
        const weekend = day.day() === 0 || day.day() === 6
        return (
          <Tooltip key={d.date} title={d.reservations ? `${d.reservations} ${plural(d.reservations, 'бронь', 'брони', 'броней')}, гостей ${d.guests}${d.known ? `, знакомых ${d.known}` : ''}` : 'Броней нет'}>
            <button
              type="button"
              className={`booking-day${d.date === data.date ? ' booking-day--active' : ''}${weekend ? ' booking-day--weekend' : ''}`}
              onClick={() => onPick(d.date)}
            >
              <span className="booking-day__wd">{d.date === data.today ? 'сегодня' : day.format('dd')}</span>
              <span className="booking-day__num">{day.format('D')}</span>
              <span className="booking-day__count">{d.reservations ? d.reservations : '·'}{d.known ? <span className="booking-day__known">★{d.known}</span> : null}</span>
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

// Схема зала: столы с бронями выбранного дня — время и отметки гостей.
function BookingPlan({ tables, tz, selected, onSelect }: { tables: BookingTable[]; tz: string; selected: string | null; onSelect: (id: string) => void }) {
  const layouts = effectiveLayouts(tables, new Map())
  return (
    <div className="hall-plan-scroll">
      <div className="hall-plan" style={{ aspectRatio: '1.6' }}>
        {tables.map((t) => {
          const l = layouts.get(t.id)!
          const res = t.reservations.filter(active)
          const has = res.length > 0
          const known = res.some((r) => r.guest.known)
          const icons = [...new Map(res.flatMap((r) => guestIcons(r.guest)).map((i) => [i.key, i])).values()]
          const tip = has
            ? res.map((r) => `${timeIn(r.startsAt, tz)}–${timeIn(r.endsAt, tz)} · ${r.guestCount} чел.${r.guestName ? ` · ${r.guestName}` : ''}${guestIcons(r.guest).map((i) => ` ${i.icon}`).join('')}`).join('\n')
            : 'Свободен весь день — нажмите, чтобы забронировать'
          return (
            <div
              key={t.id}
              className="hall-table"
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }}
              onClick={() => onSelect(t.id)}
              data-testid={`btable-${t.number}`}
            >
              <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{`Стол ${t.number}, ${t.capacity} ${plural(t.capacity, 'место', 'места', 'мест')}\n${tip}`}</span>}>
                <div
                  className="hall-table__shape"
                  style={{
                    background: has ? (known ? '#fff1b8' : '#fff7e6') : '#f4f5f7',
                    borderColor: has ? (known ? '#d4b106' : '#fa8c16') : '#c5c8d0',
                    borderRadius: l.shape === 'round' ? '50%' : 10,
                    transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
                    outline: selected === t.id ? '3px solid #1677ff' : undefined,
                    outlineOffset: 3,
                  }}
                />
              </Tooltip>
              <div className="hall-table__text" style={{ color: has ? '#613400' : '#3a3d45' }}>
                <div className="hall-table__number">{t.number}</div>
                {has
                  ? <div className="hall-table__line">{res.slice(0, 2).map((r) => timeIn(r.startsAt, tz)).join(', ')}{res.length > 2 ? ` +${res.length - 2}` : ''}</div>
                  : <div className="hall-table__line">{t.capacity} {plural(t.capacity, 'место', 'места', 'мест')}</div>}
                {has && <div className="hall-table__line">{res[0].guestCount} чел.</div>}
              </div>
              {icons.length > 0 && <div className="booking-table__icons">{icons.map((i) => <span key={i.key}>{i.icon}</span>)}</div>}
            </div>
          )
        })}
        {tables.length === 0 && <div className="hall-plan__empty">В этой зоне пока нет столов</div>}
      </div>
    </div>
  )
}

export default function ReservationsPage() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || ''
  const [data, setData] = useState<BookingsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zone, setZone] = useState<string | null>(null)
  const [tableFilter, setTableFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ reservation: BookingReservation | null; tableId: string | null } | null>(null)
  const [guestPhone, setGuestPhone] = useState<string | null>(null)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const d = await adminFetch<BookingsResponse>('/api/admin/bookings', { query: { date } })
      if (id === reqId.current) { setData(d); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const goDate = (d: string) => {
    const next = new URLSearchParams(params)
    if (data && d === data.today) next.delete('date')
    else next.set('date', d)
    setParams(next)
    setTableFilter(null)
  }

  const tz = data?.restaurant.timezone || 'Europe/Moscow'
  const zones = useMemo(() => {
    const z = data?.zones.length ? data.zones : ['main']
    return [...z].sort((a, b) => Object.keys(ZONE_LABELS).indexOf(a) - Object.keys(ZONE_LABELS).indexOf(b))
  }, [data])
  const currentZone = zone && zones.includes(zone) ? zone : zones[0]
  const zoneTables = (data?.tables || []).filter((t) => t.zone === currentZone)
  const list = (data?.reservations || []).filter((r) => !tableFilter || r.tableId === tableFilter)
  const dayActive = (data?.reservations || []).filter(active)
  const filterTable = data?.tables.find((t) => t.id === tableFilter) || null

  const save = async (body: Record<string, unknown>) => {
    if (editing?.reservation) await adminFetch('/api/admin/reservations', { method: 'PATCH', body: { id: editing.reservation.id, ...body } })
    else await adminFetch('/api/admin/reservations', { method: 'POST', body })
    message.success('Бронь сохранена')
    setEditing(null)
    await load()
  }

  const setStatus = async (r: BookingReservation, status: Reservation['status']) => {
    try {
      await adminFetch('/api/admin/reservations', { method: 'PATCH', body: { id: r.id, status } })
      message.success(RES_STATUS[status]?.label || 'Сохранено')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (r: BookingReservation) => {
    try {
      await adminFetch('/api/admin/reservations', { method: 'DELETE', body: { id: r.id } })
      message.success('Бронь удалена')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const pickTable = (id: string) => {
    const t = data?.tables.find((x) => x.id === id)
    if (!t) return
    if (t.reservations.length === 0) setEditing({ reservation: null, tableId: id })
    else setTableFilter(tableFilter === id ? null : id)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Брони{data ? ` · ${data.restaurant.name}` : ''}</Title>
        {data && (
          <Space wrap>
            <Button icon={<LeftOutlined />} disabled={data.date <= data.today} onClick={() => goDate(dayjs(data.date).subtract(1, 'day').format('YYYY-MM-DD'))} />
            <DatePicker
              value={dayjs(data.date)}
              format="dd, D MMMM"
              allowClear={false}
              disabledDate={(d) => d.format('YYYY-MM-DD') < data.today || d.format('YYYY-MM-DD') > data.maxDate}
              onChange={(d) => d && goDate(d.format('YYYY-MM-DD'))}
            />
            <Button icon={<RightOutlined />} disabled={data.date >= data.maxDate} onClick={() => goDate(dayjs(data.date).add(1, 'day').format('YYYY-MM-DD'))} />
            <Button disabled={data.date === data.today} onClick={() => goDate(data.today)}>Сегодня</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ reservation: null, tableId: tableFilter })}>Новая бронь</Button>
          </Space>
        )}
      </div>
      {error && <Alert type="error" showIcon title="Не удалось загрузить" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginBottom: 12 }} />}
      {!data ? (!error && <Spin />) : (
        <Spin spinning={loading}>
          <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 8 } }}>
            <DayStrip data={data} onPick={goDate} />
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} xl={14}>
              <Card
                size="small"
                title={(
                  <span>
                    {dayjs(data.date).format('dddd, D MMMM')}
                    <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
                      {dayActive.length ? `${dayActive.length} ${plural(dayActive.length, 'бронь', 'брони', 'броней')} · гостей ${dayActive.reduce((s, r) => s + r.guestCount, 0)}` : 'броней нет'}
                    </Text>
                  </span>
                )}
                extra={zones.length > 1 && <Segmented size="small" value={currentZone} onChange={(v) => setZone(String(v))} options={zones.map((z) => ({ value: z, label: zoneLabel(z) }))} />}
              >
                <BookingPlan tables={zoneTables} tz={tz} selected={tableFilter} onSelect={pickTable} />
                <div className="booking-legend">
                  <span><i style={{ background: '#fff7e6', borderColor: '#fa8c16' }} /> есть бронь</span>
                  <span><i style={{ background: '#fff1b8', borderColor: '#d4b106' }} /> бронь знакомого гостя</span>
                  <span>★ постоянный · ☆ уже был · 📱 приложение · 🎂 день рождения · ⚠ не приходил</span>
                </div>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card
                size="small"
                title={filterTable ? <span>Стол № {filterTable.number} <Button size="small" type="link" onClick={() => setTableFilter(null)}>все столы</Button></span> : 'Брони дня'}
              >
                {list.length === 0 ? (
                  <Empty description={filterTable ? 'На этот стол броней нет' : 'На этот день броней нет'}>
                    <Button icon={<PlusOutlined />} onClick={() => setEditing({ reservation: null, tableId: tableFilter })}>Забронировать</Button>
                  </Empty>
                ) : list.map((r) => (
                  <div key={r.id} className={`booking-row${active(r) ? '' : ' booking-row--inactive'}`}>
                    <div className="booking-row__time">
                      <div>{timeIn(r.startsAt, tz)}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>до {timeIn(r.endsAt, tz)}</Text>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text strong>{r.guestName || r.guest.name || 'Без имени'}</Text>
                        <Text type="secondary">· {r.guestCount} чел. · {r.tableNumber != null ? `стол № ${r.tableNumber}` : <Text type="warning">без стола</Text>}</Text>
                        {r.status !== 'confirmed' && <Tag color={RES_STATUS[r.status]?.color}>{RES_STATUS[r.status]?.label}</Tag>}
                      </div>
                      <div style={{ marginTop: 2 }}><GuestMarks guest={r.guest} /></div>
                      {r.comment && <Text type="secondary" style={{ fontSize: 13 }}>{r.comment}</Text>}
                      {r.guestPhone && (
                        <div>
                          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setGuestPhone(r.guestPhone)}>
                            {r.guest.known || r.guest.app ? 'Карточка гостя' : 'Гость'} · {r.guestPhone}
                          </Button>
                        </div>
                      )}
                    </div>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          { key: 'edit', label: 'Изменить' },
                          { type: 'divider' },
                          { key: 'seated', label: 'Гости пришли', disabled: r.status === 'seated' },
                          { key: 'no_show', label: 'Не пришли', disabled: r.status === 'no_show' },
                          { key: 'cancelled', label: 'Отменить', disabled: r.status === 'cancelled' },
                          { key: 'confirmed', label: 'Вернуть в ожидание', disabled: r.status === 'confirmed' },
                          { type: 'divider' },
                          { key: 'delete', label: 'Удалить', danger: true },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'edit') setEditing({ reservation: r, tableId: r.tableId })
                          else if (key === 'delete') {
                            Modal.confirm({ title: 'Удалить бронь?', content: 'Если гость отменил — лучше «Отменить»: бронь останется в его истории.', okText: 'Удалить', okButtonProps: { danger: true }, cancelText: 'Нет', onOk: () => remove(r) })
                          }
                          else setStatus(r, key as Reservation['status'])
                        },
                      }}
                    >
                      <Button size="small" icon={<MoreOutlined />} aria-label="Действия" />
                    </Dropdown>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </Spin>
      )}

      {data && (
        <ReservationModal
          open={!!editing}
          tz={tz}
          defaultDate={data.date}
          capacity={data.tables.find((t) => t.id === editing?.tableId)?.capacity || 2}
          reservation={editing?.reservation || null}
          tables={data.tables}
          tableId={editing?.tableId ?? null}
          minDate={data.today}
          maxDate={data.maxDate}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
      <GuestCardDrawer phone={guestPhone} onClose={() => setGuestPhone(null)} />
    </div>
  )
}
