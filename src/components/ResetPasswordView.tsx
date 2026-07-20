/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Key, ShieldCheck, AlertCircle, Check, X, CheckCircle2 } from 'lucide-react';
import EdgLogo from './EdgLogo';

const MIN_LENGTH = 12;

interface ResetPasswordViewProps {
  token: string;
  onDone: () => void;
}

export default function ResetPasswordView({ token, onDone }: ResetPasswordViewProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const rules = [
    { ok: newPassword.length >= MIN_LENGTH, label: `Au moins ${MIN_LENGTH} caractères` },
    { ok: /[a-z]/.test(newPassword), label: 'Au moins 1 lettre minuscule (a-z)' },
    { ok: /[A-Z]/.test(newPassword), label: 'Au moins 1 lettre majuscule (A-Z)' },
    { ok: /[0-9]/.test(newPassword), label: 'Au moins 1 chiffre (0-9)' },
    { ok: /[@$!%*?&#]/.test(newPassword), label: 'Au moins 1 caractère spécial (@$!%*?&#)' },
    { ok: newPassword.length > 0 && !/[^\x00-\x7F]/.test(newPassword), label: 'Pas de caractères accentués (é, ç, etc.)' },
  ];
  const allRulesOk = rules.every(r => r.ok);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = allRulesOk && !mismatch && confirmPassword.length > 0 && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!allRulesOk) { setError('Le mot de passe ne respecte pas toutes les exigences.'); return; }
    if (newPassword !== confirmPassword) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      setIsLoading(false);
      if (res.ok) {
        setDone(true);
      } else {
        const d = await res.json().catch(() => null);
        setError((d && d.detail) || 'Échec de la réinitialisation.');
      }
    } catch {
      setIsLoading(false);
      setError('Erreur réseau : serveur injoignable.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 font-sans">
      <div className="text-center space-y-3.5 mb-8">
        <EdgLogo className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 select-none shadow-sm">
          <ShieldCheck size={12} />
          <span>Réinitialisation sécurisée</span>
        </div>
        <h2 className="font-display font-black text-3xl text-slate-900 dark:text-white tracking-tight leading-tight">
          Nouveau mot de passe
        </h2>
      </div>

      <div className="w-full bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-8 shadow-xl">
        {done ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
            <h3 className="font-display font-black text-lg text-slate-900 dark:text-white">Mot de passe réinitialisé</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.
            </p>
            <button
              onClick={onDone}
              className="btn-premium btn-premium-green w-full py-3 px-4 text-xs font-black uppercase tracking-wider shadow-md cursor-pointer"
            >
              Aller à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-850 dark:text-red-400 p-4 rounded-2xl border border-red-250 dark:border-red-900/30 text-xs flex items-start space-x-2.5">
                <AlertCircle className="text-red-650 dark:text-red-400 shrink-0 mt-0.5" size={16} />
                <span className="leading-relaxed font-semibold">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">Nouveau mot de passe</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                <input
                  type="password" required autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Choisissez un mot de passe fort"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#048343] transition-all"
                />
              </div>
              <ul className="grid grid-cols-1 gap-1.5 pt-2">
                {rules.map((r) => (
                  <li key={r.label} className={`flex items-center space-x-2 text-[11px] font-semibold ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${r.ok ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {r.ok ? <Check size={11} className="stroke-[3]" /> : <X size={10} className="stroke-[3] text-slate-400" />}
                    </span>
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">Confirmer</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                <input
                  type="password" required autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ressaisissez le mot de passe"
                  className={`w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#048343] transition-all ${mismatch ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-white/10'}`}
                />
              </div>
              {mismatch && <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">Les mots de passe ne correspondent pas.</p>}
            </div>

            <button
              type="submit" disabled={!canSubmit}
              className={`btn-premium btn-premium-green w-full py-3.5 px-4 text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center space-x-2 ${canSubmit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
            >
              {isLoading ? 'Mise à jour…' : 'Réinitialiser mon mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
