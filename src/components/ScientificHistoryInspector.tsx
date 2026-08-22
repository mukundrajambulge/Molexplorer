import React, { useState, useMemo } from "react";
import {
  X, ChevronRight, ChevronDown, GitBranch, Clock, Hash,
  Shield, Activity, ArrowLeft, ArrowRight, AlertCircle,
  CheckCircle2, Info, Lock, History, FileText
} from "lucide-react";
import { ScientificRevisionManager } from "../domain/ScientificRevisionManager";
import { CanonicalMolecularDocument, ScientificRevision, ProvenanceRecord } from "../types/domain";
import { validateCanonicalMolecule } from "../domain/HierarchyAdapter";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ScientificHistoryInspectorProps {
  revisionManager: ScientificRevisionManager | null;
  document: CanonicalMolecularDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToRevision?: (revisionId: string) => void;
  isPseSnapshotOnly?: boolean;
  /** Increment this value from parent after any mutation/undo/redo/navigate to force refresh */
  revisionVersion?: number;
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type TabId = "history" | "tree" | "provenance" | "integrity" | "diff";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "history",    label: "History",    icon: History },
  { id: "tree",       label: "Tree",       icon: GitBranch },
  { id: "provenance", label: "Provenance", icon: FileText },
  { id: "integrity",  label: "Integrity",  icon: Shield },
  { id: "diff",       label: "Before/After", icon: Activity },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 20 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
}

