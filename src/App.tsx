import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import MainLayout from './layouts/MainLayout'
import ProfilePage from './pages/restaurant/ProfilePage'
import BrandingPage from './pages/restaurant/BrandingPage'
import QRPage from './pages/restaurant/QRPage'
import BookingsPage from './pages/jobs/BookingsPage'
import DashboardPage from './pages/shift/DashboardPage'

export default function App() {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/shift/dashboard" replace />} />
            <Route path="restaurant/profile" element={<ProfilePage />} />
            <Route path="restaurant/branding" element={<BrandingPage />} />
            <Route path="restaurant/qr" element={<QRPage />} />
            <Route path="jobs/bookings" element={<BookingsPage />} />
            <Route path="shift/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
