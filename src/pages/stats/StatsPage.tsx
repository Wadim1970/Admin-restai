import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, Empty, Progress, Row, Segmented, Spin, Statistic, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { readPeriod, writePeriod, type Period } from '../../lib/period'
import PeriodPicker from '../../components/PeriodPicker'
import BarChart from '../../components/BarChart'
import { duration, money, moneyShort, rememberZoneNames, zoneLabel } from '../hall/format'
import { reactionShort } from '../staff/compare'
import type { Kpi, KpiKey, StatsResponse } from './types'

const { Title, Text } = Typography

const WEEKDAYS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

// «▲ 12% к прошлому периоду». Цвет — хорошо ли это, стрелка — направление.
function Delta({ kpi, better = 'higher', format, prevLabel }: { kpi: Kpi; better?: 'higher' | 'lower' | 'neutral'; format: (v: number) => string; prevLabel: string }) {
  if (kpi.delta == null) return <Text type="secondary" style={{ fontSize: 12 }}>нет данных для сравнения</Text>
  const tip = `${prevLabel}: ${kpi.prev != null ? format(kpi.prev) : '—'}`
  if (kpi.delta === 0) return <Tooltip title={tip}><Text type="secondary" style={{ fontSize: 12 }}>как в прошлом периоде</Text></Tooltip>
  const good = better === 'neutral' ? null : better === 'higher' ? kpi.delta > 0 : kpi.delta < 0
  return (
    <Tooltip title={tip}>
      <span className={good == null ? '' : good ? 'cmp-up' : 'cmp-down'} style={{ fontSize: 12, color: good == null ? '#5c6070' : undefined }}>
        {kpi.delta > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(kpi.delta)}% к прошлому
      </span>
    </Tooltip>
  )
}

const KPIS: { key: KpiKey; title: string; format: (v: number) => string; better?: 'higher' | 'lower' | 'neutral' }[] = [
  { key: 'revenue', title: 'Выручка', format: money },
  { key: 'sessions', title: 'Посадок', format: (v) => String(v) },
  { key: 'guests', title: 'Гостей', format: (v) => String(v) },
  { key: 'avgCheck', title: 'Средний чек', format: money },
  { key: 'avgGuestCheck', title: 'Чек на гостя', format: money },
  { key: 'avgDurationMin', title: 'Средняя посадка', format: duration, better: 'neutral' },
]

type DayMetric = 'revenue' | 'sessions' | 'guests' | 'avgCheck'
const DAY_METRICS: Record<DayMetric, { label: string; format: (v: number) => string }> = {
  revenue: { label: 'Выручка', format: moneyShort },
  sessions: { label: 'Посадки', format: (v) => String(v) },
  guests: { label: 'Гости', format: (v) => String(v) },
  avgCheck: { label: 'Средний чек', format: moneyShort },
}

