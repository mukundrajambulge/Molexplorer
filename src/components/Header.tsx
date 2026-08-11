import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dna, Menu, X, ChevronRight, Github, ChevronUp, ChevronDown } from "lucide-react";

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const location = useLocation();
  const isWorkspace = location.pathname === "/molexplorer" || location.pathname === "/molstudio";

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "MolExplorer", path: "/molexplorer", badge: "Library & Analytics", color: "cyan" },
    { name: "MolStudio", path: "/molstudio", badge: "3D & Docking", color: "amber" },
  ];

  return (
    <div className={`relative z-50 w-full transition-all duration-300 ease-in-out ${isWorkspace && isWorkspaceCollapsed ? '-mb-14' : ''}`}>
      <header className={`w-full bg-slate-900/95 border-b border-slate-700/60 shadow-lg transition-transform duration-300 ease-in-out ${
        isWorkspace && isWorkspaceCollapsed ? '-translate-y-full pointer-events-none' : 'translate-y-0 pointer-events-auto'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-400 to-amber-500 p-[1px] shadow-[0_0_15px_rgba(0,242,255,0.25)] group-hover:shadow-[0_0_25px_rgba(0,242,255,0.4)] transition-all">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Dna className="w-4 h-4 text-cyan-400 group-hover:rotate-180 transition-transform duration-700" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-semibold tracking-tight text-white flex items-center gap-1.5 font-sans">
                  Molexplorer
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                    v2.0
                  </span>
                </span>
                <span className="text-[8px] sm:text-[9px] text-slate-400 tracking-widest font-mono hidden sm:inline">CHEMINFORMATICS SUITE</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-full border border-slate-700/60 shadow-inner">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative px-3.5 py-1 rounded-full text-xs font-medium tracking-wide transition-all duration-300 flex items-center gap-1.5 ${
                      isActive
                        ? "text-white bg-slate-800 shadow-[0_0_15px_rgba(0,242,255,0.2)] border border-cyan-400/40"
                        : "text-slate-300 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                    )}
                    {link.name}
                    {link.badge && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
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

            {/* Action CTA & Collapse Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isWorkspace && (
                <button
                  onClick={() => setIsWorkspaceCollapsed(true)}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-white/5 text-[11px] font-mono transition-all"
                  title="Hide header to maximize 3D canvas area"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Hide Header</span>
                </button>
              )}

              <a
                href="https://github.com/mukundrajambulge/Molexplorer"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shadow-sm"
                title="GitHub Repository"
              >
                <Github className="w-4 h-4" />
              </a>

              <Link
                to="/molstudio"
                className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 rounded-xl text-xs font-medium tracking-wide text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 transition-all shadow-md"
              >
                <span>Launch Studio</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-[#050508]/98 px-4 pt-2 pb-6 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-xl text-sm font-medium ${
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
                className="w-full text-center py-2.5 rounded-xl text-xs font-medium text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 shadow-md"
              >
                Launch MolStudio
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Floating Reveal Handle for Workspace Mode */}
      {isWorkspace && isWorkspaceCollapsed && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <button
            onClick={() => setIsWorkspaceCollapsed(false)}
            className="flex items-center gap-1.5 px-3 py-0.5 rounded-b-lg border border-t-0 border-cyan-400/40 bg-slate-900/95 text-[10px] font-mono text-cyan-300 shadow-lg hover:bg-slate-800 transition-all cursor-pointer"
            title="Expand Navigation Header"
          >
            <Dna className="w-3 h-3 text-cyan-400" />
            <span>Navigation</span>
            <ChevronDown className="w-3 h-3 text-cyan-400 animate-bounce" />
          </button>
        </div>
      )}
    </div>
  );
};
