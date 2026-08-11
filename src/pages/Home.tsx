import React, { useRef, useEffect, useCallback } from "react";
import { MolecularCanvas } from "../components/home/MolecularCanvas";
import { HeroContent } from "../components/home/HeroContent";
import { ScrollSections } from "../components/home/ScrollSections";
import { ResearchSection } from "../components/home/ResearchSection";

const NAV_ITEMS = [
  { label: "Overview", id: "hero" },
  { label: "Features", id: "sections" },
  { label: "Research", id: "research" }
];

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const researchRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef(0);
  const hudPillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const h = window.innerHeight;
        let next = 0;
        if (scrollY >= h * 2.2) next = 2;
        else if (scrollY >= h * 0.7) next = 1;

        if (next !== activeSectionRef.current) {
          // Direct DOM update — zero React re-renders
          hudPillRefs.current.forEach((el, i) => {
            if (!el) return;
            const label = el.querySelector('.hud-label');
            const pill = el.querySelector('.hud-pill');
            if (i === next) {
              label?.classList.add('text-cyan-300', 'opacity-100', 'font-semibold');
              label?.classList.remove('text-slate-400');
              pill?.classList.add('w-7', 'bg-gradient-to-r', 'from-cyan-400', 'to-teal-400');
              pill?.classList.remove('w-2.5', 'bg-slate-700');
            } else {
              label?.classList.remove('text-cyan-300', 'opacity-100', 'font-semibold');
              label?.classList.add('text-slate-400');
              pill?.classList.remove('w-7', 'bg-gradient-to-r', 'from-cyan-400', 'to-teal-400');
              pill?.classList.add('w-2.5', 'bg-slate-700');
            }
          });
          activeSectionRef.current = next;
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const refs = [heroRef, sectionsRef, researchRef];

  return (
    <div className="relative min-h-screen w-full bg-slate-950 font-sans text-slate-100 selection:bg-slate-700 selection:text-white">
      <MolecularCanvas />

      {/* Floating Right-Side Scroll HUD Indicator */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-3 pointer-events-auto">
        {NAV_ITEMS.map((item, idx) => (
          <button
            key={item.label}
            ref={el => { hudPillRefs.current[idx] = el; }}
            onClick={() => scrollTo(refs[idx])}
            className="group flex items-center justify-end gap-2.5 transition-all cursor-pointer"
            title={item.label}
          >
            <span className={`hud-label text-[10px] font-mono tracking-wider transition-all duration-300 opacity-0 group-hover:opacity-100 ${
              idx === 0 ? "text-cyan-300 opacity-100 font-semibold" : "text-slate-400"
            }`}>
              {item.label}
            </span>
            <span className={`hud-pill h-2.5 rounded-full transition-all duration-300 ${
              idx === 0
                ? "w-7 bg-gradient-to-r from-cyan-400 to-teal-400"
                : "w-2.5 bg-slate-700 hover:bg-slate-500"
            }`} />
          </button>
        ))}
      </div>

      {/* Foreground Transparent DOM Overlays */}
      <div className="relative z-10 flex flex-col">
        <div ref={heroRef}>
          <HeroContent onScrollToExplore={() => scrollTo(sectionsRef)} />
        </div>
        <div ref={sectionsRef}>
          <ScrollSections />
        </div>
        <div ref={researchRef}>
          <ResearchSection />
        </div>
      </div>
    </div>
  );
}
