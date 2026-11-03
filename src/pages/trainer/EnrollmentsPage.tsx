import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Popconfirm, Space, Spin, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { ApiError } from '../../lib/adminApi'
import { trainerFetch, TRAINER_API, type AddResult, type AddStatus, type Enrollment, type EnrollmentStatus } from './trainerApi'

const { Title, Text } = Typography

const STATUS: Record<EnrollmentStatus, { label: string; color: string }> = {
  invited: { label: 'Приглашён', color: 'blue' },
  active: { label: 'Идёт курс', color: 'green' },
  closed: { label: 'Закрыт', color: 'default' },
}

const RESULT_COLOR: Record<AddStatus, string> = { added: 'green', exists: 'blue', other_restaurant: 'orange', invalid: 'red', error: 'red' }

const ACTOR_KEY = 'restai_trainer_actor'
const readActor = () => { try { return localStorage.getItem(ACTOR_KEY) || '' } catch { return '' } }

const fmt = (d: string | null, f = 'DD.MM.YYYY') => (d ? dayjs(d).format(f) : '—')

// Раздел «Обучение → Доступы»: администратор вносит email официантов (одно оплаченное место на курс),
// видит, кто начал курс и как идёт обучение, и может закрыть доступ.
export default function EnrollmentsPage() {
  const [rows, setRows] = useState<Enrollment[] | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<AddResult[]>([])

  const load = useCallback(async () => {
    try {
      const r = await trainerFetch<{ enrollments: Enrollment[] }>('/api/admin/enrollments')
      setRows(r.enrollments)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные')
      setRows((cur) => cur ?? [])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      const r = await trainerFetch<{ results: AddResult[]; added: number }>('/api/admin/enrollments', {
        method: 'POST', body: { action: 'add', emails: text, actor: readActor() || 'администратор' },
      })
      setResults(r.results)
      if (r.added > 0) message.success(r.added === 1 ? 'Доступ открыт' : `Доступ открыт: ${r.added}`)
      // Оставляем в поле только то, что не получилось (чтобы исправить и отправить снова).
      setText(r.results.filter((x) => x.status === 'invalid' || x.status === 'error').map((x) => x.line || x.email || '').join('\n'))
      await load()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось открыть доступ')
    } finally {
      setBusy(false)
    }
  }

  const close = async (id: string) => {
    try {
      await trainerFetch('/api/admin/enrollments', { method: 'POST', body: { action: 'close', id } })
      message.success('Доступ закрыт')
      await load()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось закрыть доступ')
    }
  }

  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(TRAINER_API); message.success('Адрес скопирован') } catch { message.info(TRAINER_API) }
  }

  const columns: ColumnsType<Enrollment> = [
    {
      title: 'Официант', key: 'who',
      render: (_, r) => (
        <div style={r.status === 'closed' ? { opacity: 0.55 } : undefined}>
          <Text strong>{r.name || '—'}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text></div>
        </div>
      ),
    },
    { title: 'Статус', key: 'status', render: (_, r) => <Tag color={STATUS[r.status].color}>{STATUS[r.status].label}</Tag> },
    { title: 'Баллы', dataIndex: 'points', width: 90 },
    { title: 'Серия, дней', dataIndex: 'streak', width: 110, responsive: ['md'] },
    { title: 'Последнее занятие', dataIndex: 'lastActive', render: (d: string | null, r) => (d ? fmt(d) : r.status === 'invited' ? 'ещё не входил' : 'не занимался'), responsive: ['md'] },
    { title: 'Внесён', dataIndex: 'createdAt', render: (d: string) => fmt(d), responsive: ['lg'] },
    { title: 'Первый вход', dataIndex: 'firstLoginAt', render: (d: string | null) => fmt(d), responsive: ['lg'] },
    {
      title: '', key: 'actions', align: 'right',
      render: (_, r) => r.status === 'closed' ? <Text type="secondary" style={{ fontSize: 12 }}>закрыт {fmt(r.closedAt)}</Text> : (
        <Popconfirm title="Закрыть доступ?" description="Официант больше не сможет войти. Прогресс сохранится." okText="Закрыть" cancelText="Отмена" onConfirm={() => void close(r.id)}>
          <Button size="small" danger>Закрыть доступ</Button>
        </Popconfirm>
      ),
    },
  ]

  if (rows === null) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  const open = rows.filter((r) => r.status !== 'closed').length

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>Обучение · Доступы</Title>
      {!TRAINER_API && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Не задан адрес сервера тренажёра"
          description="Укажите VITE_TRAINER_API_URL в настройках сборки админки (адрес, где запущен тренажёр)." />
      )}
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={error} action={<Button size="small" onClick={() => void load()}>Ещё раз</Button>} />}
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Один email — одно оплаченное место на один курс"
        description={(
          <div>
            Внесите почту официанта. Он откроет тренажёр, введёт эту почту, получит на неё код и войдёт. Доступ можно закрыть в любой момент, прогресс сохранится.
            {TRAINER_API && (
              <div style={{ marginTop: 6 }}>
                Адрес тренажёра для официанта: <Text strong copyable={false}>{TRAINER_API}</Text>{' '}
                <Button size="small" icon={<CopyOutlined />} onClick={() => void copyAddress()}>Скопировать</Button>
              </div>
            )}
          </div>
        )} />

      <Card size="small" title="Дать доступ" style={{ marginBottom: 16 }}>
        <Input.TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} disabled={!TRAINER_API}
          placeholder={'По одной почте в строке, после неё можно указать имя:\nivan@mail.ru Иван Петров\nanna@mail.ru Анна'} />
        <Space style={{ marginTop: 8 }}>
          <Button type="primary" loading={busy} disabled={!TRAINER_API || !text.trim()} onClick={() => void add()}>Дать доступ</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>Обновить</Button>
        </Space>
        {results.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {results.map((r, i) => (
              <div key={i}>
                <Tag color={RESULT_COLOR[r.status]}>{r.message}</Tag> <Text type="secondary">{r.email || r.line}</Text>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card size="small" title={`Официанты · открыто мест: ${open}`}>
        <Table<Enrollment> rowKey="id" size="middle" columns={columns} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока никого нет. Внесите почту официанта выше." /> }} />
      </Card>
    </div>
  )
}
