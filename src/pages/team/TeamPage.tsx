import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Collapse, Form, Input, Modal, Popconfirm, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd'
import { EditOutlined, PlusOutlined, UserDeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { ROLE_LABELS, formatPhone, type Role, type StaffMember, type TeamResponse } from './types'

const { Title, Text } = Typography

// Официанты → Штатные: ФИО и телефон сотрудников. Новый сотрудник входит
// в приложение официанта по SMS на этот номер — и сразу числится в штате.
export default function TeamPage() {
  const [data, setData] = useState<TeamResponse | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<TeamResponse>('/api/admin/team'))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const fail = (e: unknown) => message.error(e instanceof Error ? e.message : String(e))

  const open = (s: StaffMember | 'new') => {
    form.resetFields()
    form.setFieldsValue(s === 'new'
      ? { role: 'waiter' }
      : { lastName: s.lastName, firstName: s.firstName, middleName: s.middleName, phone: formatPhone(s.phone), role: s.role })
    setEditing(s)
  }

  const save = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      if (editing === 'new') {
        const r = await adminFetch<{ existing: boolean }>('/api/admin/team', { method: 'POST', body: v })
        message.success(r.existing ? 'Официант уже был в приложении — добавлен в штат' : 'Сотрудник добавлен. Он войдёт в приложение официанта по SMS на этот номер')
      } else if (editing) {
        const body: Record<string, unknown> = { id: editing.id, lastName: v.lastName, firstName: v.firstName, middleName: v.middleName, role: v.role }
        if (!editing.verified) body.phone = v.phone
        await adminFetch('/api/admin/team', { method: 'PATCH', body })
        message.success('Сохранено')
      }
      setEditing(null)
      await load()
    } catch (e) { fail(e) } finally { setSaving(false) }
  }

  const setDismissed = async (s: StaffMember, dismissed: boolean) => {
    try {
      await adminFetch('/api/admin/team', { method: 'PATCH', body: { id: s.id, dismissed } })
      message.success(dismissed ? `${s.name} — уволен(а)` : `${s.name} снова в штате`)
      await load()
    } catch (e) { fail(e) }
  }

  const columns = (dismissed: boolean) => [
    { title: 'ФИО', dataIndex: 'name', render: (n: string) => <Text strong={!dismissed}>{n}</Text> },
    { title: 'Телефон', dataIndex: 'phone', render: (p: string | null) => (p ? <a href={`tel:${p}`}>{formatPhone(p)}</a> : '—') },
    { title: 'Должность', dataIndex: 'role', render: (r: Role) => ROLE_LABELS[r] || r },
    {
      title: dismissed ? 'Работал(а)' : 'В штате с',
      render: (_: unknown, s: StaffMember) => (dismissed
        ? `${dayjs(s.hireDate).format('D.MM.YYYY')} — ${dayjs(s.dismissalDate).format('D.MM.YYYY')}`
        : dayjs(s.hireDate).format('D MMMM YYYY')),
    },
    {
      title: 'Приложение',
      render: (_: unknown, s: StaffMember) => (s.verified
        ? <Tag color="green">вошёл(а)</Tag>
        : <Tooltip title="Ещё не входил(а) в приложение официанта по этому номеру"><Tag>ещё не входил(а)</Tag></Tooltip>),
    },
    {
      title: '',
      align: 'right' as const,
      render: (_: unknown, s: StaffMember) => (dismissed ? (
        <Button size="small" onClick={() => setDismissed(s, false)}>Вернуть в штат</Button>
      ) : (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => open(s)}>Изменить</Button>
          <Popconfirm title={`Уволить: ${s.name}?`} description="Сотрудник пропадёт из штата и графика; история смен сохранится." okText="Уволить" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => setDismissed(s, true)}>
            <Button type="link" size="small" danger icon={<UserDeleteOutlined />}>Уволить</Button>
          </Popconfirm>
        </Space>
      )),
    },
  ]

  if (!data) return error ? <Alert type="error" showIcon title="Не удалось загрузить штат" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Штатные официанты · {data.restaurant.name}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>Добавить сотрудника</Button>
      </div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Table rowKey="id" size="middle" pagination={false} dataSource={data.staff} columns={columns(false)} scroll={{ x: 760 }}
          locale={{ emptyText: 'В штате пока никого — добавьте сотрудников по ФИО и телефону' }} />
      </Card>
      {data.dismissed.length > 0 && (
        <Collapse size="small" items={[{
          key: 'd',
          label: `Уволенные (${data.dismissed.length})`,
          children: <Table rowKey="id" size="small" pagination={false} dataSource={data.dismissed} columns={columns(true)} scroll={{ x: 760 }} />,
        }]} />
      )}

      <Modal
        open={!!editing}
        title={editing === 'new' ? 'Новый сотрудник' : editing ? editing.name : ''}
        okText={editing === 'new' ? 'Добавить' : 'Сохранить'}
        cancelText="Отмена"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="lastName" label="Фамилия" rules={[{ required: true, whitespace: true, message: 'Фамилия' }]}><Input maxLength={60} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="firstName" label="Имя" rules={[{ required: true, whitespace: true, message: 'Имя' }]}><Input maxLength={60} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="middleName" label="Отчество"><Input maxLength={60} /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="role" label="Должность">
                <Select options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="phone"
            label="Телефон"
            rules={[{ required: true, message: 'Телефон' }, { pattern: /^[\d\s()+-]{10,18}$/, message: 'Номер вида +7 900 000-00-00' }]}
            extra={editing !== 'new' && editing?.verified
              ? 'Сотрудник уже вошёл в приложение по этому номеру — сменить его можно только в приложении'
              : 'По этому номеру сотрудник войдёт в приложение официанта (код придёт по SMS)'}
          >
            <Input placeholder="+7 900 000-00-00" disabled={editing !== 'new' && !!editing?.verified} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
