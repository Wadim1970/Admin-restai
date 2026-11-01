import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Collapse, Drawer, Empty, Popconfirm, Space, Spin, Tag, Typography, message } from 'antd'
import { CheckOutlined, CloseOutlined, RobotOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminFetch, ApiError } from '../../lib/adminApi'
import FactEditor, { emptyValue } from './FactEditor'
import {
  FACT_ORDER, LEVEL_LABELS, MISSING_LABELS, SOURCE_LABELS, STATUS_COLORS, STATUS_LABELS,
  type DishFact, type DishResponse, type FactMeta, type FactType, type FactValue, type StudioResponse,
} from './types'

const { Text } = Typography

interface Props {
  dishId: string | null
  actor: string
  meta: StudioResponse['meta']
  onClose: () => void
  onChanged: () => void
}

// Что сейчас в меню по факту — чтобы шеф видел, из-за чего факт вернулся в черновик.
function menuNow(type: FactType, dish: DishResponse['dish']): string | null {
  switch (type) {
    case 'weight': return dish.weight ? `${dish.weight.value} ${dish.weight.unit}` : 'не указана'
    case 'cooking_time_min': return dish.cookTimeMin != null ? `${dish.cookTimeMin} мин` : 'не указано'
    case 'ingredients': return dish.ingredients.join(', ') || 'не указан'
    case 'guest_description': return dish.description || 'не указано'
    default: return null
  }
}

const ACTION_LABELS: Record<string, string> = {
  seed: 'взят из меню', edit: 'правка', confirm: 'подтверждено', reject: 'отклонено', reset: 'в черновик', ai_draft: 'черновик ИИ',
  menu_changed: 'меню изменилось → черновик', menu_refresh: 'обновлено из меню', batch_confirm: 'пакетно подтверждено',
}

function FactCard({ meta, fact, ctx, allergens, actor, busy, onSave, onStatus }: {
  meta: FactMeta
  fact: DishFact | undefined
  ctx: DishResponse
  allergens: { code: string; name: string }[]
  actor: string
  busy: boolean
  onSave: (value: FactValue, confirm: boolean) => void
  onStatus: (action: 'reject' | 'reset') => void
}) {
  const initial = fact ? (fact.value.na ? emptyValue(meta.key) : fact.value) : emptyValue(meta.key)
  const [value, setValue] = useState<FactValue>(initial)
  const [na, setNa] = useState(!!fact?.value?.na)
  // Факт на сервере изменился (сохранили, обновили из меню) — редактор берёт свежее значение.
  useEffect(() => {
    setValue(fact ? (fact.value.na ? emptyValue(meta.key) : fact.value) : emptyValue(meta.key))
    setNa(!!fact?.value?.na)
  }, [fact, meta.key])

  const payload = () => (na ? { na: true } : value)
  const hint = meta.key === 'allergens' ? Object.entries(ctx.allergenHints) : []
  const allergenName = (code: string) => allergens.find((a) => a.code === code)?.name || code

  return (
    <div className="trainer-fact">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Text strong>{meta.label}</Text>
        {fact ? <Tag color={STATUS_COLORS[fact.status]}>{STATUS_LABELS[fact.status]}</Tag> : <Tag>нет данных</Tag>}
        {fact && <Tag variant="filled">{SOURCE_LABELS[fact.source]}</Tag>}
        {fact?.reviewNote === 'menu_changed' && <Tag color="orange" icon={<WarningOutlined />}>меню изменилось — проверьте</Tag>}
      </div>

      {fact?.reviewNote === 'menu_changed' && menuNow(meta.key, ctx.dish) && (
        <Alert type="warning" showIcon style={{ marginBottom: 8 }} title={`В меню сейчас: ${menuNow(meta.key, ctx.dish)}`} description="Проверьте значение ниже и подтвердите заново." />
      )}

      {hint.length > 0 && !na && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          title="Подсказка по составу — не вердикт"
          description={(
            <div>
              {hint.map(([code, words]) => (
                <div key={code}>{allergenName(code)}: {words.join(', ')}</div>
              ))}
              <Button size="small" style={{ marginTop: 6 }} onClick={() => setValue({ codes: hint.map(([c]) => c) })}>Подставить в форму</Button>
            </div>
          )}
        />
      )}

      {na ? (
        <Text type="secondary">Отмечено «не применимо» — в тренажёре этот факт не спрашивается.</Text>
      ) : (
        <FactEditor type={meta.key} value={value} onChange={setValue} allergens={allergens} alcohol={ctx.alcohol} />
      )}

      <Space wrap style={{ marginTop: 10 }}>
        <Button disabled={!actor || busy} onClick={() => onSave(payload(), false)}>Сохранить черновик</Button>
        <Button type="primary" icon={<CheckOutlined />} disabled={!actor || busy} onClick={() => onSave(payload(), true)}>Подтвердить</Button>
        {meta.na && !na && <Button disabled={busy} onClick={() => setNa(true)}>Не применимо</Button>}
        {meta.na && na && <Button disabled={busy} onClick={() => setNa(false)}>Заполнить</Button>}
        {fact && fact.status !== 'rejected' && (
          <Popconfirm title="Отклонить факт?" description="Он не попадёт в тренажёр." okText="Отклонить" cancelText="Отмена" onConfirm={() => onStatus('reject')}>
            <Button danger icon={<CloseOutlined />} disabled={!actor || busy}>Отклонить</Button>
          </Popconfirm>
        )}
        {fact && fact.status === 'rejected' && <Button disabled={!actor || busy} onClick={() => onStatus('reset')}>Вернуть в черновик</Button>}
      </Space>
      {fact?.status === 'confirmed' && fact.confirmedBy && (
        <div><Text type="secondary" style={{ fontSize: 12 }}>Подтвердил: {fact.confirmedBy}{fact.confirmedAt ? `, ${dayjs(fact.confirmedAt).format('D MMM YYYY, HH:mm')}` : ''}</Text></div>
      )}
    </div>
  )
}

