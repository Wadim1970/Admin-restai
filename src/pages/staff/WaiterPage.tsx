import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Avatar, Button, Card, Col, Collapse, Empty, Progress, Row, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { readPeriod, writePeriod, type Period } from '../../lib/period'
import PeriodPicker from '../../components/PeriodPicker'
import BarChart from '../../components/BarChart'
import SessionDetails from '../hall/SessionDetails'
import { duration, money, plural, timeIn } from '../hall/format'
import type { UpsellGroup, WaiterResponse } from './types'
import { Compare, reactionShort } from './compare'

const { Title, Text, Paragraph } = Typography

function Kpi({ title, value, extra }: { title: string; value: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic title={title} value={value as string} />
      <div style={{ minHeight: 18 }}>{extra}</div>
    </Card>
  )
}

function GroupTable({ rows, empty, title }: { rows: UpsellGroup[]; empty: string; title: string }) {
  if (!rows.length) return <Text type="secondary">{empty}</Text>
  return (
    <Table<UpsellGroup>
      rowKey="key"
      size="small"
      pagination={false}
      dataSource={rows}
      columns={[
        { title, dataIndex: 'label' },
        { title: 'Предложено', dataIndex: 'offered', align: 'right', width: 110 },
        { title: 'Продано', dataIndex: 'accepted', align: 'right', width: 90 },
        { title: 'Сработало', dataIndex: 'rate', width: 170, render: (r: number) => <Progress percent={r} size="small" strokeColor="#1677ff" status="normal" format={(p) => `${p}%`} /> },
      ]}
    />
  )
}