export default function StatsPage() {
  const [params, setParams] = useSearchParams()
  const period = readPeriod(params)
  const tab = params.get('tab') || 'dishes'
  const [metric, setMetric] = useState<DayMetric>('revenue')
  const [hourMetric, setHourMetric] = useState<'avgSessions' | 'avgRevenue'>('avgSessions')
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const d = await adminFetch<StatsResponse>('/api/admin/stats', { query: { from: period.from, to: period.to } })
      if (id === reqId.current) { rememberZoneNames(d.zoneNames); setData(d); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => { load() }, [load])

  const setPeriod = (p: Period) => setParams(writePeriod(params, p))
  const setTab = (t: string) => { const n = new URLSearchParams(params); n.set('tab', t); setParams(n, { replace: true }) }

  const prevLabel = data
    ? `${data.previous.from === data.previous.to ? dayjs(data.previous.from).format('D MMMM') : `${dayjs(data.previous.from).format('D MMM')} – ${dayjs(data.previous.to).format('D MMM')}`}`
    : ''
  const multiDay = (data?.period.days || 0) > 1
  const hourFmt = hourMetric === 'avgRevenue' ? moneyShort : (v: number) => String(v)
  const perDay = multiDay ? ' в среднем за день' : ''

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Статистика{data ? ` · ${data.restaurant.name}` : ''}</Title>
        <PeriodPicker value={period} today={data?.today || period.to} onChange={setPeriod} />
      </div>
      {error && <Alert type="error" showIcon title="Не удалось загрузить" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginBottom: 16 }} />}
      {!data ? (!error && <Spin />) : (
        <Spin spinning={loading}>
          {data.partial && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Сегодняшний день ещё идёт — итоги за него неполные, сравнение с прошлым периодом пока занижено." />}

          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            {KPIS.map((k) => (
              <Col key={k.key} xs={12} md={8} xl={4}>
                <Card size="small">
                  <Statistic title={k.title} value={data.kpi[k.key].value != null ? k.format(data.kpi[k.key].value as number) : '—'} />
                  {data.previous.hasData ? <Delta kpi={data.kpi[k.key]} better={k.better} format={k.format} prevLabel={`Прошлый период (${prevLabel})`} /> : <Text type="secondary" style={{ fontSize: 12 }}>за {prevLabel} данных нет</Text>}
                </Card>
              </Col>
            ))}
          </Row>

          {data.totals.sessions === 0 ? <Card><Empty description="За период посадок нет" /></Card> : (
            <>
              <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                {multiDay && (
                  <Col xs={24} xl={data.byWeekday ? 10 : 12}>
                    <Card size="small" title="По дням" extra={<Segmented size="small" value={metric} onChange={(v) => setMetric(v as DayMetric)} options={Object.entries(DAY_METRICS).map(([value, m]) => ({ value, label: m.label }))} />}>
                      <BarChart
                        format={DAY_METRICS[metric].format}
                        bars={data.byDay.map((d) => ({
                          key: d.date,
                          label: data.byDay.length > 14 ? dayjs(d.date).format('D') : dayjs(d.date).format('dd D'),
                          value: d[metric],
                          tip: `${dayjs(d.date).format('dd, D MMMM')}: выручка ${money(d.revenue)}, посадок ${d.sessions}, гостей ${d.guests}, ср. чек ${d.avgCheck ? money(d.avgCheck) : '—'}`,
                        }))}
                      />
                    </Card>
                  </Col>
                )}
                <Col xs={24} xl={multiDay ? (data.byWeekday ? 8 : 12) : 24}>
                  <Card size="small" title={`По часам${perDay}`} extra={<Segmented size="small" value={hourMetric} onChange={(v) => setHourMetric(v as 'avgSessions' | 'avgRevenue')} options={[{ value: 'avgSessions', label: 'Посадки' }, { value: 'avgRevenue', label: 'Выручка' }]} />}>
                    {(() => {
                      // Ночные часы без посадок по краям не показываем.
                      const h = data.byHour
                      const first = h.findIndex((x) => x.sessions > 0)
                      const last = h.length - 1 - [...h].reverse().findIndex((x) => x.sessions > 0)
                      const shown = h.slice(Math.max(0, Math.min(first, 4)), Math.max(last + 1, 18))
                      return (
                        <BarChart
                          format={hourFmt}
                          bars={shown.map((x) => ({
                            key: String(x.hour),
                            label: String(x.hour),
                            value: x[hourMetric],
                            tip: `${hh(x.hour)}–${hh((x.hour + 1) % 24)}: посадок ${x.sessions}${multiDay ? ` (${x.avgSessions} в день)` : ''}, выручка ${money(x.revenue)}${multiDay ? ` (${money(x.avgRevenue)} в день)` : ''}`,
                          }))}
                        />
                      )
                    })()}
                  </Card>
                </Col>
                {data.byWeekday && (
                  <Col xs={24} xl={6}>
                    <Card size="small" title="Дни недели · ср. выручка">
                      <BarChart
                        format={moneyShort}
                        bars={data.byWeekday.map((w) => ({
                          key: String(w.weekday),
                          label: WEEKDAYS[w.weekday],
                          value: w.avgRevenue,
                          tip: w.days ? `${WEEKDAYS[w.weekday]} (дней в периоде: ${w.days}): выручка ${money(w.avgRevenue)}, посадок ${w.avgSessions} в среднем` : `${WEEKDAYS[w.weekday]}: в периоде нет`,
                        }))}
                      />
                    </Card>
                  </Col>
                )}
              </Row>

              <Card size="small">
                <Tabs
                  activeKey={tab}
                  onChange={setTab}
                  items={[
                    { key: 'dishes', label: 'Блюда', children: <DishesTab data={data} /> },
                    { key: 'tables', label: 'Столы', children: <TablesTab data={data} /> },
                    { key: 'ai', label: 'ИИ-подсказки', children: <AiTab data={data} /> },
                    { key: 'guest', label: 'Гостевое приложение', children: <GuestTab data={data} /> },
                  ]}
                />
              </Card>
            </>
          )}
        </Spin>
      )}
    </div>
  )
}

