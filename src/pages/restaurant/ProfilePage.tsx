import { Form, Input, Button, Upload, Card, Row, Col, Typography } from 'antd'
import { UploadOutlined, PictureOutlined } from '@ant-design/icons'

const { Title } = Typography

export default function ProfilePage() {
  const [form] = Form.useForm()

  const onFinish = (values: unknown) => {
    console.log('Сохранено:', values)
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Профиль ресторана</Title>
      <Row gutter={24}>
        <Col span={14}>
          <Card>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item label="Название ресторана" name="name" rules={[{ required: true, message: 'Введите название' }]}>
                <Input placeholder="Например: Кафе Центральное" />
              </Form.Item>
              <Form.Item label="Город" name="city" rules={[{ required: true, message: 'Введите город' }]}>
                <Input placeholder="Москва" />
              </Form.Item>
              <Form.Item label="Адрес" name="address" rules={[{ required: true, message: 'Введите адрес' }]}>
                <Input placeholder="ул. Пушкина, д. 1" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Широта" name="latitude">
                    <Input placeholder="55.7558" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Долгота" name="longitude">
                    <Input placeholder="37.6176" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="Часовой пояс" name="timezone">
                <Input disabled placeholder="Определяется автоматически по координатам" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">Сохранить</Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={10}>
          <Card title="Логотип" style={{ marginBottom: 16 }}>
            <Upload listType="picture-card" maxCount={1} beforeUpload={() => false}>
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>Загрузить логотип</div>
              </div>
            </Upload>
          </Card>
          <Card title="Фото зала">
            <Upload listType="picture-card" maxCount={3} multiple beforeUpload={() => false}>
              <div>
                <PictureOutlined />
                <div style={{ marginTop: 8 }}>Загрузить фото</div>
              </div>
            </Upload>
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>Максимум 3 фотографии</div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
