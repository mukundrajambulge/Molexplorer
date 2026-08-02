import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import MolExplorer from "./pages/MolExplorer";
import MolStudio from "./pages/MolStudio";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/molexplorer" element={<MolExplorer />} />
        <Route path="/molstudio" element={<MolStudio />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

