/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Department, Poste } from '../types';
import { apiFetch } from '../api';
import { Network, Plus, Pencil, Trash2, Save, X, RefreshCw, AlertCircle, UserRound } from 'lucide-react';

interface PostesAdminProps {
  departments: Department[];
}

interface PosteForm {
  title: string;
  unityId: number | null;
  parentId: number | null;
  occupantName: string;
  occupantEmail: string;
  ordre: number;
}

const EMPTY_FORM: PosteForm = { title: '', unityId: null, parentId: null, occupantName: '', occupantEmail: '', ordre: 0 };

export default function PostesAdmin({ departments }: PostesAdminProps) {
  const [postes, setPostes] = useState<Poste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<PosteForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/postes', {}, null);
      if (res.ok) setPostes(await res.json());
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const titleById = (id?: number | null) => postes.find(p => p.id === id)?.title || '—';

  const startCreate = () => { setForm(EMPTY_FORM); setEditingId('new'); setError(null); };
  const startEdit = (p: Poste) => {
    setForm({
      title: p.title,
      unityId: p.unityId ?? null,
      parentId: p.parentId ?? null,
      occupantName: p.occupantName ?? '',
      occupantEmail: p.occupantEmail ?? '',
      ordre: p.ordre ?? 0,
    });
    setEditingId(p.id);
    setError(null);
  };
  const cancel = () => { setEditingId(null); setError(null); };

  const save = async () => {
    if (!form.title.trim()) { setError("L'intitulé du poste est obligatoire."); return; }
    setSaving(true);
    setError(null);
    const body = JSON.stringify({
      title: form.title.trim(),
      unityId: form.unityId,
      parentId: form.parentId,
      occupantName: form.occupantName.trim(),
      occupantEmail: form.occupantEmail.trim(),
      ordre: Number(form.ordre) || 0,
    });
    try {
      const url = editingId === 'new' ? '/api/postes' : `/api/postes/${editingId}`;
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body }, null);
      if (res.ok) {
        setEditingId(null);
        await load();
      } else {
        const data = await res.json().catch(() => null);
        setError((data && data.detail) || "Échec de l'enregistrement.");
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Poste) => {
    if (!window.confirm(`Supprimer le poste « ${p.title} » ? Ses sous-postes remonteront à la racine.`)) return;
    try {
      const res = await apiFetch(`/api/postes/${p.id}`, { method: 'DELETE' }, null);
      if (res.ok) await load();
    } catch { /* silencieux */ }
  };

  const inputCls = "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-400 shadow-sm";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Network size={18} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Organigramme — Postes</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gérez les postes/fonctions et leur hiérarchie (poste parent). L'occupant est optionnel.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
          <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#048343] hover:bg-emerald-700 text-white shadow-md cursor-pointer">
            <Plus size={14} /> Nouveau poste
          </button>
        </div>
      </div>

      {/* Formulaire (création / édition) */}
      {editingId !== null && (
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {editingId === 'new' ? 'Nouveau poste' : 'Modifier le poste'}
          </h3>
          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-[11px] font-semibold flex items-center gap-2">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Intitulé du poste *</label>
              <input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ex : Directeur des Systèmes d'Information" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Direction / service de rattachement</label>
              <select className={`${inputCls} cursor-pointer`} value={form.unityId ?? ''} onChange={e => setForm({ ...form, unityId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Aucune</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code.toUpperCase()} — {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Poste parent (hiérarchie)</label>
              <select className={`${inputCls} cursor-pointer`} value={form.parentId ?? ''} onChange={e => setForm({ ...form, parentId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Aucun (racine)</option>
                {postes.filter(p => p.id !== editingId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Occupant (optionnel)</label>
              <input className={inputCls} value={form.occupantName} onChange={e => setForm({ ...form, occupantName: e.target.value })} placeholder="Nom de la personne (ou vide)" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail occupant (optionnel)</label>
              <input className={inputCls} value={form.occupantEmail} onChange={e => setForm({ ...form, occupantEmail: e.target.value })} placeholder="nom@edg.com.gn" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ordre d'affichage</label>
              <input type="number" className={inputCls} value={form.ordre} onChange={e => setForm({ ...form, ordre: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={cancel} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer">
              <X size={13} /> Annuler
            </button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#048343] hover:bg-emerald-700 text-white shadow-md cursor-pointer disabled:opacity-60">
              <Save size={13} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des postes */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm font-mono">Chargement…</div>
      ) : postes.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Aucun poste. Créez-en un avec « Nouveau poste ».</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="px-4 py-3 font-bold">Poste</th>
                <th className="px-4 py-3 font-bold">Occupant</th>
                <th className="px-4 py-3 font-bold">Direction</th>
                <th className="px-4 py-3 font-bold">Rattaché à</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {postes.map(p => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{p.title}</td>
                  <td className="px-4 py-3">
                    {p.occupantName ? (
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><UserRound size={11} /> {p.occupantName}</span>
                    ) : (
                      <span className="text-slate-400 italic">vacant</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.unityCode ? <span className="font-mono font-bold text-[10px] uppercase text-emerald-700 dark:text-emerald-400">{p.unityCode}</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.parentId ? titleById(p.parentId) : <span className="text-[10px] font-mono uppercase text-slate-400">racine</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer" title="Modifier"><Pencil size={13} /></button>
                      <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer" title="Supprimer"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
