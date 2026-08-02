import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import MolExplorer from "./pages/MolExplorer";
import MolStudio from "./pages/MolStudio";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="flex flex-col min-h-screen font-sans bg-[#0A0A0C] text-[#F0F0F0] selection:bg-[#F27D26]/30 selection:text-white">
      <Header />
      <main className="flex-1 overflow-hidden relative flex flex-col">
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/molexplorer" element={<MolExplorer />} />
          <Route path="/molstudio" element={<MolStudio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
