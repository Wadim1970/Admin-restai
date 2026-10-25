import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, Empty, Input, Modal, Rate, Row, Segmented, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { readPeriod, writePeriod, type Period } from '../../lib/period'
import PeriodPicker from '../../components/PeriodPicker'
import BarChart from '../../components/BarChart'
import type { Review, ReviewsResponse } from './types'
import { timeIn } from '../hall/format'

const { Title, Text } = Typography

type Show = 'complaints' | 'unresolved' | 'all' | 'comments'

// Распределение оценок 5…1 — полосками, число справа.
function Distribution({ title, scale }: { title: string; scale: ReviewsResponse['summary']['food'] }) {
  const max = Math.max(1, ...Object.values(scale.distribution))
  return (
    <Card size="small" title={<span>{title} {scale.avg != null && <Text strong style={{ marginLeft: 8 }}>★ {scale.avg}</Text>} <Text type="secondary" style={{ fontWeight: 400 }}>· оценок {scale.count}</Text></span>}>
      {[5, 4, 3, 2, 1].map((v) => {
        const n = scale.distribution[v] || 0
        return (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
            <span style={{ width: 28, color: '#5c6070' }}>{v} ★</span>
            <div style={{ flex: 1, background: '#f4f5f7', borderRadius: 4, height: 12 }}>
              <div style={{ width: `${(n / max) * 100}%`, height: '100%', borderRadius: 4, background: v <= 3 ? '#ff7875' : '#1677ff' }} />
            </div>
            <span style={{ width: 28, textAlign: 'right' }}>{n}</span>
          </div>
        )
      })}
    </Card>
  )
}

