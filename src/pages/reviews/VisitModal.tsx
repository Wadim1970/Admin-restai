import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Col, Divider, Modal, Rate, Row, Spin, Tag, Tooltip, Typography } from 'antd'
import { CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { adminFetch } from '../../lib/adminApi'
import SessionDetails from '../hall/SessionDetails'
import { dateIn, duration, money, plural, reaction, timeIn } from '../hall/format'
import type { ReviewVisit } from './types'

const { Text } = Typography

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ background: '#fafafa', borderRadius: 8, padding: '8px 12px', height: '100%' }}>
      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{hint}</div>}
    </div>
  )
}

// Окно «Визит» у отзыва: только та посадка, за которую поставили оценку, —
// когда сидели, кто из гостей подтвердил телефон, заказ по местам, сколько
// ждали блюда, как быстро подходили на вызов.
export default function VisitModal({ reviewId, onClose }: { reviewId: number | null; onClose: () => void }) {
  const [data, setData] = useState<ReviewVisit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (reviewId == null) return
    let alive = true
    setData(null)
    setError('')
    adminFetch<ReviewVisit>('/api/admin/reviews', { query: { id: String(reviewId) } })
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [reviewId])

  const tz = data?.restaurant.timezone || 'Europe/Moscow'
  const r = data?.review
  const s = data?.session

  const verified = (data?.guests || []).filter((g) => g.verified)
  const seatGuests = Object.fromEntries((data?.guests || []).filter((g) => g.seat != null)
    .map((g) => [String(g.seat), g.verified ? (g.name || 'гость приложения') : 'без регистрации']))

  const waits = (s?.items || []).filter((i) => i.waitMin != null)
  const avgWait = waits.length ? Math.round(waits.reduce((a, i) => a + i.waitMin!, 0) / waits.length) : null
  const longest = waits.reduce<typeof waits[0] | null>((m, i) => (!m || i.waitMin! > m.waitMin! ? i : m), null)
  const late = waits.filter((i) => i.normMin && i.waitMin! > i.normMin).length

  const calls = (s?.calls || []).filter((c) => c.kind !== 'dessert')
  const answered = calls.filter((c) => c.reactionSec != null)
  const avgReaction = answered.length ? Math.round(answered.reduce((a, c) => a + c.reactionSec!, 0) / answered.length) : null

  return (
    <Modal
      open={reviewId != null}
      onCancel={onClose}
      width={760}
      title={r ? `Визит · стол № ${r.tableNumber ?? '?'}` : 'Визит'}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          {r?.tableId ? <Link to={`/shift/hall?date=${r.date}&table=${r.tableId}`} onClick={onClose}>Весь день этого стола</Link> : <span />}
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      )}
    >
      {error && <Alert type="error" showIcon title="Не удалось загрузить визит" description={error} />}
      {!data || !r ? (!error && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>) : (
        <div>
          <Text type="secondary">
            {dateIn(s?.startedAt || r.createdAt, tz)} · отзыв оставлен в {timeIn(r.createdAt, tz)}
          </Text>

          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 12px', margin: '10px 0 14px' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>Кухня {r.food != null ? <Rate disabled value={r.food} style={{ fontSize: 14 }} /> : <Text type="secondary">не оценили</Text>}</span>
              <span>Обслуживание {r.service != null ? <Rate disabled value={r.service} style={{ fontSize: 14 }} /> : <Text type="secondary">не оценили</Text>}</span>
              {r.complaint && <Tag color={r.severity === 'high' ? 'red' : 'orange'}>жалоба{r.about.length ? ` на ${r.about.map((a) => (a === 'kitchen' ? 'кухню' : 'сервис')).join(' и ')}` : ''}</Tag>}
              {r.resolvedAt && <Tag color="green" icon={<CheckCircleOutlined />}>разобрана</Tag>}
            </div>
            {r.comment ? <div style={{ marginTop: 6, fontSize: 15 }}>«{r.comment}»</div> : <Text type="secondary">без комментария</Text>}
            {r.resolvedNote && <div style={{ marginTop: 4, fontSize: 13 }}><Text type="success">Что сделали: </Text>{r.resolvedNote}</div>}
          </div>

          {!s ? (
            <Alert
              type="info"
              showIcon
              title="Посадку для этого отзыва не нашли"
              description={r.tableId
                ? 'Официант не открывал стол в приложении, или отзыв оставили больше чем через час после закрытия стола.'
                : `Стола № ${r.tableNumber ?? '?'} нет в схеме зала.`}
            />
          ) : (
            <>
              <Row gutter={[8, 8]}>
                <Col xs={12} md={8}>
                  <Tile label="Время обслуживания" value={`${timeIn(s.startedAt, tz)}–${s.endedAt ? timeIn(s.endedAt, tz) : 'сейчас'}`} hint={duration(s.durationMin)} />
                </Col>
                <Col xs={12} md={8}>
                  <Tile
                    label="Гостей"
                    value={s.guestCount ?? '—'}
                    hint={verified.length ? `подтвердили телефон: ${verified.length}` : 'никто не подтвердил телефон'}
                  />
                </Col>
                <Col xs={12} md={8}>
                  <Tile label="Официант" value={s.waiter.name || <Text type="danger">не записан</Text>} hint={s.waiter.name && s.waiter.inferred ? 'по закреплению стола' : undefined} />
                </Col>
                <Col xs={12} md={8}>
                  <Tile label="Счёт" value={money(s.total)} hint={s.billType ? (s.billType === 'personal' ? 'раздельный' : 'общий') : undefined} />
                </Col>
                <Col xs={12} md={8}>
                  <Tile
                    label="Ожидание блюд"
                    value={avgWait != null ? `в среднем ${avgWait} мин` : '—'}
                    hint={longest
                      ? <>дольше всего: {longest.name} — {longest.waitMin} мин{late ? <Text type="danger">{` · дольше норматива: ${late}`}</Text> : ''}</>
                      : s.items.length ? 'отметок «готово» нет' : 'заказа не было'}
                  />
                </Col>
                <Col xs={12} md={8}>
                  <Tile
                    label="Реакция на вызов"
                    value={calls.length === 0 ? 'вызовов не было' : avgReaction != null ? `в среднем ${reaction(avgReaction)}` : <Text type="danger">без ответа</Text>}
                    hint={calls.length
                      ? `${calls.length} ${plural(calls.length, 'вызов', 'вызова', 'вызовов')}${calls.length > answered.length ? `, без ответа ${calls.length - answered.length}` : ''}`
                      : undefined}
                  />
                </Col>
              </Row>
              {s.firstOrderMin != null && (
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  Первый заказ ушёл на кухню через {duration(s.firstOrderMin)} после посадки.
                </Text>
              )}

              <Divider titlePlacement="start" style={{ margin: '14px 0 8px' }}>Гости</Divider>
              {data.guests.length === 0 ? (
                <Text type="secondary">С телефона никто не заказывал — заказ принимал официант.</Text>
              ) : data.guests.map((g) => (
                <div key={String(g.seat)} style={{ fontSize: 13, margin: '2px 0' }}>
                  <Text strong>{g.seat != null ? `Место ${g.seat}` : 'Без места'}</Text>
                  {' — '}
                  {g.verified ? (
                    <>
                      <Tooltip title="Подтвердил телефон по SMS в приложении"><SafetyCertificateOutlined style={{ color: '#52c41a' }} /></Tooltip>{' '}
                      {g.name || 'Гость приложения'}{g.phone && <Text type="secondary">, {g.phone}</Text>}
                    </>
                  ) : <Text type="secondary">заказывал с телефона, без регистрации</Text>}
                </div>
              ))}

              <Divider titlePlacement="start" style={{ margin: '14px 0 8px' }}>Заказ и вызовы</Divider>
              <SessionDetails s={s} tz={tz} seatGuests={seatGuests} hideReview hideSummary />
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
