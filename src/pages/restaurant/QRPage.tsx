import { useState } from 'react'
import { Card, Row, Col, Button, Table, Tag, TimePicker, Space, Typography, Popconfirm } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

interface TokenRecord {
  key: string
  date: string
  token: string
  createdAt: string
  active: boolean
}

const mockTokens: TokenRecord[] = [
  { key: '1', date: '28.06.2026', token: 'abc123xyz', createdAt: '08:00', active: true },
  { key: '2', date: '27.06.2026', token: 'def456uvw', createdAt: '09:00', active: false },
  { key: '3', date: '26.06.2026', token: 'ghi789rst', createdAt: '08:30', active: false },
]

const columns: ColumnsType<TokenRecord> = [
  { title: 'Дата', dataIndex: 'date', key: 'date' },
  { title: 'Токен', dataIndex: 'token', key: 'token', render: val => <code>{val}</code> },
  { title: 'Время создания', dataIndex: 'createdAt', key: 'createdAt' },
  {
    title: 'Статус',
    dataIndex: 'active',
    key: 'active',
    render: (active: boolean) =>
      active ? <Tag color="green">Активный</Tag> : <Tag color="default">Истёк</Tag>,
  },
]

export default function QRPage() {
  const [resetTime, setResetTime] = useState<Dayjs | null>(null)

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>QR Коды</Title>
      <Row gutter={24}>
        <Col span={10}>
          <Card title="Текущий QR код">
            <div style={{
              width: 200,
              height: 200,
              background: '#f0f0f0',
              border: '2px dashed #d9d9d9',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              marginBottom: 16,
            }}>
              QR заглушка
            </div>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Popconfirm
                title="Сбросить QR?"
                description="Текущий токен станет недействительным."
                okText="Да"
                cancelText="Нет"
                onConfirm={() => console.log('QR сброшен')}
              >
                <Button icon={<ReloadOutlined />} danger>Сбросить токен</Button>
              </Popconfirm>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Время автосброса</div>
                <Space>
                  <TimePicker
                    value={resetTime}
                    onChange={setResetTime}
                    format="HH:mm"
                    placeholder="Выберите время"
                  />
                  <Button type="primary" icon={<SaveOutlined />}>Сохранить</Button>
                </Space>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={14}>
          <Card title="История токенов">
            <Table
              columns={columns}
              dataSource={mockTokens}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