export default function ReviewsPage() {
  const [params, setParams] = useSearchParams()
  const period = readPeriod(params)
  const show = (params.get('show') as Show) || 'complaints'
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState<Review | null>(null)
  const [note, setNote] = useState('')
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const d = await adminFetch<ReviewsResponse>('/api/admin/reviews', { query: { from: period.from, to: period.to } })
      if (id === reqId.current) { setData(d); setError('') }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => { load() }, [load])

  const setPeriod = (p: Period) => setParams(writePeriod(params, p))
  const setShow = (s: Show) => { const n = new URLSearchParams(params); n.set('show', s); setParams(n) }
  const tz = data?.restaurant.timezone || 'Europe/Moscow'

  const rows = useMemo(() => (data?.reviews || []).filter((r) => (
    show === 'all' ? true : show === 'comments' ? !!r.comment : show === 'unresolved' ? r.complaint && !r.resolvedAt : r.complaint
  )), [data, show])

  const resolve = async (r: Review, resolved: boolean, text = '') => {
    try {
      await adminFetch('/api/admin/reviews', { method: 'PATCH', body: { id: r.id, resolved, note: text } })
      message.success(resolved ? 'Жалоба отмечена разобранной' : 'Жалоба снова открыта')
      setResolving(null)
      setNote('')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const s = data?.summary
  const multiDay = (data?.period.days || 0) > 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Жалобы и оценки{data ? ` · ${data.restaurant.name}` : ''}</Title>
        <PeriodPicker value={period} today={data?.today || period.to} onChange={setPeriod} />
      </div>
      {error && <Alert type="error" showIcon title="Не удалось загрузить" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginBottom: 16 }} />}
      {!data || !s ? (!error && <Spin />) : (
        <Spin spinning={loading}>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Отзывов" value={s.reviews} suffix={s.withComment ? <Text type="secondary" style={{ fontSize: 14 }}>с комментарием {s.withComment}</Text> : null} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Кухня" value={s.food.avg ?? '—'} prefix={s.food.avg != null ? '★' : undefined} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Сервис" value={s.service.avg ?? '—'} prefix={s.service.avg != null ? '★' : undefined} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Жалоб (оценка 3 и ниже)" value={s.complaints} suffix={<Text type={s.unresolved ? 'danger' : 'secondary'} style={{ fontSize: 14 }}>{s.unresolved ? `не разобрано ${s.unresolved}` : s.complaints ? 'все разобраны' : ''}</Text>} styles={{ content: s.complaints ? { color: '#cf1322' } : undefined }} /></Card></Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} md={multiDay ? 8 : 12}><Distribution title="Кухня" scale={s.food} /></Col>
            <Col xs={24} md={multiDay ? 8 : 12}><Distribution title="Сервис" scale={s.service} /></Col>
            {multiDay && (
              <Col xs={24} md={8}>
                <Card size="small" title="Жалобы по дням">
                  <BarChart
                    height={110}
                    format={(v) => String(v)}
                    bars={data.byDay.map((d) => ({ key: d.date, label: data.byDay.length > 14 ? dayjs(d.date).format('D') : dayjs(d.date).format('dd D'), value: d.complaints, tip: `${dayjs(d.date).format('D MMMM')}: отзывов ${d.reviews}, жалоб ${d.complaints}` }))}
                  />
                </Card>
              </Col>
            )}
          </Row>

          <Card size="small" style={{ marginBottom: 12 }} title={(
            <Segmented
              value={show}
              onChange={(v) => setShow(v as Show)}
              options={[
                { value: 'complaints', label: `Жалобы (${s.complaints})` },
                { value: 'unresolved', label: `Не разобраны (${s.unresolved})` },
                { value: 'comments', label: `С комментарием (${s.withComment})` },
                { value: 'all', label: `Все (${s.reviews})` },
              ]}
            />
          )}>
            {rows.length === 0 ? <Empty description={show === 'unresolved' ? 'Все жалобы разобраны' : 'Отзывов нет'} /> : rows.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 0', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ flex: '1 1 420px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text type="secondary">{dayjs(r.createdAt).format('D MMM')}, {timeIn(r.createdAt, tz)}</Text>
                    {r.food != null && <span>Кухня <Rate disabled value={r.food} style={{ fontSize: 13 }} /></span>}
                    {r.service != null && <span>Сервис <Rate disabled value={r.service} style={{ fontSize: 13 }} /></span>}
                    {r.complaint && <Tag color={r.severity === 'high' ? 'red' : 'orange'}>жалоба{r.about.length ? ` на ${r.about.map((a) => (a === 'kitchen' ? 'кухню' : 'сервис')).join(' и ')}` : ''}</Tag>}
                    {r.resolvedAt && <Tag color="green" icon={<CheckCircleOutlined />}>разобрана</Tag>}
                  </div>
                  {r.comment ? <div style={{ margin: '6px 0', fontSize: 15 }}>«{r.comment}»</div> : <Text type="secondary" style={{ display: 'block', margin: '6px 0' }}>без комментария</Text>}
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {r.tableNumber ? `Стол № ${r.tableNumber}` : 'Стол неизвестен'}
                    {r.session && ` · посадка ${timeIn(r.session.startedAt, tz)}–${r.session.endedAt ? timeIn(r.session.endedAt, tz) : 'сейчас'}${r.session.guestCount ? `, гостей ${r.session.guestCount}` : ''}`}
                    {r.waiter?.name && ` · официант ${r.waiter.name}${r.waiter.inferred ? ' (по закреплению)' : ''}`}
                  </Text>
                  {r.resolvedNote && <div style={{ marginTop: 4, fontSize: 13 }}><Text type="success">Что сделали: </Text>{r.resolvedNote}</div>}
                </div>
                <Space wrap style={{ alignSelf: 'center' }}>
                  {r.tableId && <Link to={`/shift/hall?date=${r.date}&table=${r.tableId}`}>История стола</Link>}
                  {r.waiter?.id && <Link to={`/shift/waiters/${r.waiter.id}?p=day&from=${r.date}`}>Официант</Link>}
                  {r.complaint && (r.resolvedAt
                    ? <Button size="small" icon={<UndoOutlined />} onClick={() => resolve(r, false)}>Открыть снова</Button>
                    : <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => { setResolving(r); setNote('') }}>Разобрана</Button>)}
                </Space>
              </div>
            ))}
          </Card>

          {data.byWaiter.length > 0 && (
            <Card size="small" title="По официантам">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={data.byWaiter}
                columns={[
                  { title: 'Официант', dataIndex: 'name', render: (n: string | null, w: ReviewsResponse['byWaiter'][0]) => <Link to={`/shift/waiters/${w.id}?${writePeriod(new URLSearchParams(), period)}`}>{n || 'Без имени'}</Link> },
                  { title: 'Отзывов', dataIndex: 'reviews', align: 'right' },
                  { title: 'Сервис', dataIndex: 'serviceAvg', align: 'right', render: (v: number | null) => (v != null ? `★ ${v}` : '—') },
                  { title: 'Жалоб', dataIndex: 'complaints', align: 'right', render: (v: number) => (v ? <Text type="danger">{v}</Text> : 0) },
                ]}
              />
            </Card>
          )}
        </Spin>
      )}

      <Modal
        open={!!resolving}
        title="Жалоба разобрана"
        okText="Сохранить"
        cancelText="Отмена"
        onOk={() => resolving && resolve(resolving, true, note)}
        onCancel={() => setResolving(null)}
      >
        {resolving?.comment && <p>«{resolving.comment}»</p>}
        <Input.TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Что сделали: извинились, блюдо за счёт заведения, поговорили с поваром…"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={500}
        />
      </Modal>
    </div>
  )
}
