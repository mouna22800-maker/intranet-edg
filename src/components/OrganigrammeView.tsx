/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Network, ArrowLeft, RefreshCw, UserRound, Building2 } from 'lucide-react';
import { Poste } from '../types';

interface OrganigrammeViewProps {
  onNavigateBack?: () => void;
  /** Si fourni, n'affiche que les postes rattachés à cette direction (vue intégrée à un espace direction). */
  departmentId?: number;
}

interface TreeNode extends Poste {
  children: TreeNode[];
}

function buildTree(postes: Poste[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  postes.forEach(p => byId.set(p.id, { ...p, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach(node => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.title.localeCompare(b.title));
    n.children.forEach(sortRec);
  };
  roots.forEach(sortRec);
  roots.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.title.localeCompare(b.title));
  return roots;
}

function PosteCard({ node }: { node: TreeNode }) {
  const vacant = !node.occupantName || !node.occupantName.trim();
  return (
    <div className="inline-flex flex-col items-center text-center bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/70 dark:border-white/10 rounded-2xl px-4 py-3 shadow-sm min-w-[170px] max-w-[220px] hover:border-emerald-400/60 hover:shadow-md transition-all">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-sm mb-1.5">
        <UserRound size={16} />
      </div>
      <h4 className="font-display font-black text-[12px] leading-tight text-slate-900 dark:text-white">{node.title}</h4>
      <p className={`text-[10px] mt-0.5 font-medium ${vacant ? 'text-slate-400 italic' : 'text-emerald-700 dark:text-emerald-400'}`}>
        {vacant ? 'Poste vacant' : node.occupantName}
      </p>
      {node.unityCode && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[8.5px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Building2 size={8} /> {node.unityCode}
        </span>
      )}
    </div>
  );
}

function TreeNodes({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul>
      {nodes.map(n => (
        <li key={n.id}>
          <PosteCard node={n} />
          {n.children.length > 0 && <TreeNodes nodes={n.children} />}
        </li>
      ))}
    </ul>
  );
}

function findTreeNode(nodes: TreeNode[], id: number): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findTreeNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export default function OrganigrammeView({ onNavigateBack, departmentId }: OrganigrammeViewProps) {
  const [postes, setPostes] = useState<Poste[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/postes')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data) => { setPostes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError("Impossible de charger l'organigramme."); setLoading(false); });
  };

  useEffect(load, []);

  // Vue intégrée à une direction : on ne garde que ses postes (leur hiérarchie interne).
  const source = departmentId != null ? postes.filter(p => p.unityId === departmentId) : postes;
  const roots = buildTree(source);
  const selectedRoot = selectedRootId != null ? findTreeNode(roots, selectedRootId) : null;
  const visibleRoots = selectedRoot ? [selectedRoot] : roots;

  return (
    <div className="space-y-6 pb-16 font-sans">
      {onNavigateBack && (
        <button onClick={onNavigateBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer">
          <ArrowLeft size={14} /> Retour à l'accueil
        </button>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400">
              <Network size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Organigramme des postes
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Hiérarchie des fonctions de l'Électricité de Guinée (les personnes occupant les postes sont indiquées à titre indicatif).
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {roots.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Racine :</span>
            <button
              onClick={() => setSelectedRootId(null)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selectedRootId == null ? 'bg-[#048343] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Toutes
            </button>
            {roots.map(root => (
              <button
                key={root.id}
                onClick={() => setSelectedRootId(root.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selectedRootId === root.id ? 'bg-[#048343] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {root.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#048343] mx-auto"></div>
          <p className="text-xs font-mono mt-3">Chargement de l'organigramme…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-2xl text-sm font-semibold text-center">{error}</div>
      ) : roots.length === 0 ? (
        <div className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center text-slate-500">
          Aucun poste défini pour l'instant. Un administrateur peut les créer dans la console d'administration.
        </div>
      ) : (
        <div className="space-y-4">
          {selectedRoot && (
            <div className="text-sm text-slate-500 dark:text-slate-400 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              Affichage centré sur la racine <span className="font-semibold text-slate-700 dark:text-white">{selectedRoot.title}</span> et ses descendants.
            </div>
          )}
          <div className="org-tree overflow-x-auto pb-6">
            <div className="inline-block min-w-full text-center">
              <TreeNodes nodes={visibleRoots} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
