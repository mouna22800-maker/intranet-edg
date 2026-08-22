/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consultation des organigrammes contextuels.
 * - Mode global (accueil)   : on choisit un contexte (workflow) et l'on voit tout son arbre.
 * - Mode ancré (page direction, rootUnitId fourni) : on affiche l'arbre COMPLET du contexte,
 *   mais on met en évidence (focus) la direction concernée et ses descendants, tandis que le
 *   reste (parent, directions collatérales…) est estompé. On sélectionne par défaut le contexte
 *   où la direction possède une structure.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Workflow as WorkflowIcon, Building2, Layers, ArrowLeft, RefreshCw, Info } from 'lucide-react';
import { Workflow } from '../types';

interface WorkflowViewProps {
  onNavigateBack?: () => void;
  /** Si fourni : arbre complet du contexte, avec focus sur cette entité et ses descendants. */
  rootUnitId?: number;
}

interface TreeNode {
  id: number;
  unitId: number;
  name: string;
  code: string;
  type: string;
  children: TreeNode[];
}

const isDirection = (t: string) => (t || '').trim().toLowerCase() === 'direction';
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function findSubtree(nodes: TreeNode[], unitId: number): TreeNode | null {
  for (const n of nodes) {
    if (n.unitId === unitId) return n;
    const f = findSubtree(n.children, unitId);
    if (f) return f;
  }
  return null;
}

/** Ensemble des unitId de l'entité focalisée et de tous ses descendants. */
function collectFocusSet(node: TreeNode): Set<number> {
  const s = new Set<number>();
  const walk = (n: TreeNode) => { s.add(n.unitId); n.children.forEach(walk); };
  walk(node);
  return s;
}

