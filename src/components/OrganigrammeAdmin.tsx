/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gestion des organigrammes / circuits DYNAMIQUES et CONTEXTUELS.
 *
 * Concept : une entité (unity) existe indépendamment. Un « workflow » est un contexte
 * (Organigramme Général, Validation Application…). Dans un workflow donné, on place des entités
 * avec un parent PROPRE à ce workflow — la même entité peut donc avoir un parent différent ailleurs.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { UnitEntity, Workflow, OrgNode } from '../types';
import { apiFetch } from '../api';
import {
  Workflow as WorkflowIcon, Plus, Pencil, Trash2, Save, X, RefreshCw, AlertCircle,
  Building2, Layers, CornerDownRight, ChevronDown, ChevronRight,
} from 'lucide-react';

const isDirection = (t: string) => (t || '').trim().toLowerCase() === 'direction';
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const LEVEL_SUGGESTIONS = ['Direction', 'Département', 'Service', 'Division', 'Section', 'Bureau', 'Cellule', 'Unité', 'Pôle'];

interface TreeNode extends OrgNode { children: TreeNode[]; }

/** Construit l'arbre à partir des nœuds plats (relation unitId ↔ parentUnitId). */
function buildTree(nodes: OrgNode[]): TreeNode[] {
  const byUnit = new Map<number, TreeNode>();
  nodes.forEach(n => byUnit.set(n.unitId, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  byUnit.forEach(node => {
    const p = node.parentUnitId;
    if (p != null && byUnit.has(p)) byUnit.get(p)!.children.push(node);
    else roots.push(node);
  });
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.name.localeCompare(b.name));
    n.children.forEach(sortRec);
  };
  roots.forEach(sortRec);
  roots.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.name.localeCompare(b.name));
  return roots;
}

const inputCls = "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-400 shadow-sm";