export default function WaiterPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const period = readPeriod(params)
  const [data, setData] = useState<WaiterResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const rid = ++reqId.current
    setLoading(true)
    try {
      const d = await adminFetch<WaiterResponse>('/api/admin/waiter', { query: { waiterId: id, from: period.from, to: period.to } })
      if (rid === reqId.current) { setData(d); setError('') }
    } catch (e) {
      if (rid === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (rid === reqId.current) setLoading(false)
    }
  }, [id, period.from, period.to])

  useEffect(() => { load() }, [load])

  const setPeriod = (p: Period) => setParams(writePeriod(params, p))
  const back = `/shift/waiters?${writePeriod(new URLSearchParams(), period)}`
  const t = data?.totals
  const r = data?.restaurantTotals
  const tz = data?.restaurant.timezone || 'Europe/Moscow'

  const bars = useMemo(() => {
    if (!data) return null
    const lbl = (d: string) => (data.byDay.length > 14 ? dayjs(d).format('D') : dayjs(d).format('dd D'))
    const full = (d: string) => dayjs(d).format('dd, D MMMM')
    return {
      revenue: data.byDay.map((d) => ({ key: d.date, label: lbl(d.date), value: d.revenue, tip: `${full(d.date)}: ${money(d.revenue)}, ${d.sessions} ${plural(d.sessions, 'посадка', 'посадки', 'посадок')}` })),
      avgCheck: data.byDay.map((d) => ({ key: d.date, label: lbl(d.date), value: d.avgCheck, tip: `${full(d.date)}: средний чек ${d.avgCheck ? money(d.avgCheck) : '—'}` })),
      upsell: data.byDay.map((d) => ({ key: d.date, label: lbl(d.date), value: d.accepted, tip: `${full(d.date)}: продано ${d.accepted} из ${d.offered} предложенных` })),
    }
  }, [data])

  if (error && !data) {
    return (
      <div>
        <Link to={back}><ArrowLeftOutlined /> Все официанты</Link>
        <Alert type="error" showIcon title="Не удалось загрузить" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginTop: 16 }} />
      </div>
    )
  }
  if (!data || !t || !r) return <Spin />

  const w = data.waiter
  const multiDay = data.period.days > 1

  const sessionsTab = data.sessions.length === 0 ? <Empty description="В этот период посадок не было" /> : (
    <Collapse
      items={data.sessions.map((s) => ({
        key: s.id,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>
              {multiDay && <Text type="secondary">{dayjs(s.date).format('D MMM')} · </Text>}
              <b>{timeIn(s.startedAt, tz)}–{s.endedAt ? timeIn(s.endedAt, tz) : 'сейчас'}</b>
              {' · '}стол {s.tableNumber ?? '—'} · {s.guestCount ?? '—'} {plural(s.guestCount || 0, 'гость', 'гостя', 'гостей')}
            </span>
            <span>
              {s.calls.some((c) => c.reactionSec == null) && <Tag color="red">вызов без ответа</Tag>}
              {s.upsell.offered > 0 && <Tag color="purple">доп. {s.upsell.accepted}/{s.upsell.offered}</Tag>}
              {s.waiter.inferred && <Tag>авто</Tag>}
              <b>{money(s.total)}</b>
            </span>
          </div>
        ),
        children: <SessionDetails s={s} tz={tz} />,
      }))}
    />
  )

  const tablesTab = (
    <Table
      rowKey="tableId"
      size="small"
      pagination={false}
      dataSource={data.tables}
      locale={{ emptyText: 'В этот период столов не обслуживал' }}
      columns={[
        { title: 'Стол', dataIndex: 'number', render: (n: number) => `№ ${n}` },
        { title: 'Сколько раз занимали', dataIndex: 'sessions', align: 'right' },
        { title: 'Гостей', dataIndex: 'guests', align: 'right' },
        { title: 'Выручка', dataIndex: 'revenue', align: 'right', render: money },
        { title: 'Средний чек', key: 'avg', align: 'right', render: (_: unknown, x: { sessions: number; revenue: number }) => money(x.sessions ? x.revenue / x.sessions : 0) },
      ]}
    />
  )

  const u = t.upsell
  const upsellTab = (
    <div>
      <Paragraph type="secondary" style={{ maxWidth: 760 }}>
        Считаются подсказки ИИ в приложении официанта: «предложено» — официант получил подсказку и предложил блюдо (или
        попросил другой вариант), «продано» — нажал «В корзину», блюдо ушло в заказ. Доп. продажи без подсказок пока не
        учитываются.
      </Paragraph>
      {u.offered === 0 ? <Empty description="В этот период подсказками ИИ не пользовался" /> : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="По приёмам продаж"><GroupTable title="Приём" rows={u.byTechnique || []} empty="—" /></Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="По категориям"><GroupTable title="Категория" rows={u.byCategory || []} empty="—" /></Card>
          </Col>
          <Col xs={24}>
            <Card size="small" title="Что чаще всего докупали">
              {(u.topDishes || []).length === 0 ? <Text type="secondary">Пока ничего не продано по подсказкам</Text> : (
                <Table
                  rowKey="name"
                  size="small"
                  pagination={false}
                  dataSource={u.topDishes}
                  columns={[
                    { title: 'Блюдо', dataIndex: 'name' },
                    { title: 'Продано', dataIndex: 'accepted', align: 'right', width: 100 },
                    { title: 'На сумму', dataIndex: 'revenue', align: 'right', width: 130, render: money },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )

  const serviceRows = [
    { key: 'reaction', name: 'Подходит на вызов гостя', value: reactionShort(t.avgReactionSec), cmp: <Compare value={t.avgReactionSec} base={r.avgReactionSec} better="lower" format={reactionShort} />, note: t.calls ? `вызовов ${t.calls}${t.unansweredCalls ? `, без ответа ${t.unansweredCalls}` : ''}` : 'вызовов не было' },
    { key: 'first', name: 'Первый заказ уходит на кухню', value: t.avgFirstOrderMin == null ? '—' : `через ${duration(t.avgFirstOrderMin)}`, cmp: <Compare value={t.avgFirstOrderMin} base={r.avgFirstOrderMin} better="lower" format={(v) => duration(v)} />, note: 'от посадки гостей' },
    { key: 'upsell', name: 'Предлагает доп. продажи', value: `${t.upsellPerSession} на посадку`, cmp: <Compare value={t.upsellPerSession} base={r.upsellPerSession} format={(v) => `${v} на посадку`} />, note: 'по подсказкам ИИ' },
    { key: 'rating', name: 'Оценка сервиса гостями', value: t.serviceRating ? `★ ${t.serviceRating}` : '—', cmp: <Compare value={t.serviceRating} base={r.serviceRating} format={(v) => `★ ${v}`} />, note: t.reviews ? `${t.reviews} ${plural(t.reviews, 'отзыв', 'отзыва', 'отзывов')}` : 'отзывов нет' },
  ]
  const serviceTab = (
    <div>
      <Table
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={serviceRows}
        columns={[
          { title: 'Что измеряем', dataIndex: 'name' },
          { title: 'У официанта', dataIndex: 'value', render: (v: string, x) => <span><b>{v}</b> <Text type="secondary" style={{ fontSize: 12 }}>· {x.note}</Text></span> },
          { title: 'Против среднего по ресторану', dataIndex: 'cmp' },
        ]}
      />
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 16 }}
        title="Политика ресторана"
        description="Следующий шаг — правила вашего ресторана (например: подойти за 2 минуты, предложить аперитив и десерт, попрощаться) и отметки их выполнения. Тогда здесь появится, насколько чётко официант им следует."
      />
    </div>
  )

  const dynamicsTab = bars && (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}><Card size="small" title="Выручка по дням"><BarChart bars={bars.revenue} format={money} /></Card></Col>
      <Col xs={24} lg={12}><Card size="small" title="Средний чек по дням"><BarChart bars={bars.avgCheck} format={money} /></Card></Col>
      <Col xs={24} lg={12}><Card size="small" title="Продано по подсказкам ИИ"><BarChart bars={bars.upsell} format={(v) => String(v)} /></Card></Col>
    </Row>
  )

  return (
    <div>
      <Link to={back}><ArrowLeftOutlined /> Все официанты</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '12px 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={48} src={w.photo || undefined} icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{w.name}</Title>
            <Text type="secondary">
              {w.staff ? 'Штатный' : 'Фрилансер'}
              {t.tables.length > 0 && ` · столы ${t.tables.join(', ')}`}
              {` · ${t.workDays} ${plural(t.workDays, 'рабочий день', 'рабочих дня', 'рабочих дней')}`}
            </Text>
          </div>
        </div>
        <PeriodPicker value={period} today={data.today} onChange={setPeriod} />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6} xl={4}><Kpi title="Выручка" value={money(t.revenue)} extra={multiDay && t.workDays > 0 && <><Text type="secondary" style={{ fontSize: 12 }}>{money(t.revenuePerDay)} в день </Text><Compare value={t.revenuePerDay} base={r.revenuePerDay} format={money} /></>} /></Col>
          <Col xs={12} md={6} xl={4}><Kpi title="Посадок · гостей" value={`${t.sessions} · ${t.guests}`} /></Col>
          <Col xs={12} md={6} xl={4}><Kpi title="Средний чек" value={t.avgCheck ? money(t.avgCheck) : '—'} extra={<Compare value={t.avgCheck || null} base={r.avgCheck || null} format={money} />} /></Col>
          <Col xs={12} md={6} xl={4}><Kpi title="Чек на гостя" value={t.avgGuestCheck ? money(t.avgGuestCheck) : '—'} extra={<Compare value={t.avgGuestCheck || null} base={r.avgGuestCheck || null} format={money} />} /></Col>
          <Col xs={12} md={6} xl={4}><Kpi title="Доп. продажи по ИИ" value={u.offered ? `${u.accepted} из ${u.offered}` : '—'} extra={u.offered > 0 && <><Text type="secondary" style={{ fontSize: 12 }}>{u.rate}% · {money(u.revenue)} </Text><Compare value={u.rate} base={r.upsell.rate || null} format={(v) => `${v}%`} /></>} /></Col>
          <Col xs={12} md={6} xl={4}><Kpi title="Реакция на вызов" value={reactionShort(t.avgReactionSec)} extra={<Compare value={t.avgReactionSec} base={r.avgReactionSec} better="lower" format={reactionShort} />} /></Col>
        </Row>

        <Card size="small">
          <Tabs
            items={[
              { key: 'sessions', label: `Посадки (${t.sessions})`, children: sessionsTab },
              { key: 'tables', label: 'Столы', children: tablesTab },
              { key: 'upsell', label: 'Доп. продажи', children: upsellTab },
              { key: 'service', label: 'Стандарты сервиса', children: serviceTab },
              ...(multiDay ? [{ key: 'dynamics', label: 'Динамика', children: dynamicsTab }] : []),
            ]}
          />
        </Card>
      </Spin>
      {data.sessions.length === 300 && <Text type="secondary">Показаны последние 300 посадок периода.</Text>}
    </div>
  )
}
