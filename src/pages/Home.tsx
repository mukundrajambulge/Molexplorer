import React, { useRef, useState, useEffect } from "react";
import { MolecularCanvas } from "../components/home/MolecularCanvas";
import { HeroContent } from "../components/home/HeroContent";
import { ScrollSections } from "../components/home/ScrollSections";
import { ResearchSection } from "../components/home/ResearchSection";

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const researchRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const h = window.innerHeight;
          if (scrollY < h * 0.7) {
            setActiveSection(0);
          } else if (scrollY < h * 2.2) {
            setActiveSection(1);
          } else {
            setActiveSection(2);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navItems = [
    { label: "Overview", ref: heroRef },
    { label: "Features", ref: sectionsRef },
    { label: "Research", ref: researchRef }
  ];

  return (
    <div className="relative min-h-screen w-full bg-slate-950 font-sans text-slate-100 selection:bg-slate-700 selection:text-white">
      
      {/* 1. Persistent Hardware-Accelerated 3D Molecular Background Canvas (60/144 FPS) */}
      <MolecularCanvas />

      {/* 2. Floating Right-Side Scroll HUD Indicator */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-3 pointer-events-auto">
        {navItems.map((item, idx) => (
          <button
            key={item.label}
            onClick={() => scrollTo(item.ref)}
            className="group flex items-center justify-end gap-2.5 transition-all cursor-pointer"
            title={item.label}
          >
            <span className={`text-[10px] font-mono tracking-wider transition-all duration-300 opacity-0 group-hover:opacity-100 ${
              activeSection === idx ? "text-cyan-300 opacity-100 font-semibold" : "text-slate-400"
            }`}>
              {item.label}
            </span>
            <span className={`h-2.5 rounded-full transition-all duration-300 ${
              activeSection === idx
                ? "w-7 bg-gradient-to-r from-cyan-400 to-teal-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                : "w-2.5 bg-slate-700 hover:bg-slate-500"
            }`} />
          </button>
        ))}
      </div>

      {/* 3. Foreground Transparent DOM Overlays */}
      <div className="relative z-10 flex flex-col">
        {/* Full-Screen Hero View */}
        <div ref={heroRef}>
          <HeroContent onScrollToExplore={() => scrollTo(sectionsRef)} />
        </div>

        {/* Feature & Computation Sections */}
        <div ref={sectionsRef}>
          <ScrollSections />
        </div>

        {/* Research & Platform Launch */}
        <div ref={researchRef}>
          <ResearchSection />
        </div>
      </div>

    </div>
  );
}
