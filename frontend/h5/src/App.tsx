import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PropertyDetail from './pages/PropertyDetail'
import PropertyList from './pages/PropertyList'
import AgentHome from './pages/AgentHome'
import Login from './pages/Login'
import ArticleList from './pages/ArticleList'
import ArticleDetail from './pages/ArticleDetail'
import LoanCalculator from './pages/LoanCalculator'

export default function App() {
  return (
    <BrowserRouter>
      <div className="page-container">
        <Routes>
          {/* 房源分享页（核心入口）*/}
          <Route path="/p/:id" element={<PropertyDetail />} />

          {/* 销售员主页 */}
          <Route path="/agent/:agent_code" element={<AgentHome />} />

          {/* 房源列表 */}
          <Route path="/properties" element={<PropertyList />} />

          {/* 资讯 */}
          <Route path="/articles" element={<ArticleList />} />
          <Route path="/articles/:id" element={<ArticleDetail />} />

          {/* 贷款计算器 */}
          <Route path="/loan-calculator" element={<LoanCalculator />} />

          {/* 微信登录回调 */}
          <Route path="/login" element={<Login />} />

          {/* 默认跳转 */}
          <Route path="/" element={<Navigate to="/properties" replace />} />
          <Route path="*" element={<Navigate to="/properties" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
