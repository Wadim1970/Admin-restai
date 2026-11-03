import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Input, Popconfirm, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd'
import { ReloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { adminFetch, ApiError } from '../../lib/adminApi'
import FactDrawer from './FactDrawer'
import {
  LEVEL_LABELS, MISSING_LABELS, type FactType, type LevelReady, type StudioDish, type StudioResponse, type SyncResult,
} from './types'

const { Title, Text } = Typography

const ACTOR_KEY = 'restai_trainer_actor'
const LEVELS = [1, 2, 3] as const

function readActor() {
  try { return localStorage.getItem(ACTOR_KEY) || '' } catch { return '' }
}

function LevelTag({ r }: { r: LevelReady }) {
  if (r.ready === null) return <Text type="secondary">—</Text>
  if (r.ready) return <Tag color="green" style={{ margin: 0 }}>готово</Tag>
  return (
    <Tooltip title={`Нужно подтвердить: ${r.missing.map((m) => MISSING_LABELS[m] || m).join(', ')}`}>
      <Tag color="orange" style={{ margin: 0 }}>не хватает {r.missing.length}</Tag>
    </Tooltip>
  )
}

// Контент-студия тренажёра: факты о блюдах, которые шеф подтверждает.
// В обучение попадают только подтверждённые факты; ИИ и меню дают лишь черновики.
export default function ContentStudioPage() {
  const [data, setData] = useState<StudioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [actor, setActor] = useState(readActor)
  const [section, setSection] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [batchSection, setBatchSection] = useState<string | undefined>()
  const [batchType, setBatchType] = useState<FactType | undefined>()

  const changeActor = (v: string) => {
    setActor(v)
    try { localStorage.setItem(ACTOR_KEY, v) } catch { /* без хранилища просто не запомним */ }
  }

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<StudioResponse>('/api/admin/trainer-facts'))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные')
    }
  }, [])

  const sync = useCallback(async (announce: boolean) => {
    setSyncing(true)
    try {
      const r = await adminFetch<SyncResult>('/api/admin/trainer-facts', { method: 'POST', body: { action: 'sync' } })
      if (announce) {
        message.success(
          r.created || r.returnedToDraft || r.refreshed
            ? `Обновлено: новых черновиков ${r.created}, возвращено в черновик из-за изменений меню ${r.returnedToDraft}, обновлено ${r.refreshed}`
            : 'В меню нет изменений',
        )
      }
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить из меню')
    } finally {
      setSyncing(false)
    }
  }, [load])

  useEffect(() => {
    void (async () => {
      await sync(false)
      setLoading(false)
    })()
  }, [sync])

  const runBatch = async () => {
    if (!batchSection || !batchType) return
    try {
      const r = await adminFetch<{ confirmed: number; skipped: number }>('/api/admin/trainer-facts', {
        method: 'POST', body: { action: 'batch_confirm', actor, section: batchSection, factType: batchType },
      })
      message.success(`Подтверждено: ${r.confirmed}${r.skipped ? `. Пропущено ${r.skipped} — меню изменилось, проверьте по одному` : ''}`)
      await load()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Не удалось подтвердить')
    }
  }

  const dishes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.dishes || []).filter((d) => (
      (!section || d.section === section)
      && (!q || d.name.toLowerCase().includes(q))
      && (!onlyAttention || d.review.length > 0 || Object.values(d.statuses).includes('draft'))
    ))
  }, [data, section, search, onlyAttention])

  const totals = useMemo(() => {
    const t = { 1: { ready: 0, all: 0 }, 2: { ready: 0, all: 0 }, 3: { ready: 0, all: 0 } }
    for (const s of data?.sections || []) for (const lv of LEVELS) { t[lv].ready += s.ready[lv]; t[lv].all += s.applicable[lv] }
    return t
  }, [data])

  const columns: ColumnsType<StudioDish> = [
    {
      title: 'Блюдо', dataIndex: 'name', key: 'name',
      render: (_, d) => (
        <Space>
          {d.thumbUrl ? <img src={d.thumbUrl} alt="" className="trainer-thumb" loading="lazy" /> : <div className="trainer-thumb trainer-thumb--none" />}
          <div>
            <Text strong>{d.name}</Text>
            <div>
              {d.hidden && <Tag style={{ marginRight: 4 }}>скрыто</Tag>}
              {d.review.length > 0 && <Tag color="orange" icon={<WarningOutlined />}>меню изменилось</Tag>}
            </div>
          </div>
        </Space>
      ),
    },
    { title: 'Раздел', dataIndex: 'section', key: 'section', responsive: ['md'] },
    ...LEVELS.map((lv) => ({
      title: `${lv}. ${LEVEL_LABELS[lv]}`, key: `l${lv}`, width: 130,
      render: (_: unknown, d: StudioDish) => <LevelTag r={d.ready[lv]} />,
    })),
    {
      title: 'Факты', key: 'facts', width: 150, responsive: ['lg'],
      render: (_, d) => {
        const v = Object.values(d.statuses)
        return <Text type="secondary" style={{ fontSize: 12 }}>подтв. {v.filter((s) => s === 'confirmed').length} · черн. {v.filter((s) => s === 'draft').length}</Text>
      },
    },
  ]

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>Обучение · Контент-студия</Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Тестовый режим"
        description="Входа в кабинет пока нет, поэтому «кто подтвердил» — это имя, которое вы вводите здесь; оно попадёт в журнал, но не проверяется. В тренажёр попадают только подтверждённые факты."
      />
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={error} action={<Button size="small" onClick={() => void sync(true)}>Ещё раз</Button>} />}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {LEVELS.map((lv) => (
          <Col xs={24} sm={8} key={lv}>
            <Card size="small">
              <Statistic title={`Уровень ${lv} · ${LEVEL_LABELS[lv]}`} value={totals[lv].ready} suffix={`/ ${totals[lv].all} блюд готовы`} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input value={actor} onChange={(e) => changeActor(e.target.value)} placeholder="Ваше имя (для журнала)" style={{ width: 220 }} status={actor.trim().length < 2 ? 'warning' : undefined} />
          <Button icon={<ReloadOutlined />} loading={syncing} onClick={() => void sync(true)}>Обновить из меню</Button>
          <Select allowClear placeholder="Все разделы" value={section} onChange={setSection} style={{ width: 200 }} options={(data?.sections || []).map((s) => ({ value: s.name, label: `${s.name} (${s.dishes})` }))} />
          <Input allowClear prefix={<SearchOutlined />} placeholder="Поиск блюда" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <Button type={onlyAttention ? 'primary' : 'default'} onClick={() => setOnlyAttention(!onlyAttention)}>Требуют внимания</Button>
        </Space>
      </Card>

      <Card size="small" title="Пакетное подтверждение простых фактов" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select placeholder="Раздел" value={batchSection} onChange={setBatchSection} style={{ width: 200 }} options={(data?.sections || []).map((s) => ({ value: s.name, label: s.name }))} />
          <Select
            placeholder="Что подтвердить" value={batchType} onChange={setBatchType} style={{ width: 240 }}
            options={(data?.meta.batchTypes || []).map((t) => ({ value: t, label: data?.meta.factTypes.find((f) => f.key === t)?.label || t }))}
          />
          <Popconfirm
            title="Подтвердить все черновики?"
            description={`Выбранный факт у всех блюд раздела «${batchSection}» станет подтверждённым и попадёт в обучение. Факты с пометкой «меню изменилось» пропускаются.`}
            okText="Подтвердить" cancelText="Отмена" onConfirm={runBatch} disabled={!batchSection || !batchType || actor.trim().length < 2}
          >
            <Button type="primary" disabled={!batchSection || !batchType || actor.trim().length < 2}>Подтвердить черновики</Button>
          </Popconfirm>
        </Space>
        <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>Аллергены, состав и «можно без глютена/молочного» пакетно подтвердить нельзя — только по одному блюду.</Text></div>
      </Card>

      <Table<StudioDish>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={dishes}
        pagination={{ pageSize: 25, showSizeChanger: false, hideOnSinglePage: true }}
        onRow={(d) => ({ onClick: () => setOpenId(d.id), style: { cursor: 'pointer' } })}
        locale={{ emptyText: 'Блюд нет. Добавьте их в разделе «Ресторан → Меню».' }}
        style={{ background: '#fff' }}
      />

      {data && (
        <FactDrawer
          dishId={openId}
          actor={actor.trim()}
          meta={data.meta}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}
