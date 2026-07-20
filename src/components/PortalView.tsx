/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Department, Application, IntranetUser } from '../types';
import { Cpu, ExternalLink, ArrowRight, Info } from 'lucide-react';

interface PortalViewProps {
  department: Department;
  globalApplications?: Application[];
  localApplications?: Application[];
  onNavigate?: (view: string, deptCode?: string) => void;
  currentUser?: IntranetUser | null;
  appHubUrl?: string;
}

export default function PortalView({ department, appHubUrl = '' }: PortalViewProps) {
  const hasHub = !!(appHubUrl && appHubUrl.trim());

  return (
    <div id="portal-view-section" className="space-y-8 pb-16">

      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Portail Applicatif • {department.name}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Accédez à l'ensemble des applications métiers de l'Électricité de Guinée.
        </p>
      </div>

      {hasHub ? (
        /* Carte d'accès unique au hub applicatif */
        <a
          href={appHubUrl}
          target="_blank"
          rel="noreferrer"
          className="group block rounded-3xl overflow-hidden border border-white/10 shadow-xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 p-8 sm:p-12 hover:shadow-2xl transition-all max-w-3xl mx-auto text-center"
        >
          <div className="flex flex-col items-center text-white space-y-5">
            <div className="p-5 rounded-3xl bg-white/15 backdrop-blur border border-white/20 group-hover:scale-105 transition-transform">
              <Cpu size={40} />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-300">Accès unique</span>
              <h3 className="font-display font-black text-2xl sm:text-3xl leading-tight">Hub Applicatif EDG</h3>
              <p className="text-sm text-emerald-50/85 leading-relaxed max-w-md mx-auto">
                Toutes les applications métiers de l'Électricité de Guinée, réunies dans un seul portail.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-emerald-800 text-sm font-black uppercase tracking-wider shadow-lg group-hover:scale-105 transition-transform mt-1">
              Cliquer pour accéder
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-100/70 font-mono">
              <ExternalLink size={11} /> S'ouvre dans un nouvel onglet
            </span>
          </div>
        </a>
      ) : (
        /* Aucun lien configuré : message clair pour l'administrateur */
        <div className="max-w-2xl mx-auto rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/30 p-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Info size={22} />
          </div>
          <h3 className="font-display font-extrabold text-base text-slate-800 dark:text-white">Portail applicatif non configuré</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            Le lien du hub applicatif n'a pas encore été renseigné. Un administrateur peut l'ajouter dans
            la console d'administration → onglet <strong>Applications</strong> → champ « Hub applicatif ».
          </p>
        </div>
      )}
    </div>
  );
}
