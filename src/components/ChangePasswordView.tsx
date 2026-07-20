/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { IntranetUser } from '../types';
import { Key, ShieldCheck, AlertCircle, Check, X } from 'lucide-react';

interface ChangePasswordViewProps {
  currentUser: IntranetUser;
  /** Changement imposé : pas d'échappatoire. */
  forced?: boolean;
  /** Motif : 'initial' = activation d'un compte créé par l'admin ; 'expired' = renouvellement après 90 jours. */
  reason?: 'initial' | 'expired' | null;
  onSuccess: () => void;
  onCancel?: () => void;
  /** Permet de quitter l'écran (déconnexion) même en mode forcé — évite d'être bloqué. */
  onLogout?: () => void;
}

const MIN_LENGTH = 12;

export default function ChangePasswordView({ currentUser, forced, reason, onSuccess, onCancel, onLogout }: ChangePasswordViewProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Exigences de robustesse (identiques au backend password_policy_error).
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
  const canSubmit = allRulesOk && !mismatch && confirmPassword.length > 0 && currentPassword.length > 0 && !isLoading;

  const isInitial = reason === 'initial';
  const firstName = currentUser.name.split(' ')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allRulesOk) {
      setError('Le mot de passe ne respecte pas toutes les exigences de sécurité.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword === currentPassword) {
      setError(isInitial
        ? 'Choisissez un mot de passe différent du mot de passe temporaire.'
        : "Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setIsLoading(false);
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => null);
        setError((data && data.detail) || 'Impossible de changer le mot de passe.');
      }
    } catch (err) {
      setIsLoading(false);
      setError("Erreur réseau : impossible de contacter le serveur.");
    }
  };

  // Textes selon le motif.
  const badge = isInitial ? 'Bienvenue' : (reason === 'expired' ? 'Renouvellement requis' : 'Sécurité du compte');
  const title = isInitial ? 'Définissez votre mot de passe' : 'Changer votre mot de passe';
  const subtitle = isInitial
    ? `Bonjour ${firstName}, votre compte a été créé par l'administrateur. Choisissez votre mot de passe personnel pour activer votre accès en toute sécurité.`
    : reason === 'expired'
      ? `Bonjour ${firstName}, votre mot de passe a dépassé 90 jours. Pour votre sécurité, veuillez le renouveler avant de continuer.`
      : "Choisissez un nouveau mot de passe pour sécuriser votre accès à l'intranet EDG.";
  const currentLabel = isInitial ? "Mot de passe temporaire (fourni par l'administrateur)" : 'Mot de passe actuel';
  const submitLabel = isInitial ? 'Activer mon compte' : 'Valider le nouveau mot de passe';

  return (
    <div className="max-w-md mx-auto py-8 px-4 font-sans">
      <div className="text-center space-y-3.5 mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 select-none shadow-sm">
          <ShieldCheck size={12} />
          <span>{badge}</span>
        </div>
        <h2 className="font-display font-black text-3xl text-slate-900 dark:text-white tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-xs text-slate-550 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
          {subtitle}
        </p>
      </div>

      <div className="w-full bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-8 shadow-xl">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-850 dark:text-red-400 p-4 rounded-2xl border border-red-250 dark:border-red-900/30 text-xs flex items-start space-x-2.5 mb-5">
            <AlertCircle className="text-red-650 dark:text-red-400 shrink-0 mt-0.5" size={16} />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">
              {currentLabel}
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={isInitial ? 'Mot de passe temporaire' : 'Votre mot de passe actuel'}
                className="w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#048343] focus:bg-white dark:focus:bg-slate-900/80 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choisissez un mot de passe fort"
                className="w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#048343] focus:bg-white dark:focus:bg-slate-900/80 transition-all"
              />
            </div>
            {/* Checklist des exigences, mise à jour en direct */}
            <ul className="grid grid-cols-1 gap-1.5 pt-2">
              {rules.map((r) => (
                <li key={r.label} className={`flex items-center space-x-2 text-[11px] font-semibold transition-colors ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${r.ok ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {r.ok ? <Check size={11} className="stroke-[3]" /> : <X size={10} className="stroke-[3] text-slate-400" />}
                  </span>
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ressaisissez le nouveau mot de passe"
                className={`w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#048343] focus:bg-white dark:focus:bg-slate-900/80 transition-all ${
                  mismatch ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-white/10'
                }`}
              />
            </div>
            {mismatch && <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">Les mots de passe ne correspondent pas.</p>}
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`btn-premium btn-premium-green w-full py-3.5 px-4 text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center space-x-2 ${
                canSubmit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Mise à jour…</span>
                </>
              ) : (
                <>
                  <Check size={14} className="text-amber-300" />
                  <span>{submitLabel}</span>
                </>
              )}
            </button>
            {!forced && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Annuler
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
              >
                Ce n'est pas vous ? Se déconnecter
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
