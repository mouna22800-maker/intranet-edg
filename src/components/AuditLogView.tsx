/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../api';
import { ShieldCheck, RefreshCw, LogIn, LogOut, Lock, KeyRound, AlertTriangle, XCircle } from 'lucide-react';

interface AuditEntry {
  id: number;
  userId: number | null;
  email: string | null;
  event: string;
  ip: string | null;
  userAgent: string | null;
  at: string;
}

// Libellés + style par type d'événement de sécurité.
const EVENT_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  login_success: { label: 'Connexion réussie', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40', icon: <LogIn size={12} /> },
  login_failed: { label: 'Échec de connexion', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/40', icon: <AlertTriangle size={12} /> },
  login_blocked: { label: 'Tentative sur compte bloqué', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900/40', icon: <Lock size={12} /> },
  account_locked: { label: 'Compte bloqué', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900/40', icon: <Lock size={12} /> },
  logout: { label: 'Déconnexion', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200 dark:border-slate-700', icon: <LogOut size={12} /> },
  password_changed: { label: 'Mot de passe changé', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-900/40', icon: <KeyRound size={12} /> },
  password_change_failed: { label: 'Échec changement mot de passe', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/40', icon: <XCircle size={12} /> },
};

function formatDate(at: string): string {
  try {
    const iso = at.endsWith('Z') ? at : at + 'Z'; // valeurs stockées en UTC
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return at;
  }
}

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/audit?limit=300', {}, null);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data.data) ? data.data : []);
      } else if (res.status === 403) {
        setError("Accès réservé aux administrateurs.");
      } else {
        setError("Impossible de charger le journal de sécurité.");
      }
    } catch {
      setError("Erreur réseau : serveur injoignable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = filter === 'all' ? entries : entries.filter(e => e.event === filter);

  const FILTERS: { id: string; label: string }[] = [
    { id: 'all', label: 'Tout' },
    { id: 'login_success', label: 'Connexions' },
    { id: 'login_failed', label: 'Échecs' },
    { id: 'account_locked', label: 'Blocages' },
    { id: 'logout', label: 'Déconnexions' },
    { id: 'password_changed', label: 'Mots de passe' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Journal de sécurité</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Connexions, déconnexions, blocages de compte et changements de mot de passe.</p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Filtres par type d'événement */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              filter === f.id
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                : 'bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-4 rounded-2xl border border-red-200 dark:border-red-900/30 text-xs font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm font-mono">Chargement du journal…</div>
      ) : shown.length === 0 && !error ? (
        <div className="text-center py-16 text-slate-400 text-sm">Aucun événement à afficher.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="px-4 py-3 font-bold">Date & heure</th>
                <th className="px-4 py-3 font-bold">Événement</th>
                <th className="px-4 py-3 font-bold">Compte</th>
                <th className="px-4 py-3 font-bold">Adresse IP</th>
                <th className="px-4 py-3 font-bold hidden lg:table-cell">Navigateur</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const meta = EVENT_META[e.event] || { label: e.event, cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: null };
                return (
                  <tr key={e.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300 tabular-nums">{formatDate(e.at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${meta.cls}`}>
                        {meta.icon}
                        <span>{meta.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-200 font-medium">{e.email || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400">{e.ip || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-[280px] truncate text-slate-400 dark:text-slate-500" title={e.userAgent || ''}>{e.userAgent || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
