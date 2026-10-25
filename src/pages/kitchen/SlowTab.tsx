import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, Empty, Row, Spin, Statistic, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { readPeriod, writePeriod, type Period } from '../../lib/period'
import PeriodPicker from '../../components/PeriodPicker'
import type { SlowResponse } from './types'
import { timeIn } from '../hall/format'

const { Text, Paragraph } = Typography

// Долго готовились: от «ушло на кухню» до «готово» против норматива блюда.
export default function SlowTab() {
  const [params, setParams] = useSearchParams()
  const period = readPeriod(params)
  const [data, setData] = useState<SlowResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const d = await adminFetch<SlowResponse>('/api/admin/kitchen-slow', { query: { from: period.from, to: period.to } })
      if (id === reqId.current) { setData(d); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => { load() }, [load])
  const setPeriod = (p: Period) => setParams(writePeriod(params, p))
  const tz = data?.restaurant.timezone || 'Europe/Moscow'
  const s = data?.summary

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Paragraph type="secondary" style={{ maxWidth: 640, margin: 0 }}>
          Время считается от момента, когда заказ ушёл на кухню, до отметки «готово» в приложении официанта (позже — из
          кассовой системы кухни) и сравнивается с нормативом блюда из меню.
        </Paragraph>
        <PeriodPicker value={period} today={data?.today || period.to} onChange={setPeriod} />
      </div>
      {error && <Alert type="error" showIcon title="Не удалось загрузить" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginBottom: 12 }} />}
      {!data ? (!error && <Spin />) : (
        <Spin spinning={loading}>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Измерено блюд" value={s!.measured} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Дольше норматива" value={s!.late} suffix={s!.measured ? <Text type="secondary" style={{ fontSize: 14 }}>{s!.latePct}%</Text> : null} styles={{ content: s!.late ? { color: '#cf1322' } : undefined }} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Среднее опоздание" value={s!.late ? `${s!.avgDelayMin} мин` : '—'} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Без норматива в меню" value={s!.noNorm} /></Card></Col>
          </Row>
          {s!.measured === 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              title="За этот период нет отметок «готово»"
              description="Время готовности записывается, когда официант нажимает у блюда «готово» в приложении. Отчёт наполняется с момента обновления системы."
            />
          )}
          {s!.skipped > 0 && <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Не учтено {s!.skipped} отметок, поставленных позже 3 часов, — скорее всего, «готово» забыли нажать вовремя.</Text>}

          <Card size="small" title="По блюдам" style={{ marginBottom: 12 }}>
            <Table
              rowKey="dish"
              size="small"
              pagination={false}
              dataSource={data.dishes}
              locale={{ emptyText: <Empty description="Нет данных" /> }}
              columns={[
                { title: 'Блюдо', dataIndex: 'dish' },
                { title: 'Норматив', dataIndex: 'normMin', align: 'right', render: (v: number) => `${v} мин` },
                { title: 'Приготовлено', dataIndex: 'count', align: 'right' },
                { title: 'Дольше нормы', key: 'late', align: 'right', render: (_: unknown, d: SlowResponse['dishes'][0]) => (d.late ? <Tag color={d.latePct >= 50 ? 'red' : 'orange'}>{d.late} · {d.latePct}%</Tag> : <Tag color="green">0</Tag>) },
                { title: 'В среднем', dataIndex: 'avgActualMin', align: 'right', render: (v: number, d: SlowResponse['dishes'][0]) => <span style={{ color: v > d.normMin ? '#cf1322' : undefined }}>{v} мин</span> },
                { title: 'Максимум', dataIndex: 'maxActualMin', align: 'right', render: (v: number) => `${v} мин` },
              ]}
            />
          </Card>

          <Card size="small" title="Запоздавшие блюда">
            <Table
              rowKey="itemId"
              size="small"
              dataSource={data.lateItems}
              pagination={{ pageSize: 30, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="Всё готовилось в срок" /> }}
              columns={[
                { title: 'Когда', dataIndex: 'sentAt', render: (v: string) => `${dayjs(v).format('D MMM')}, ${timeIn(v, tz)}` },
                { title: 'Блюдо', dataIndex: 'dish', render: (v: string, i: SlowResponse['lateItems'][0]) => `${v}${i.quantity > 1 ? ` × ${i.quantity}` : ''}` },
                { title: 'Стол', dataIndex: 'tableNumber', render: (v: string | null) => (v ? `№ ${v}` : '—') },
                { title: 'Норматив', dataIndex: 'normMin', align: 'right', render: (v: number) => `${v} мин` },
                { title: 'Готовилось', dataIndex: 'actualMin', align: 'right', render: (v: number) => `${v} мин` },
                { title: 'Опоздание', dataIndex: 'delayMin', align: 'right', render: (v: number) => <Text type="danger">+{v} мин</Text> },
              ]}
            />
          </Card>
        </Spin>
      )}
    </div>
  )
}
