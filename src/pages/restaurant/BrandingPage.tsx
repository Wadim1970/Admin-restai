import { useState } from 'react'
import { Card, Row, Col, Form, Input, Button, Typography, Divider } from 'antd'

const { Title, Text } = Typography

interface BrandingValues {
  colorBackground: string
  colorPrimary: string
  colorAccent: string
  colorPrice: string
  fontHeading: string
  fontBody: string
  fontHeadingUrl: string
  fontBodyUrl: string
}

const defaults: BrandingValues = {
  colorBackground: '#ffffff',
  colorPrimary: '#1890ff',
  colorAccent: '#ff4d4f',
  colorPrice: '#52c41a',
  fontHeading: 'Georgia',
  fontBody: 'Arial',
  fontHeadingUrl: '',
  fontBodyUrl: '',
}

const menuItems = [
  { name: 'Борщ украинский', desc: 'Наваристый суп со свёклой', price: '350 ₽' },
  { name: 'Стейк рибай', desc: 'Мраморная говядина на гриле', price: '1 200 ₽' },
  { name: 'Тирамису', desc: 'Итальянский десерт', price: '280 ₽' },
]

export default function BrandingPage() {
  const [branding, setBranding] = useState<BrandingValues>(defaults)

  const handleChange = (field: keyof BrandingValues, value: string) => {
    setBranding(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Брендинг</Title>
      <Row gutter={24}>
        <Col span={11}>
          <Card title="Настройки бренда">
            <Form layout="vertical">
              <Title level={5}>Цвета</Title>
              {(
                [
                  { label: 'Фон', field: 'colorBackground' },
                  { label: 'Основной цвет', field: 'colorPrimary' },
                  { label: 'Акцентный цвет', field: 'colorAccent' },
                  { label: 'Цвет цены', field: 'colorPrice' },
                ] as { label: string; field: keyof BrandingValues }[]
              ).map(({ label, field }) => (
                <Form.Item key={field} label={label}>
                  <Row gutter={8} align="middle">
                    <Col>
                      <input
                        type="color"
                        value={branding[field]}
                        onChange={e => handleChange(field, e.target.value)}
                        style={{ width: 40, height: 32, border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer' }}
                      />
                    </Col>
                    <Col flex="1">
                      <Input
                        value={branding[field]}
                        onChange={e => handleChange(field, e.target.value)}
                      />
                    </Col>
                  </Row>
                </Form.Item>
              ))}

              <Divider />
              <Title level={5}>Шрифты</Title>
              <Form.Item label="Шрифт заголовков">
                <Input value={branding.fontHeading} onChange={e => handleChange('fontHeading', e.target.value)} />
              </Form.Item>
              <Form.Item label="Шрифт текста">
                <Input value={branding.fontBody} onChange={e => handleChange('fontBody', e.target.value)} />
              </Form.Item>
              <Form.Item label="URL шрифта заголовков">
                <Input value={branding.fontHeadingUrl} onChange={e => handleChange('fontHeadingUrl', e.target.value)} placeholder="https://fonts.googleapis.com/..." />
              </Form.Item>
              <Form.Item label="URL шрифта текста">
                <Input value={branding.fontBodyUrl} onChange={e => handleChange('fontBodyUrl', e.target.value)} placeholder="https://fonts.googleapis.com/..." />
              </Form.Item>
              <Button type="primary">Сохранить</Button>
            </Form>
          </Card>
        </Col>

        <Col span={13}>
          <Card title="Предпросмотр меню">
            <div style={{ background: branding.colorBackground, padding: 24, borderRadius: 8, minHeight: 300 }}>
              <div style={{
                fontFamily: branding.fontHeading,
                color: branding.colorPrimary,
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 16,
              }}>
                Наше меню
              </div>
              {menuItems.map((item, i) => (
                <div key={i} style={{
                  borderBottom: `1px solid ${branding.colorAccent}22`,
                  padding: '12px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontFamily: branding.fontHeading, fontWeight: 600, color: branding.colorPrimary }}>
                      {item.name}
                    </div>
                    <Text style={{ fontFamily: branding.fontBody, fontSize: 13, color: '#666' }}>
                      {item.desc}
                    </Text>
                  </div>
                  <div style={{ color: branding.colorPrice, fontWeight: 700, fontFamily: branding.fontBody, marginLeft: 16 }}>
                    {item.price}
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 16,
                background: branding.colorAccent,
                color: '#fff',
                padding: '8px 20px',
                borderRadius: 6,
                display: 'inline-block',
                fontFamily: branding.fontBody,
                cursor: 'pointer',
              }}>
                Заказать
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
