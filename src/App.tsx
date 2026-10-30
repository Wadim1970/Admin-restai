import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import MainLayout from './layouts/MainLayout'
import ProfilePage from './pages/restaurant/ProfilePage'
import BrandingPage from './pages/restaurant/BrandingPage'
import QRPage from './pages/restaurant/QRPage'
import PairingsPage from './pages/restaurant/PairingsPage'
import MenuPage from './pages/menu/MenuPage'
import TablesPage from './pages/tables/TablesPage'
import TeamPage from './pages/team/TeamPage'
import JobsPage from './pages/team/JobsPage'
import FreelancersPage from './pages/team/FreelancersPage'
import SchedulePage from './pages/team/SchedulePage'
import HallPage from './pages/hall/HallPage'
import WaitersPage from './pages/staff/WaitersPage'
import WaiterPage from './pages/staff/WaiterPage'
import KitchenPage from './pages/kitchen/KitchenPage'
import ReviewsPage from './pages/reviews/ReviewsPage'
import StatsPage from './pages/stats/StatsPage'
import ReservationsPage from './pages/bookings/ReservationsPage'

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
            <Route index element={<Navigate to="/shift/hall" replace />} />
            <Route path="restaurant/profile" element={<ProfilePage />} />
            <Route path="restaurant/branding" element={<BrandingPage />} />
            <Route path="restaurant/qr" element={<QRPage />} />
            <Route path="restaurant/menu" element={<MenuPage />} />
            <Route path="restaurant/tables" element={<TablesPage />} />
            <Route path="restaurant/pairings" element={<PairingsPage />} />
            <Route path="staff/team" element={<TeamPage />} />
            <Route path="staff/jobs" element={<JobsPage />} />
            <Route path="staff/freelancers" element={<FreelancersPage />} />
            <Route path="staff/schedule" element={<SchedulePage />} />
            <Route path="jobs/*" element={<Navigate to="/staff/jobs" replace />} />
            <Route path="shift/hall" element={<HallPage />} />
            <Route path="shift/waiters" element={<WaitersPage />} />
            <Route path="shift/waiters/:id" element={<WaiterPage />} />
            <Route path="shift/kitchen" element={<KitchenPage />} />
            <Route path="shift/reviews" element={<ReviewsPage />} />
            <Route path="shift/stats" element={<StatsPage />} />
            <Route path="shift/bookings" element={<ReservationsPage />} />
            <Route path="shift/calls" element={<Navigate to="/shift/bookings" replace />} />
            <Route path="shift/complaints" element={<Navigate to="/shift/reviews" replace />} />
            <Route path="shift/dashboard" element={<Navigate to="/shift/hall" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
