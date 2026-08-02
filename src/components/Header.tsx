import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FlaskConical, Beaker, Sparkles, Dna, Menu, X, ChevronRight, Github } from "lucide-react";

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "MolExplorer", path: "/molexplorer", badge: "Library & Analytics" },
    { name: "MolStudio", path: "/molstudio", badge: "3D & Docking" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#0A0A0C]/80 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#F27D26] via-[#E85D04] to-[#4A90E2] p-[1px] shadow-lg shadow-[#F27D26]/10 group-hover:shadow-[#F27D26]/25 transition-all">
              <div className="w-full h-full bg-[#0E0E12] rounded-[11px] flex items-center justify-center">
                <Dna className="w-5 h-5 text-[#F27D26] group-hover:rotate-45 transition-transform duration-500" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-medium tracking-tight text-white flex items-center gap-1.5">
                Molexplorer
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white/70 border border-white/10">
                  v2.0
                </span>
              </span>
              <span className="text-[11px] text-white/40 tracking-wider font-mono">CHEMINFORMATICS SUITE</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1.5 rounded-full border border-white/[0.08]">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-5 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-300 flex items-center gap-2 ${
                    isActive
                      ? "text-white bg-white/10 shadow-sm border border-white/15"
                      : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {link.name}
                  {link.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F27D26]/20 text-[#F27D26] font-mono">
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
              className="p-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] transition-all"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>
            <Link
              to="/molexplorer"
              className="relative group inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-medium tracking-wide text-white bg-gradient-to-r from-[#F27D26] to-[#E85D04] hover:from-[#f3883a] hover:to-[#f06813] transition-all shadow-lg shadow-[#F27D26]/20 hover:shadow-[#F27D26]/35"
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
        <div className="md:hidden border-b border-white/10 bg-[#0A0A0C] px-4 pt-2 pb-6 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-medium ${
                location.pathname === link.path
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{link.name}</span>
                {link.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F27D26]/20 text-[#F27D26]">
                    {link.badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/molexplorer"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-[#F27D26] to-[#E85D04]"
            >
              Explore Platform
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
