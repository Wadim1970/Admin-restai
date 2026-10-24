import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Dropdown, Empty, Input, Popconfirm, Row, Space, Spin, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CopyOutlined, DownloadOutlined, MailOutlined, PrinterOutlined, ReloadOutlined, SendOutlined, ShareAltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminBlob, adminFetch, ApiError } from '../../lib/adminApi'

const { Title, Text, Paragraph } = Typography

interface QrResponse {
  restaurant: { id: string; name: string; timezone: string | null; qrResetTime: string | null }
  today: string
  current: { date: string; createdAt: string; token: string; shareUrl: string | null } | null
  history: { date: string; createdAt: string; active: boolean }[]
}
type HistoryRow = QrResponse['history'][number]

const TOKEN_KEY = 'restai_admin_token'
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
const saveToken = (t: string) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* без хранилища — спросим снова */ }
}

const ruDate = (d: string) => dayjs(d).format('DD.MM.YYYY')
const ruTime = (iso: string) => dayjs(iso).format('HH:mm')

const columns: ColumnsType<HistoryRow> = [
  { title: 'Дата', dataIndex: 'date', render: ruDate },
  { title: 'Создан', dataIndex: 'createdAt', render: ruTime },
  { title: 'Статус', dataIndex: 'active', render: (a: boolean) => (a ? <Tag color="green">Активный</Tag> : <Tag>Истёк</Tag>) },
]

