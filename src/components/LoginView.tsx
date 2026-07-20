/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { IntranetUser } from '../types';
import { Shield, Key, Mail, AlertCircle, Clock } from 'lucide-react';
import EdgLogo from './EdgLogo';

interface LoginViewProps {
  onLoginSuccess: (user: IntranetUser) => void;
  /** Message informatif affiché après une expiration de session (inactivité / 401). */
  notice?: string | null;
}

export default function LoginView({ onLoginSuccess, notice }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mot de passe oublié
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
    } catch { /* réponse volontairement neutre */ }
    setForgotLoading(false);
    setForgotSent(true);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (res.ok) {
        const data = await res.json();
        setIsLoading(false);
        // La session est ouverte via le cookie httpOnly posé par le serveur ; aucun jeton n'est manipulé en JS.
        onLoginSuccess(data.user as IntranetUser);
      } else if (res.status === 429) {
        setIsLoading(false);
        setError("Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.");
      } else {
        setIsLoading(false);
        // Message volontairement générique : ne révèle ni l'existence du compte, ni quel champ est erroné.
        setError("E-mail ou mot de passe incorrect.");
      }
    } catch (err) {
      setIsLoading(false);
      setError("Erreur réseau : impossible de contacter le serveur d'authentification EDG.");
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 font-sans" id="login-viewport">
      {/* Marque & contexte */}
      <div className="text-center space-y-3.5 mb-8">
        <EdgLogo className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 select-none shadow-sm">
          <Shield size={12} />
          <span>PORTAIL INTRANET SÉCURISÉ</span>
        </div>
        <h2 className="font-display font-black text-3.5xl text-slate-900 dark:text-white tracking-tight leading-none uppercase">
          Espace de Connexion • EDG S.A.
        </h2>
        <p className="text-xs text-slate-550 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
          Connectez-vous à votre espace personnel pour accéder à vos outils de travail, informations de service et documents d'Électricité de Guinée.
        </p>
      </div>

      {/* Carte de connexion */}
      <div className="w-full bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-8 shadow-xl">
        <div className="border-b border-slate-100 dark:border-neutral-800 pb-4 mb-6">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-350 uppercase tracking-wider">Identifiants de connexion</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1 leading-relaxed">
            Saisissez vos identifiants d'entreprise pour accéder de manière sécurisée à votre compte.
          </p>
        </div>

        {notice && !error && (
          <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 text-xs flex items-start space-x-2.5 mb-5">
            <Clock className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={16} />
            <span className="leading-relaxed font-semibold">{notice}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-850 dark:text-red-400 p-4 rounded-2xl border border-red-250 dark:border-red-900/30 text-xs flex items-start space-x-2.5 mb-5">
            <AlertCircle className="text-red-650 dark:text-red-400 shrink-0 mt-0.5" size={16} />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSignInSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">
              Adresse e-mail professionnelle (EDG S.A.)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: m.kouyate@edg.com.gn"
                className="w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#048343] focus:bg-white dark:focus:bg-slate-900/80 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">
              Mot de passe
            </label>
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Saisissez votre mot de passe"
                className="w-full pl-11 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#048343] focus:bg-white dark:focus:bg-slate-900/80 transition-all"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`btn-premium btn-premium-green w-full py-3.5 px-4 text-xs font-black uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center space-x-2 ${
                isLoading ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Vérification des accès en cours...</span>
                </>
              ) : (
                <>
                  <Shield size={14} className="text-amber-300" />
                  <span>Se connecter à l'Intranet EDG</span>
                </>
              )}
            </button>
          </div>

          {!forgotMode && (
            <button
              type="button"
              onClick={() => { setForgotMode(true); setForgotSent(false); }}
              className="w-full text-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer pt-1"
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>

        {forgotMode && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
            {forgotSent ? (
              <div className="text-center space-y-2">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">E-mail envoyé (si le compte existe)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Consultez votre boîte mail pour le lien de réinitialisation (valable 1 heure).</p>
                <button type="button" onClick={() => { setForgotMode(false); setForgotSent(false); }} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer">Retour à la connexion</button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-2.5">
                <label className="text-[10px] tracking-wider text-slate-500 dark:text-slate-400 uppercase block font-bold">Réinitialiser — saisissez votre e-mail</label>
                <div className="flex gap-2">
                  <input
                    type="email" required value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="votre.email@edg.com.gn"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#048343] font-mono"
                  />
                  <button type="submit" disabled={forgotLoading} className="px-3.5 py-2.5 bg-[#048343] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0 disabled:opacity-60">
                    {forgotLoading ? '…' : 'Envoyer'}
                  </button>
                </div>
                <button type="button" onClick={() => setForgotMode(false)} className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">Annuler</button>
              </form>
            )}
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 dark:border-white/5 mt-6 flex items-start space-x-3 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-sans">
          <Shield className="text-emerald-500 shrink-0 mt-0.5" size={13} />
          <p>
            Portail officiel d'Électricité de Guinée S.A. Accès réservé au personnel. L'utilisation de cet espace de travail est régie par la charte informatique de l'entreprise.
          </p>
        </div>
      </div>
    </div>
  );
}
