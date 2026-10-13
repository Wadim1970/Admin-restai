import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Switch,
  Table, Tag, Typography, message,
} from 'antd'
import { PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

// Пары блюд для подсказки гостю «к пицце отлично подходит салат…».
// Данные — на сервере официанта (Waiter-app, api/pairings/*), доступ по
// токену админки PAIRINGS_ADMIN_TOKEN: входа в админку пока нет, поэтому
// токен вводится здесь и хранится только в этой вкладке браузера.

const { Title, Text, Paragraph } = Typography

const API = (import.meta.env.VITE_WAITER_API_URL || 'https://waiter.restai.pro').replace(/\/$/, '')

interface Pair {
  id: string
  dish_id: string
  pair_dish_id: string
  dish_name: string
  dish_section: string
  pair_name: string
  pair_price: number | null
  rank: number
  lead: string
  reason: string
  source: 'ai' | 'manual'
  status: 'active' | 'disabled'
  updated_at: string
}
interface MenuItem { id: string; name: string; section: string; price: number }
interface PairingState {
  status: 'running' | 'done' | 'partial' | 'error' | null
  generated_at: string | null
  started_at: string | null
  pair_count: number | null
  error: string | null
}

const STATE_LABEL: Record<string, { text: string; color: string }> = {
  running: { text: 'Идёт расчёт', color: 'processing' },
  done: { text: 'Готово', color: 'success' },
  partial: { text: 'Готово частично', color: 'warning' },
  error: { text: 'Ошибка', color: 'error' },
}

function readStore(storage: Storage, key: string) {
  try { return storage.getItem(key) || '' } catch { return '' }
}
function writeStore(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value) } catch { /* приватный режим */ }
}

