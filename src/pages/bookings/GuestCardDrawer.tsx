import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, Col, Descriptions, Drawer, Empty, Progress, Rate, Row, Spin, Statistic, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { RES_STATUS, money, timeIn } from '../hall/format'
import type { GuestCard } from './types'

const { Text, Title } = Typography

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const LEVEL_COLORS: Record<string, string> = { bronze: '#ad6800', silver: '#8c8c8c', gold: '#d4b106', platinum: '#2f54eb' }

// Карточка гостя брони: только его история в этом ресторане.
export default function GuestCardDrawer({ phone, onClose }: { phone: string | null; onClose: () => void }) {
  const [card, setCard] = useState<GuestCard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!phone) return
    let alive = true
    setCard(null)
    setError('')
    adminFetch<GuestCard>('/api/admin/booking-guest', { query: { phone } })
      .then((c) => { if (alive) setCard(c) })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [phone])

  const tz = card?.restaurant.timezone || 'Europe/Moscow'
  const h = card?.history
  const l = card?.loyalty

  return (
    <Drawer
      open={!!phone}
      onClose={onClose}
      size="large"
      title={card?.found ? (card.name || 'Гость без имени') : 'Гость'}
      extra={phone && <a href={`tel:${card?.phone || phone}`}>{card?.phone || phone}</a>}
    >
      {error && <Alert type="error" showIcon title="Не удалось загрузить" description={error} />}
      {!card && !error && <Spin />}
      {card && !card.found && <Empty description="Гость по этому номеру у нас ещё не был и не бронировал" />}
      {card?.found && h && (
        <div>
          <div style={{ marginBottom: 12 }}>
            {card.app ? <Tag color="purple">📱 в приложении{card.app.since ? ` с ${dayjs(card.app.since).format('MMMM YYYY')}` : ''}</Tag> : <Tag>не в приложении — история по броням</Tag>}
            {h.visits >= 3 && <Tag color="gold">★ постоянный гость</Tag>}
            {h.reservations.noShow > 0 && <Tag color="red">⚠ не приходил по брони: {h.reservations.noShow}</Tag>}
          </div>

          {l && (
            <Card
              size="small"
              style={{ marginBottom: 12, borderColor: l.level ? LEVEL_COLORS[l.level.key] : undefined }}
              title={<span>💎 Программа лояльности <Tag color="orange" style={{ marginLeft: 8 }}>демо</Tag></span>}
            >
              {l.level ? (
                <Row gutter={12} align="middle">
                  <Col span={8}><Statistic title="Уровень" value={l.level.name} styles={{ content: { color: LEVEL_COLORS[l.level.key] } }} /></Col>
                  <Col span={8}><Statistic title="Кешбэк" value={`${l.level.cashbackPct}%`} /></Col>
                  <Col span={8}><Statistic title="Баллы" value={l.balance.toLocaleString('ru-RU')} /></Col>
                  {l.next && (
                    <Col span={24} style={{ marginTop: 8 }}>
                      <Text type="secondary">До уровня «{l.next.name}» — {l.next.visitsLeft} {l.next.visitsLeft === 1 ? 'визит' : l.next.visitsLeft < 5 ? 'визита' : 'визитов'}</Text>
                      <Progress percent={Math.round((h.visits / (h.visits + l.next.visitsLeft)) * 100)} showInfo={false} size="small" />
                    </Col>
                  )}
                </Row>
              ) : <Text type="secondary">Участник программы, визитов ещё не было — уровень появится после первого.</Text>}
              <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                Пример работы: уровни по числу визитов, кешбэк баллами. Правила задаст ресторан при подключении программы.
                {card.app && card.app.points > 0 ? ` Баллы за викторины в приложении: ${card.app.points}.` : ''}
              </Text>
            </Card>
          )}

          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Визитов" value={h.visits} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Средний чек" value={h.avgCheck ? money(h.avgCheck) : '—'} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Всего потратил" value={h.spent ? money(h.spent) : '—'} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Обычно гостей" value={h.avgParty ?? '—'} /></Card></Col>
          </Row>

          <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Последний визит">{h.lastVisit ? dayjs(h.lastVisit).format('D MMMM YYYY') : '—'}{h.firstVisit && h.firstVisit !== h.lastVisit ? <Text type="secondary"> · впервые {dayjs(h.firstVisit).format('D MMMM YYYY')}</Text> : null}</Descriptions.Item>
            {card.app?.birthdayDay && card.app.birthdayMonth && <Descriptions.Item label="День рождения">🎂 {card.app.birthdayDay} {MONTHS[card.app.birthdayMonth - 1]}</Descriptions.Item>}
            {card.app?.dislikes && <Descriptions.Item label="Не ест"><Text type="danger">{card.app.dislikes}</Text></Descriptions.Item>}
            {card.tastes && card.tastes.length > 0 && <Descriptions.Item label="Предпочтения">{card.tastes.map((t) => <Tag key={t}>{t}</Tag>)}</Descriptions.Item>}
            {h.favoriteTables.length > 0 && <Descriptions.Item label="Обычно садится">{h.favoriteTables.map((t) => `стол № ${t.number} (${t.times})`).join(', ')}</Descriptions.Item>}
            {h.waiters.length > 0 && <Descriptions.Item label="Обслуживали">{h.waiters.map((w, i) => <span key={w.id}>{i ? ', ' : ''}<Link to={`/shift/waiters/${w.id}`}>{w.name || 'официант'}</Link> ({w.times})</span>)}</Descriptions.Item>}
            <Descriptions.Item label="Брони">{h.reservations.total} · пришёл {h.reservations.came}{h.reservations.noShow ? <Text type="danger"> · не пришёл {h.reservations.noShow}</Text> : null}{h.reservations.cancelled ? ` · отменил ${h.reservations.cancelled}` : ''}</Descriptions.Item>
          </Descriptions>

          <Title level={5}>Что любит заказывать</Title>
          {h.topDishes.length === 0
            ? <Text type="secondary">Заказов этого гостя пока не видно.</Text>
            : h.topDishes.map((d) => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{d.name}</span>
                <Text type="secondary">{d.times} шт. · в {d.visits} {d.visits === 1 ? 'визите' : 'визитах'}</Text>
              </div>
            ))}

          {card.upcoming && card.upcoming.length > 0 && (
            <>
              <Title level={5} style={{ marginTop: 16 }}>Ближайшие брони</Title>
              {card.upcoming.map((r) => (
                <div key={r.id}>{dayjs(r.startsAt).format('D MMMM')}, {timeIn(r.startsAt, tz)}–{timeIn(r.endsAt, tz)} · {r.guestCount} чел.{r.comment ? <Text type="secondary"> · {r.comment}</Text> : null}</div>
              ))}
            </>
          )}

          {card.visits && card.visits.length > 0 && (
            <>
              <Title level={5} style={{ marginTop: 16 }}>Визиты</Title>
              {card.visits.map((v) => (
                <div key={v.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{dayjs(v.startedAt).format('D MMMM YYYY')}, {timeIn(v.startedAt, tz)}{v.tableNumber != null && <Text type="secondary"> · стол № {v.tableNumber}</Text>}{v.waiterName && <Text type="secondary"> · {v.waiterName}</Text>}</span>
                    <Text strong>{money(v.spent)}{v.scope === 'table' && <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}> · весь стол</Text>}</Text>
                  </div>
                  {v.items.length > 0 && <Text type="secondary" style={{ fontSize: 13 }}>{v.items.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join(', ')}</Text>}
                  {v.tableNumber != null && v.sessionId && <div><Link to={`/shift/hall?date=${v.date}`} style={{ fontSize: 12 }}>Зал в этот день</Link></div>}
                </div>
              ))}
            </>
          )}

          {card.reviews && card.reviews.length > 0 && (
            <>
              <Title level={5} style={{ marginTop: 16 }}>Отзывы</Title>
              {card.reviews.map((r) => (
                <div key={r.id} style={{ padding: '4px 0' }}>
                  <Text type="secondary">{dayjs(r.createdAt).format('D MMMM')}</Text>
                  {r.food != null && <span style={{ marginLeft: 8 }}>Кухня <Rate disabled value={r.food} style={{ fontSize: 12 }} /></span>}
                  {r.service != null && <span style={{ marginLeft: 8 }}>Сервис <Rate disabled value={r.service} style={{ fontSize: 12 }} /></span>}
                  {r.comment && <div>«{r.comment}»</div>}
                </div>
              ))}
            </>
          )}

          {card.reservations && card.reservations.length > 0 && (
            <>
              <Title level={5} style={{ marginTop: 16 }}>История броней</Title>
              {card.reservations.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{dayjs(r.startsAt).format('D MMM YYYY')}, {timeIn(r.startsAt, tz)} · {r.guestCount} чел.</span>
                  <Tag color={RES_STATUS[r.status]?.color}>{RES_STATUS[r.status]?.label || r.status}</Tag>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}
