import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, Row, Spin, Statistic, Table, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { adminFetch } from '../../lib/adminApi'
import { readPeriod, writePeriod, type Period } from '../../lib/period'
import PeriodPicker from '../../components/PeriodPicker'
import type { StaffResponse, WaiterRow } from './types'
import { duration, money, plural } from '../hall/format'
import { reactionShort } from './compare'

const { Title, Text } = Typography

export default function WaitersPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const period = readPeriod(params)
  const [data, setData] = useState<StaffResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const d = await adminFetch<StaffResponse>('/api/admin/staff', { query: { from: period.from, to: period.to } })
      if (id === reqId.current) { setData(d); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => { load() }, [load])

  const setPeriod = (p: Period) => setParams(writePeriod(params, p))
  const today = data?.today || period.to
  const t = data?.restaurantTotals

  const columns: ColumnsType<WaiterRow> = [
    {
      title: 'Официант', dataIndex: 'name', fixed: 'left', width: 180,
      render: (name: string, w) => (
        <div>
          <a>{name}</a>
          {w.tables.length > 0 && <div><Text type="secondary" style={{ fontSize: 12 }}>столы {w.tables.join(', ')}</Text></div>}
        </div>
      ),
    },
    { title: 'Дней', dataIndex: 'workDays', align: 'right', sorter: (a, b) => a.workDays - b.workDays, width: 70 },
    { title: 'Посадок', dataIndex: 'sessions', align: 'right', sorter: (a, b) => a.sessions - b.sessions, width: 105 },
    { title: 'Гостей', dataIndex: 'guests', align: 'right', sorter: (a, b) => a.guests - b.guests, width: 80 },
    { title: 'Выручка', dataIndex: 'revenue', align: 'right', render: money, sorter: (a, b) => a.revenue - b.revenue, defaultSortOrder: 'descend', width: 120 },
    { title: 'Средний чек', dataIndex: 'avgCheck', align: 'right', render: (v: number) => (v ? money(v) : '—'), sorter: (a, b) => a.avgCheck - b.avgCheck, width: 120 },
    { title: 'Чек на гостя', dataIndex: 'avgGuestCheck', align: 'right', render: (v: number) => (v ? money(v) : '—'), sorter: (a, b) => a.avgGuestCheck - b.avgGuestCheck, width: 120 },
    {
      title: <Tooltip title="По подсказкам ИИ: сколько раз предложил и сколько гости взяли">Доп. продажи</Tooltip>,
      key: 'upsell', align: 'right', width: 130,
      sorter: (a, b) => a.upsell.accepted - b.upsell.accepted,
      render: (_, w) => (w.upsell.offered ? <span>{w.upsell.accepted} из {w.upsell.offered} <Text type="secondary">({w.upsell.rate}%)</Text></span> : '—'),
    },
    {
      title: 'Реакция на вызов', dataIndex: 'avgReactionSec', align: 'right', width: 130,
      sorter: (a, b) => (a.avgReactionSec ?? 1e9) - (b.avgReactionSec ?? 1e9),
      render: (v: number | null, w) => (
        <span>{reactionShort(v)}{w.unansweredCalls > 0 && <Text type="danger"> · {w.unansweredCalls} без ответа</Text>}</span>
      ),
    },
    {
      title: 'Оценка', dataIndex: 'serviceRating', align: 'right', width: 90,
      sorter: (a, b) => (a.serviceRating ?? 0) - (b.serviceRating ?? 0),
      render: (v: number | null, w) => (v ? <Tooltip title={`Оценка сервиса гостями, отзывов: ${w.reviews}`}>★ {v}</Tooltip> : '—'),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Официанты{data ? ` · ${data.restaurant.name}` : ''}</Title>
        <PeriodPicker value={period} today={today} onChange={setPeriod} />
      </div>

      {error && <Alert type="error" showIcon title="Не удалось загрузить" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginBottom: 16 }} />}
      {!data ? (!error && <Spin />) : (
        <Spin spinning={loading}>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={4}><Card size="small"><Statistic title="Посадок" value={t!.sessions} /></Card></Col>
            <Col xs={12} md={4}><Card size="small"><Statistic title="Выручка" value={money(t!.revenue)} /></Card></Col>
            <Col xs={12} md={4}><Card size="small"><Statistic title="Средний чек" value={t!.avgCheck ? money(t!.avgCheck) : '—'} /></Card></Col>
            <Col xs={12} md={4}><Card size="small"><Statistic title="Доп. продажи по ИИ" value={t!.upsell.offered ? `${t!.upsell.accepted} из ${t!.upsell.offered}` : '—'} suffix={t!.upsell.offered ? <Text type="secondary" style={{ fontSize: 14 }}>{t!.upsell.rate}%</Text> : null} /></Card></Col>
            <Col xs={12} md={4}><Card size="small"><Statistic title="Реакция на вызов" value={reactionShort(t!.avgReactionSec)} /></Card></Col>
            <Col xs={12} md={4}><Card size="small"><Statistic title="Средняя посадка" value={t!.avgDurationMin ? duration(t!.avgDurationMin) : '—'} /></Card></Col>
          </Row>

          {t!.unattributed.sessions > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={`${t!.unattributed.sessions} ${plural(t!.unattributed.sessions, 'посадка', 'посадки', 'посадок')} без официанта (${money(t!.unattributed.revenue)})`}
              description="Стол ни за кем не был закреплён, и официант не отметился в посадке. Закрепите официантов за столами в разделе «Зал»."
            />
          )}

          <Card size="small">
            <Table<WaiterRow>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={data.waiters}
              pagination={false}
              scroll={{ x: 1100 }}
              onRow={(w) => ({ onClick: () => navigate(`/shift/waiters/${w.id}?${writePeriod(new URLSearchParams(), period)}`), style: { cursor: 'pointer' } })}
              rowClassName={(w) => (w.sessions === 0 && w.workDays === 0 ? 'row-idle' : '')}
              locale={{ emptyText: 'Официантов пока нет' }}
            />
          </Card>
        </Spin>
      )}
    </div>
  )
}
