import { useEffect, useMemo, useState } from 'react'
import {
  Alert, AutoComplete, Button, Cascader, Checkbox, Col, Collapse, Drawer, Form, Input, InputNumber, Popconfirm,
  Row, Segmented, Select, Space, Switch, Typography, Upload, message,
} from 'antd'
import { DeleteOutlined, MinusCircleOutlined, PictureOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { adminFetch } from '../../lib/adminApi'
import { resizeDishPhoto } from '../../lib/resizeImage'
import {
  MEAL_LABELS, ROLE_LABELS, TYPE_LABELS, isPopularSection,
  type Dish, type MenuResponse, type ModifierGroup, type ProductType, type TreeNode,
} from './types'

const { Text } = Typography

// Раздел, которого ещё нет в базе (добавлен на странице, блюд пока нет):
// у официанта для него заводится подраздел с тем же названием.
export interface DraftSection { name: string; topId: string | null }

interface FormValues {
  name: string
  section: string
  productType: ProductType
  price: number | null
  weightValue: number | null
  weightUnit: string
  cookTimeMin: number | null
  description: string
  ingredients: string
  kcal: number | null; protein: number | null; fat: number | null; carbs: number | null
  specs: { key: string; value: string }[]
  tags: string[]
  imageUrl: string
  thumbUrl: string
  hidden: boolean
  available: boolean
  inPopular: boolean
  placePath: string[]
  courseRole: string | null
  mealTimes: string[]
  modifiers: ModifierGroup[]
}

const SPEC_KEYS = ['Крепость', 'Полнота', 'Горечь', 'Сладость', 'Кислотность', 'Танины', 'Выдержка', 'Регион', 'Сорт винограда']

// Ссылка не открылась — серый квадрат с подписью.
const NO_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="#f5f5f5"/><text x="50%" y="50%" fill="#999" font-family="sans-serif" font-size="16" text-anchor="middle">фото не открылось</text></svg>')}`

const pathOf = (p: Dish['place'] | undefined) => [p?.sectionId, p?.subsectionId, p?.subSubsectionId].filter(Boolean) as string[]

// Карточка блюда: всё, что видит гость и официант, — добавить или изменить.
export default function DishDrawer({ open, dish, section, data, drafts, sectionsOrder, onClose, onSaved }: {
  open: boolean
  dish: Dish | null // null — новое блюдо
  section: string | null // раздел для нового блюда
  data: MenuResponse
  drafts: DraftSection[]
  sectionsOrder: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const sectionName = Form.useWatch('section', form) || ''
  const productType = Form.useWatch('productType', form) || 'food'
  const imageUrl = Form.useWatch('imageUrl', form)

  const known = (name: string) => data.sections.find((s) => s.name === name)
  const draftOf = (name: string) => drafts.find((d) => d.name === name)
  const twin = dish?.popularTwinId ? data.dishes.find((d) => d.id === dish.popularTwinId) : null
  const hasPopular = data.sections.some((s) => isPopularSection(s.name))

  // Дерево официанта для выбора места; у нового раздела — «новый подраздел».
  const placeOptions = useMemo(() => {
    const isNew = !!sectionName && !known(sectionName)
    type Opt = { value: string; label: string; children?: Opt[] }
    const conv = (n: TreeNode): Opt => ({
      value: n.id, label: n.name, children: n.children?.length ? n.children.map(conv) : undefined,
    })
    return data.tree.map((top) => {
      const o = conv(top)
      if (isNew) o.children = [{ value: 'new', label: `Новый подраздел «${sectionName}»` }, ...(o.children || [])]
      return o
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sectionName])

  useEffect(() => {
    if (!open) return
    const sec = dish?.section || section || data.sections[0]?.name || ''
    const draft = draftOf(sec)
    const defaultPlace = dish ? pathOf(dish.place) : draft ? [draft.topId, 'new'].filter(Boolean) as string[] : pathOf(known(sec)?.place)
    const sibling = data.dishes.find((d) => d.section === sec)
    form.resetFields()
    form.setFieldsValue({
      name: dish?.name || '',
      section: sec,
      productType: dish?.productType || sibling?.productType || 'food',
      price: dish?.price ?? null,
      weightValue: dish?.weight?.value ?? null,
      weightUnit: dish?.weight?.unit || (sibling?.productType && sibling.productType !== 'food' ? 'мл' : 'г'),
      cookTimeMin: dish?.cookTimeMin ?? null,
      description: dish?.description || '',
      ingredients: (dish?.ingredients || []).join(', '),
      kcal: dish?.kbju?.kcal ?? null, protein: dish?.kbju?.protein ?? null, fat: dish?.kbju?.fat ?? null, carbs: dish?.kbju?.carbs ?? null,
      specs: dish?.specs || [],
      tags: dish?.tags || [],
      imageUrl: dish?.imageUrl || '',
      thumbUrl: dish?.thumbUrl || '',
      hidden: dish?.hidden ?? false,
      available: dish?.available ?? true,
      inPopular: !!dish?.popularTwinId,
      placePath: defaultPlace,
      courseRole: dish?.courseRole || null,
      mealTimes: dish?.mealTimes || [],
      modifiers: dish?.modifiers || [],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dish, section])

  // Сменили раздел у нового блюда — место у официанта берём из раздела.
  const onSectionChange = (name: string) => {
    if (dish) return
    const draft = draftOf(name)
    form.setFieldValue('placePath', draft ? [draft.topId, 'new'].filter(Boolean) : pathOf(known(name)?.place))
  }

  const save = async () => {
    try {
      await form.validateFields()
    } catch (e) {
      const first = (e as { errorFields?: { name: (string | number)[] }[] }).errorFields?.[0]
      if (first) form.scrollToField(first.name, { behavior: 'smooth', block: 'center' })
      message.error('Проверьте поля, отмеченные красным')
      return
    }
    // Все значения формы, в том числе из свёрнутых блоков.
    const v = form.getFieldsValue(true) as FormValues
    const [sectionId, subsectionId, subSubsectionId] = v.placePath || []
    const body = {
      ...(dish ? { id: dish.id } : {}),
      name: v.name,
      section: v.section,
      sectionsOrder,
      productType: v.productType,
      price: v.price,
      weight: v.weightValue ? { value: v.weightValue, unit: v.weightUnit } : null,
      cookTimeMin: v.cookTimeMin,
      description: v.description,
      ingredients: v.ingredients,
      kbju: { kcal: v.kcal, protein: v.protein, fat: v.fat, carbs: v.carbs },
      specs: v.specs,
      tags: v.tags,
      imageUrl: v.imageUrl,
      thumbUrl: v.thumbUrl,
      hidden: v.hidden,
      available: v.available,
      inPopular: v.inPopular,
      place: { sectionId: sectionId || null, subsectionId: subsectionId || null, subSubsectionId: subSubsectionId || null },
      courseRole: v.courseRole,
      mealTimes: v.mealTimes,
      modifiers: v.modifiers || [],
    }
    setSaving(true)
    try {
      await adminFetch('/api/admin/menu', { method: dish ? 'PATCH' : 'POST', body })
      message.success(dish ? 'Блюдо сохранено' : 'Блюдо добавлено в меню')
      onSaved()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  // Фото с компьютера: браузер уменьшает его, сервер кладёт в хранилище и
  // отдаёт ссылки; в меню они попадут, когда блюдо сохранят.
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { photo, thumb } = await resizeDishPhoto(file)
      const r = await adminFetch<{ imageUrl: string; thumbUrl: string }>('/api/admin/menu-photo', { method: 'POST', body: { dishId: dish?.id, photo, thumb } })
      form.setFieldsValue({ imageUrl: r.imageUrl, thumbUrl: r.thumbUrl })
      message.success('Фото загружено. Нажмите «Сохранить», чтобы оно появилось в меню')
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    if (!dish) return
    try {
      await adminFetch('/api/admin/menu', { method: 'DELETE', query: { id: dish.id } })
      message.success('Блюдо удалено')
      onSaved()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const sectionOptions = [...sectionsOrder.map((n) => ({ value: n, label: n }))]
  const isPopularCopy = !!dish && isPopularSection(dish.section)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={720}
      title={dish ? dish.name : 'Новое блюдо'}
      forceRender
      rootClassName="dish-drawer"
      afterOpenChange={(o) => { if (o) document.querySelector('.dish-drawer .ant-drawer-body')?.scrollTo(0, 0) }}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {dish ? (
            <Popconfirm
              title="Удалить блюдо из меню?"
              description="Если его уже заказывали, удалить не получится — тогда скройте его."
              okText="Удалить" okButtonProps={{ danger: true }} cancelText="Нет" onConfirm={remove}
            >
              <Button danger icon={<DeleteOutlined />}>Удалить</Button>
            </Popconfirm>
          ) : <span />}
          <Space>
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" loading={saving} onClick={save}>{dish ? 'Сохранить' : 'Добавить в меню'}</Button>
          </Space>
        </div>
      )}
    >
      {twin && (
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          title={isPopularCopy ? `Это блюдо стоит и в разделе «${twin.section}»` : 'Это блюдо показывается и в «Популярном»'}
          description="Название, цена, состав, КБЖУ и фото меняются сразу в обоих разделах."
        />
      )}
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={14}>
            <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}>
              <Input maxLength={200} placeholder="Борщ с говядиной" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name="section" label="Раздел меню" rules={[{ required: true, message: 'Выберите раздел' }]}>
              <Select options={sectionOptions} onChange={onSectionChange} disabled={isPopularCopy} showSearch />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} md={10}>
            <Form.Item name="productType" label="Тип">
              <Segmented block options={(['food', 'drink', 'alcohol'] as ProductType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))} />
            </Form.Item>
          </Col>
          <Col xs={12} md={5}>
            <Form.Item name="price" label="Цена, ₽" rules={[{ required: true, message: 'Укажите цену' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={9}>
            <Form.Item label={productType === 'food' ? 'Вес порции' : 'Объём'}>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="weightValue" noStyle><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="weightUnit" noStyle>
                  <Select style={{ width: 76 }} options={data.options.weightUnits.map((u) => ({ value: u, label: u }))} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Описание для гостя">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder="Классический борщ на говяжьем бульоне с бородинским хлебом и сметаной" />
        </Form.Item>
        <Form.Item name="ingredients" label="Состав" extra="Ингредиенты через запятую — гость видит их списком">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} placeholder="свекла, капуста, говядина, сметана" />
        </Form.Item>

        {productType !== 'alcohol' && (
          <>
            <Text strong>КБЖУ на порцию</Text>
            <Row gutter={12} style={{ marginTop: 8 }}>
              <Col xs={12} md={6}><Form.Item name="kcal" label="Калории, ккал"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item name="protein" label="Белки, г"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item name="fat" label="Жиры, г"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item name="carbs" label="Углеводы, г"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </>
        )}

        {productType !== 'food' && (
          <Form.Item label="Свойства напитка" extra="Гость видит их в карточке: «Крепость» — рядом с ценой, остальное — строками">
            <Form.List name="specs">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((f) => (
                    <Space key={f.key} align="baseline" style={{ display: 'flex', marginBottom: 4 }}>
                      <Form.Item name={[f.name, 'key']} noStyle><AutoComplete style={{ width: 200 }} options={SPEC_KEYS.map((k) => ({ value: k }))} placeholder="Крепость" /></Form.Item>
                      <Form.Item name={[f.name, 'value']} noStyle><Input style={{ width: 220 }} placeholder="12" /></Form.Item>
                      <MinusCircleOutlined onClick={() => remove(f.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ key: '', value: '' })}>Свойство</Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        )}

        <Form.Item label="Фото" extra="JPG, PNG или WebP — можно перетащить файл в рамку. Фото само уменьшится для меню.">
          <Row gutter={12} align="middle">
            <Col xs={24} md={10}>
              <Upload.Dragger
                accept="image/*"
                showUploadList={false}
                disabled={uploading}
                beforeUpload={(file) => { upload(file); return Upload.LIST_IGNORE }}
                style={{ padding: 0 }}
              >
                {imageUrl
                  ? <img key={imageUrl} src={imageUrl} alt="" className="dish-photo" onError={(e) => { e.currentTarget.src = NO_PHOTO }} />
                  : (
                    <div className="dish-photo dish-photo--empty">
                      <PictureOutlined style={{ fontSize: 28 }} />
                      <div>Перетащите фото или нажмите</div>
                    </div>
                  )}
              </Upload.Dragger>
            </Col>
            <Col xs={24} md={14}>
              <Space wrap style={{ marginBottom: 8 }}>
                <Upload accept="image/*" showUploadList={false} beforeUpload={(file) => { upload(file); return Upload.LIST_IGNORE }}>
                  <Button icon={<UploadOutlined />} loading={uploading}>{imageUrl ? 'Заменить фото' : 'Загрузить с компьютера'}</Button>
                </Upload>
                {imageUrl && <Button icon={<DeleteOutlined />} onClick={() => form.setFieldsValue({ imageUrl: '', thumbUrl: '' })}>Убрать</Button>}
              </Space>
              <Form.Item name="imageUrl" noStyle rules={[{ pattern: /^(https?:\/\/.+)?$/, message: 'Ссылка должна начинаться с https://' }]}>
                {/* Своя ссылка — прежняя миниатюра уже не к этому фото. */}
                <Input placeholder="или вставьте ссылку на фото: https://…" allowClear size="small" onChange={() => form.setFieldValue('thumbUrl', '')} />
              </Form.Item>
              <Form.Item name="thumbUrl" hidden><Input /></Form.Item>
            </Col>
          </Row>
        </Form.Item>

        <Row gutter={12}>
          <Col xs={12} md={8}>
            <Form.Item name="cookTimeMin" label="Готовится, мин" extra="Норматив кухни">
              <InputNumber min={0} max={600} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item name="tags" label="Теги" extra="Помогают ИИ подбирать блюда: «острое», «вегетарианское», «рыба»…">
              <Select mode="tags" tokenSeparators={[',']} placeholder="острое, вегетарианское" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={12} md={8}>
            <Form.Item name="hidden" label="Скрыть от гостя" valuePropName="checked" extra="Официант видит">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item name="available" label="В продаже" valuePropName="checked" extra="Временно — через «Кухню» → стоп">
              <Switch />
            </Form.Item>
          </Col>
          {hasPopular && !isPopularCopy && (
            <Col xs={24} md={8}>
              <Form.Item name="inPopular" label="В «Популярном»" valuePropName="checked" extra="Показать и в этом разделе">
                <Switch />
              </Form.Item>
            </Col>
          )}
        </Row>

        {data.tree.length > 0 && (
          <Form.Item
            name="placePath"
            label="Где блюдо у официанта"
            extra="Раздел в приложении официанта"
            rules={[{ required: true, message: 'Выберите раздел у официанта' }]}
          >
            <Cascader options={placeOptions} changeOnSelect placeholder="Еда → Супы" style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Collapse
          key={dish?.id || 'new'}
          size="small"
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'mods',
              forceRender: true,
              label: `Добавки и варианты${dish?.modifiers.length ? ` (${dish.modifiers.length})` : ''}`,
              children: <ModifiersEditor />,
            },
            {
              key: 'ai',
              forceRender: true,
              label: 'Для подсказок ИИ: роль в заказе и время подачи',
              children: (
                <>
                  <Form.Item name="courseRole" label="Роль в заказе" extra="Пусто — ИИ определит по разделу и названию">
                    <Select allowClear options={data.options.courseRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] || r }))} placeholder="определить автоматически" />
                  </Form.Item>
                  <Form.Item name="mealTimes" label="Когда предлагать" extra="Пусто — в любое время">
                    <Checkbox.Group options={data.options.mealTimes.map((m) => ({ value: m, label: MEAL_LABELS[m] || m }))} />
                  </Form.Item>
                </>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  )
}

// Группы добавок («Прожарка», «Соус») и варианты в них с доплатой.
function ModifiersEditor() {
  return (
    <Form.List name="modifiers">
      {(groups, { add, remove }) => (
        <>
          {groups.map((g) => (
            <div key={g.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <Space wrap align="baseline">
                <Form.Item name={[g.name, 'name']} noStyle rules={[{ required: true, whitespace: true, message: 'Название группы' }]}>
                  <Input placeholder="Прожарка" style={{ width: 200 }} />
                </Form.Item>
                <Form.Item name={[g.name, 'type']} noStyle initialValue="single">
                  <Select style={{ width: 170 }} options={[{ value: 'single', label: 'выбрать один' }, { value: 'multi', label: 'можно несколько' }]} />
                </Form.Item>
                <Form.Item name={[g.name, 'required']} noStyle valuePropName="checked"><Checkbox>обязательно</Checkbox></Form.Item>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(g.name)} />
              </Space>
              <Form.List name={[g.name, 'options']}>
                {(opts, o) => (
                  <div style={{ marginTop: 8, paddingLeft: 12 }}>
                    {opts.map((f) => (
                      <Space key={f.key} align="baseline" style={{ display: 'flex', marginBottom: 4 }}>
                        <Form.Item name={[f.name, 'name']} noStyle rules={[{ required: true, whitespace: true }]}><Input placeholder="Medium" style={{ width: 200 }} /></Form.Item>
                        <Form.Item name={[f.name, 'priceDelta']} noStyle><InputNumber placeholder="+0" suffix="₽" style={{ width: 120 }} /></Form.Item>
                        <Form.Item name={[f.name, 'available']} noStyle valuePropName="checked" initialValue><Checkbox>есть</Checkbox></Form.Item>
                        <MinusCircleOutlined onClick={() => o.remove(f.name)} />
                      </Space>
                    ))}
                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => o.add({ name: '', priceDelta: 0, available: true })}>Вариант</Button>
                  </div>
                )}
              </Form.List>
            </div>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', type: 'single', required: false, options: [{ name: '', priceDelta: 0, available: true }] })}>
            Группа добавок
          </Button>
        </>
      )}
    </Form.List>
  )
}
