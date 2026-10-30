import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Card, Col, Collapse, DatePicker, Drawer, Empty, Form, Input, InputNumber, Popconfirm, Rate, Row, Space, Spin, Tag,
  TimePicker, Tooltip, Typography, message,
} from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { money, plural } from '../hall/format'
import { BOOKING_LABELS, formatPhone, type Job, type JobBooking, type JobConditions, type JobsResponse } from './types'

const { Title, Text, Paragraph } = Typography

// Условия — те же подписи, что видит официант в карточке смены.
const CONDITIONS: { key: keyof JobConditions; label: string; placeholder: string }[] = [
  { key: 'dressCode', label: 'Дресс-код', placeholder: 'Чёрная рубашка без логотипов, классические чёрные брюки, закрытая тёмная обувь' },
  { key: 'tipsDistribution', label: 'Чаевые', placeholder: 'Личные чаевые остаются у вас' },
  { key: 'nutrition', label: 'Питание', placeholder: 'Бесплатный обед для персонала' },
  { key: 'requiredDocuments', label: 'Документы', placeholder: 'Медкнижка с отметкой аттестации' },
  { key: 'responsibilityZone', label: 'Зона ответственности', placeholder: 'Основной зал, столы 1–9' },
  { key: 'duties', label: 'Обязанности', placeholder: 'Приём заказов, подача блюд, расчёт гостей' },
  { key: 'requiredTechnologies', label: 'Технологии', placeholder: 'Приложение RestAI, терминал оплаты' },
]

type Mode = { kind: 'new' | 'repeat'; from: JobConditions | null } | { kind: 'edit'; job: Job }

const weekday = (d: string) => dayjs(d).format('dd, D MMMM')

function JobForm({ mode, today, onClose, onSaved }: { mode: Mode | null; today: string; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!mode) return
    form.resetFields()
    const src: JobConditions | null = mode.kind === 'edit' ? mode.job : mode.from
    form.setFieldsValue({
      dates: [],
      date: mode.kind === 'edit' ? dayjs(mode.job.date) : null,
      time: src ? [dayjs(`2000-01-01T${src.startTime}`), dayjs(`2000-01-01T${src.endTime}`)] : [dayjs('2000-01-01T10:00'), dayjs('2000-01-01T22:00')],
      slots: src?.slots ?? 1,
      pay: src?.pay ?? null,
      ...Object.fromEntries(CONDITIONS.map((c) => [c.key, src?.[c.key] || ''])),
    })
  }, [mode, form])

  const save = async () => {
    const v = await form.validateFields()
    const body: Record<string, unknown> = {
      startTime: (v.time[0] as Dayjs).format('HH:mm'),
      endTime: (v.time[1] as Dayjs).format('HH:mm'),
      slots: v.slots,
      pay: v.pay,
      ...Object.fromEntries(CONDITIONS.map((c) => [c.key, v[c.key] || ''])),
    }
    setSaving(true)
    try {
      if (mode?.kind === 'edit') {
        await adminFetch('/api/admin/jobs', { method: 'PATCH', body: { id: mode.job.id, ...body, date: (v.date as Dayjs).format('YYYY-MM-DD') } })
        message.success('Заявка сохранена')
      } else {
        const dates = (v.dates as Dayjs[]).map((d) => d.format('YYYY-MM-DD'))
        await adminFetch('/api/admin/jobs', { method: 'POST', body: { ...body, dates } })
        message.success(dates.length > 1 ? `Размещено смен: ${dates.length}` : 'Смена размещена — официанты увидят её в приложении')
      }
      onSaved()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const title = mode?.kind === 'edit' ? `Смена ${weekday(mode.job.date)}` : mode?.kind === 'repeat' ? 'Повторить смену на другие даты' : 'Новая смена для фрилансеров'
  const disabledDate = (d: Dayjs) => d.format('YYYY-MM-DD') < today

  return (
    <Drawer
      open={!!mode}
      onClose={onClose}
      size={640}
      title={title}
      footer={<div style={{ textAlign: 'right' }}><Space><Button onClick={onClose}>Отмена</Button><Button type="primary" loading={saving} onClick={save}>{mode?.kind === 'edit' ? 'Сохранить' : 'Разместить'}</Button></Space></div>}
    >
      {mode && mode.kind !== 'edit' && mode.from && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Условия подставлены из прошлой смены" description="Выберите даты — при необходимости поправьте условия." />
      )}
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={12}>
            {mode?.kind === 'edit' ? (
              <Form.Item name="date" label="Дата" rules={[{ required: true, message: 'Дата' }]}>
                <DatePicker format="D MMMM YYYY" style={{ width: '100%' }} disabledDate={disabledDate} allowClear={false} />
              </Form.Item>
            ) : (
              <Form.Item name="dates" label="Даты" rules={[{ required: true, type: 'array', min: 1, message: 'Выберите хотя бы одну дату' }]} extra="Можно выбрать несколько дней — на каждый будет своя смена">
                <DatePicker multiple format="D.MM" style={{ width: '100%' }} disabledDate={disabledDate} placeholder="Выберите даты" />
              </Form.Item>
            )}
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="time" label="Время смены" rules={[{ required: true, message: 'Время' }]}>
              <TimePicker.RangePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} order={false} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={12} md={12}><Form.Item name="slots" label="Сколько официантов нужно" rules={[{ required: true, message: 'Сколько' }]}><InputNumber min={1} max={50} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={12}><Form.Item name="pay" label="Оплата за смену, ₽" rules={[{ required: true, message: 'Оплата' }]}><InputNumber min={0} step={500} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Text strong>Условия</Text>
        {CONDITIONS.slice(0, 4).map((c) => (
          <Form.Item key={c.key} name={c.key} label={c.label} style={{ marginTop: 8, marginBottom: 12 }}>
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={1000} placeholder={c.placeholder} />
          </Form.Item>
        ))}
        <Text strong>Описание задач</Text>
        {CONDITIONS.slice(4).map((c) => (
          <Form.Item key={c.key} name={c.key} label={c.label} style={{ marginTop: 8, marginBottom: 12 }}>
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={1000} placeholder={c.placeholder} />
          </Form.Item>
        ))}
      </Form>
    </Drawer>
  )
}

