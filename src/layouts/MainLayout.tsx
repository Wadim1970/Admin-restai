import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Badge } from 'antd'
import {
  ShopOutlined,
  CalendarOutlined,
  DashboardOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons'

const { Sider, Header, Content } = Layout

const menuItems = [
  {
    key: 'restaurant',
    icon: <ShopOutlined />,
    label: 'Ресторан',
    children: [
      { key: '/restaurant/profile', label: 'Профиль' },
      { key: '/restaurant/branding', label: 'Брендинг' },
      { key: '/restaurant/qr', label: 'QR коды' },
      { key: '/restaurant/menu', label: 'Меню' },
      { key: '/restaurant/pairings', label: 'Пары блюд' },
      { key: '/restaurant/tables', label: 'Столы' },
    ],
  },
  {
    key: 'jobs',
    icon: <CalendarOutlined />,
    label: 'Вакансии',
    children: [
      { key: '/jobs/list', label: 'Все вакансии' },
      { key: '/jobs/bookings', label: 'Заявки' },
      { key: '/jobs/waiters', label: 'Официанты' },
      { key: '/jobs/schedule', label: 'Расписание' },
    ],
  },
  {
    key: 'shift',
    icon: <DashboardOutlined />,
    label: 'Контроль смены',
    children: [
      { key: '/shift/hall', label: 'Зал' },
      { key: '/shift/waiters', label: 'Официанты' },
      { key: '/shift/bookings', label: 'Брони' },
      { key: '/shift/kitchen', label: 'Кухня' },
      { key: '/shift/reviews', label: 'Жалобы и оценки' },
      { key: '/shift/stats', label: 'Статистика' },
    ],
  },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  // Узкий экран (телефон, планшет вертикально): меню прячется целиком и
  // выезжает поверх страницы, страница занимает всю ширину.
  const [narrow, setNarrow] = useState(false)
  const siderWidth = narrow ? 0 : collapsed ? 80 : 220

  const openKeys = menuItems
    .filter(group =>
      group.children?.some(item => location.pathname.startsWith(item.key))
    )
    .map(group => group.key)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={narrow ? 0 : 80}
        onBreakpoint={(broken) => { setNarrow(broken); setCollapsed(broken) }}
        zeroWidthTriggerStyle={{ top: 12 }}
        width={220}
        style={{ background: '#001529', position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100 }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 14 : 16,
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {collapsed ? 'RA' : 'RestAI Admin'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname.replace(/^(\/shift\/waiters)\/.+$/, '$1')]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => { navigate(key); if (narrow) setCollapsed(true) }}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Header style={{
          position: 'sticky',
          top: 0,
          zIndex: 99,
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          <Badge count={3}>
            <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
          </Badge>
          <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
        </Header>

        <Content style={{ padding: narrow ? 12 : 24, background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
