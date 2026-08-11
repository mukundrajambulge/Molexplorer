import React, { useState, useEffect, useRef } from "react";
import { MolecularCanvas } from "../components/home/MolecularCanvas";
import { HeroContent } from "../components/home/HeroContent";
import { ScrollSections } from "../components/home/ScrollSections";
import { ResearchSection } from "../components/home/ResearchSection";

export default function Home() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const exploreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll <= 0) {
        setScrollProgress(0);
        return;
      }
      const currentScroll = window.scrollY;
      const progress = Math.min(Math.max(currentScroll / totalScroll, 0), 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToExplore = () => {
    if (exploreRef.current) {
      exploreRef.current.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: window.innerHeight * 0.85, behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 1. Persistent Interactive 3D Molecular Background Canvas */}
      <MolecularCanvas scrollProgress={scrollProgress} />

      {/* 2. Soft Ambient Radial Glows */}
      <div className="pointer-events-none fixed -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[150px] z-0" />
      <div className="pointer-events-none fixed top-1/2 -right-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[150px] z-0" />
      <div className="pointer-events-none fixed bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[150px] z-0" />

      {/* 3. Foreground DOM Layer (Translucent Overlays) */}
      <div className="relative z-10 flex flex-col">
        {/* Full-Screen Hero View */}
        <HeroContent onScrollToExplore={handleScrollToExplore} />

        {/* Scroll Sections Anchor */}
        <div ref={exploreRef}>
          <ScrollSections />
        </div>

        {/* Research & Platform Launch */}
        <ResearchSection />
      </div>

    </div>
  );
}