function NodeCard({ node, focusSet, targetUnitId }: { node: TreeNode; focusSet: Set<number> | null; targetUnitId: number | null }) {
  const dir = isDirection(node.type);
  // État de focus : 'target' = l'entité visée ; 'branch' = un de ses descendants ; 'dim' = le reste.
  let state: 'target' | 'branch' | 'dim' | 'none' = 'none';
  if (focusSet) {
    if (node.unitId === targetUnitId) state = 'target';
    else if (focusSet.has(node.unitId)) state = 'branch';
    else state = 'dim';
  }
  const dim = state === 'dim';
  const target = state === 'target';

  return (
    <div className={`relative inline-flex flex-col items-center text-center backdrop-blur-sm rounded-2xl px-4 py-3 shadow-sm min-w-[160px] max-w-[240px] transition-all border ${
      dir
        ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-300/70 dark:border-emerald-500/30'
        : 'bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-white/10'
    } ${dim ? 'opacity-40 saturate-[.55]' : 'hover:shadow-md'} ${
      target ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.03] z-10' : ''
    }`}>
      {target && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7.5px] font-mono font-black uppercase tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded-full shadow">
          Cette direction
        </span>
      )}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm mb-1.5 ${
        dir ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
      }`}>
        {dir ? <Building2 size={16} /> : <Layers size={15} />}
      </div>
      <h4 className="font-display font-black text-[12px] leading-tight text-slate-900 dark:text-white">{node.name}</h4>
      <span className={`mt-1.5 inline-flex items-center text-[8.5px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        dir ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-500/30'
            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      }`}>
        {cap(node.type)}
      </span>
    </div>
  );
}

function TreeNodes({ nodes, focusSet, targetUnitId }: { nodes: TreeNode[]; focusSet: Set<number> | null; targetUnitId: number | null }) {
  return (
    <ul>
      {nodes.map(n => (
        <li key={n.id}>
          <NodeCard node={n} focusSet={focusSet} targetUnitId={targetUnitId} />
          {n.children.length > 0 && <TreeNodes nodes={n.children} focusSet={focusSet} targetUnitId={targetUnitId} />}
        </li>
      ))}
    </ul>
  );
}

export default function WorkflowView({ onNavigateBack, rootUnitId }: WorkflowViewProps) {
  const scoped = rootUnitId != null;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [treesByWf, setTreesByWf] = useState<Record<number, TreeNode[]>>({});
  const [selectedWf, setSelectedWf] = useState<number | null>(null);
  const [showAllContexts, setShowAllContexts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = async (wfId: number): Promise<TreeNode[]> => {
    try {
      const res = await fetch(`/api/workflows/${wfId}/tree`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.tree) ? data.tree : [];
    } catch { return []; }
  };

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/workflows');
        if (!res.ok) throw new Error();
        const wfs: Workflow[] = await res.json();
        if (cancelled) return;
        setWorkflows(wfs);
        const entries = await Promise.all(wfs.map(async w => [w.id, await fetchTree(w.id)] as const));
        if (cancelled) return;
        const map: Record<number, TreeNode[]> = {};
        entries.forEach(([id, t]) => { map[id] = t; });
        setTreesByWf(map);
        if (scoped) {
          // Contexte par défaut : le 1er où la direction possède des enfants (vraie structure) ;
          // sinon le 1er où elle est présente ; sinon le tout premier.
          const present = wfs.filter(w => findSubtree(map[w.id] || [], rootUnitId as number));
          const withKids = present.find(w => (findSubtree(map[w.id] || [], rootUnitId as number)?.children.length ?? 0) > 0);
          setSelectedWf((withKids || present[0] || wfs[0])?.id ?? null);
          setShowAllContexts(present.length > 1);
        } else {
          setSelectedWf(prev => (prev && wfs.some(w => w.id === prev) ? prev : (wfs[0]?.id ?? null)));
          setShowAllContexts(false);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger les organigrammes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scoped, rootUnitId]);

  useEffect(() => reload(), [reload]);

  const currentTree = selectedWf != null ? (treesByWf[selectedWf] || []) : [];
  const scopedNode = scoped && rootUnitId != null ? findSubtree(currentTree, rootUnitId) : null;
  const focusSet = scoped && scopedNode ? collectFocusSet(scopedNode) : null;
  const scopedChildCount = scopedNode?.children.length ?? 0;

  // En mode ancré, on ne propose comme contextes que ceux où la direction est présente.
  const contextButtons = scoped
    ? workflows.filter(w => findSubtree(treesByWf[w.id] || [], rootUnitId as number))
    : workflows;
  const presentAnywhere = !scoped || contextButtons.length > 0;
  const currentWf = workflows.find(w => w.id === selectedWf) || null;
  const visibleWorkflows = showAllContexts ? contextButtons : (currentWf ? [currentWf] : []);
  const headerName = scoped ? (scopedNode?.name || 'la direction') : null;

  return (
    <div className="space-y-6 pb-16 font-sans">
      {onNavigateBack && (
        <button onClick={onNavigateBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer">
          <ArrowLeft size={14} /> Retour à l'accueil
        </button>
      )}

      {/* En-tête + sélecteur de contexte */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400">
              <WorkflowIcon size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {scoped ? `Organigramme — ${headerName}` : 'Organigrammes des directions'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {scoped
                  ? 'Sa position dans le contexte, mise en évidence parmi l’ensemble de l’organigramme.'
                  : 'Choisissez un contexte pour visualiser la hiérarchie correspondante.'}
              </p>
            </div>
          </div>
          <button onClick={reload} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {contextButtons.length > (scoped ? 1 : 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {scoped && <span className="text-[10px] font-mono font-bold uppercase text-slate-400 mr-1">Contexte :</span>}
            {contextButtons.map(w => (
              <button
                key={w.id}
                onClick={() => { setSelectedWf(w.id); setShowAllContexts(false); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedWf === w.id && !showAllContexts
                    ? 'bg-[#048343] text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {w.label}
              </button>
            ))}
            {contextButtons.length > 1 && (
              <button
                onClick={() => setShowAllContexts(prev => !prev)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer bg-slate-900 text-white hover:bg-slate-800"
              >
                {showAllContexts ? 'Voir un seul organigramme' : 'Voir tous les organigrammes'}
              </button>
            )}
          </div>
        )}
        {!scoped && currentWf?.description && <p className="text-xs text-slate-400 dark:text-slate-500 italic">{currentWf.description}</p>}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#048343] mx-auto"></div>
          <p className="text-xs font-mono mt-3">Chargement…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-2xl text-sm font-semibold text-center">{error}</div>
      ) : workflows.length === 0 ? (
        <div className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center text-slate-500">
          Aucun organigramme défini. Un administrateur peut en créer dans la console (Organigrammes &amp; circuits).
        </div>
      ) : scoped && !presentAnywhere ? (
        <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center text-slate-500 flex flex-col items-center gap-2">
          <Info size={20} className="text-slate-400" />
          <p className="text-sm font-semibold">Cette direction n'est encore placée dans aucun organigramme.</p>
          <p className="text-xs">Un administrateur peut l'ajouter à un contexte dans la console → <span className="font-mono">Organigrammes / circuits</span>.</p>
        </div>
      ) : currentTree.length === 0 ? (
        <div className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center text-slate-500">
          Ce contexte ne contient encore aucune entité.
        </div>
      ) : (
        <>
          {scoped && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-500/20"></span> Cette direction &amp; ses rattachements</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 opacity-40"></span> Reste du contexte (estompé)</span>
              {scopedChildCount === 0 && <span className="italic">— aucune sous-entité rattachée à cette direction pour l’instant.</span>}
            </div>
          )}
          <div className="space-y-10">
            {visibleWorkflows.map((wf) => {
              const tree = treesByWf[wf.id] || [];
              const scopedNodeForWf = scoped && rootUnitId != null ? findSubtree(tree, rootUnitId) : null;
              const focusSetForWf = scoped && scopedNodeForWf ? collectFocusSet(scopedNodeForWf) : null;

              return (
                <div key={wf.id} className="rounded-3xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-950/60 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <div className="text-[10px] uppercase font-mono tracking-widest text-slate-400 dark:text-slate-500 mb-1">Organigramme</div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{wf.label}</h3>
                      {wf.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{wf.description}</p>}
                    </div>
                    {showAllContexts && scoped && scopedNodeForWf && (
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Direction mise en évidence</div>
                    )}
                  </div>
                  <div className="org-tree overflow-x-auto pb-6">
                    <div className="inline-block min-w-full text-center">
                      <TreeNodes nodes={tree} focusSet={showAllContexts ? focusSetForWf : focusSet} targetUnitId={scoped ? (rootUnitId as number) : null} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
