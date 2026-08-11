import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import Home from "./pages/Home";
import MolExplorer from "./pages/MolExplorer";
import MolStudio from "./pages/MolStudio";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageTransition } from "./components/PageTransition";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Home />
            </PageTransition>
          }
        />
        <Route
          path="/molexplorer"
          element={
            <PageTransition>
              <MolExplorer />
            </PageTransition>
          }
        />
        <Route
          path="/molstudio"
          element={
            <PageTransition>
              <MolStudio />
            </PageTransition>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isWorkspace = location.pathname === "/molexplorer" || location.pathname === "/molstudio";

  if (isWorkspace) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <Header />
        <main className="flex-1 w-full min-h-0 overflow-hidden relative flex flex-col">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header />
      <main className="flex-1 relative flex flex-col">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      {isHome && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </BrowserRouter>
  );
}

