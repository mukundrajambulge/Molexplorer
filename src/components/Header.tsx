import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dna, Menu, X, ChevronRight, Github, Sparkles } from "lucide-react";

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "MolExplorer", path: "/molexplorer", badge: "Library & Analytics", color: "cyan" },
    { name: "MolStudio", path: "/molstudio", badge: "3D & Docking", color: "amber" },
  ];

  return (
    <header className="relative z-50 w-full backdrop-blur-2xl bg-[#050508]/85 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-400 to-amber-500 p-[1px] shadow-[0_0_20px_rgba(0,242,255,0.25)] group-hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all">
              <div className="w-full h-full bg-[#080a12] rounded-[11px] flex items-center justify-center">
                <Dna className="w-5 h-5 text-cyan-400 group-hover:rotate-180 transition-transform duration-700" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-medium tracking-tight text-white flex items-center gap-1.5 font-sans">
                Molexplorer
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  v2.0
                </span>
              </span>
              <span className="text-[10px] text-slate-400 tracking-widest font-mono">CHEMINFORMATICS SUITE</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-full border border-white/[0.1] backdrop-blur-xl shadow-inner">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-5 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-300 flex items-center gap-2 ${
                    isActive
                      ? "text-white bg-white/10 shadow-[0_0_15px_rgba(0,242,255,0.15)] border border-cyan-400/30"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  )}
                  {link.name}
                  {link.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                      link.color === 'amber' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Action CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/mukundrajambulge/Molexplorer"
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shadow-sm"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>
            <Link
              to="/molstudio"
              className="btn-luminous relative group inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-medium tracking-wide text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:shadow-[0_0_30px_rgba(0,242,255,0.5)]"
            >
              <span>Explore Platform</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-[#050508]/95 px-4 pt-2 pb-6 space-y-3 backdrop-blur-2xl">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-medium ${
                location.pathname === link.path
                  ? "bg-white/10 text-white border border-cyan-400/30"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{link.name}</span>
                {link.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    link.color === 'amber' ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'
                  }`}>
                    {link.badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/molstudio"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl text-xs font-medium text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 shadow-[0_0_20px_rgba(0,242,255,0.3)]"
            >
              Explore Platform
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

