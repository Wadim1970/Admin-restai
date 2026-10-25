import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Spin, Tabs, Typography, message } from 'antd'
import { adminFetch } from '../../lib/adminApi'
import type { KitchenResponse } from './types'
import StopTab from './StopTab'
import PriorityTab from './PriorityTab'
import SlowTab from './SlowTab'

const { Title } = Typography

const DONE: Record<string, string> = {
  stop: 'Блюда в стопе',
  unstop: 'Блюда вернулись в меню',
  urgent: 'Отмечено: срочно продать сегодня',
  unurgent: '«Срочно» снято',
  priority: 'Приоритет сохранён',
}

export default function KitchenPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'stop'
  const [data, setData] = useState<KitchenResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminFetch<KitchenResponse>('/api/admin/kitchen'))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = useCallback(async (action: string, ids: string[], extra: Record<string, unknown> = {}) => {
    try {
      await adminFetch('/api/admin/kitchen', { method: 'PATCH', body: { action, ids, ...extra } })
      message.success(DONE[action] || 'Сохранено')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }, [load])

  const setTab = (t: string) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next)
  }

  const listTab = (children: (d: KitchenResponse) => React.ReactNode) => (
    error && !data
      ? <Alert type="error" showIcon title="Не удалось загрузить меню" description={error} action={<Button onClick={load}>Ещё раз</Button>} />
      : !data ? <Spin /> : <Spin spinning={loading}>{children(data)}</Spin>
  )

  const stoppedCount = data?.dishes.filter((d) => d.stopUntil).length || 0

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Кухня{data ? ` · ${data.restaurant.name}` : ''}</Title>
      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'stop', label: `Стоп-лист${stoppedCount ? ` (${stoppedCount})` : ''}`, children: listTab((d) => <StopTab dishes={d.dishes} sections={d.sections} act={act} dayEnd={d.dayEnd} tz={d.restaurant.timezone} />) },
            { key: 'priority', label: 'Приоритет в рекомендациях', children: listTab((d) => <PriorityTab dishes={d.dishes} sections={d.sections} act={act} />) },
            { key: 'slow', label: 'Долго готовились', children: <SlowTab /> },
          ]}
        />
      </Card>
    </div>
  )
}
