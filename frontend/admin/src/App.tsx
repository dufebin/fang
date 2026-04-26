import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ProLayout, DefaultFooter } from '@ant-design/pro-components'
import {
  HomeOutlined,
  TeamOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  FileTextOutlined,
  PictureOutlined,
  UserOutlined,
  CheckCircleOutlined,
  BellOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import PropertiesPage from './pages/Properties'
import AgentsPage from './pages/Agents'
import StatisticsPage from './pages/Statistics'
import AppointmentsPage from './pages/Appointments'
import AgentApplicationsPage from './pages/AgentApplications'
import ArticlesPage from './pages/Articles'
import BannersPage from './pages/Banners'
import UsersPage from './pages/Users'
import NotificationsPage from './pages/Notifications'
import LoginPage from './pages/Login'

const menuRoutes = [
  { path: '/admin', name: '数据概览', icon: <AppstoreOutlined /> },
  { path: '/admin/statistics', name: '统计分析', icon: <BarChartOutlined /> },
  {
    name: '房源中心',
    icon: <HomeOutlined />,
    routes: [
      { path: '/admin/properties', name: '房源管理', icon: <HomeOutlined /> },
    ],
  },
  {
    name: '经纪人中心',
    icon: <TeamOutlined />,
    routes: [
      { path: '/admin/agents', name: '销售员管理', icon: <TeamOutlined /> },
      { path: '/admin/agent-applications', name: '申请审核', icon: <CheckCircleOutlined /> },
    ],
  },
  {
    name: '内容管理',
    icon: <FileTextOutlined />,
    routes: [
      { path: '/admin/articles', name: '文章资讯', icon: <FileTextOutlined /> },
      { path: '/admin/banners', name: '横幅管理', icon: <PictureOutlined /> },
    ],
  },
  { path: '/admin/appointments', name: '预约管理', icon: <CalendarOutlined /> },
  { path: '/admin/users', name: '用户管理', icon: <UserOutlined /> },
  { path: '/admin/notifications', name: '通知广播', icon: <BellOutlined /> },
]

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  const location = useLocation()
  if (!token) return <Navigate to="/admin/login" state={{ from: location }} replace />
  return <>{children}</>
}

function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const onLogout = () => {
    localStorage.removeItem('admin_token')
    navigate('/admin/login')
  }

  return (
    <ProLayout
      title="房产管理后台"
      logo={<span style={{ fontSize: 20 }}>🏠</span>}
      route={{ path: '/admin', routes: menuRoutes }}
      location={{ pathname: location.pathname }}
      onMenuHeaderClick={() => navigate('/admin')}
      menuItemRender={(item, dom) => (
        <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
      )}
      avatarProps={{
        src: undefined,
        title: '管理员',
        render: (_, dom) => (
          <div onClick={onLogout} style={{ cursor: 'pointer' }} title="点击退出登录">
            {dom}
          </div>
        ),
      }}
      footerRender={() => <DefaultFooter copyright="房产中介系统" links={[]} />}
      layout="side"
      colorPrimary="#1677ff"
    >
      <Routes>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/statistics" element={<StatisticsPage />} />
        <Route path="/admin/properties" element={<PropertiesPage />} />
        <Route path="/admin/agents" element={<AgentsPage />} />
        <Route path="/admin/agent-applications" element={<AgentApplicationsPage />} />
        <Route path="/admin/articles" element={<ArticlesPage />} />
        <Route path="/admin/banners" element={<BannersPage />} />
        <Route path="/admin/appointments" element={<AppointmentsPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </ProLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
