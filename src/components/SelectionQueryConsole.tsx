import React, { useState, useRef, useEffect } from "react";
import { Terminal, Send, Trash2, CheckCircle2, AlertCircle, HelpCircle, ChevronRight, CornerDownLeft, Minus, X } from "lucide-react";
import { useStore } from "../store";

interface QueryConsoleProps {
  onRunQuery: (query: string) => { count: number; textOutput?: string } | string | undefined;
  selectedAtomCount: number;
  totalAtomCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface QueryLog {
  id: string;
  query: string;
  count: number;
  status: "success" | "error";
  timestamp: string;
  error?: string;
  textOutput?: string;
}

export const SelectionQueryConsole: React.FC<QueryConsoleProps> = ({
  onRunQuery,
  selectedAtomCount,
  totalAtomCount,
  isOpen,
  setIsOpen
}) => {
  const [inputQuery, setInputQuery] = useState("");
  const [logs, setLogs] = useState<QueryLog[]>([
    {
      id: "1",
      query: "all",
      count: totalAtomCount,
      status: "success",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  ]);
  const { lastMeasurementLog } = useStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastMeasurementLog) {
      const newLog: QueryLog = {
        id: crypto.randomUUID(),
        query: "3D Pick / Measurement",
        count: selectedAtomCount,
        status: "success",
        textOutput: lastMeasurementLog,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setLogs(prev => [...prev, newLog]);
    }
  }, [lastMeasurementLog]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleExecute = (queryToRun?: string) => {
    const q = (queryToRun || inputQuery).trim();
    if (!q) return;

    try {
      const res = onRunQuery(q);
      let count = selectedAtomCount;
      let outputText: string | undefined = undefined;

      if (res && typeof res === 'object') {
        count = res.count;
        outputText = res.textOutput;
      } else if (typeof res === 'string') {
        outputText = res;
      }

      const newLog: QueryLog = {
        id: crypto.randomUUID(),
        query: q,
        count: count,
        status: "success",
        textOutput: outputText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setLogs(prev => [...prev, newLog]);
      if (!queryToRun) setInputQuery("");
    } catch (err: any) {
      const errorLog: QueryLog = {
        id: crypto.randomUUID(),
        query: q,
        count: 0,
        status: "error",
        error: err.message || "Invalid selection query syntax",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setLogs(prev => [...prev, errorLog]);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-[#0E0E12]/90 border border-white/10 hover:border-[#4A90E2] backdrop-blur-md px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-2 shadow-xl hover:shadow-2xl transition-all"
      >
        <Terminal className="w-4 h-4 text-[#4A90E2]" />
        <span>Selection Query Console</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-lg bg-[#0E0E12]/95 border border-white/15 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono text-xs">
      
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#070709] border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#4A90E2]" />
          <span className="font-semibold text-white tracking-wide">Selection Algebra Console</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
            title="Minimize Console (-)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLogs([])}
            className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400 transition-colors font-bold"
            title="Close Console (✕)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Console Log Window */}
      <div className="h-44 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar bg-[#050507]/60 text-white/80">
        {logs.map((log) => (
          <div key={log.id} className="flex flex-col gap-0.5 border-b border-white/[0.04] pb-1.5">
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-[#4A90E2]" />
                <strong className="text-white font-mono">{log.query}</strong>
              </span>
              <span>{log.timestamp}</span>
            </div>
            
            {log.status === "success" ? (
              <div className="flex flex-col gap-1 pl-4 text-[11px] text-emerald-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Selected <strong>{log.count}</strong> / {totalAtomCount} atoms</span>
                </div>
                {log.textOutput && (
                  <div className="mt-1 text-white/90 whitespace-pre-wrap bg-black/40 p-2 rounded border border-white/5 font-mono text-[10px] max-w-full overflow-x-auto leading-relaxed">
                    {log.textOutput}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-400 pl-4">
                <AlertCircle className="w-3 h-3" />
                <span>Syntax Error: {log.error}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Input Prompt Bar */}
      <div className="p-2.5 bg-[#0A0A0E] border-t border-white/10 flex items-center gap-2">
        <span className="text-[#4A90E2] font-bold pl-1">&gt;</span>
        <textarea
          rows={1}
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleExecute();
            }
          }}
          placeholder="Type selection query (e.g. byres (resn LIG around 5))..."
          className="flex-1 bg-transparent text-white focus:outline-none resize-none text-xs placeholder:text-white/30"
        />
        <button
          onClick={() => handleExecute()}
          className="px-3 py-1.5 rounded-lg bg-[#4A90E2] hover:bg-[#357abd] text-white text-xs font-semibold flex items-center gap-1 transition-all"
        >
          <span>Run</span>
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </div>

      {/* Quick Presets Bar at Bottom */}
      <div className="px-3 py-1.5 bg-[#070709] border-t border-white/[0.06] flex items-center gap-1 overflow-x-auto text-[10px] no-scrollbar">
        <span className="text-white/40 mr-1 shrink-0">Examples:</span>
        {[
          "byres (resn LIG around 5)",
          "chain A and resn ALA",
          "ss h and not resn HOH"
        ].map(ex => (
          <button
            key={ex}
            onClick={() => { setInputQuery(ex); handleExecute(ex); }}
            className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/[0.06] whitespace-nowrap shrink-0"
          >
            {ex}
          </button>
        ))}
      </div>

    </div>
  );
};
