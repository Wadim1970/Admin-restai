import { useEffect, useState } from 'react'
import { DatePicker, Form, Input, InputNumber, Modal, Select, TimePicker, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import type { Reservation } from './types'
import { RES_STATUS, localParts, zonedIso } from './format'

interface Values {
  date: Dayjs; from: Dayjs; to: Dayjs; guestCount: number; tableId?: string | null
  guestName?: string; guestPhone?: string; comment?: string; status: Reservation['status']
}

interface Props {
  open: boolean
  tz: string
  defaultDate: string
  capacity: number
  reservation: Reservation | null // null — новая
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => Promise<void>
  // Выбор стола (раздел «Брони»); без него стол задан тем, откуда открыли.
  tables?: { id: string; number: number; capacity: number }[]
  tableId?: string | null
  // Брони — с сегодняшнего дня и не дальше maxDate.
  minDate?: string
  maxDate?: string
}

// Бронь стола: время — по часам ресторана (даже если админка открыта в
// другом часовом поясе).
export default function ReservationModal({ open, tz, defaultDate, capacity, reservation, onCancel, onSave, tables, tableId, minDate, maxDate }: Props) {
  const [form] = Form.useForm<Values>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (reservation) {
      const s = localParts(reservation.startsAt, tz)
      const e = localParts(reservation.endsAt, tz)
      form.setFieldsValue({
        date: dayjs(s.date), from: dayjs(`2000-01-01T${s.time}`), to: dayjs(`2000-01-01T${e.time}`),
        guestCount: reservation.guestCount, guestName: reservation.guestName || undefined,
        guestPhone: reservation.guestPhone || undefined, comment: reservation.comment || undefined, status: reservation.status,
        tableId: reservation.tableId ?? '',
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        date: dayjs(defaultDate), from: dayjs('2000-01-01T19:00'), to: dayjs('2000-01-01T21:00'),
        guestCount: Math.min(2, capacity) || 2, status: 'confirmed', tableId: tableId ?? '',
      })
    }
  }, [open, reservation, tz, defaultDate, capacity, form, tableId])

  const submit = async () => {
    const v = await form.validateFields()
    const date = v.date.format('YYYY-MM-DD')
    const fromHm = v.from.format('HH:mm')
    const toHm = v.to.format('HH:mm')
    // Конец раньше начала — бронь через полночь, конец на следующий день.
    const endDate = toHm <= fromHm ? v.date.add(1, 'day').format('YYYY-MM-DD') : date
    setSaving(true)
    try {
      await onSave({
        startsAt: zonedIso(date, fromHm, tz),
        endsAt: zonedIso(endDate, toHm, tz),
        guestCount: v.guestCount,
        guestName: v.guestName || '',
        guestPhone: v.guestPhone || '',
        comment: v.comment || '',
        status: v.status,
        ...(tables ? { tableId: v.tableId || null } : {}),
      })
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={reservation ? 'Бронь' : 'Новая бронь'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      onOk={submit}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="Дата" name="date" rules={[{ required: true, message: 'Укажите дату' }]}>
          <DatePicker
            format="D MMMM YYYY"
            style={{ width: '100%' }}
            allowClear={false}
            disabledDate={(d) => (!!minDate && d.format('YYYY-MM-DD') < minDate) || (!!maxDate && d.format('YYYY-MM-DD') > maxDate)}
          />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item label="С" name="from" rules={[{ required: true, message: 'Время' }]} style={{ flex: 1 }}>
            <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} allowClear={false} needConfirm={false} />
          </Form.Item>
          <Form.Item label="До" name="to" rules={[{ required: true, message: 'Время' }]} style={{ flex: 1 }}>
            <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} allowClear={false} needConfirm={false} />
          </Form.Item>
          <Form.Item label="Гостей" name="guestCount" rules={[{ required: true, message: 'Сколько' }]} style={{ width: 100 }}>
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        {tables && (
          <Form.Item label="Стол" name="tableId">
            <Select
              options={[{ value: '', label: 'Без стола — посадим на месте' }, ...[...tables].sort((a, b) => a.number - b.number).map((t) => ({ value: t.id, label: `№ ${t.number} · ${t.capacity} ${t.capacity === 1 ? 'место' : t.capacity < 5 ? 'места' : 'мест'}` }))]}
            />
          </Form.Item>
        )}
        <Form.Item label="Имя гостя" name="guestName">
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item label="Телефон" name="guestPhone">
          <Input maxLength={40} inputMode="tel" placeholder="+7 900 000-00-00 — по номеру узнаем гостя" />
        </Form.Item>
        <Form.Item label="Комментарий" name="comment">
          <Input.TextArea maxLength={500} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Например: день рождения, нужен детский стул" />
        </Form.Item>
        {reservation && (
          <Form.Item label="Статус" name="status">
            <Select options={Object.entries(RES_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