function Bookings({ job, past, onAction }: { job: Job; past: boolean; onAction: (b: JobBooking, status: 'approved' | 'rejected' | 'cancelled') => void }) {
  if (!job.bookings.length) return <Text type="secondary">{past ? 'Никто не откликнулся' : 'Пока никто не откликнулся'}</Text>
  return (
    <div>
      {job.bookings.map((b) => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f0f0f0' }}>
          <Text strong>{b.waiter.name}</Text>
          {b.waiter.rating != null && <Tooltip title="Средняя оценка ресторанов"><span><Rate disabled allowHalf value={b.waiter.rating} style={{ fontSize: 12 }} /></span></Tooltip>}
          {b.waiter.phone && <a href={`tel:${b.waiter.phone}`} style={{ fontSize: 13 }}>{formatPhone(b.waiter.phone)}</a>}
          <Tag color={BOOKING_LABELS[b.status].color}>{BOOKING_LABELS[b.status].label}</Tag>
          {!past && (
            <Space size={4} style={{ marginLeft: 'auto' }}>
              {b.status === 'applied' && <>
                <Button size="small" type="primary" onClick={() => onAction(b, 'approved')}>Одобрить</Button>
                <Button size="small" onClick={() => onAction(b, 'rejected')}>Отклонить</Button>
              </>}
              {(b.status === 'approved' || b.status === 'confirmed') && (
                <Popconfirm title={`Отменить смену для ${b.waiter.name}?`} okText="Отменить" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => onAction(b, 'cancelled')}>
                  <Button size="small" danger>Отменить</Button>
                </Popconfirm>
              )}
            </Space>
          )}
        </div>
      ))}
    </div>
  )
}

