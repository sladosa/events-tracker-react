import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { supabase } from '@/lib/supabaseClient'
import { FilterProvider } from '@/context/FilterContext'
import AuthPage from '@/pages/AuthPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import AppHome from '@/pages/AppHome'
import { AddActivityPage } from '@/pages/AddActivityPage'
import { EditActivityPage } from '@/pages/EditActivityPage'
import { ViewDetailsPage } from '@/pages/ViewDetailsPage'
import { DebugPage } from '@/pages/DebugPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
      setReady(true)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/debug" element={<DebugPage />} />
        
        {/* Protected routes - sve unutar FilterProvider da dijele isti filter state */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <FilterProvider>
                <AppHome />
              </FilterProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/app/add"
          element={
            <RequireAuth>
              <FilterProvider>
                <AddActivityPage />
              </FilterProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/app/edit/:sessionStart"
          element={
            <RequireAuth>
              <FilterProvider>
                <EditActivityPage />
              </FilterProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/app/view/:sessionStart"
          element={
            <RequireAuth>
              <FilterProvider>
                <ViewDetailsPage />
              </FilterProvider>
            </RequireAuth>
          }
        />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <FilterProvider>
                <AppHome />
              </FilterProvider>
            </RequireAuth>
          }
        />
        
        {/* Catch all - redirect to app */}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  )
}