export default function PairingsPage() {
  const [restaurantId, setRestaurantId] = useState(() => readStore(localStorage, 'pairings_restaurant_id'))
  const [token, setToken] = useState(() => readStore(sessionStorage, 'pairings_admin_token'))
  const [pairs, setPairs] = useState<Pair[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [state, setState] = useState<PairingState | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)
  const [editing, setEditing] = useState<Pair | null>(null)
  const [adding, setAdding] = useState(false)
  const [editForm] = Form.useForm()
  const [addForm] = Form.useForm()
  const pollRef = useRef<number | null>(null)

  const call = useCallback(async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token, ...init.headers },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `Ошибка ${res.status}`)
    return json
  }, [token])

  const load = useCallback(async () => {
    if (!restaurantId || !token) return
    setLoading(true)
    setLoadError('')
    try {
      const data = await call(`/api/pairings/admin?restaurantId=${encodeURIComponent(restaurantId)}`)
      setPairs(data.pairs || [])
      setMenu(data.menu || [])
      setState(data.state || null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [call, restaurantId, token])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current) }, [])

  const saveAccess = (values: { restaurantId: string; token: string }) => {
    writeStore(localStorage, 'pairings_restaurant_id', values.restaurantId.trim())
    writeStore(sessionStorage, 'pairings_admin_token', values.token.trim())
    setRestaurantId(values.restaurantId.trim())
    setToken(values.token.trim())
  }

  // Расчёт идёт на сервере 1–3 минуты: запускаем и опрашиваем состояние.
  const regenerate = async () => {
    try {
      await call('/api/pairings/generate', { method: 'POST', body: JSON.stringify({ restaurantId, force: true }) })
      setState((s) => ({ ...(s || { generated_at: null, pair_count: null, error: null }), status: 'running', started_at: new Date().toISOString() }))
      message.info('Расчёт запущен, займёт 1–3 минуты')
      if (pollRef.current) window.clearInterval(pollRef.current)
      pollRef.current = window.setInterval(async () => {
        try {
          const { state: st } = await call(`/api/pairings/generate?restaurantId=${encodeURIComponent(restaurantId)}`)
          setState(st)
          if (st && st.status !== 'running') {
            if (pollRef.current) window.clearInterval(pollRef.current)
            pollRef.current = null
            if (st.status === 'error') message.error(st.error || 'Расчёт не удался')
            else message.success(`Пары пересчитаны: ${st.pair_count ?? 0}`)
            load()
          }
        } catch { /* следующий опрос */ }
      }, 5000)
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const patch = async (id: string, body: Partial<Pair>) => {
    await call('/api/pairings/admin', { method: 'PATCH', body: JSON.stringify({ restaurantId, id, ...body }) })
  }

  const toggle = async (row: Pair, on: boolean) => {
    const status = on ? 'active' : 'disabled'
    setPairs((list) => list.map((p) => (p.id === row.id ? { ...p, status } : p)))
    try {
      await patch(row.id, { status })
    } catch (e) {
      setPairs((list) => list.map((p) => (p.id === row.id ? { ...p, status: row.status } : p)))
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    const values = await editForm.validateFields()
    try {
      await patch(editing.id, values)
      message.success('Сохранено')
      setEditing(null)
      load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const saveAdd = async () => {
    const values = await addForm.validateFields()
    try {
      await call('/api/pairings/admin', { method: 'POST', body: JSON.stringify({ restaurantId, ...values }) })
      message.success('Пара добавлена')
      setAdding(false)
      addForm.resetFields()
      load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (row: Pair) => {
    try {
      await call('/api/pairings/admin', { method: 'DELETE', body: JSON.stringify({ restaurantId, id: row.id }) })
      setPairs((list) => list.filter((p) => p.id !== row.id))
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pairs.filter((p) => (!onlyActive || p.status === 'active')
      && (!q || `${p.dish_name} ${p.pair_name} ${p.lead}`.toLowerCase().includes(q)))
  }, [pairs, search, onlyActive])

  const menuOptions = useMemo(() => {
    const bySection = new Map<string, MenuItem[]>()
    for (const m of menu) bySection.set(m.section || 'Без раздела', [...(bySection.get(m.section || 'Без раздела') || []), m])
    return [...bySection.entries()].map(([section, items]) => ({
      label: section,
      options: items.map((m) => ({ value: m.id, label: `${m.name} · ${m.price} ₽` })),
    }))
  }, [menu])

  const activeCount = pairs.filter((p) => p.status === 'active').length
  const dishCount = new Set(pairs.filter((p) => p.status === 'active').map((p) => p.dish_id)).size

  const columns = [
    {
      title: 'Блюдо в заказе',
      key: 'dish',
      width: 220,
      render: (_: unknown, r: Pair) => (
        <div>
          <Text strong>{r.dish_name}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.dish_section}</Text></div>
        </div>
      ),
    },
    {
      title: 'Предлагаем',
      key: 'pair',
      width: 200,
      render: (_: unknown, r: Pair) => (
        <div>
          <Text>{r.pair_name}</Text>
          {r.pair_price != null && <div><Text type="secondary" style={{ fontSize: 12 }}>{r.pair_price} ₽</Text></div>}
        </div>
      ),
    },
    {
      title: 'Что увидит гость',
      key: 'text',
      render: (_: unknown, r: Pair) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.lead}</div>
          <Text type="secondary">{r.reason}</Text>
        </div>
      ),
    },
    {
      title: 'Источник',
      key: 'source',
      width: 110,
      render: (_: unknown, r: Pair) => (r.source === 'manual' ? <Tag color="blue">Вручную</Tag> : <Tag>ИИ</Tag>),
    },
    {
      title: 'Показывать',
      key: 'status',
      width: 110,
      render: (_: unknown, r: Pair) => <Switch checked={r.status === 'active'} onChange={(on) => toggle(r, on)} />,
    },
    {
      title: '',
      key: 'actions',
      width: 170,
      render: (_: unknown, r: Pair) => (
        <Space>
          <Button size="small" onClick={() => { setEditing(r); editForm.setFieldsValue({ lead: r.lead, reason: r.reason }) }}>Текст</Button>
          {r.source === 'manual' && (
            <Popconfirm title="Удалить пару?" okText="Удалить" cancelText="Отмена" onConfirm={() => remove(r)}>
              <Button size="small" danger>Удалить</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const st = state?.status ? STATE_LABEL[state.status] : null

  return (
    <div>
      <Title level={4} style={{ marginBottom: 8 }}>Пары блюд</Title>
      <Paragraph type="secondary" style={{ maxWidth: 760 }}>
        Гость кладёт блюдо в заказ — приложение предлагает к нему пару: «К пицце Пепперони отлично подходит салат с бурратой».
        Пары составляет ИИ раз в сутки и при изменении меню. Здесь их можно выключить, поправить текст или добавить свою.
        Выключенная пара не вернётся при следующем расчёте. Пара с поправленным текстом считается ручной и тоже не перезаписывается.
      </Paragraph>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form
          layout="inline"
          initialValues={{ restaurantId, token }}
          onFinish={saveAccess}
        >
          <Form.Item label="ID ресторана" name="restaurantId" rules={[{ required: true, message: 'Укажите ID' }]}>
            <Input style={{ width: 340 }} placeholder="dd89773c-…" />
          </Form.Item>
          <Form.Item label="Токен админки" name="token" rules={[{ required: true, message: 'Укажите токен' }]}>
            <Input.Password style={{ width: 260 }} placeholder="PAIRINGS_ADMIN_TOKEN" />
          </Form.Item>
          <Button type="primary" htmlType="submit">Открыть</Button>
        </Form>
      </Card>

      {loadError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Не удалось загрузить пары" description={loadError} />}

      {restaurantId && token && !loadError && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={16}>
              <Card size="small">
                <Space wrap size="large">
                  <span><Text type="secondary">Активных пар:</Text> <Text strong>{activeCount}</Text></span>
                  <span><Text type="secondary">Блюд с подсказкой:</Text> <Text strong>{dishCount}</Text></span>
                  <span>
                    <Text type="secondary">Последний расчёт:</Text>{' '}
                    {st ? <Tag color={st.color}>{st.text}</Tag> : <Tag>ещё не было</Tag>}
                    {state?.generated_at && <Text type="secondary">{dayjs(state.generated_at).format('DD.MM.YYYY HH:mm')}</Text>}
                  </span>
                </Space>
                {state?.error && <div style={{ marginTop: 8 }}><Text type="danger">{state.error}</Text></div>}
              </Card>
            </Col>
            <Col xs={24} md={8} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Обновить</Button>
              <Button icon={<ThunderboltOutlined />} onClick={regenerate} disabled={state?.status === 'running'}>
                Пересчитать ИИ
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>Своя пара</Button>
            </Col>
          </Row>

          <Card size="small">
            <Space style={{ marginBottom: 12 }} wrap>
              <Input.Search allowClear placeholder="Поиск по блюду или тексту" style={{ width: 300 }} onChange={(e) => setSearch(e.target.value)} />
              <Space><Switch checked={onlyActive} onChange={setOnlyActive} /> <Text>только показываемые</Text></Space>
            </Space>
            <Table
              rowKey="id"
              size="middle"
              loading={loading}
              columns={columns}
              dataSource={visible}
              pagination={{ pageSize: 50, showSizeChanger: false }}
              rowClassName={(r: Pair) => (r.status === 'disabled' ? 'pair-disabled' : '')}
              locale={{ emptyText: 'Пар пока нет. Нажмите «Пересчитать ИИ» или добавьте свою.' }}
            />
          </Card>
        </>
      )}

      <Modal title="Текст подсказки" open={!!editing} onOk={saveEdit} onCancel={() => setEditing(null)} okText="Сохранить" cancelText="Отмена">
        {editing && <Paragraph type="secondary">{editing.dish_name} → {editing.pair_name}</Paragraph>}
        <Form form={editForm} layout="vertical">
          <Form.Item label="Заголовок" name="lead" rules={[{ required: true, message: 'Заполните заголовок' }, { max: 120 }]}>
            <Input showCount maxLength={120} />
          </Form.Item>
          <Form.Item label="Почему подходит" name="reason" rules={[{ required: true, message: 'Заполните пояснение' }, { max: 160 }]}>
            <Input.TextArea showCount maxLength={160} autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Своя пара" open={adding} onOk={saveAdd} onCancel={() => setAdding(false)} okText="Добавить" cancelText="Отмена" width={560}>
        <Paragraph type="secondary">Ручная пара показывается гостю первой, раньше пар от ИИ.</Paragraph>
        <Form form={addForm} layout="vertical">
          <Form.Item label="Когда гость кладёт в заказ" name="dishId" rules={[{ required: true, message: 'Выберите блюдо' }]}>
            <Select showSearch optionFilterProp="label" options={menuOptions} placeholder="Блюдо" />
          </Form.Item>
          <Form.Item label="Предложить" name="pairDishId" rules={[{ required: true, message: 'Выберите пару' }]}>
            <Select showSearch optionFilterProp="label" options={menuOptions} placeholder="Пара" />
          </Form.Item>
          <Form.Item label="Заголовок" name="lead" rules={[{ required: true, message: 'Заполните заголовок' }]}>
            <Input showCount maxLength={120} placeholder="К пицце Пепперони отлично подходит салат с бурратой" />
          </Form.Item>
          <Form.Item label="Почему подходит" name="reason" rules={[{ required: true, message: 'Заполните пояснение' }]}>
            <Input.TextArea showCount maxLength={160} autoSize={{ minRows: 2 }} placeholder="Сливочная буррата и свежие томаты смягчат остроту колбасок" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
