import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Collapse, Descriptions, Drawer, Empty, Popconfirm, Rate, Segmented, Select, Space, Spin, Tabs, Tag, Tooltip, Typography, message,
} from 'antd'
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons'
import { adminFetch, ApiError, type Access } from '../../lib/adminApi'
import type { Reservation, TableDayResponse, TableSession } from './types'
import {
  RES_STATUS, STATUS, callLabel, dateCaption, dateIn, duration, money, plural, reaction, shortName, timeIn, zoneLabel,
} from './format'
import ReservationModal from './ReservationModal'

const { Text } = Typography

interface Props {
  access: Access
  deny: () => void
  tableId: string | null
  date: string
  dayRange: { from: string; to: string }
  waiters: { id: string; name: string }[]
  onClose: () => void
  onChanged: () => void
}

// Шкала дня: отрезки посадок. Видимое окно — с 10:00 до 24:00 по времени
// ресторана, расширяется, если посадки выходят за него.
function Timeline({ sessions, dayRange, tz, current, onPick }: {
  sessions: TableSession[]; dayRange: { from: string; to: string }; tz: string; current: string | null; onPick: (id: string) => void
}) {
  const dayFrom = new Date(dayRange.from).getTime() // 06:00
  const now = Date.now()
  const starts = sessions.map((s) => new Date(s.startedAt).getTime())
  const ends = sessions.map((s) => (s.endedAt ? new Date(s.endedAt).getTime() : now))
  const from = Math.min(dayFrom + 4 * 3600_000, ...starts)
  const to = Math.max(dayFrom + 18 * 3600_000, ...ends.map((e) => Math.min(e, new Date(dayRange.to).getTime())))
  const span = to - from
  const pct = (t: number) => `${(((t - from) / span) * 100).toFixed(2)}%`
  const ticks: number[] = []
  const firstTick = Math.ceil(from / (2 * 3600_000)) * 2 * 3600_000
  for (let t = firstTick; t <= to; t += 2 * 3600_000) ticks.push(t)

  return (
    <div className="hall-timeline">
      {sessions.map((s, i) => (
        <div
          key={s.id}
          className={`hall-timeline__seg${s.active ? ' hall-timeline__seg--active' : ''}${current === s.id ? ' hall-timeline__seg--current' : ''}`}
          style={{ left: pct(Math.max(starts[i], from)), width: `calc(${pct(Math.min(ends[i], to))} - ${pct(Math.max(starts[i], from))})` }}
          title={`${timeIn(s.startedAt, tz)}–${s.endedAt ? timeIn(s.endedAt, tz) : 'сейчас'} · ${money(s.total)}`}
          onClick={() => onPick(s.id)}
        />
      ))}
      {ticks.map((t) => <div key={t} className="hall-timeline__tick" style={{ left: pct(t) }}>{timeIn(new Date(t).toISOString(), tz)}</div>)}
    </div>
  )
}