function humanOp(provenance: ProvenanceRecord | undefined, revision: ScientificRevision): string {
  if (provenance?.operation_name) return provenance.operation_name;
  const opId = revision.operation_id || "";
  // derive from operation_id prefix e.g. "op-remove-uuid"
  const m = opId.match(/^op-([a-z_]+)-/);
  if (m) return m[1].replace(/_/g, "-");
  return revision.parent_revision_id === null ? "root (session baseline)" : "unknown";
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({ label, value, mono = false, chip }: {
  label: string; value: string; mono?: boolean; chip?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
      <span className="shrink-0 w-32 text-[10px] text-slate-400 uppercase tracking-wide leading-5">{label}</span>
      <span className={`flex-1 text-[11px] break-all ${mono ? "font-mono text-cyan-300" : "text-white/90"}`}>
        {value}
        {chip}
      </span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
      <Info className="w-6 h-6" />
      <p className="text-xs text-center px-4">{message}</p>
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({
  mgr,
  selectedRevId,
  onSelectRev,
}: {
  mgr: ScientificRevisionManager;
  selectedRevId: string;
  onSelectRev: (id: string) => void;
}) {
  const activeRev = mgr.getActiveRevision();
  const provenance = mgr.getProvenance(activeRev.revision_id);
  const canUndo = mgr.canUndo();
  const canRedo = mgr.canRedo();

  return (
    <div className="space-y-1 text-xs">
      {/* Scope context — always first per spec §8 */}
      <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg p-2 mb-3">
        <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest mb-1">Scope Context</p>
        <Field label="document_id" value={shortId(activeRev.document_id)} mono />
        <Field label="object_id"   value={shortId(activeRev.object_id)} mono />
        <Field label="state_id"    value={shortId(activeRev.state_id)} mono />
      </div>

      {/* Active revision */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-widest mb-1">Active Revision</p>
        <Field label="revision_id"    value={shortId(activeRev.revision_id)} mono />
        <Field label="parent_rev"     value={activeRev.parent_revision_id ? shortId(activeRev.parent_revision_id) : "— (root)"} mono />
        <Field label="operation"      value={humanOp(provenance, activeRev)} />
        <Field label="operation_id"   value={shortId(activeRev.operation_id)} mono />
        <Field label="timestamp"      value={formatTimestamp(activeRev.timestamp)} />
        <Field label="author"         value={activeRev.author || "—"} />
        <Field label="provenance ref" value={provenance ? shortId(provenance.provenance_id) : "— (root, no provenance)"} mono />
      </div>

      {/* Hash display */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-widest mb-1">Hash Display</p>
        <Field label="STATE HASH"    value={shortId(activeRev.canonical_state_hash)} mono />
        <Field label="REVISION HASH" value={shortId(activeRev.revision_hash)} mono />
      </div>

      {/* Undo / Redo status */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Navigation Status</p>
        <div className="flex gap-3 mt-1">
          <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${canUndo ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/30" : "border-white/10 text-slate-500"}`}>
            <ArrowLeft className="w-3 h-3" /> undo {canUndo ? "available" : "unavailable"}
          </span>
          <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${canRedo ? "border-sky-500/40 text-sky-400 bg-sky-950/30" : "border-white/10 text-slate-500"}`}>
            <ArrowRight className="w-3 h-3" /> redo {canRedo ? "available" : "unavailable"}
          </span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          Total revisions: {mgr.getRevisionCount()}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Revision Tree ───────────────────────────────────────────────────────

function TreeTab({
  mgr,
  selectedRevId,
  onSelectRev,
  onNavigate,
}: {
  mgr: ScientificRevisionManager;
  selectedRevId: string;
  onSelectRev: (id: string) => void;
  onNavigate?: (id: string) => void;
}) {
  const treeNodes = mgr.getRevisionTree();
  const activeRevId = mgr.getActiveRevisionId();

  // Build parent→children lookup
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, string[]>();
    for (const n of treeNodes) {
      const parentId = n.revision.parent_revision_id;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(n.revision.revision_id);
    }
    return map;
  }, [treeNodes]);

  const revById = useMemo(() => {
    const map = new Map<string, ScientificRevision>();
    for (const n of treeNodes) map.set(n.revision.revision_id, n.revision);
    return map;
  }, [treeNodes]);

  function renderNode(revId: string, depth: number): React.ReactNode {
    const rev = revById.get(revId);
    if (!rev) return null;
    const isActive = revId === activeRevId;
    const isSelected = revId === selectedRevId;
    const children = childrenOf.get(revId) || [];
    const prov = mgr.getProvenance(revId);
    const opName = humanOp(prov, rev);
    const isBranch = children.length > 1;

    return (
      <div key={revId} style={{ marginLeft: depth * 14 }} className="mt-0.5">
        <div
          className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 cursor-pointer text-[10px] transition-colors
            ${isSelected ? "bg-amber-500/20 border border-amber-500/40" : "hover:bg-white/5 border border-transparent"}
          `}
          onClick={() => onSelectRev(revId)}
        >
          {/* Tree connector */}
          {depth > 0 && (
            <span className="text-slate-600 select-none">{"└─"}</span>
          )}

          {/* Active indicator */}
          {isActive && (
            <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30" title="Active" />
          )}

          <span className={`font-mono ${isActive ? "text-amber-300 font-bold" : "text-slate-300"}`}>
            {shortId(revId)}
          </span>

          <span className="text-slate-500">{opName}</span>

          {isBranch && (
            <span className="ml-1 px-1 py-0 rounded text-[9px] border border-sky-500/40 text-sky-400 bg-sky-950/30">
              branch
            </span>
          )}

          {isActive && (
            <span className="ml-auto px-1 py-0 rounded text-[9px] border border-amber-500/40 text-amber-300 bg-amber-950/30">
              active
            </span>
          )}

          {/* Navigate button */}
          {!isActive && onNavigate && (
            <button
              className="ml-auto text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
              onClick={(e) => { e.stopPropagation(); onNavigate(revId); }}
              title="Navigate to this revision"
            >
              goto
            </button>
          )}
        </div>

        {/* Recurse children */}
        {children.map(cid => renderNode(cid, depth + 1))}
      </div>
    );
  }

  // Find root(s) — revisions with no parent
  const roots = treeNodes.filter(n => n.revision.parent_revision_id === null).map(n => n.revision.revision_id);

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-slate-400 uppercase tracking-widest">
        <GitBranch className="w-3 h-3" /> Revision DAG
        <span className="ml-auto text-slate-600">{mgr.getRevisionCount()} revisions</span>
      </div>
      <div className="overflow-y-auto max-h-72 pr-1">
        {roots.map(rootId => renderNode(rootId, 0))}
      </div>
      <p className="mt-2 text-[9px] text-slate-600 italic">Click a node to inspect. Historical revisions are immutable.</p>
    </div>
  );
}

// ─── Tab: Provenance ──────────────────────────────────────────────────────────

function ProvenanceTab({
  mgr,
  selectedRevId,
}: {
  mgr: ScientificRevisionManager;
  selectedRevId: string;
}) {
  const prov = mgr.getProvenance(selectedRevId);
  const rev = mgr.getRevision(selectedRevId);

  if (!prov) {
    return <EmptyState message="No provenance record for this revision (root baseline has no operation provenance)." />;
  }

  const atomIdDisplay = prov.resolved_atom_ids.length === 0
    ? "— (none)"
    : prov.resolved_atom_ids.length <= 20
      ? prov.resolved_atom_ids.join(", ")
      : `${prov.resolved_atom_ids.slice(0, 20).join(", ")} … (+${prov.resolved_atom_ids.length - 20} more)`;

  return (
    <div className="space-y-1 text-xs">
      {/* Immutability notice */}
      <div className="flex items-center gap-1.5 bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1 mb-2">
        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-[10px] text-amber-300 font-semibold">IMMUTABLE RECORD — read-only</span>
      </div>

      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <Field label="provenance_id"   value={shortId(prov.provenance_id)} mono />
        <Field label="revision_id"     value={shortId(prov.revision_id)} mono />
        <Field label="parent_rev"      value={prov.parent_revision_id ? shortId(prov.parent_revision_id) : "— (root)"} mono />
        <Field label="operation"       value={prov.operation_name} />
        <Field label="selection query" value={prov.selection_query || "— (not applicable)"} mono />
        <Field label="resolved atoms"  value={`${prov.resolved_atom_ids.length} atoms: ${atomIdDisplay}`} mono />
        <Field label="object_id"       value={shortId(rev?.object_id)} mono />
        <Field label="state_id"        value={shortId(rev?.state_id)} mono />
        <Field label="validation"      value={prov.validation_summary || "PASSED"} />
        <Field label="timestamp"       value={formatTimestamp(prov.timestamp)} />
        <Field label="tool_version"    value={prov.tool_version} />
      </div>

      {/* Parameters */}
      {prov.parameters && Object.keys(prov.parameters).length > 0 && (
        <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Parameters</p>
          {Object.entries(prov.parameters).map(([k, v]) => (
            <Field key={k} label={k} value={String(v)} mono />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Integrity ───────────────────────────────────────────────────────────

function IntegrityTab({
  mgr,
  selectedRevId,
}: {
  mgr: ScientificRevisionManager;
  selectedRevId: string;
}) {
  const rev = mgr.getRevision(selectedRevId);
  if (!rev) return <EmptyState message="Revision not found." />;

  const mol = rev.molecule_snapshot;
  const parentRev = rev.parent_revision_id ? mgr.getRevision(rev.parent_revision_id) : null;
  const parentHash = parentRev?.canonical_state_hash ?? null;
  const hashMatch = parentHash !== null && parentHash === rev.canonical_state_hash;

  // Run existing validator — do NOT invent new rules
  let validationErrors: string[] = [];
  let isValid = true;
  try {
    validateCanonicalMolecule(mol);
  } catch (err: any) {
    isValid = false;
    validationErrors = [err.message];
  }

  return (
    <div className="space-y-1 text-xs">
      {/* Scope context */}
      <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg p-2 mb-2">
        <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest mb-1">Object / State Context</p>
        <Field label="document_id" value={shortId(rev.document_id)} mono />
        <Field label="object_id"   value={shortId(rev.object_id)} mono />
        <Field label="state_id"    value={shortId(rev.state_id)} mono />
      </div>

      {/* Validity badge */}
      <div className={`flex items-center gap-2 rounded-lg p-2 border ${isValid ? "bg-emerald-950/30 border-emerald-500/30" : "bg-rose-950/30 border-rose-500/30"}`}>
        {isValid
          ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-emerald-300 font-bold text-[11px]">✅ VALID — canonical invariants satisfied</span></>
          : <><AlertCircle  className="w-4 h-4 text-rose-400"    /><span className="text-rose-300    font-bold text-[11px]">⚠️ STALE / INVALID — {validationErrors[0]}</span></>
        }
      </div>

      {/* Structural counts */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Structural Counts</p>
        <Field label="atoms"    value={String(mol.atoms.length)} />
        <Field label="bonds"    value={String(mol.topology.bonds.length)} />
        <Field label="residues" value={String(mol.residues.length)} />
        <Field label="chains"   value={String(mol.chains.length)} />
      </div>

      {/* Hash display */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-purple-400 uppercase tracking-widest mb-1">Hash Verification</p>
        <Field label="STATE HASH (current)" value={shortId(rev.canonical_state_hash)} mono />
        <Field label="STATE HASH (parent)"  value={parentHash ? shortId(parentHash) : "— (root, no parent)"} mono />
        <Field label="REVISION HASH"        value={shortId(rev.revision_hash)} mono />
        <div className={`mt-1 text-[10px] px-2 py-1 rounded-md border ${hashMatch ? "border-rose-500/40 text-rose-400 bg-rose-950/30" : "border-emerald-500/40 text-emerald-400 bg-emerald-950/30"}`}>
          {hashMatch
            ? "⚠️ H(current) == H(parent) — unexpected state equivalence"
            : parentHash === null
              ? "H(parent) not available — root revision"
              : "✅ H(current) ≠ H(parent) — state mutation verified"
          }
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Before/After ────────────────────────────────────────────────────────

function DiffTab({
  mgr,
  selectedRevId,
}: {
  mgr: ScientificRevisionManager;
  selectedRevId: string;
}) {
  const rev = mgr.getRevision(selectedRevId);
  if (!rev || rev.parent_revision_id === null) {
    return <EmptyState message="Root revision has no parent — no before/after comparison available." />;
  }

  const parentRev = mgr.getRevision(rev.parent_revision_id);
  if (!parentRev) {
    return <EmptyState message="Parent revision not found in graph." />;
  }

  const prov = mgr.getProvenance(selectedRevId);
  const opName = humanOp(prov, rev);

  const curr = rev.molecule_snapshot;
  const prev = parentRev.molecule_snapshot;

  const atomDelta = curr.atoms.length - prev.atoms.length;
  const bondDelta = curr.topology.bonds.length - prev.topology.bonds.length;
  const topologyChanged = bondDelta !== 0;
  const atomSetChanged = atomDelta !== 0;

  function delta(n: number) {
    if (n > 0) return <span className="text-emerald-400">+{n}</span>;
    if (n < 0) return <span className="text-rose-400">{n}</span>;
    return <span className="text-slate-500">0 (unchanged)</span>;
  }

  // Try to extract property change from provenance parameters
  let propertyChangeLabel: React.ReactNode = null;
  if (prov?.parameters) {
    const p = prov.parameters;
    if (p.property && (p.old_value !== undefined || p.new_value !== undefined)) {
      propertyChangeLabel = (
        <div className="mt-1 text-[10px] font-mono text-white/70">
          property changed: <span className="text-cyan-300">{p.property}</span>{" "}
          <span className="text-rose-300">{String(p.old_value ?? "?")}</span> → <span className="text-emerald-300">{String(p.new_value ?? "?")}</span>
        </div>
      );
    } else if (p.property) {
      propertyChangeLabel = (
        <div className="mt-1 text-[10px] font-mono text-white/70">
          property modified: <span className="text-cyan-300">{p.property}</span>
        </div>
      );
    }
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Operation</p>
        <div className="text-[12px] font-semibold text-white">{opName}</div>
        {propertyChangeLabel}
      </div>

      {/* Structural delta — sourced from molecule_snapshot, not viewer */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Structural Delta (authoritative revision data)</p>
        <div className="grid grid-cols-3 gap-1 text-[11px]">
          <span className="text-slate-400">Property</span>
          <span className="text-slate-400">Before</span>
          <span className="text-slate-400">After</span>

          <span>atoms</span>
          <span className="font-mono text-white/80">{prev.atoms.length}</span>
          <span className="font-mono">{prev.atoms.length} → {curr.atoms.length} ({delta(atomDelta)})</span>

          <span>bonds</span>
          <span className="font-mono text-white/80">{prev.topology.bonds.length}</span>
          <span className="font-mono">{prev.topology.bonds.length} → {curr.topology.bonds.length} ({delta(bondDelta)})</span>

          <span>residues</span>
          <span className="font-mono text-white/80">{prev.residues.length}</span>
          <span className="font-mono">{prev.residues.length} → {curr.residues.length} ({delta(curr.residues.length - prev.residues.length)})</span>

          <span>chains</span>
          <span className="font-mono text-white/80">{prev.chains.length}</span>
          <span className="font-mono">{prev.chains.length} → {curr.chains.length} ({delta(curr.chains.length - prev.chains.length)})</span>
        </div>
      </div>

      {/* Summary line */}
      <div className="text-[10px] text-slate-500 italic pl-1">
        {atomSetChanged && !topologyChanged && "Atom set changed; topology unchanged."}
        {!atomSetChanged && topologyChanged && "Topology changed; atom set unchanged."}
        {atomSetChanged && topologyChanged && "Both atom set and topology changed."}
        {!atomSetChanged && !topologyChanged && "No structural change (property-only mutation)."}
      </div>

      {/* State hash delta */}
      <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">State Hash Delta</p>
        <div className="text-[10px] font-mono">
          <span className="text-slate-500">before: </span><span className="text-rose-300">{shortId(parentRev.canonical_state_hash)}</span>
        </div>
        <div className="text-[10px] font-mono mt-0.5">
          <span className="text-slate-500">after:  </span><span className="text-emerald-300">{shortId(rev.canonical_state_hash)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScientificHistoryInspector({
  revisionManager,
  document: doc,
  isOpen,
  onClose,
  onNavigateToRevision,
  isPseSnapshotOnly = false,
  revisionVersion: _revisionVersion = 0,
}: ScientificHistoryInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("history");
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);

  if (!isOpen) return null;

  // ── No mutations yet ──────────────────────────────────────────────────────
  if (!revisionManager) {
    return (
      <div
        data-testid="scientific-history-inspector"
        className="absolute top-16 left-4 z-40 pointer-events-auto w-96 max-h-[calc(100vh-6rem)] flex flex-col bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden"
        style={{ fontFamily: "inherit" }}
      >
        <Header onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
          <History className="w-8 h-8 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No scientific mutations recorded in this session</p>
          <p className="text-xs text-slate-600">Perform a mutation (remove, bond, alter, etc.) to initialize the scientific revision history.</p>
        </div>
        <div className="px-4 pb-3">
          <p className="text-[9px] text-slate-700 italic text-center">IMPLEMENTED · SOFTWARE VERIFIED · CLASSICAL CHEMICAL RULES APPLIED · NOT EXTERNALLY BENCHMARKED</p>
        </div>
      </div>
    );
  }

  // ── PSE snapshot-only mode ────────────────────────────────────────────────
  if (isPseSnapshotOnly) {
    const activeRev = revisionManager.getActiveRevision();
    return (
      <div
        data-testid="scientific-history-inspector"
        className="absolute top-16 left-4 z-40 pointer-events-auto w-96 max-h-[calc(100vh-6rem)] flex flex-col bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden"
      >
        <Header onClose={onClose} />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-300">
              <strong>History not available — PSE snapshot only.</strong><br />
              Full revision DAG is not persisted per current policy. The active scientific snapshot has been restored.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-lg p-2 text-xs">
            <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest mb-1">Restored Snapshot</p>
            <Field label="revision_id"   value={shortId(activeRev.revision_id)} mono />
            <Field label="document_id"   value={shortId(activeRev.document_id)} mono />
            <Field label="object_id"     value={shortId(activeRev.object_id)} mono />
            <Field label="state_id"      value={shortId(activeRev.state_id)} mono />
            <Field label="STATE HASH"    value={shortId(activeRev.canonical_state_hash)} mono />
            <Field label="REVISION HASH" value={shortId(activeRev.revision_hash)} mono />
            <Field label="atoms"         value={String(activeRev.molecule_snapshot.atoms.length)} />
            <Field label="bonds"         value={String(activeRev.molecule_snapshot.topology.bonds.length)} />
          </div>
        </div>
        <div className="px-4 pb-3">
          <p className="text-[9px] text-slate-700 italic text-center">IMPLEMENTED · SOFTWARE VERIFIED · CLASSICAL CHEMICAL RULES APPLIED · NOT EXTERNALLY BENCHMARKED</p>
        </div>
      </div>
    );
  }

  // ── Normal mode ───────────────────────────────────────────────────────────
  const activeRevId = revisionManager.getActiveRevisionId();
  // Default selected revision to active
  const resolvedSelectedId = selectedRevId ?? activeRevId;

  const handleSelectRev = (id: string) => {
    setSelectedRevId(id);
    // Switch to provenance when user clicks a tree node
    if (activeTab === "tree") setActiveTab("provenance");
  };

  const handleNavigate = (id: string) => {
    onNavigateToRevision?.(id);
    setSelectedRevId(id);
  };

  return (
    <div
      data-testid="scientific-history-inspector"
      className="absolute top-16 left-4 z-40 pointer-events-auto w-[420px] max-h-[calc(100vh-6rem)] flex flex-col bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden"
    >
      <Header onClose={onClose} />

      {/* Tab bar */}
      <div className="flex border-b border-white/10 bg-slate-950/50 shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-cyan-400 text-cyan-400 bg-cyan-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {activeTab === "history" && (
          <HistoryTab
            mgr={revisionManager}
            selectedRevId={resolvedSelectedId}
            onSelectRev={handleSelectRev}
          />
        )}
        {activeTab === "tree" && (
          <TreeTab
            mgr={revisionManager}
            selectedRevId={resolvedSelectedId}
            onSelectRev={handleSelectRev}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === "provenance" && (
          <ProvenanceTab
            mgr={revisionManager}
            selectedRevId={resolvedSelectedId}
          />
        )}
        {activeTab === "integrity" && (
          <IntegrityTab
            mgr={revisionManager}
            selectedRevId={resolvedSelectedId}
          />
        )}
        {activeTab === "diff" && (
          <DiffTab
            mgr={revisionManager}
            selectedRevId={resolvedSelectedId}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 shrink-0 border-t border-white/5 pt-1.5">
        <p className="text-[9px] text-slate-700 italic text-center">IMPLEMENTED · SOFTWARE VERIFIED · CLASSICAL CHEMICAL RULES APPLIED · NOT EXTERNALLY BENCHMARKED</p>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0 bg-slate-900/50">
      <History className="w-4 h-4 text-cyan-400" />
      <span className="text-sm font-bold text-white">Scientific History Inspector</span>
      <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/30 font-semibold">READ-ONLY</span>
      <button
        onClick={onClose}
        className="ml-auto p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        title="Close inspector"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default ScientificHistoryInspector;
