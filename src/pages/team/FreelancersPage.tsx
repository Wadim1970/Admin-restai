import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, Form, Input, Modal, Rate, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd'
import { CheckCircleOutlined, StarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { formatPhone, type FreelanceShift, type Freelancer, type FreelancersResponse } from './types'

const { Title, Text } = Typography

type Target = { shift: FreelanceShift; name: string }

// Официанты → Фрилансеры: кто выходил на смены по заявкам. После смены —
// оценка и отзыв: официант увидит их в приложении (Мои смены → Прошедшие),
// а средняя оценка ресторанов станет его рейтингом.
export default function FreelancersPage() {
  const [data, setData] = useState<FreelancersResponse | null>(null)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<Target | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<FreelancersResponse>('/api/admin/freelancers'))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const open = (t: Target) => {
    form.setFieldsValue({ rating: t.shift.review?.rating || 0, comment: t.shift.review?.comment || '' })
    setTarget(t)
  }

  const save = async () => {
    const v = await form.validateFields()
    if (!target) return
    setSaving(true)
    try {
      await adminFetch('/api/admin/freelancers', { method: 'POST', body: { bookingId: target.shift.bookingId, rating: v.rating, comment: v.comment } })
      message.success('Отзыв сохранён — официант увидит его в приложении')
      setTarget(null)
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!data) return error ? <Alert type="error" showIcon title="Не удалось загрузить фрилансеров" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />

  const shiftLine = (s: FreelanceShift) => `${dayjs(s.date).format('dd, D MMMM')}, ${s.startTime}–${s.endTime}`

  const shiftsTable = (f: Freelancer) => (
    <Table
      rowKey="bookingId"
      size="small"
      pagination={false}
      dataSource={f.shifts}
      columns={[
        { title: 'Смена', render: (_: unknown, s: FreelanceShift) => shiftLine(s) },
        {
          title: 'Отметка',
          render: (_: unknown, s: FreelanceShift) => (!s.done ? <Tag color="blue">предстоит</Tag>
            : s.checkedIn ? <Tag color="green" icon={<CheckCircleOutlined />}>отметился на смене</Tag>
              : <Tooltip title="Официант не отметил начало смены в приложении"><Tag>без отметки</Tag></Tooltip>),
        },
        {
          title: 'Наша оценка',
          render: (_: unknown, s: FreelanceShift) => (s.review
            ? <span><Rate disabled value={s.review.rating} style={{ fontSize: 13 }} />{s.review.comment && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>«{s.review.comment}»</Text>}</span>
            : s.done ? <Text type="secondary">нет</Text> : '—'),
        },
        {
          title: '',
          align: 'right' as const,
          render: (_: unknown, s: FreelanceShift) => s.done && data.reviewsEnabled && (
            <Button size="small" type={s.review ? 'link' : 'primary'} icon={s.review ? undefined : <StarOutlined />} onClick={() => open({ shift: s, name: f.name })}>
              {s.review ? 'Изменить отзыв' : 'Оценить'}
            </Button>
          ),
        },
      ]}
    />
  )

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Фрилансеры · {data.restaurant.name}</Title>
        <Text type="secondary">Официанты, которые выходили к вам на смены по заявкам</Text>
      </div>
      {!data.reviewsEnabled && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Отзывы появятся после обновления базы" description="Нужно применить миграцию 20261031010000_zones_staff.sql на сервере базы." />
      )}

      {data.reviewsEnabled && data.toReview.length > 0 && (
        <Card size="small" title={`Ждут вашей оценки (${data.toReview.length})`} style={{ marginBottom: 12 }}>
          {data.toReview.map((s) => (
            <div key={s.bookingId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f0f0f0' }}>
              <Text strong>{s.waiter.name}</Text>
              <Text type="secondary">{shiftLine(s)}</Text>
              {s.checkedIn ? <Tag color="green">отметился</Tag> : <Tag>без отметки</Tag>}
              <Button size="small" type="primary" icon={<StarOutlined />} style={{ marginLeft: 'auto' }} onClick={() => open({ shift: s, name: s.waiter.name })}>Оценить</Button>
            </div>
          ))}
        </Card>
      )}

      <Card size="small">
        {data.freelancers.length === 0 ? <Empty description="Пока никто не выходил по заявкам" /> : (
          <Table
            rowKey={(f) => f.id || f.name}
            size="middle"
            pagination={false}
            dataSource={data.freelancers}
            scroll={{ x: 760 }}
            expandable={{ expandedRowRender: shiftsTable, expandRowByClick: true }}
            columns={[
              { title: 'Официант', dataIndex: 'name', render: (n: string) => <Text strong>{n}</Text> },
              { title: 'Телефон', dataIndex: 'phone', render: (p: string | null) => (p ? <a href={`tel:${p}`} onClick={(e) => e.stopPropagation()}>{formatPhone(p)}</a> : '—') },
              { title: 'Смен у нас', dataIndex: 'shiftsDone', align: 'right' as const, render: (n: number, f: Freelancer) => <span>{n}{f.upcoming ? <Text type="secondary"> + {f.upcoming} впереди</Text> : null}</span> },
              { title: 'Последняя', dataIndex: 'lastDate', render: (d: string | null) => (d ? dayjs(d).format('D MMMM') : '—') },
              { title: 'Наша оценка', dataIndex: 'myRating', render: (r: number | null) => (r != null ? `★ ${r}` : '—') },
              { title: 'Рейтинг', dataIndex: 'rating', render: (r: number | null) => (r != null ? <Tooltip title="Средняя оценка всех ресторанов">★ {Number(r).toFixed(1)}</Tooltip> : '—') },
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!target}
        title={target ? `${target.name} · ${shiftLine(target.shift)}` : ''}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setTarget(null)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="rating" label="Оценка за смену" rules={[{ validator: (_, v) => (v >= 1 ? Promise.resolve() : Promise.reject(new Error('Поставьте оценку'))) }]}>
            <Rate style={{ fontSize: 28 }} />
          </Form.Item>
          <Form.Item name="comment" label="Отзыв" extra="Официант увидит его в приложении">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={1000} placeholder="Пунктуальный, вежливый с гостями, быстро освоил меню" />
          </Form.Item>
          <Space><Text type="secondary">Средняя оценка ресторанов — рейтинг официанта в приложении.</Text></Space>
        </Form>
      </Modal>
    </div>
  )
}
