import { useState } from 'react'
import { Card, Row, Col, Table, Tag, Button, Select, Rate, Space, Typography, Statistic } from 'antd'
import { UserOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

type BookingStatus = 'pending' | 'approved' | 'confirmed' | 'rejected'

interface Booking {
  key: string
  waiter: string
  experience: string
  rating: number
  shiftDate: string
  shiftTime: string
  status: BookingStatus
}

const statusConfig: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'orange' },
  approved: { label: 'Одобрена', color: 'blue' },
  confirmed: { label: 'Подтверждена', color: 'green' },
  rejected: { label: 'Отклонена', color: 'red' },
}

const mockBookings: Booking[] = [
  { key: '1', waiter: 'Иванов Сергей', experience: '3 года', rating: 4.5, shiftDate: '29.06.2026', shiftTime: '10:00–22:00', status: 'pending' },
  { key: '2', waiter: 'Петрова Анна', experience: '1 год', rating: 4.0, shiftDate: '29.06.2026', shiftTime: '12:00–00:00', status: 'approved' },
  { key: '3', waiter: 'Козлов Дмитрий', experience: '5 лет', rating: 4.8, shiftDate: '30.06.2026', shiftTime: '09:00–21:00', status: 'confirmed' },
  { key: '4', waiter: 'Смирнова Ольга', experience: '2 года', rating: 3.9, shiftDate: '30.06.2026', shiftTime: '11:00–23:00', status: 'rejected' },
]

export default function BookingsPage() {
  const [filterStatus, setFilterStatus] = useState<BookingStatus | 'all'>('all')

  const filtered = filterStatus === 'all'
    ? mockBookings
    : mockBookings.filter(b => b.status === filterStatus)

  const counts = {
    pending: mockBookings.filter(b => b.status === 'pending').length,
    approved: mockBookings.filter(b => b.status === 'approved').length,
    confirmed: mockBookings.filter(b => b.status === 'confirmed').length,
    total: mockBookings.length,
  }

  const columns: ColumnsType<Booking> = [
    {
      title: 'Официант',
      key: 'waiter',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.waiter}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.experience}</div>
        </div>
      ),
    },
    {
      title: 'Рейтинг',
      dataIndex: 'rating',
      key: 'rating',
      render: val => <Rate disabled allowHalf defaultValue={val} style={{ fontSize: 13 }} />,
    },
    { title: 'Дата смены', dataIndex: 'shiftDate', key: 'shiftDate' },
    { title: 'Время', dataIndex: 'shiftTime', key: 'shiftTime' },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: BookingStatus) => (
        <Tag color={statusConfig[status].color}>{statusConfig[status].label}</Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<UserOutlined />}>Профиль</Button>
          {r.status === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />}>Одобрить</Button>
              <Button size="small" danger icon={<CloseOutlined />}>Отклонить</Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Заявки на смены</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Ожидают" value={counts.pending} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Одобрены" value={counts.approved} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Подтверждены" value={counts.confirmed} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Всего" value={counts.total} /></Card>
        </Col>
      </Row>

      <Card
        title="Список заявок"
        extra={
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Все статусы' },
              { value: 'pending', label: 'Ожидают' },
              { value: 'approved', label: 'Одобрены' },
              { value: 'confirmed', label: 'Подтверждены' },
              { value: 'rejected', label: 'Отклонены' },
            ]}
          />
        }
      >
        <Table columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}
