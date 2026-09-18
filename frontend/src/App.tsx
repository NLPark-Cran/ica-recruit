import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import Protected from '@/components/Protected'
import Spinner from '@/components/Spinner'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'

// 路由级代码分割：任务流 / 核销台 / 管理后台 / AI 页单独拆包
const Flow = lazy(() => import('@/pages/Flow'))
const Redeem = lazy(() => import('@/pages/Redeem'))
const Admin = lazy(() => import('@/pages/Admin'))
const Ai = lazy(() => import('@/pages/Ai'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route
          path="flow"
          element={
            <Protected>
              <Suspense fallback={<Spinner />}>
                <Flow />
              </Suspense>
            </Protected>
          }
        />
        <Route
          path="redeem"
          element={
            <Protected roles={['staff', 'admin']}>
              <Suspense fallback={<Spinner />}>
                <Redeem />
              </Suspense>
            </Protected>
          }
        />
        <Route
          path="admin"
          element={
            <Protected roles={['admin']}>
              <Suspense fallback={<Spinner />}>
                <Admin />
              </Suspense>
            </Protected>
          }
        />
        <Route
          path="ai"
          element={
            <Protected>
              <Suspense fallback={<Spinner />}>
                <Ai />
              </Suspense>
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
