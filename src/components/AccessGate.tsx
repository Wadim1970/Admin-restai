import { useState, type ReactNode } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { loadAccess, saveAccess, type Access } from '../lib/adminApi'

const { Paragraph } = Typography

// Пока нет ID ресторана и токена — форма доступа; дальше — страница.
// onDenied страница зовёт при ответе 401 (токен неверный) — снова форма.
export default function AccessGate({ children, title }: { title: string; children: (access: Access, deny: () => void) => ReactNode }) {
  const [access, setAccess] = useState<Access>(loadAccess)
  const [denied, setDenied] = useState(false)
  const ready = access.restaurantId && access.token && !denied

  if (ready) return <>{children(access, () => setDenied(true))}</>

  return (
    <Card title={title} style={{ maxWidth: 520 }}>
      {denied && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Сервер не принял токен админки — проверьте его" />}
      <Paragraph type="secondary">
        Входа в админку пока нет: укажите ID ресторана и токен админки (ADMIN_TOKEN на сервере). Токен хранится
        только в этой вкладке браузера.
      </Paragraph>
      <Form
        layout="vertical"
        initialValues={access}
        onFinish={(v: Access) => {
          const next = { restaurantId: v.restaurantId.trim(), token: v.token.trim() }
          saveAccess(next)
          setAccess(next)
          setDenied(false)
        }}
      >
        <Form.Item label="ID ресторана" name="restaurantId" rules={[{ required: true, message: 'Укажите ID ресторана' }]}>
          <Input placeholder="dd89773c-…" autoComplete="off" />
        </Form.Item>
        <Form.Item label="Токен админки" name="token" rules={[{ required: true, message: 'Укажите токен' }]}>
          <Input.Password autoComplete="off" />
        </Form.Item>
        <Button type="primary" htmlType="submit">Открыть</Button>
      </Form>
    </Card>
  )
}