function DishesTab({ data }: { data: StatsResponse }) {
  const d = data.dishes
  const [showAll, setShowAll] = useState(false)
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Title level={5}>Самые продаваемые <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>· продано разных блюд: {d.dishesSold}</Text></Title>
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          dataSource={d.top}
          columns={[
            { title: '#', key: 'i', width: 40, render: (_v, _r, i) => i + 1 },
            { title: 'Блюдо', dataIndex: 'name', render: (n: string, r) => <span>{n}{r.section && <Text type="secondary" style={{ fontSize: 12 }}> · {r.section}</Text>}</span> },
            { title: 'Шт.', dataIndex: 'quantity', align: 'right', sorter: (a, b) => a.quantity - b.quantity },
            { title: 'Выручка', dataIndex: 'revenue', align: 'right', render: money, sorter: (a, b) => a.revenue - b.revenue },
            { title: 'Доля', dataIndex: 'share', align: 'right', width: 70, render: (v: number) => `${v}%` },
          ]}
        />
        {d.bottom.length > 0 && (
          <>
            <Title level={5} style={{ marginTop: 16 }}>Продаются хуже всего</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Заказывали, но редко — кандидаты убрать из меню или продвигать через «Кухню → Приоритет».</Text>
            <Table rowKey="name" size="small" pagination={false} dataSource={d.bottom} columns={[
              { title: 'Блюдо', dataIndex: 'name', render: (n: string, r) => <span>{n}{r.section && <Text type="secondary" style={{ fontSize: 12 }}> · {r.section}</Text>}</span> },
              { title: 'Шт.', dataIndex: 'quantity', align: 'right' },
              { title: 'Выручка', dataIndex: 'revenue', align: 'right', render: money },
            ]} />
          </>
        )}
      </Col>
      <Col xs={24} xl={9}>
        <Title level={5}>Разделы меню</Title>
        {d.sections.map((s) => (
          <div key={s.section} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{s.section}</span>
              <Text type="secondary">{money(s.revenue)} · {s.share}%</Text>
            </div>
            <Progress percent={s.share} showInfo={false} size="small" />
          </div>
        ))}
        <Title level={5} style={{ marginTop: 16 }}>Не заказывали ни разу <Tag>{d.unsold.length}</Tag></Title>
        {d.unsold.length === 0 ? <Text type="secondary">Каждое блюдо меню заказали хотя бы раз.</Text> : (
          <>
            {(showAll ? d.unsold : d.unsold.slice(0, 12)).map((u) => (
              <div key={u.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                <span>{u.name}{u.section && <Text type="secondary" style={{ fontSize: 12 }}> · {u.section}</Text>}</span>
                <Text type="secondary">{money(u.price)}</Text>
              </div>
            ))}
            {d.unsold.length > 12 && <Button type="link" style={{ padding: 0 }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Свернуть' : `Показать все ${d.unsold.length}`}</Button>}
          </>
        )}
      </Col>
    </Row>
  )
}

function TablesTab({ data }: { data: StatsResponse }) {
  const multiDay = data.period.days > 1
  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Заполнение мест — сколько мест в среднем занято за посадку: двое за столом на шестерых — 33 %. Низкое заполнение больших столов — повод сажать пары за маленькие.
      </Text>
      <Table
        rowKey="tableId"
        size="small"
        pagination={false}
        scroll={{ x: 760 }}
        dataSource={data.tables}
        columns={[
          { title: 'Стол', dataIndex: 'number', render: (n: number, t) => <Link to={`/shift/hall?table=${t.tableId}${data.period.from === data.period.to ? `&date=${data.period.from}` : ''}`}>№ {n}</Link>, sorter: (a, b) => a.number - b.number },
          { title: 'Зона', dataIndex: 'zone', render: zoneLabel },
          { title: 'Мест', dataIndex: 'capacity', align: 'right', render: (v: number | null) => v ?? '—' },
          { title: 'Посадок', dataIndex: 'sessions', align: 'right', sorter: (a, b) => a.sessions - b.sessions, render: (v: number, t) => (multiDay ? <span>{v} <Text type="secondary" style={{ fontSize: 12 }}>({t.sessionsPerDay}/день)</Text></span> : v) },
          { title: multiDay ? 'Занят, ч/день' : 'Занят, ч', dataIndex: 'hoursPerDay', align: 'right', sorter: (a, b) => a.hoursPerDay - b.hoursPerDay },
          { title: 'Заполнение мест', dataIndex: 'seatFill', align: 'right', sorter: (a, b) => (a.seatFill ?? -1) - (b.seatFill ?? -1), render: (v: number | null) => (v == null ? '—' : <Text type={v < 50 ? 'warning' : undefined}>{v}%</Text>) },
          { title: 'Выручка', dataIndex: 'revenue', align: 'right', render: money, sorter: (a, b) => a.revenue - b.revenue, defaultSortOrder: 'descend' },
          { title: 'Средний чек', dataIndex: 'avgCheck', align: 'right', render: (v: number) => (v ? money(v) : '—'), sorter: (a, b) => a.avgCheck - b.avgCheck },
        ]}
      />
    </>
  )
}

function AiTab({ data }: { data: StatsResponse }) {
  const { ai } = data
  const block = (title: string, u: StatsResponse['ai']['waiter'] | StatsResponse['ai']['guestMenu'], hint: string) => (
    <Card size="small" title={title} style={{ height: '100%' }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>{hint}</Text>
      <Row gutter={12}>
        <Col span={8}><Statistic title="Предложено" value={u.offered} /></Col>
        <Col span={8}><Statistic title="Взяли" value={u.accepted} suffix={u.offered ? <Text type="secondary" style={{ fontSize: 14 }}>{u.rate}%</Text> : null} /></Col>
        <Col span={8}><Statistic title="На сумму" value={money(u.revenue)} /></Col>
      </Row>
      {u.topDishes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text strong>Чаще всего брали</Text>
          {u.topDishes.slice(0, 5).map((d) => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{d.name}</span><Text type="secondary">{d.accepted} × · {money(d.revenue)}</Text></div>
          ))}
        </div>
      )}
    </Card>
  )
  const cart = ai.guestCart
  if (!ai.waiter.offered && !ai.guestMenu.offered && !cart?.offered && !cart?.dessertAsked) return <Empty description="За период подсказок ИИ не было" />
  return (
    <>
      <Alert
        type="success"
        showIcon
        style={{ marginBottom: 12 }}
        title={`По подсказкам ИИ продано на ${money(ai.revenue)} — ${ai.share}% выручки периода`}
        description="Считаются блюда, которые гость взял после подсказки: официант предложил по подсказке, гость добавил из «К этому блюду подойдёт» в меню или по совету в корзине."
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>{block('Подсказки официанту', ai.waiter, 'Официант показал подсказку гостю; «взяли» — блюдо ушло в заказ.')}</Col>
        <Col xs={24} lg={8}>{block('Подсказки гостю в меню', ai.guestMenu, 'Пары «К этому блюду подойдёт» в гостевом меню.')}</Col>
        {cart && <Col xs={24} lg={8}>{block('Советы в корзине', cart, 'Гость открыл корзину — ИИ подсказал, чего не хватает к завтраку, обеду или ужину.')}</Col>}
        {cart && (cart.byGap.length > 0 || cart.dessertAsked > 0) && (
          <Col xs={24}>
            <Card size="small" title="Советы в корзине: чего не хватало">
              {cart.byGap.length > 0 && (
                <Table rowKey="key" size="small" pagination={false} dataSource={cart.byGap} columns={[
                  { title: 'Предложили', dataIndex: 'label' },
                  { title: 'Показано', dataIndex: 'offered', align: 'right' },
                  { title: 'Взяли', dataIndex: 'accepted', align: 'right' },
                  { title: 'Конверсия', dataIndex: 'rate', align: 'right', render: (v: number) => <Progress percent={v} size="small" style={{ width: 120, margin: 0 }} /> },
                ]} />
              )}
              {cart.dessertAsked > 0 && (
                <Text style={{ display: 'block', marginTop: 8 }}>
                  Всё было в заказе — ИИ похвалил выбор и спросил про десерт: {cart.dessertAsked} раз, согласились {cart.dessertYes} ({Math.round((cart.dessertYes / cart.dessertAsked) * 100)}%). Согласившимся десерт предлагает официант после горячего.
                </Text>
              )}
            </Card>
          </Col>
        )}
        {ai.waiter.byTechnique.length > 0 && (
          <Col xs={24}>
            <Card size="small" title="Какие приёмы работают (подсказки официанту)">
              <Table rowKey="key" size="small" pagination={false} dataSource={ai.waiter.byTechnique} columns={[
                { title: 'Приём', dataIndex: 'label' },
                { title: 'Предложено', dataIndex: 'offered', align: 'right' },
                { title: 'Взяли', dataIndex: 'accepted', align: 'right' },
                { title: 'Конверсия', dataIndex: 'rate', align: 'right', render: (v: number) => <Progress percent={v} size="small" style={{ width: 120, margin: 0 }} /> },
              ]} />
              <Text type="secondary" style={{ fontSize: 12 }}>Подробнее по каждому официанту — в разделе <Link to="/shift/waiters">«Официанты»</Link>.</Text>
            </Card>
          </Col>
        )}
      </Row>
    </>
  )
}

function GuestTab({ data }: { data: StatsResponse }) {
  const g = data.guestApp
  return (
    <>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Вызовов официанта" value={g.calls} suffix={g.calls ? <Text type="secondary" style={{ fontSize: 14 }}>в {g.sessionsWithCallsPct}% посадок</Text> : null} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Средняя реакция" value={reactionShort(g.avgReactionSec)} />{g.calls - g.answered > 0 && <Text type="danger" style={{ fontSize: 12 }}>без ответа: {g.calls - g.answered}</Text>}</Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Дольше 3 минут" value={g.slowCalls} styles={{ content: g.slowCalls ? { color: '#cf1322' } : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Отзывов" value={g.reviews} suffix={<Text type="secondary" style={{ fontSize: 14 }}>{g.reviewsPct}% посадок</Text>} /></Card></Col>
      </Row>
      <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
        Оценки и жалобы — в разделе <Link to="/shift/reviews">«Жалобы и оценки»</Link>, подсказки в меню — на вкладке «ИИ-подсказки».
      </Text>
    </>
  )
}
