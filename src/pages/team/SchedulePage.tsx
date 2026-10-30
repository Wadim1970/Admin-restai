import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Segmented, Space, Spin, TimePicker, Tooltip, Typography, message } from 'antd'
import { CopyOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { adminFetch } from '../../lib/adminApi'
import { ROLE_LABELS, type ScheduleResponse, type ScheduleShift } from './types'

const { Title, Text } = Typography

// Частые смены — одним нажатием.
const PRESETS = [
  { label: 'Утро 08–16', start: '08:00', end: '16:00' },
  { label: 'День 10–22', start: '10:00', end: '22:00' },
  { label: 'Вечер 16–00', start: '16:00', end: '00:00' },
]

type Cell = { waiterId: string; name: string; date: string; shift: ScheduleShift | null }

// Официанты → Смены: кто из сотрудников в какой день и с какого по какое
// время работает. Фрилансеры по одобренным заявкам — в отдельных строках.
export default function SchedulePage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ScheduleResponse | null>(null)
  const [error, setError] = useState('')
  const [cell, setCell] = useState<Cell | null>(null)
  const [form] = Form.useForm()
  const week = params.get('week') || ''

  const load = useCallback(async () => {
    try {
      setData(await adminFetch<ScheduleResponse>('/api/admin/schedule', { query: { date: week } }))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [week])
  useEffect(() => { load() }, [load])

  const go = (n: number | null) => {
    const next = new URLSearchParams(params)
    if (n === null || !data) next.delete('week')
    else next.set('week', dayjs(data.days[0]).add(n * 7, 'day').format('YYYY-MM-DD'))
    setParams(next)
  }

  const fail = (e: unknown) => message.error(e instanceof Error ? e.message : String(e))

  const open = (c: Cell) => {
    form.setFieldsValue({
      time: c.shift ? [dayjs(`2000-01-01T${c.shift.startTime}`), dayjs(`2000-01-01T${c.shift.endTime}`)] : [dayjs('2000-01-01T10:00'), dayjs('2000-01-01T22:00')],
      note: c.shift?.note || '',
    })
    setCell(c)
  }

  const save = async (preset?: { start: string; end: string }) => {
    if (!cell) return
    const v = preset ? null : await form.validateFields()
    const startTime = preset ? preset.start : (v.time[0] as Dayjs).format('HH:mm')
    const endTime = preset ? preset.end : (v.time[1] as Dayjs).format('HH:mm')
    try {
      await adminFetch('/api/admin/schedule', { method: 'POST', body: { waiterId: cell.waiterId, date: cell.date, startTime, endTime, note: preset ? cell.shift?.note || '' : v.note } })
      setCell(null)
      await load()
    } catch (e) { fail(e) }
  }

  const remove = async () => {
    if (!cell?.shift) return
    try {
      await adminFetch('/api/admin/schedule', { method: 'DELETE', query: { id: cell.shift.id } })
      setCell(null)
      await load()
    } catch (e) { fail(e) }
  }

  const copyPrev = async () => {
    if (!data) return
    try {
      const r = await adminFetch<{ copied: number }>('/api/admin/schedule', {
        method: 'POST', body: { copy: { from: dayjs(data.days[0]).subtract(7, 'day').format('YYYY-MM-DD'), to: data.days[0] } },
      })
      message.success(r.copied ? `Перенесено смен: ${r.copied}` : 'На прошлой неделе нечего переносить (или эти дни уже заполнены)')
      await load()
    } catch (e) { fail(e) }
  }

  if (!data) return error ? <Alert type="error" showIcon title="Не удалось загрузить график" description={error} action={<Button onClick={load}>Ещё раз</Button>} /> : <Spin />

  const shiftOf = (waiterId: string, date: string) => data.shifts.find((s) => s.waiterId === waiterId && s.date === date) || null
  const perDay = data.days.map((d) => data.shifts.filter((s) => s.date === d).length + data.freelance.filter((f) => f.date === d).length)
  const freelancers = [...new Map(data.freelance.map((f) => [f.waiter.id, f.waiter])).values()]
  const thisWeek = data.days.includes(data.today)
  const range = `${dayjs(data.days[0]).format('D MMMM')} — ${dayjs(data.days[6]).format('D MMMM YYYY')}`

  const head = (
    <tr>
      <th className="sched__name">Сотрудник</th>
      {data.days.map((d, i) => (
        <th key={d} className={d === data.today ? 'sched__today' : undefined}>
          <div>{dayjs(d).format('dd')}</div>
          <div className="sched__date">{dayjs(d).format('D.MM')}</div>
          <div className="sched__count">{perDay[i] ? `${perDay[i]} чел.` : '—'}</div>
        </th>
      ))}
    </tr>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>График смен · {data.restaurant.name}</Title>
        <Space wrap>
          <Button icon={<LeftOutlined />} onClick={() => go(-1)} aria-label="Прошлая неделя" />
          <Text strong style={{ minWidth: 220, textAlign: 'center', display: 'inline-block' }}>{range}</Text>
          <Button icon={<RightOutlined />} onClick={() => go(1)} aria-label="Следующая неделя" />
          <Button onClick={() => go(null)} disabled={thisWeek}>Эта неделя</Button>
          {data.enabled && (
            <Popconfirm title="Перенести смены с прошлой недели?" description="Дни, где смена уже стоит, не изменятся." okText="Перенести" cancelText="Нет" onConfirm={copyPrev}>
              <Button icon={<CopyOutlined />}>Как на прошлой неделе</Button>
            </Popconfirm>
          )}
        </Space>
      </div>
      {!data.enabled && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="График появится после обновления базы" description="Нужно применить миграцию 20261031010000_zones_staff.sql на сервере базы." />
      )}
      <Card size="small">
        {data.staff.length === 0 && freelancers.length === 0 ? <Empty description="Добавьте сотрудников в «Штатные», чтобы составить график" /> : (
          <div className="sched">
            <table>
              <thead>{head}</thead>
              <tbody>
                {data.staff.map((w) => (
                  <tr key={w.id}>
                    <td className="sched__name"><div>{w.name}</div><Text type="secondary" style={{ fontSize: 12 }}>{ROLE_LABELS[w.role]}</Text></td>
                    {data.days.map((d) => {
                      const s = shiftOf(w.id!, d)
                      return (
                        <td key={d} className={d === data.today ? 'sched__today' : undefined}>
                          <button
                            type="button"
                            className={`sched__cell${s ? ' sched__cell--on' : ''}`}
                            disabled={!data.enabled}
                            onClick={() => open({ waiterId: w.id!, name: w.name, date: d, shift: s })}
                            title={s?.note || undefined}
                          >
                            {s ? <><b>{s.startTime}–{s.endTime}</b>{s.note && <small>{s.note}</small>}</> : <PlusOutlined />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {freelancers.length > 0 && (
                  <tr><td colSpan={8} className="sched__group">Фрилансеры по заявкам</td></tr>
                )}
                {freelancers.map((w) => (
                  <tr key={w.id}>
                    <td className="sched__name"><div>{w.name}</div><Text type="secondary" style={{ fontSize: 12 }}>фрилансер</Text></td>
                    {data.days.map((d) => {
                      const f = data.freelance.find((x) => x.waiter.id === w.id && x.date === d)
                      return (
                        <td key={d} className={d === data.today ? 'sched__today' : undefined}>
                          {f && (
                            <Tooltip title={f.status === 'confirmed' ? 'Подтвердил выход' : 'Одобрен, ждём подтверждения'}>
                              <div className={`sched__cell sched__cell--free${f.status === 'confirmed' ? '' : ' sched__cell--wait'}`}><b>{f.startTime}–{f.endTime}</b></div>
                            </Tooltip>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!cell}
        title={cell ? `${cell.name} · ${dayjs(cell.date).format('dd, D MMMM')}` : ''}
        onCancel={() => setCell(null)}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {cell?.shift ? <Button danger onClick={remove}>Выходной</Button> : <span />}
            <Space><Button onClick={() => setCell(null)}>Отмена</Button><Button type="primary" onClick={() => save()}>Сохранить</Button></Space>
          </div>
        )}
      >
        <Text type="secondary">Быстро:</Text>
        <div style={{ margin: '6px 0 14px' }}>
          <Segmented block options={PRESETS.map((p) => p.label)} value={null as unknown as string} onChange={(v) => { const p = PRESETS.find((x) => x.label === v); if (p) save(p) }} />
        </div>
        <Form form={form} layout="vertical">
          <Form.Item name="time" label="Время" rules={[{ required: true, message: 'Время' }]}>
            <TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="Заметка">
            <Input maxLength={200} placeholder="банкет, стажировка…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
