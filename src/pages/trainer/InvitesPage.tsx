import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Input, InputNumber, Modal, Popconfirm, Space, Spin, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CopyOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons'
import QRCode from 'qrcode'
import dayjs from 'dayjs'
import { ApiError } from '../../lib/adminApi'
import { trainerFetch, TRAINER_API, type Invite, type InviteState, type Member } from './trainerApi'

const { Title, Text } = Typography

const STATE: Record<InviteState, { label: string; color: string }> = {
  ok: { label: 'Ждёт официанта', color: 'blue' },
  used: { label: 'Использован', color: 'green' },
  expired: { label: 'Истёк', color: 'default' },
  revoked: { label: 'Отозван', color: 'red' },
  missing: { label: '—', color: 'default' },
}

const ACTOR_KEY = 'restai_trainer_actor'
const readActor = () => { try { return localStorage.getItem(ACTOR_KEY) || '' } catch { return '' } }

async function copy(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(ok)
  } catch {
    message.info(text) // нет доступа к буферу — показываем текст, чтобы скопировали вручную
  }
}

// Окно с QR-кодом и кодом: администратор показывает экран или присылает официанту.
function QrModal({ invite, onClose }: { invite: Invite | null; onClose: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    setSrc('')
    if (invite?.joinUrl) void QRCode.toDataURL(invite.joinUrl, { margin: 1, width: 280, errorCorrectionLevel: 'M' }).then(setSrc)
  }, [invite])
  return (
    <Modal open={!!invite} onCancel={onClose} footer={null} title="Приглашение в тренажёр" width={360} centered>
      {invite && (
        <div style={{ textAlign: 'center' }}>
          {invite.joinUrl
            ? (src ? <img src={src} alt={`QR-код приглашения ${invite.codeFormatted}`} width={280} height={280} /> : <Spin />)
            : <Alert type="warning" showIcon style={{ textAlign: 'left' }} title="QR недоступен" description="На сервере тренажёра не задан TRAINER_PUBLIC_URL (адрес приложения). Пока передайте официанту код." />}
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, margin: '8px 0' }}>{invite.codeFormatted}</div>
          <Text type="secondary">Действует до {dayjs(invite.expiresAt).format('D MMMM, HH:mm')}. Один код — один официант.</Text>
          <div style={{ marginTop: 12 }}>
            <Space wrap style={{ justifyContent: 'center' }}>
              {invite.joinUrl && <Button icon={<CopyOutlined />} onClick={() => void copy(invite.joinUrl as string, 'Ссылка скопирована')}>Скопировать ссылку</Button>}
              <Button icon={<CopyOutlined />} onClick={() => void copy(invite.codeFormatted, 'Код скопирован')}>Скопировать код</Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Раздел «Обучение → Приглашения»: коды для официантов и список тех, кто уже зарегистрировался.
export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [count, setCount] = useState<number | null>(1)
  const [days, setDays] = useState<number | null>(7)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<Invite | null>(null)

  const load = useCallback(async () => {
    try {
      const [i, m] = await Promise.all([
        trainerFetch<{ invites: Invite[] }>('/api/admin/invites'),
        trainerFetch<{ members: Member[] }>('/api/admin/members'),
      ])
      setInvites(i.invites)
      setMembers(m.members)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные')
      setInvites((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const r = await trainerFetch<{ invites: Invite[] }>('/api/admin/invites', {
        method: 'POST', body: { count: count ?? 1, days: days ?? 7, note, actor: readActor() || 'администратор' },
      })
      message.success(r.invites.length === 1 ? 'Код создан' : `Создано кодов: ${r.invites.length}`)
      setNote('')
      await load()
      if (r.invites.length === 1) setQr(r.invites[0])
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось создать коды')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      await trainerFetch('/api/admin/invites', { method: 'DELETE', query: { id } })
      message.success('Код отозван')
      await load()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось отозвать код')
    }
  }

  const inviteColumns: ColumnsType<Invite> = [
    { title: 'Код', dataIndex: 'codeFormatted', render: (c: string) => <Text strong style={{ letterSpacing: 1 }}>{c}</Text> },
    { title: 'Статус', key: 'state', render: (_, r) => <Tag color={STATE[r.state].color}>{STATE[r.state].label}{r.state === 'used' && r.usedBy ? ` — ${r.usedBy}` : ''}</Tag> },
    { title: 'Пометка', dataIndex: 'note', render: (n: string | null) => n || '—', responsive: ['md'] },
    { title: 'Действует до', dataIndex: 'expiresAt', render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm'), responsive: ['lg'] },
    {
      title: '', key: 'actions', align: 'right',
      render: (_, r) => r.state === 'ok' ? (
        <Space>
          <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQr(r)}>{r.joinUrl ? 'QR' : 'Код'}</Button>
          <Popconfirm title="Отозвать код?" description="По нему больше нельзя будет зарегистрироваться." okText="Отозвать" cancelText="Отмена" onConfirm={() => void revoke(r.id)}>
            <Button size="small" danger>Отозвать</Button>
          </Popconfirm>
        </Space>
      ) : null,
    },
  ]

  const memberColumns: ColumnsType<Member> = [
    { title: 'Официант', dataIndex: 'name', render: (n: string, m) => <div><Text strong>{n}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{m.email}</Text></div></div> },
    { title: 'Баллы', dataIndex: 'points', width: 90 },
    { title: 'Серия, дней', dataIndex: 'streak', width: 110, responsive: ['md'] },
    { title: 'Последнее занятие', dataIndex: 'lastActive', render: (d: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : 'не занимался'), responsive: ['md'] },
    { title: 'Зарегистрирован', dataIndex: 'registeredAt', render: (d: string) => dayjs(d).format('DD.MM.YYYY'), responsive: ['lg'] },
  ]

  if (invites === null) return <Spin style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>Обучение · Приглашения</Title>
      {!TRAINER_API && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Не задан адрес сервера тренажёра"
          description="Укажите VITE_TRAINER_API_URL в настройках сборки админки (адрес, где запущен api/ репозитория Trainer-RestAI)." />
      )}
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={error} action={<Button size="small" onClick={() => void load()}>Ещё раз</Button>} />}
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Один код — один официант (одно оплаченное место)"
        description="Передайте официанту код или QR. Он откроет ссылку, укажет имя и email, введёт код из письма — и попадёт в тренажёр. Код одноразовый и действует ограниченное время." />

      <Card size="small" title="Выдать коды" style={{ marginBottom: 16 }}>
        <Space wrap align="end">
          <div><div><Text type="secondary" style={{ fontSize: 12 }}>Сколько кодов</Text></div><InputNumber min={1} max={100} value={count} onChange={setCount} style={{ width: 110 }} /></div>
          <div><div><Text type="secondary" style={{ fontSize: 12 }}>Действует, дней</Text></div><InputNumber min={1} max={90} value={days} onChange={setDays} style={{ width: 130 }} /></div>
          <div><div><Text type="secondary" style={{ fontSize: 12 }}>Пометка (необязательно)</Text></div><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Например: новая смена" style={{ width: 240 }} /></div>
          <Button type="primary" loading={busy} onClick={() => void create()} disabled={!TRAINER_API}>Выдать</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>Обновить</Button>
        </Space>
      </Card>

      <Card size="small" title="Коды" style={{ marginBottom: 16 }}>
        <Table<Invite> rowKey="id" size="middle" columns={inviteColumns} dataSource={invites} pagination={{ pageSize: 15, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Кодов пока нет" /> }} />
      </Card>

      <Card size="small" title="Официанты в тренажёре">
        <Table<Member> rowKey="id" size="middle" columns={memberColumns} dataSource={members} pagination={{ pageSize: 15, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока никто не зарегистрировался" /> }} />
      </Card>

      <QrModal invite={qr} onClose={() => setQr(null)} />
    </div>
  )
}
