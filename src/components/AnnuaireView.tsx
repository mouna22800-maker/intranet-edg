/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Mail, ArrowLeft, UserRound } from 'lucide-react';
import { Poste } from '../types';

interface AnnuaireViewProps {
  onNavigateBack?: () => void;
}

export default function AnnuaireView({ onNavigateBack }: AnnuaireViewProps) {
  const [postes, setPostes] = useState<Poste[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/postes')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data) => { setPostes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // L'annuaire est dérivé des POSTES occupés (l'occupant est la personne).
  const staff = postes
    .filter(p => p.occupantName && p.occupantName.trim())
    .map(p => ({
      name: p.occupantName as string,
      role: p.title,
      dept: (p.unityCode || 'EDG').toUpperCase(),
      email: p.occupantEmail || '',
    }));

  const filtered = staff.filter(agent =>
    agent.name.toLowerCase().includes(query.toLowerCase()) ||
    agent.dept.toLowerCase().includes(query.toLowerCase()) ||
    agent.role.toLowerCase().includes(query.toLowerCase()) ||
    agent.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16 font-sans">
      {onNavigateBack && (
        <button onClick={onNavigateBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer">
          <ArrowLeft size={14} /> Retour à l'accueil
        </button>
      )}

      {/* Page header */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="p-2.5 rounded-xl bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400">
          <UserRound size={20} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Annuaire du personnel
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Les personnes occupant les postes de l'organigramme, avec leurs coordonnées.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3.5 text-slate-450" size={15} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, poste ou direction..."
          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder-slate-400"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2 text-[10px] font-mono font-black uppercase text-slate-500">
          <span>Personnel EDG S.A.</span>
          <span>{filtered.length} personne(s)</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm font-mono">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
            {staff.length === 0
              ? "Aucun poste n'a encore d'occupant renseigné. Un administrateur peut les ajouter dans l'organigramme."
              : "Aucune personne ne correspond à cette recherche."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((agent, index) => (
              <div
                key={index}
                className="p-3.5 bg-white/50 hover:bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/80 rounded-xl flex items-start justify-between gap-3 shadow-sm hover:shadow"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white truncate">{agent.name}</h4>
                    <span className="text-[7.5px] font-mono font-black text-[#048343] bg-[#048343]/10 px-1.5 py-0.2 rounded border border-[#048343]/15 uppercase shrink-0">
                      {agent.dept}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-semibold dark:text-slate-400 truncate">{agent.role}</p>
                  {agent.email && (
                    <div className="space-y-0.5 pt-2 text-[9.5px] font-mono text-slate-450 dark:text-slate-500">
                      <a href={`mailto:${agent.email}`} className="hover:text-[#048343] flex items-center space-x-1 truncate">
                        <Mail size={10} />
                        <span>{agent.email}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