export default function FactDrawer({ dishId, actor, meta, onClose, onChanged }: Props) {
  const [data, setData] = useState<DishResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!dishId) return
    setLoading(true)
    try {
      setData(await adminFetch<DishResponse>('/api/admin/trainer-facts', { query: { dishId } }))
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось загрузить блюдо')
    } finally {
      setLoading(false)
    }
  }, [dishId])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  const run = async (body: Record<string, unknown>, okText?: string) => {
    setBusy(true)
    try {
      const res = await adminFetch<Record<string, unknown>>('/api/admin/trainer-facts', { method: 'POST', body: { actor, dishId, ...body } })
      if (okText) message.success(okText)
      await load()
      onChanged()
      return res
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  const askAi = async () => {
    const res = await run({ action: 'ai_draft' })
    const created = (res?.created as string[] | undefined) || []
    if (res) message[created.length ? 'success' : 'info'](created.length ? `ИИ предложил черновики: ${created.length}. Проверьте и подтвердите.` : 'ИИ ничего не добавил: пустых фактов для него нет.')
  }

  const factMap = new Map((data?.facts || []).map((f) => [f.type, f]))
  const cards = FACT_ORDER.map((t) => meta.factTypes.find((m) => m.key === t)).filter((m): m is FactMeta => !!m)

  return (
    <Drawer open={!!dishId} onClose={onClose} size={620} title={data?.dish.name || 'Блюдо'} destroyOnHidden>
      {loading && !data && <Spin style={{ display: 'block', margin: '40px auto' }} />}
      {data && (
        <>
          {!actor && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Укажите имя вверху страницы — без него нельзя сохранять и подтверждать." />}

          <Space wrap style={{ marginBottom: 8 }}>
            <Text type="secondary">{data.dish.section}</Text>
            {([1, 2, 3] as const).map((lv) => {
              const r = data.ready[lv]
              if (r.ready === null) return <Tag key={lv}>{LEVEL_LABELS[lv]}: не нужен</Tag>
              return r.ready
                ? <Tag key={lv} color="green">{LEVEL_LABELS[lv]}: готово</Tag>
                : <Tag key={lv} color="orange">{LEVEL_LABELS[lv]}: нужно — {r.missing.map((m) => MISSING_LABELS[m] || m).join(', ')}</Tag>
            })}
          </Space>

          <Collapse
            size="small"
            style={{ marginBottom: 12 }}
            items={[{
              key: 'menu',
              label: 'Данные блюда в меню',
              children: (
                <div style={{ fontSize: 13 }}>
                  <div>Описание: {data.dish.description || '—'}</div>
                  <div>Состав: {data.dish.ingredients.join(', ') || '—'}</div>
                  <div>Порция: {data.dish.weight ? `${data.dish.weight.value} ${data.dish.weight.unit}` : '—'}; готовится: {data.dish.cookTimeMin != null ? `${data.dish.cookTimeMin} мин` : '—'}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Меню правится в разделе «Ресторан → Меню». Изменение данных вернёт подтверждённые факты в черновики.</Text>
                </div>
              ),
            }]}
          />

          <Popconfirm
            title="Попросить ИИ набросать черновики?"
            description="Заполнит только пустые факты (соус, прожарка, вкус, описание, без глютена/молочного). Подтверждать их всё равно вам."
            okText="Да" cancelText="Отмена" onConfirm={askAi}
          >
            <Button icon={<RobotOutlined />} disabled={!actor || busy} style={{ marginBottom: 12 }}>Черновики от ИИ</Button>
          </Popconfirm>

          {cards.map((m) => (
            <FactCard
              key={m.key}
              meta={m}
              fact={factMap.get(m.key as FactType)}
              ctx={data}
              allergens={meta.allergens}
              actor={actor}
              busy={busy}
              onSave={(value, confirm) => run({ action: 'save', factType: m.key, value, confirm }, confirm ? 'Подтверждено' : 'Сохранено как черновик')}
              onStatus={(action) => run({ action, factType: m.key }, action === 'reject' ? 'Отклонено' : 'Возвращено в черновик')}
            />
          ))}

          <Collapse
            size="small"
            style={{ marginTop: 12 }}
            items={[{
              key: 'log',
              label: `Журнал изменений (${data.log.length})`,
              children: data.log.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пока пусто" /> : (
                <div style={{ fontSize: 12 }}>
                  {data.log.map((l, i) => (
                    <div key={i}>{dayjs(l.at).format('D MMM HH:mm')} · {meta.factTypes.find((f) => f.key === l.type)?.label || l.type} · {ACTION_LABELS[l.action] || l.action} · {l.actor}</div>
                  ))}
                </div>
              ),
            }]}
          />
        </>
      )}
    </Drawer>
  )
}
