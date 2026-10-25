import { Tag, Tooltip } from 'antd'
import type { GuestBadges } from './types'

// Отметки гостя брони: бывал, приложение, лояльность, день рождения, не приходил.
export function guestIcons(g: GuestBadges) {
  const out: { key: string; icon: string; tip: string }[] = []
  if (g.regular) out.push({ key: 'regular', icon: '★', tip: `Постоянный гость: ${g.visits} визитов` })
  else if (g.known) out.push({ key: 'known', icon: '☆', tip: g.visits ? `Уже был у нас: ${g.visits} ${g.visits === 1 ? 'визит' : 'визита'}` : 'Уже приходил по брони' })
  if (g.app) out.push({ key: 'app', icon: '📱', tip: 'Пользуется приложением' })
  if (g.birthdayIn != null) out.push({ key: 'bday', icon: '🎂', tip: g.birthdayIn === 0 ? 'День рождения в этот день' : g.birthdayIn > 0 ? `День рождения через ${g.birthdayIn} дн.` : `День рождения был ${-g.birthdayIn} дн. назад` })
  if (g.noShows > 0) out.push({ key: 'noshow', icon: '⚠', tip: `Не приходил по брони: ${g.noShows} раз` })
  return out
}

export default function GuestMarks({ guest, compact = false }: { guest: GuestBadges; compact?: boolean }) {
  const icons = guestIcons(guest)
  if (compact) {
    return <span>{icons.map((i) => <Tooltip key={i.key} title={i.tip}><span style={{ marginRight: 2 }}>{i.icon}</span></Tooltip>)}</span>
  }
  return (
    <span>
      {guest.regular ? <Tag color="gold">★ постоянный · {guest.visits}</Tag> : guest.known ? <Tag color="blue">☆ уже был{guest.visits ? ` · ${guest.visits}` : ''}</Tag> : null}
      {guest.app && <Tag color="purple">📱 приложение</Tag>}
      {guest.loyalty && <Tooltip title="Демо программы лояльности"><Tag color="geekblue">💎 {guest.loyalty}</Tag></Tooltip>}
      {guest.birthdayIn != null && <Tooltip title={icons.find((i) => i.key === 'bday')?.tip}><Tag color="magenta">🎂 день рождения</Tag></Tooltip>}
      {guest.noShows > 0 && <Tag color="red">⚠ не приходил · {guest.noShows}</Tag>}
    </span>
  )
}