export default function OrganigrammeAdmin() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWf, setSelectedWf] = useState<number | null>(null);
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [entities, setEntities] = useState<UnitEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire d'ajout d'une entité au workflow courant
  const [addUnitId, setAddUnitId] = useState<number | ''>('');
  const [addParentId, setAddParentId] = useState<number | ''>('');

  // Création / édition de workflow
  const [wfForm, setWfForm] = useState<{ id: number | 'new'; label: string; description: string } | null>(null);

  // Gestion des entités (unity)
  const [showEntities, setShowEntities] = useState(false);
  const [entForm, setEntForm] = useState<{ id: number | 'new'; name: string; type: string } | null>(null);

  const loadWorkflows = useCallback(async () => {
    try {
      const res = await apiFetch('/api/workflows', {}, null);
      if (res.ok) {
        const data: Workflow[] = await res.json();
        setWorkflows(data);
        setSelectedWf(prev => (prev && data.some(w => w.id === prev) ? prev : (data[0]?.id ?? null)));
      }
    } catch { /* silencieux */ }
  }, []);

  const loadEntities = useCallback(async () => {
    try {
      const res = await apiFetch('/api/workflows/entities', {}, null);
      if (res.ok) setEntities(await res.json());
    } catch { /* silencieux */ }
  }, []);

  const loadNodes = useCallback(async (wfId: number | null) => {
    if (!wfId) { setNodes([]); return; }
    try {
      const res = await apiFetch(`/api/workflows/${wfId}/nodes`, {}, null);
      if (res.ok) setNodes(await res.json());
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadWorkflows(), loadEntities()]);
      setLoading(false);
    })();
  }, [loadWorkflows, loadEntities]);

  useEffect(() => { loadNodes(selectedWf); setAddUnitId(''); setAddParentId(''); }, [selectedWf, loadNodes]);

  // Entités déjà présentes dans le workflow courant (pour le formulaire adaptatif)
  const unitsInWf = new Set(nodes.map(n => n.unitId));
  const availableEntities = entities.filter(e => !unitsInWf.has(e.id));      // sélectionnables à l'ajout
  const parentChoices = nodes;                                              // parents = entités DÉJÀ dans ce workflow
  const entityName = (uid?: number | null) => entities.find(e => e.id === uid)?.name || nodes.find(n => n.unitId === uid)?.name || '—';

  async function apiJson(url: string, method: string, body: any) {
    setError(null);
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, null);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError((d && d.detail) || 'Échec de l’opération.');
      return null;
    }
    return res.json().catch(() => ({}));
  }

  // ---- Workflows ----
  const saveWorkflow = async () => {
    if (!wfForm || !wfForm.label.trim()) { setError('Le nom de l’organigramme est obligatoire.'); return; }
    const body = { label: wfForm.label.trim(), description: wfForm.description.trim() };
    const r = wfForm.id === 'new'
      ? await apiJson('/api/workflows', 'POST', body)
      : await apiJson(`/api/workflows/${wfForm.id}`, 'PUT', body);
    if (r) { setWfForm(null); await loadWorkflows(); if (r.id) setSelectedWf(r.id); }
  };
  const deleteWorkflow = async (w: Workflow) => {
    if (!window.confirm(`Supprimer l’organigramme « ${w.label} » et tous ses placements ? (les entités elles-mêmes sont conservées)`)) return;
    const res = await apiFetch(`/api/workflows/${w.id}`, { method: 'DELETE' }, null);
    if (res.ok) { setSelectedWf(null); await loadWorkflows(); }
  };

  // ---- Nœuds (placement d'entités) ----
  const addNode = async () => {
    if (!selectedWf || addUnitId === '') { setError('Choisissez une entité à ajouter.'); return; }
    const r = await apiJson(`/api/workflows/${selectedWf}/nodes`, 'POST', {
      unitId: Number(addUnitId),
      parentUnitId: addParentId === '' ? null : Number(addParentId),
      ordre: nodes.length,
    });
    if (r) { setAddUnitId(''); setAddParentId(''); await loadNodes(selectedWf); }
  };
  const changeParent = async (node: OrgNode, parentUnitId: number | null) => {
    const r = await apiJson(`/api/workflows/${selectedWf}/nodes/${node.id}`, 'PUT', { parentUnitId, ordre: node.ordre ?? 0 });
    if (r) await loadNodes(selectedWf);
  };
  const removeNode = async (node: OrgNode) => {
    if (!window.confirm(`Retirer « ${node.name} » de cet organigramme ? (ses enfants remontent à la racine)`)) return;
    const res = await apiFetch(`/api/workflows/${selectedWf}/nodes/${node.id}`, { method: 'DELETE' }, null);
    if (res.ok) await loadNodes(selectedWf);
  };

  // ---- Entités (unity) ----
  const saveEntity = async () => {
    if (!entForm || !entForm.name.trim()) { setError('Le nom de l’entité est obligatoire.'); return; }
    const body = { name: entForm.name.trim(), type: entForm.type.trim() || 'Département' };
    const r = entForm.id === 'new'
      ? await apiJson('/api/workflows/entities', 'POST', body)
      : await apiJson(`/api/workflows/entities/${entForm.id}`, 'PUT', body);
    if (r) { setEntForm(null); await loadEntities(); }
  };
  const deleteEntity = async (e: UnitEntity) => {
    if (!window.confirm(`Supprimer définitivement l’entité « ${e.name} » ? Elle disparaîtra de tous les organigrammes.`)) return;
    const res = await apiFetch(`/api/workflows/entities/${e.id}`, { method: 'DELETE' }, null);
    if (res.ok) { await loadEntities(); await loadNodes(selectedWf); }
    else { const d = await res.json().catch(() => null); setError((d && d.detail) || 'Suppression impossible.'); }
  };

  const currentWf = workflows.find(w => w.id === selectedWf) || null;
  const tree = buildTree(nodes);

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <WorkflowIcon size={18} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Organigrammes &amp; circuits</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Plusieurs contextes possibles. Une même entité peut avoir un parent différent selon l’organigramme choisi.</p>
          </div>
        </div>
        <button onClick={() => { setShowEntities(s => !s); setEntForm(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
          {showEntities ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Gérer les entités ({entities.length})
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-[11px] font-semibold flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Gestion des entités (unity) — repliable */}
      {showEntities && (
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Entités de l’organisation</h3>
            <button onClick={() => setEntForm({ id: 'new', name: '', type: 'Département' })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#048343] hover:bg-emerald-700 text-white cursor-pointer">
              <Plus size={12} /> Nouvelle entité
            </button>
          </div>
          {entForm && (
            <div className="flex flex-wrap items-end gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nom</label>
                <input className={inputCls} value={entForm.name} onChange={e => setEntForm({ ...entForm, name: e.target.value })} placeholder="ex : Service Maintenance" />
              </div>
              <div className="w-44">
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Type / niveau</label>
                <select
                  className={`${inputCls} cursor-pointer`}
                  value={LEVEL_SUGGESTIONS.includes(entForm.type) ? entForm.type : '__custom__'}
                  onChange={e => setEntForm({ ...entForm, type: e.target.value === '__custom__' ? '' : e.target.value })}
                >
                  {LEVEL_SUGGESTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="__custom__">Autre (préciser)…</option>
                </select>
                {!LEVEL_SUGGESTIONS.includes(entForm.type) && (
                  <input
                    className={`${inputCls} mt-1.5`}
                    value={entForm.type}
                    onChange={e => setEntForm({ ...entForm, type: e.target.value })}
                    placeholder="Type personnalisé (ex : Antenne)"
                    autoFocus
                  />
                )}
              </div>
              <button onClick={saveEntity} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold bg-[#048343] hover:bg-emerald-700 text-white cursor-pointer"><Save size={12} /> Enregistrer</button>
              <button onClick={() => setEntForm(null)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"><X size={12} /></button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {entities.map(e => (
              <span key={e.id} className={`group inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px] font-semibold border ${
                isDirection(e.type) ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
                {isDirection(e.type) ? <Building2 size={11} /> : <Layers size={11} />}
                {e.name}
                <span className="text-[8px] font-mono uppercase opacity-60">{cap(e.type)}</span>
                <button onClick={() => setEntForm({ id: e.id, name: e.name, type: e.type })} className="p-0.5 rounded hover:text-emerald-600 cursor-pointer" title="Modifier"><Pencil size={10} /></button>
                {!isDirection(e.type) && <button onClick={() => deleteEntity(e)} className="p-0.5 rounded hover:text-red-600 cursor-pointer" title="Supprimer"><Trash2 size={10} /></button>}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Les entités de type « Direction » se gèrent aussi dans l’onglet Directions ; elles n’apparaissent ici qu’en lecture pour les organigrammes.</p>
        </div>
      )}

      {/* Barre de sélection du contexte (workflow) */}
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contexte / organigramme</label>
          <select className={`${inputCls} cursor-pointer`} value={selectedWf ?? ''} onChange={e => setSelectedWf(e.target.value ? Number(e.target.value) : null)}>
            {workflows.length === 0 && <option value="">Aucun organigramme</option>}
            {workflows.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </div>
        <button onClick={() => setWfForm({ id: 'new', label: '', description: '' })} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#048343] hover:bg-emerald-700 text-white shadow-md cursor-pointer">
          <Plus size={14} /> Nouvel organigramme
        </button>
        {currentWf && (
          <>
            <button onClick={() => setWfForm({ id: currentWf.id, label: currentWf.label, description: currentWf.description || '' })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"><Pencil size={13} /> Renommer</button>
            <button onClick={() => deleteWorkflow(currentWf)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 cursor-pointer"><Trash2 size={13} /></button>
          </>
        )}
      </div>

      {/* Formulaire création / renommage de workflow */}
      {wfForm && (
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nom de l’organigramme</label>
            <input className={inputCls} value={wfForm.label} onChange={e => setWfForm({ ...wfForm, label: e.target.value })} placeholder="ex : Circuit Validation Application" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Description (optionnel)</label>
            <input className={inputCls} value={wfForm.description} onChange={e => setWfForm({ ...wfForm, description: e.target.value })} placeholder="À quoi sert ce contexte" />
          </div>
          <button onClick={saveWorkflow} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold bg-[#048343] hover:bg-emerald-700 text-white cursor-pointer"><Save size={12} /> Enregistrer</button>
          <button onClick={() => setWfForm(null)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"><X size={12} /></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm font-mono">Chargement…</div>
      ) : !currentWf ? (
        <div className="text-center py-12 text-slate-400 text-sm">Aucun organigramme. Créez-en un avec « Nouvel organigramme ».</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche : ajout + liste des placements */}
          <div className="space-y-4">
            {/* Formulaire d'ajout ADAPTATIF (parents = entités de ce workflow) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Ajouter une entité à « {currentWf.label} »</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Entité</label>
                  <select className={`${inputCls} cursor-pointer`} value={addUnitId} onChange={e => setAddUnitId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">— choisir —</option>
                    {availableEntities.map(e => <option key={e.id} value={e.id}>{cap(e.type)} — {e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Rattachée à (dans ce contexte)</label>
                  <select className={`${inputCls} cursor-pointer`} value={addParentId} onChange={e => setAddParentId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Racine (aucun parent)</option>
                    {parentChoices.map(n => <option key={n.id} value={n.unitId}>{n.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={addNode} disabled={addUnitId === ''} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#048343] hover:bg-emerald-700 text-white shadow-md cursor-pointer disabled:opacity-50">
                <Plus size={14} /> Ajouter
              </button>
              {availableEntities.length === 0 && <p className="text-[10px] text-slate-400">Toutes les entités sont déjà présentes dans ce contexte.</p>}
            </div>

            {/* Liste des placements (avec changement de parent en ligne) */}
            {nodes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Aucune entité dans ce contexte. Ajoutez-en ci-dessus.</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="px-3 py-2.5 font-bold">Entité</th>
                      <th className="px-3 py-2.5 font-bold">Parent (ce contexte)</th>
                      <th className="px-3 py-2.5 font-bold text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map(n => (
                      <tr key={n.id} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1.5">
                            {isDirection(n.type) ? <Building2 size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Layers size={12} className="text-slate-400" />}
                            {n.name}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                            value={n.parentUnitId ?? ''}
                            onChange={e => changeParent(n, e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">— racine —</option>
                            {nodes.filter(o => o.unitId !== n.unitId).map(o => <option key={o.id} value={o.unitId}>{o.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => removeNode(n)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer" title="Retirer de ce contexte"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Colonne droite : aperçu de l'arbre du contexte */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">Aperçu de la hiérarchie</h3>
            {tree.length === 0 ? (
              <p className="text-xs text-slate-400">Ajoutez des entités pour voir l’arbre.</p>
            ) : (
              <TreePreview nodes={tree} depth={0} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Aperçu indenté récursif de l'arbre (dans l'admin). */
function TreePreview({ nodes, depth }: { nodes: TreeNode[]; depth: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'space-y-1 mt-1'}>
      {nodes.map(n => (
        <li key={n.id}>
          <div className="flex items-center gap-1.5 text-xs" style={{ paddingLeft: depth * 16 }}>
            {depth > 0 && <CornerDownRight size={11} className="text-slate-300 dark:text-slate-600 shrink-0" />}
            {isDirection(n.type)
              ? <Building2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              : <Layers size={12} className="text-slate-400 shrink-0" />}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{n.name}</span>
            <span className="text-[8.5px] font-mono uppercase text-slate-400">{cap(n.type)}</span>
          </div>
          {n.children.length > 0 && <TreePreview nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