function JobCard({ job, past, onEdit, onRepeat, onDelete, onAction }: {
  job: Job; past: boolean; onEdit: () => void; onRepeat: () => void; onDelete: () => void
  onAction: (b: JobBooking, status: 'approved' | 'rejected' | 'cancelled') => void
}) {
  const taken = job.slots - job.slotsFree
  const pending = job.bookings.filter((b) => b.status === 'applied').length
  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      title={<span>{weekday(job.date)} <Text type="secondary" style={{ fontWeight: 400 }}>· {job.startTime}–{job.endTime}</Text></span>}
      extra={(
        <Space size={0} wrap>
          {!past && <Button type="link" size="small" icon={<EditOutlined />} onClick={onEdit}>Изменить</Button>}
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={onRepeat}>Повторить</Button>
          {!past && (
            <Popconfirm title="Снять смену?" description="Официанты больше не увидят её в приложении." okText="Снять" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={onDelete}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )}
    >
      <Space wrap style={{ marginBottom: 8 }}>
        <Tag color="blue">{money(job.pay)} за смену</Tag>
        <Tag color={job.slotsFree === 0 ? 'green' : 'default'}>
          {taken} из {job.slots} {plural(job.slots, 'места', 'мест', 'мест')} занято
        </Tag>
        {pending > 0 && !past && <Tag color="orange">новых откликов: {pending}</Tag>}
      </Space>
      {(job.dressCode || job.duties) && (
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }} ellipsis={{ rows: 2, expandable: true, symbol: 'все условия' }}>
          {CONDITIONS.filter((c) => job[c.key]).map((c) => `${c.label}: ${job[c.key]}`).join(' · ')}
        </Paragraph>
      )}
      <Bookings job={job} past={past} onAction={onAction} />
    </Card>
  )
}

// Официанты → Заявки: смены для фрилансеров. Новая заявка берёт условия
// прошлой — меняется только дата; «Повторить» — то же на другие дни.
export default function JobsPage() {
  const [data, setData] = useState<JobsResponse | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<JobsResponse>('/api/admin/jobs'))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const fail = (e: unknown) => message.error(e instanceof Error ? e.message : String(e))
  const act = async (b: JobBooking, status: 'approved' | 'rejected' | 'cancelled') => {
    try {
      await adminFetch('/api/admin/jobs', { method: 'PATCH', body: { bookingId: b.id, status } })
      message.success(status === 'approved' ? `${b.waiter.name} одобрен(а) — ждём подтверждения в приложении` : status === 'rejected' ? 'Отклик отклонён' : 'Смена отменена')
      await load()
    } catch (e) { fail(e) }
  }
  const remove = async (j: Job) => {
    try {
      await adminFetch('/api/admin/jobs', { method: 'DELETE', query: { id: j.id } })
      message.success('Смена снята')
      await load()
    } catch (e) { fail(e) }
  }

  if (!data) return error ? <Alert type="error" showIcon title="Не удалось загрузить заявки" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />

  const card = (j: Job, past: boolean) => (
    <JobCard key={j.id} job={j} past={past} onAction={act}
      onEdit={() => setMode({ kind: 'edit', job: j })} onRepeat={() => setMode({ kind: 'repeat', from: j })} onDelete={() => remove(j)} />
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Заявки на смены · {data.restaurant.name}</Title>
          <Text type="secondary">Смены для официантов-фрилансеров: они видят их в приложении и откликаются</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setMode({ kind: 'new', from: data.template })}>Разместить смену</Button>
      </div>
      {data.upcoming.length === 0
        ? <Card size="small" style={{ marginBottom: 12 }}><Empty description="Предстоящих смен нет">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setMode({ kind: 'new', from: data.template })}>Разместить смену</Button>
          </Empty></Card>
        : data.upcoming.map((j) => card(j, false))}
      {data.past.length > 0 && (
        <Collapse size="small" items={[{ key: 'p', label: `Прошедшие за 60 дней (${data.past.length})`, children: data.past.map((j) => card(j, true)) }]} />
      )}
      <JobForm mode={mode} today={data.today} onClose={() => setMode(null)} onSaved={() => { setMode(null); load() }} />
    </div>
  )
}
