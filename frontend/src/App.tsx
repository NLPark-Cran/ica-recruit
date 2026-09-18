import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import Protected from '@/components/Protected'
import Spinner from '@/components/Spinner'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Club from '@/pages/Club'
import NewClub from '@/pages/NewClub'
import NotFound from '@/pages/NotFound'

// 路由级代码分割：任务流 / 核销台 / 社团后台 / AI 页单独拆包
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
          path="new-club"
          element={
            <Protected>
              <NewClub />
            </Protected>
          }
        />
        <Route path="c/:slug" element={<Club />} />
        <Route
          path="c/:slug/flow"
          element={
            <Protected>
              <Suspense fallback={<Spinner />}>
                <Flow />
              </Suspense>
            </Protected>
          }
        />
        <Route
          path="c/:slug/redeem"
          element={
            <Protected>
              <Suspense fallback={<Spinner />}>
                <Redeem />
              </Suspense>
            </Protected>
          }
        />
        <Route
          path="c/:slug/admin"
          element={
            <Protected>
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