export default function QRPage() {
  const [token, setToken] = useState(readToken)
  // Учебный ресторан открыт без токена; для остальных сервер отвечает 401 — тогда просим токен.
  const [needAuth, setNeedAuth] = useState(false)
  const [draft, setDraft] = useState('')
  const [data, setData] = useState<QrResponse | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, ctx] = message.useMessage()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await adminFetch<QrResponse>('/api/admin/qr', { token })
      let url = ''
      if (d.current) url = URL.createObjectURL(await adminBlob('/api/qr-image', { query: { d: d.current.date }, token }))
      setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return url })
      setData(d)
      setNeedAuth(false)
      setError('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setNeedAuth(true)
        if (token) {
          // Токен не подошёл: забываем его. Следующая загрузка (уже без токена) сообщение не сбрасывает.
          saveToken('')
          setToken('')
          setError('Токен не подошёл. Введите токен администратора ещё раз.')
        }
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl) }, [imageUrl])

  const signIn = () => {
    const t = draft.trim()
    if (!t) return
    // Токен уходит в HTTP-заголовок: русские буквы (чаще всего — не та раскладка) туда не пройдут.
    if (!/^[\x21-\x7E]+$/.test(t)) {
      setError('В токене могут быть только латинские буквы, цифры и знаки. Проверьте раскладку клавиатуры.')
      return
    }
    saveToken(t)
    setToken(t)
    setDraft('')
    setError('')
  }

  const reset = async () => {
    setLoading(true)
    try {
      await adminFetch('/api/admin/qr', { method: 'POST', body: { action: 'reset' }, token })
      await load()
      msg.success('Токен сброшен. Прежний QR больше не действует.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }

  if (needAuth && !data) {
    return (
      <div>
        {ctx}
        <Title level={4} style={{ marginBottom: 24 }}>QR-коды</Title>
        <Card style={{ maxWidth: 480 }}>
          <Paragraph>
            Для этого ресторана раздел закрыт токеном администратора: QR открывает официантам доступ к смене.
            Токен хранится в настройках сервера; здесь вводится один раз и помнится до закрытия вкладки.
          </Paragraph>
          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
          <Space.Compact style={{ width: '100%' }}>
            <Input.Password
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPressEnter={signIn}
              placeholder="Токен администратора"
              autoComplete="off"
            />
            <Button type="primary" onClick={signIn}>Войти</Button>
          </Space.Compact>
        </Card>
      </div>
    )
  }

  const cur = data?.current || null
  const name = data?.restaurant.name || ''
  const caption = cur ? `QR для входа на смену — ${name}, ${ruDate(cur.date)}` : ''
  const fileName = cur ? `qr-${cur.date}.png` : 'qr.png'
  const link = cur?.shareUrl || ''
  const text = link ? `${caption}. Откройте картинку и покажите её в приложении официанта: ${link}` : caption

  const download = () => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = fileName
    a.click()
  }

  const print = () => {
    const w = window.open('', '_blank')
    if (!w) { msg.error('Браузер заблокировал окно печати. Разрешите всплывающие окна для этого сайта.'); return }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${caption}</title>
<style>body{font-family:sans-serif;text-align:center;margin:40px}img{width:420px;max-width:90vw}h1{font-size:24px;margin:0 0 4px}p{color:#555;margin:0 0 24px}</style>
<h1>${name}</h1><p>QR для входа на смену · ${ruDate(cur!.date)}</p><img src="${imageUrl}" onload="setTimeout(function(){window.print()},200)">`)
    w.document.close()
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); msg.success('Ссылка скопирована') } catch { msg.error('Не удалось скопировать, выделите ссылку вручную') }
  }

  const nativeShare = async () => {
    try {
      const blob = await (await fetch(imageUrl)).blob()
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: caption, text: caption })
      } else if (navigator.share) {
        await navigator.share({ title: caption, text, url: link || undefined })
      } else {
        msg.info('Этот браузер не умеет делиться — воспользуйтесь кнопками мессенджеров или почты.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') msg.error('Не удалось поделиться')
    }
  }

  const open = (url: string) => window.open(url, '_blank', 'noopener')
  const shareItems = link ? [
    { key: 'wa', label: 'WhatsApp', onClick: () => open(`https://wa.me/?text=${encodeURIComponent(text)}`) },
    { key: 'tg', label: 'Telegram', onClick: () => open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(caption)}`) },
    { key: 'mail', label: 'Почта', icon: <MailOutlined />, onClick: () => { window.location.href = `mailto:?subject=${encodeURIComponent(caption)}&body=${encodeURIComponent(text)}` } },
    { key: 'copy', label: 'Копировать ссылку', icon: <CopyOutlined />, onClick: copyLink },
  ] : []

  return (
    <div>
      {ctx}
      <Title level={4} style={{ marginBottom: 24 }}>QR-коды</Title>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} closable onClose={() => setError('')} />}
      <Spin spinning={loading}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={10}>
            <Card title={cur ? `Сегодня, ${ruDate(cur.date)}` : 'Сегодня'}>
              {cur ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <img src={imageUrl} alt={caption} style={{ width: '100%', maxWidth: 280, border: '1px solid #f0f0f0', borderRadius: 8 }} />
                    <div style={{ marginTop: 8 }}><Text type="secondary">{name} · создан в {ruTime(cur.createdAt)}</Text></div>
                  </div>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Button icon={<DownloadOutlined />} onClick={download}>Скачать</Button>
                    <Button icon={<PrinterOutlined />} onClick={print}>Печать</Button>
                    <Button icon={<ShareAltOutlined />} onClick={nativeShare}>Поделиться</Button>
                    <Dropdown menu={{ items: shareItems }} disabled={!link}>
                      <Button icon={<SendOutlined />}>Мессенджер или почта</Button>
                    </Dropdown>
                  </Space>
                  {!link && <Alert type="warning" showIcon message="Ссылка для пересылки недоступна: на сервере не задан ADMIN_TOKEN." style={{ marginBottom: 16 }} />}
                  <Popconfirm
                    title="Сбросить QR?"
                    description="Текущий токен сразу станет недействительным, QR придётся разослать заново."
                    okText="Сбросить" cancelText="Отмена" onConfirm={reset}
                  >
                    <Button icon={<ReloadOutlined />} danger>Сбросить токен</Button>
                  </Popconfirm>
                </>
              ) : data ? (
                <Empty description="На сегодня QR ещё нет. Он создаётся ночью; можно создать сейчас.">
                  <Button type="primary" icon={<ReloadOutlined />} onClick={reset}>Создать QR на сегодня</Button>
                </Empty>
              ) : (
                <Empty description="Не удалось загрузить QR.">
                  <Button icon={<ReloadOutlined />} onClick={load}>Ещё раз</Button>
                </Empty>
              )}
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">
                  {data?.restaurant.qrResetTime
                    ? `Токен обновляется ежедневно (по настройке ресторана — в ${data.restaurant.qrResetTime}${data.restaurant.timezone ? `, ${data.restaurant.timezone}` : ''}). Действует только в день создания.`
                    : 'Токен обновляется ежедневно и действует только в день создания.'}
                </Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="История токенов">
              <Table columns={columns} dataSource={data?.history || []} rowKey="date" pagination={false} size="small" />
              <div style={{ marginTop: 12 }}><Text type="secondary">Прошлые токены не хранятся в кабинете: они уже недействительны.</Text></div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