function SessionDetails({ s, tz }: { s: TableSession; tz: string }) {
  const seats = useMemo(() => {
    const m = new Map<string, typeof s.items>()
    for (const it of s.items) {
      const k = it.seat == null ? 'Без места' : `Место ${it.seat}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(it)
    }
    return [...m.entries()]
  }, [s])

  return (
    <div>
      <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Официант">
          {s.waiter.name || <Text type="danger">не записан</Text>}
          {s.waiter.name && s.waiter.inferred && (
            <Tooltip title="В посадке официант не был записан — определён по подсказкам ИИ или по закреплению стола">
              <Tag style={{ marginLeft: 6 }}>авто</Tag>
            </Tooltip>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Гостей">{s.guestCount ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Время">{timeIn(s.startedAt, tz)}–{s.endedAt ? timeIn(s.endedAt, tz) : 'сейчас'} ({duration(s.durationMin)})</Descriptions.Item>
        <Descriptions.Item label="Чек"><b>{money(s.total)}</b>{s.billType ? ` · ${s.billType === 'personal' ? 'раздельный' : 'общий'}` : ''}</Descriptions.Item>
      </Descriptions>

      {seats.length === 0 ? <Text type="secondary">Заказа не было</Text> : seats.map(([seat, items]) => (
        <div key={seat} style={{ marginBottom: 8 }}>
          <Text strong>{seat}</Text>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span>
                {it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ''}
                {it.modifiers.length > 0 && <Text type="secondary"> · {it.modifiers.join(', ')}</Text>}
                {it.comment && <Text type="secondary"> · «{it.comment}»</Text>}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{money(it.price * it.quantity)}</span>
            </div>
          ))}
        </div>
      ))}

      {s.calls.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text strong>Вызовы</Text>
          {s.calls.map((c, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              {timeIn(c.at, tz)} · {callLabel(c.kind, c.reason)} — {c.reactionSec == null
                ? <Text type="danger">без ответа</Text>
                : <>подошли через {reaction(c.reactionSec)}{c.acknowledgedBy ? ` (${shortName(c.acknowledgedBy)})` : ''}</>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 13 }}>
        <Text strong>Доп. продажи: </Text>
        {s.upsell.offered
          ? <>предложено {s.upsell.offered}, сработало {s.upsell.accepted}</>
          : <Text type="secondary">подсказками ИИ не пользовались</Text>}
      </div>

      {s.review && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <Text strong>Отзыв: </Text>
          кухня <Rate disabled value={s.review.food || 0} style={{ fontSize: 12 }} />, сервис <Rate disabled value={s.review.service || 0} style={{ fontSize: 12 }} />
          {s.review.comment && <div>«{s.review.comment}»</div>}
        </div>
      )}
    </div>
  )
}

export default function TableDrawer({ access, deny, tableId, date, dayRange, waiters, onClose, onChanged }: Props) {
  const [data, setData] = useState<TableDayResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<string>('history')
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [resModal, setResModal] = useState<{ open: boolean; res: Reservation | null }>({ open: false, res: null })
  const [assignWaiter, setAssignWaiter] = useState<string | undefined>()
  const [assignKind, setAssignKind] = useState<'day' | 'permanent'>('permanent')

  const call = useCallback(async <T,>(path: string, opts?: Parameters<typeof adminFetch>[2]) => {
    try {
      return await adminFetch<T>(access, path, opts)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) deny()
      throw e
    }
  }, [access, deny])

  const load = useCallback(async (keepTab = false) => {
    if (!tableId) return
    setLoading(true)
    try {
      const d = await call<TableDayResponse>('/api/admin/table', { query: { tableId, date } })
      setData(d)
      if (!keepTab) {
        const live = d.sessions.find((s) => s.active)
        setTab(d.mode === 'future' ? 'reservations' : d.mode === 'today' && live ? 'now' : 'history')
        setOpenSession(null)
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [call, tableId, date])

  useEffect(() => { setData(null); load() }, [load])

  const changed = async () => {
    await load(true)
    onChanged()
  }

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      message.success(ok)
      await changed()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const tz = data?.restaurant.timezone || 'Europe/Moscow'
  const live = data?.sessions.find((s) => s.active) || null
  const t = data?.table

  const assignBlock = data && (
    <div style={{ marginBottom: 16 }}>
      {data.assigned.length === 0 ? (
        <Alert type="error" showIcon title="За столом никто не закреплён" style={{ marginBottom: 8 }} />
      ) : (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">Обслуживает: </Text>
          {data.assigned.map((a) => (
            <Tag
              key={a.id}
              closable
              color={a.permanent ? 'blue' : 'cyan'}
              onClose={(e) => {
                e.preventDefault()
                act(() => call('/api/admin/assignments', { method: 'DELETE', body: { id: a.id } }), 'Закрепление снято')
              }}
            >
              {a.name || 'Без имени'} · {a.permanent ? 'постоянно' : 'на этот день'}
            </Tag>
          ))}
        </div>
      )}
      {data.mode !== 'past' && (
        <Space wrap>
          <Select
            placeholder="Официант"
            style={{ width: 200 }}
            value={assignWaiter}
            onChange={setAssignWaiter}
            showSearch
            optionFilterProp="label"
            options={waiters.filter((w) => !data.assigned.some((a) => a.waiterId === w.id)).map((w) => ({ value: w.id, label: w.name }))}
          />
          <Segmented
            value={assignKind}
            onChange={(v) => setAssignKind(v as 'day' | 'permanent')}
            options={[{ value: 'permanent', label: 'Постоянно' }, { value: 'day', label: 'На этот день' }]}
          />
          <Button
            icon={<UserAddOutlined />}
            disabled={!assignWaiter}
            onClick={() => act(async () => {
              await call('/api/admin/assignments', { method: 'POST', body: { tableId, waiterId: assignWaiter, permanent: assignKind === 'permanent', date } })
              setAssignWaiter(undefined)
            }, 'Официант закреплён')}
          >
            Закрепить
          </Button>
        </Space>
      )}
    </div>
  )

  const sessionLabel = (s: TableSession) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <span>
        <b>{timeIn(s.startedAt, tz)}–{s.endedAt ? timeIn(s.endedAt, tz) : 'сейчас'}</b>
        {' · '}{s.guestCount ?? '—'} {plural(s.guestCount || 0, 'гость', 'гостя', 'гостей')}
        {' · '}{shortName(s.waiter.name) || <Text type="danger">официант не записан</Text>}
      </span>
      <span>
        {s.calls.length > 0 && <Tag color={s.calls.some((c) => c.reactionSec == null) ? 'red' : 'default'}>вызовов {s.calls.length}</Tag>}
        {s.upsell.offered > 0 && <Tag color="purple">доп. {s.upsell.accepted}/{s.upsell.offered}</Tag>}
        {s.active && <Tag color="green">идёт</Tag>}
        <b>{money(s.total)}</b>
      </span>
    </div>
  )

  const history = data && (
    data.sessions.length === 0 ? <Empty description="В этот день стол не занимали" /> : (
      <>
        <div style={{ marginBottom: 8 }}>
          За день: <b>{data.summary?.sessions}</b> {plural(data.summary?.sessions || 0, 'посадка', 'посадки', 'посадок')},
          {' '}{data.summary?.guests} {plural(data.summary?.guests || 0, 'гость', 'гостя', 'гостей')}, выручка <b>{money(data.summary?.revenue || 0)}</b>,
          {' '}средний чек {money(data.summary?.avgCheck || 0)}
        </div>
        <Timeline sessions={data.sessions} dayRange={dayRange} tz={tz} current={openSession} onPick={setOpenSession} />
        <Collapse
          activeKey={openSession ? [openSession] : []}
          onChange={(keys) => setOpenSession((Array.isArray(keys) ? keys[keys.length - 1] : keys) || null)}
          items={data.sessions.map((s) => ({ key: s.id, label: sessionLabel(s), children: <SessionDetails s={s} tz={tz} /> }))}
        />
      </>
    )
  )

  const reservations = data && (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setResModal({ open: true, res: null })} style={{ marginBottom: 12 }}>
        Новая бронь
      </Button>
      {data.reservations.length === 0 ? <Empty description="Броней нет" /> : data.reservations.map((r) => (
        <div key={r.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', marginBottom: 8, opacity: r.status === 'cancelled' ? 0.55 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>
              <b>{dateIn(r.startsAt, tz)}, {timeIn(r.startsAt, tz)}–{timeIn(r.endsAt, tz)}</b> · {r.guestCount} чел.
            </span>
            <Tag color={RES_STATUS[r.status]?.color}>{RES_STATUS[r.status]?.label}</Tag>
          </div>
          {(r.guestName || r.guestPhone) && <div>{[r.guestName, r.guestPhone].filter(Boolean).join(', ')}</div>}
          {r.comment && <Text type="secondary">{r.comment}</Text>}
          <div style={{ marginTop: 6 }}>
            <Space size={4} wrap>
              <Button size="small" onClick={() => setResModal({ open: true, res: r })}>Изменить</Button>
              {r.status === 'confirmed' && <>
                <Button size="small" onClick={() => act(() => call('/api/admin/reservations', { method: 'PATCH', body: { id: r.id, status: 'seated' } }), 'Отмечено: гости пришли')}>Пришли</Button>
                <Button size="small" onClick={() => act(() => call('/api/admin/reservations', { method: 'PATCH', body: { id: r.id, status: 'no_show' } }), 'Отмечено: не пришли')}>Не пришли</Button>
                <Button size="small" onClick={() => act(() => call('/api/admin/reservations', { method: 'PATCH', body: { id: r.id, status: 'cancelled' } }), 'Бронь отменена')}>Отменить</Button>
              </>}
              <Popconfirm title="Удалить бронь совсем?" okText="Удалить" cancelText="Нет" onConfirm={() => act(() => call('/api/admin/reservations', { method: 'DELETE', body: { id: r.id } }), 'Бронь удалена')}>
                <Button size="small" danger type="text">Удалить</Button>
              </Popconfirm>
            </Space>
          </div>
        </div>
      ))}
    </>
  )

  const now = live && (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Tag color={STATUS[live.status || '']?.color}>{STATUS[live.status || '']?.label || 'Занят'}</Tag>
        с {timeIn(live.startedAt, tz)} ({duration(live.durationMin)})
      </div>
      <SessionDetails s={live} tz={tz} />
    </div>
  )

  const tabs = data ? [
    ...(data.mode === 'today' ? [{ key: 'now', label: 'Сейчас', children: now || <Empty description="Стол свободен" /> }] : []),
    ...(data.mode !== 'future' ? [{ key: 'history', label: `История${data.sessions.length ? ` (${data.sessions.length})` : ''}`, children: history }] : []),
    { key: 'reservations', label: `Брони${data.reservations.filter((r) => r.status === 'confirmed').length ? ` (${data.reservations.filter((r) => r.status === 'confirmed').length})` : ''}`, children: reservations },
  ] : []

  return (
    <Drawer
      open={!!tableId}
      onClose={onClose}
      size={Math.min(600, typeof window === 'undefined' ? 600 : window.innerWidth)}
      title={t ? `Стол ${t.number} · ${zoneLabel(t.zone)} · ${t.capacity} ${plural(t.capacity, 'место', 'места', 'мест')}` : 'Стол'}
      extra={data && <Text type="secondary">{dateCaption(data.date, data.today)}</Text>}
    >
      {!data ? <Spin /> : (
        <Spin spinning={loading}>
          {assignBlock}
          <Tabs activeKey={tab} onChange={setTab} items={tabs} />
        </Spin>
      )}
      {data && (
        <ReservationModal
          open={resModal.open}
          tz={tz}
          defaultDate={date}
          capacity={data.table.capacity}
          reservation={resModal.res}
          onCancel={() => setResModal({ open: false, res: null })}
          onSave={async (body) => {
            if (resModal.res) await call('/api/admin/reservations', { method: 'PATCH', body: { id: resModal.res.id, ...body } })
            else await call('/api/admin/reservations', { method: 'POST', body: { tableId, ...body } })
            setResModal({ open: false, res: null })
            message.success('Бронь сохранена')
            await changed()
          }}
        />
      )}
    </Drawer>
  )
}
