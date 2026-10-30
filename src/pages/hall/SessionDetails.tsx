import { useMemo } from 'react'
import { Descriptions, Rate, Tag, Tooltip, Typography } from 'antd'
import type { TableSession } from './types'
import { callLabel, duration, money, reaction, shortName, timeIn } from './format'

const { Text } = Typography

// Посадка целиком: официант, гости, время, чек, заказ по местам (сколько
// ждали каждое блюдо), вызовы, доп. продажи, отзыв. Общая для истории стола,
// карточки официанта и окна визита у отзыва. seatGuests — кто сидел на месте
// (подпись к «Место N»); hideSummary и hideReview — официант, время, чек
// и отзыв уже показаны выше.
export default function SessionDetails({ s, tz, seatGuests, hideSummary, hideReview }: {
  s: TableSession; tz: string; seatGuests?: Record<string, string>; hideSummary?: boolean; hideReview?: boolean
}) {
  const seats = useMemo(() => {
    const m = new Map<string, typeof s.items>()
    for (const it of s.items) {
      const k = it.seat == null ? 'Без места' : `Место ${it.seat}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(it)
    }
    return [...m.entries()]
  }, [s])
  const guestOf = (seat: string) => seatGuests?.[seat.replace('Место ', '')]

  return (
    <div>
      {!hideSummary && <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
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
      </Descriptions>}

      {seats.length === 0 ? <Text type="secondary">Заказа не было</Text> : seats.map(([seat, items]) => (
        <div key={seat} style={{ marginBottom: 8 }}>
          <Text strong>{seat}</Text>{guestOf(seat) && <Text type="secondary"> · {guestOf(seat)}</Text>}
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span>
                {it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ''}
                {it.modifiers.length > 0 && <Text type="secondary"> · {it.modifiers.join(', ')}</Text>}
                {it.comment && <Text type="secondary"> · «{it.comment}»</Text>}
                {it.waitMin != null && (
                  <Tooltip title={`Ушло на кухню ${timeIn(it.sentAt!, tz)}, готово ${timeIn(it.readyAt!, tz)}${it.normMin ? ` · норматив ${it.normMin} мин` : ''}`}>
                    <Text type={it.normMin && it.waitMin > it.normMin ? 'danger' : 'secondary'}> · ждали {it.waitMin} мин</Text>
                  </Tooltip>
                )}
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

      {s.review && !hideReview && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <Text strong>Отзыв: </Text>
          кухня <Rate disabled value={s.review.food || 0} style={{ fontSize: 12 }} />, сервис <Rate disabled value={s.review.service || 0} style={{ fontSize: 12 }} />
          {s.review.comment && <div>«{s.review.comment}»</div>}
        </div>
      )}
    </div>
  )
}
