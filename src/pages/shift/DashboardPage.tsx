import { Card, Row, Col, Tag, Badge, Typography, Statistic, Avatar } from 'antd'
import { UserOutlined, BellOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

type TableStatus = 'free' | 'preparing' | 'resting' | 'bill_requested' | 'call'
type Zone = 'main' | 'veranda' | 'banquet'

interface TableData {
  id: number
  zone: Zone
  status: TableStatus
  waiter?: string
}

const statusConfig: Record<TableStatus, { label: string; color: string; bg: string }> = {
  free: { label: 'Свободен', color: '#595959', bg: '#f0f0f0' },
  preparing: { label: 'Готовится', color: '#1890ff', bg: '#e6f7ff' },
  resting: { label: 'Отдыхают', color: '#52c41a', bg: '#f6ffed' },
  bill_requested: { label: 'Счёт', color: '#722ed1', bg: '#f9f0ff' },
  call: { label: 'Вызов!', color: '#ff4d4f', bg: '#fff1f0' },
}

const zoneLabels: Record<Zone, string> = {
  main: 'Основной зал',
  veranda: 'Веранда',
  banquet: 'Банкетный зал',
}

const tables: TableData[] = [
  { id: 1, zone: 'main', status: 'free' },
  { id: 2, zone: 'main', status: 'preparing', waiter: 'Иванов С.' },
  { id: 3, zone: 'main', status: 'resting', waiter: 'Петрова А.' },
  { id: 4, zone: 'main', status: 'call', waiter: 'Козлов Д.' },
  { id: 5, zone: 'main', status: 'bill_requested', waiter: 'Петрова А.' },
  { id: 6, zone: 'main', status: 'free' },
  { id: 7, zone: 'veranda', status: 'free' },
  { id: 8, zone: 'veranda', status: 'resting', waiter: 'Иванов С.' },
  { id: 9, zone: 'veranda', status: 'preparing', waiter: 'Козлов Д.' },
  { id: 10, zone: 'banquet', status: 'free' },
  { id: 11, zone: 'banquet', status: 'call', waiter: 'Смирнова О.' },
  { id: 12, zone: 'banquet', status: 'free' },
]

const waiters = [
  { name: 'Иванов Сергей', tables: 2, status: 'active' },
  { name: 'Петрова Анна', tables: 2, status: 'active' },
  { name: 'Козлов Дмитрий', tables: 2, status: 'active' },
  { name: 'Смирнова Ольга', tables: 1, status: 'break' },
]

const calls = tables.filter(t => t.status === 'call')

const zones: Zone[] = ['main', 'veranda', 'banquet']

export default function DashboardPage() {
  const free = tables.filter(t => t.status === 'free').length
  const occupied = tables.filter(t => t.status !== 'free').length
  const callCount = calls.length

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Дашборд смены</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Свободно столов" value={free} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Занято столов" value={occupied} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Активных вызовов" value={callCount} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Официантов на смене" value={waiters.length} /></Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={16}>
          <Card title="Схема зала">
            {zones.map(zone => (
              <div key={zone} style={{ marginBottom: 20 }}>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#595959' }}>
                  {zoneLabels[zone]}
                </Text>
                <Row gutter={[8, 8]}>
                  {tables.filter(t => t.zone === zone).map(table => {
                    const cfg = statusConfig[table.status]
                    return (
                      <Col key={table.id}>
                        <div style={{
                          width: 90,
                          padding: '10px 8px',
                          background: cfg.bg,
                          border: `2px solid ${cfg.color}`,
                          borderRadius: 8,
                          textAlign: 'center',
                          cursor: 'default',
                        }}>
                          <div style={{ fontWeight: 600, color: cfg.color }}>Стол {table.id}</div>
                          <div style={{ fontSize: 11, color: cfg.color, marginTop: 2 }}>{cfg.label}</div>
                          {table.waiter && (
                            <div style={{ fontSize: 10, color: '#999', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {table.waiter}
                            </div>
                          )}
                        </div>
                      </Col>
                    )
                  })}
                </Row>
              </div>
            ))}
          </Card>
        </Col>

        <Col span={8}>
          {calls.length > 0 && (
            <Card
              title={
                <span style={{ color: '#ff4d4f' }}>
                  <BellOutlined style={{ marginRight: 8 }} />
                  Активные вызовы
                </span>
              }
              style={{ border: '2px solid #ff4d4f', marginBottom: 16 }}
            >
              {calls.map(t => (
                <div key={t.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #ffe7e7',
                }}>
                  <span style={{ fontWeight: 600 }}>Стол {t.id}</span>
                  <span style={{ color: '#999', fontSize: 12 }}>{t.waiter}</span>
                  <Tag color="red">Вызов</Tag>
                </div>
              ))}
            </Card>
          )}

          <Card title="Официанты на смене">
            {waiters.map((w, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < waiters.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <Badge status={w.status === 'active' ? 'success' : 'warning'}>
                  <Avatar size={32} icon={<UserOutlined />} style={{ marginRight: 8 }} />
                </Badge>
                <div style={{ marginLeft: 8, flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {w.status === 'active' ? `${w.tables} стола` : 'Перерыв'}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
