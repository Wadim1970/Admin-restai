import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Spin, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, EyeInvisibleOutlined, PlusOutlined, SearchOutlined, SwapOutlined,
} from '@ant-design/icons'
import { adminFetch } from '../../lib/adminApi'
import { money } from '../hall/format'
import DishDrawer, { type DraftSection } from './DishDrawer'
import { TYPE_LABELS, isPopularSection, type Dish, type MenuResponse } from './types'

const { Title, Text } = Typography

function kbjuLine(d: Dish) {
  const k = d.kbju
  if (!k) return null
  return [k.kcal != null && `${k.kcal} ккал`, k.protein != null && `Б ${k.protein}`, k.fat != null && `Ж ${k.fat}`, k.carbs != null && `У ${k.carbs}`].filter(Boolean).join(' · ')
}

function DishRow({ d, onOpen }: { d: Dish; onOpen: () => void }) {
  const img = d.thumbUrl || d.imageUrl
  const facts = [
    d.weight && `${d.weight.value} ${d.weight.unit}`,
    d.cookTimeMin != null && `готовится ${d.cookTimeMin} мин`,
    kbjuLine(d),
    ...d.specs.map((s) => `${s.key}: ${s.value}${/крепост/i.test(s.key) && !/%$/.test(s.value) ? '%' : ''}`),
    d.grape,
    d.vintage && `${d.vintage} г.`,
  ].filter(Boolean)
  return (
    <div className="menu-dish" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      {img ? <img src={img} alt="" className="menu-dish__img" loading="lazy" /> : <div className="menu-dish__img menu-dish__img--none" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text strong>{d.name}</Text>
          {d.productType !== 'food' && <Tag>{TYPE_LABELS[d.productType]}</Tag>}
          {d.hidden && <Tag icon={<EyeInvisibleOutlined />}>скрыто от гостя</Tag>}
          {d.stopped && <Tag color="red">стоп</Tag>}
          {!d.available && <Tag color="orange">не в продаже</Tag>}
          {d.popularTwinId && !isPopularSection(d.section) && <Tag color="gold">в «Популярном»</Tag>}
          {d.modifiers.length > 0 && <Tag color="blue">добавки: {d.modifiers.map((m) => m.name).join(', ')}</Tag>}
        </div>
        {facts.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{facts.join(' · ')}</Text>}
        {d.description && <div className="menu-dish__line">{d.description}</div>}
        {d.ingredients.length > 0 && <div className="menu-dish__line menu-dish__line--muted">{d.productType === 'alcohol' ? 'Вкус' : 'Состав'}: {d.ingredients.join(', ')}</div>}
        {d.aroma && <div className="menu-dish__line menu-dish__line--muted">Аромат: {d.aroma}</div>}
        {d.tags.length > 0 && <div style={{ marginTop: 2 }}>{d.tags.map((t) => <Tag key={t} variant="filled" style={{ fontSize: 11 }}>{t}</Tag>)}</div>}
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <Text strong style={{ fontSize: 15 }}>{money(d.price)}</Text>
        <div><Button type="link" size="small" icon={<EditOutlined />} style={{ padding: 0 }}><span className="menu-dish__edit">Изменить</span></Button></div>
      </div>
    </div>
  )
}

type SectionDialog = { mode: 'add' } | { mode: 'rename'; name: string } | { mode: 'move'; name: string } | null

// Раздел «Меню»: все блюда по разделам гостевого меню — состав, КБЖУ, цена,
// фото, добавки. Добавить и изменить блюдо, добавить, переименовать,
// переставить и удалить раздел.
export default function MenuPage() {
  const [data, setData] = useState<MenuResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<(DraftSection & { after: string | null })[]>([])
  const [editing, setEditing] = useState<{ dish: Dish | null; section: string | null } | null>(null)
  const [dialog, setDialog] = useState<SectionDialog>(null)
  const [dialogForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await adminFetch<MenuResponse>('/api/admin/menu')
      setData(d)
      setError('')
      // Раздел-черновик, в котором появилось блюдо, — уже настоящий.
      setDrafts((cur) => cur.filter((x) => !d.sections.some((s) => s.name === x.name)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Порядок разделов: из базы + добавленные на странице (после выбранного).
  const order = useMemo(() => {
    const names = (data?.sections || []).map((s) => s.name)
    for (const d of drafts) {
      const i = d.after == null ? -1 : names.indexOf(d.after)
      names.splice(i + 1, 0, d.name)
    }
    return names
  }, [data, drafts])

  const q = search.trim().toLowerCase()
  const dishesOf = (name: string) => (data?.dishes || []).filter((d) => d.section === name
    && (!q || d.name.toLowerCase().includes(q) || d.ingredients.some((i) => i.toLowerCase().includes(q)) || d.description.toLowerCase().includes(q)))

  const sectionCall = async (section: Record<string, unknown>, done: string) => {
    try {
      await adminFetch('/api/admin/menu', { method: 'PATCH', body: { section } })
      message.success(done)
      await load()
      return true
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const move = async (name: string, dir: -1 | 1) => {
    const next = [...order]
    const i = next.indexOf(name)
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    const draft = drafts.find((d) => d.name === name)
    if (draft) { // черновик двигаем только на странице
      setDrafts((cur) => cur.map((d) => (d.name === name ? { ...d, after: next[j - 1] ?? null } : d)))
      return
    }
    await sectionCall({ op: 'order', order: next.filter((n) => !drafts.some((d) => d.name === n)) }, 'Порядок разделов сохранён')
  }

  const removeSection = async (name: string) => {
    if (drafts.some((d) => d.name === name)) {
      setDrafts((cur) => cur.filter((d) => d.name !== name))
      return
    }
    await sectionCall({ op: 'delete', name }, `Раздел «${name}» удалён`)
  }

  const openDialog = (d: SectionDialog) => setDialog(d)
  // Форма окна создаётся заново при каждом открытии — со своими начальными значениями.
  const dialogInitial = dialog?.mode === 'rename'
    ? { name: dialog.name }
    : dialog?.mode === 'add' ? { after: order[order.length - 1] ?? null, topId: data?.tree[0]?.id ?? null } : {}

  const submitDialog = async () => {
    const v = await dialogForm.validateFields()
    if (!dialog) return
    if (dialog.mode === 'add') {
      const name = String(v.name).trim()
      if (order.some((n) => n.toLowerCase() === name.toLowerCase())) {
        message.error(`Раздел «${name}» уже есть`)
        return
      }
      setDrafts((cur) => [...cur, { name, topId: v.topId ?? null, after: v.after ?? null }])
      setDialog(null)
      setEditing({ dish: null, section: name })
      return
    }
    if (dialog.mode === 'rename') {
      const to = String(v.name).trim()
      if (drafts.some((d) => d.name === dialog.name)) {
        setDrafts((cur) => cur.map((d) => (d.name === dialog.name ? { ...d, name: to } : d)))
        setDialog(null)
        return
      }
      if (await sectionCall({ op: 'rename', name: dialog.name, to }, 'Раздел переименован')) setDialog(null)
      return
    }
    if (await sectionCall({ op: 'move', name: dialog.name, to: v.to }, 'Блюда перенесены')) setDialog(null)
  }

  const total = data?.dishes.length || 0
  const hiddenTotal = data?.dishes.filter((d) => d.hidden).length || 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Меню{data ? ` · ${data.restaurant.name}` : ''}</Title>
          {data && <Text type="secondary">{order.length} разделов · {total} блюд{hiddenTotal ? `, скрыто от гостя ${hiddenTotal}` : ''}</Text>}
        </div>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Блюдо или ингредиент" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
          <Button icon={<PlusOutlined />} onClick={() => openDialog({ mode: 'add' })} disabled={!data}>Раздел</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ dish: null, section: order[0] || null })} disabled={!data || !order.length}>Блюдо</Button>
        </Space>
      </div>
      {error && <Alert type="error" showIcon title="Не удалось загрузить меню" description={error} action={<Button onClick={load}>Ещё раз</Button>} style={{ marginBottom: 16 }} />}
      {!data ? (!error && <Spin />) : (
        <Spin spinning={loading}>
          <Row gutter={16}>
            <Col xs={0} lg={6}>
              <Card size="small" title="Разделы" className="menu-nav">
                {order.map((name, i) => {
                  const s = data.sections.find((x) => x.name === name)
                  return (
                    <a key={name} href={`#menu-sec-${i}`} className="menu-nav__item">
                      <span>{name}</span>
                      <Text type="secondary">{s ? s.dishes : 'новый'}</Text>
                    </a>
                  )
                })}
              </Card>
            </Col>
            <Col xs={24} lg={18}>
              {order.map((name, i) => {
                const s = data.sections.find((x) => x.name === name)
                const list = dishesOf(name)
                if (q && !list.length) return null
                return (
                  <Card
                    key={name}
                    id={`menu-sec-${i}`}
                    size="small"
                    className="menu-section"
                    style={{ marginBottom: 12, scrollMarginTop: 80 }}
                    title={(
                      <span>
                        {name}{' '}
                        <Text type="secondary" style={{ fontWeight: 400 }}>
                          {s ? `${s.dishes} блюд${s.hidden ? `, скрыто ${s.hidden}` : ''}` : 'новый раздел'}
                        </Text>
                      </span>
                    )}
                    extra={(
                      <Space size={0} wrap>
                        <Tooltip title="Выше"><Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(name, -1)} /></Tooltip>
                        <Tooltip title="Ниже"><Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={i === order.length - 1} onClick={() => move(name, 1)} /></Tooltip>
                        <Tooltip title="Переименовать"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openDialog({ mode: 'rename', name })} /></Tooltip>
                        {s && s.dishes > 0 && <Tooltip title="Перенести все блюда в другой раздел"><Button type="text" size="small" icon={<SwapOutlined />} onClick={() => openDialog({ mode: 'move', name })} /></Tooltip>}
                        {s && s.dishes > 0
                          ? <Tooltip title="В разделе есть блюда — сначала перенесите или удалите их"><Button type="text" size="small" icon={<DeleteOutlined />} disabled /></Tooltip>
                          : (
                            <Popconfirm title={`Удалить раздел «${name}»?`} okText="Удалить" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={() => removeSection(name)}>
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          )}
                        <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setEditing({ dish: null, section: name })}>Блюдо</Button>
                      </Space>
                    )}
                  >
                    {list.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Пока без блюд — гость увидит раздел, когда в нём появится первое блюдо"
                      >
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ dish: null, section: name })}>Добавить блюдо</Button>
                      </Empty>
                    ) : list.map((d) => <DishRow key={d.id} d={d} onOpen={() => setEditing({ dish: d, section: name })} />)}
                  </Card>
                )
              })}
              {q && order.every((n) => dishesOf(n).length === 0) && <Empty description={`Ничего не нашли по «${search}»`} />}
            </Col>
          </Row>

          <DishDrawer
            open={!!editing}
            dish={editing?.dish || null}
            section={editing?.section || null}
            data={data}
            drafts={drafts}
            sectionsOrder={order}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load() }}
          />
        </Spin>
      )}

      <Modal
        open={!!dialog}
        title={dialog?.mode === 'add' ? 'Новый раздел меню' : dialog?.mode === 'rename' ? `Переименовать «${dialog.name}»` : dialog ? `Перенести блюда из «${dialog.name}»` : ''}
        okText={dialog?.mode === 'add' ? 'Добавить' : dialog?.mode === 'move' ? 'Перенести' : 'Сохранить'}
        cancelText="Отмена"
        onOk={submitDialog}
        onCancel={() => setDialog(null)}
        destroyOnHidden
      >
        <Form form={dialogForm} layout="vertical" preserve={false} initialValues={dialogInitial}>
          {dialog?.mode !== 'move' && (
            <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}>
              <Input maxLength={100} placeholder="Завтраки" autoFocus />
            </Form.Item>
          )}
          {dialog?.mode === 'add' && (
            <>
              <Form.Item name="after" label="Поставить после раздела">
                <Select allowClear placeholder="в самое начало" options={order.map((n) => ({ value: n, label: n }))} />
              </Form.Item>
              {data && data.tree.length > 0 && (
                <Form.Item name="topId" label="У официанта — в разделе" rules={[{ required: true, message: 'Выберите' }]} extra="В приложении официанта появится подраздел с этим названием">
                  <Select options={data.tree.map((t) => ({ value: t.id, label: t.name }))} />
                </Form.Item>
              )}
              <Text type="secondary">Раздел сохранится, когда вы добавите в него первое блюдо.</Text>
            </>
          )}
          {dialog?.mode === 'move' && (
            <Form.Item name="to" label="В раздел" rules={[{ required: true, message: 'Выберите раздел' }]}>
              <Select options={(data?.sections || []).filter((s) => s.name !== dialog.name).map((s) => ({ value: s.name, label: s.name }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
