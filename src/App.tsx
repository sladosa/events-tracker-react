import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { supabase } from "./lib/supabaseClient";
import LoginPage from "./pages/LoginPage";
import AppHome from "./pages/AppHome";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setReady(true);
    }); // [web:536]

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!authed) return <Navigate to="/login" replace state={{ from: location }} />;

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppHome />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}
