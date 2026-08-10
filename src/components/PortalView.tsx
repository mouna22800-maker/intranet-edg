/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Department, Application, IntranetUser } from '../types';
import { Cpu, Info, Box, Link as LinkIcon } from 'lucide-react';
import LucideIcon from './LucideIcon';

interface PortalViewProps {
  department?: Department;
  globalApplications?: Application[];
  localApplications?: Application[];
  onNavigate?: (view: string, deptCode?: string) => void;
  currentUser?: IntranetUser | null;
  appHubUrl?: string;
}

export default function PortalView({
  department,
  globalApplications = [],
  localApplications = []
}: PortalViewProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [appFilter, setAppFilter] = React.useState<'all' | 'global' | 'local'>('all');

  const matchesSearch = (app: Application) => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return true;
    return [app.name, app.description, app.category]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(term));
  };

  const filteredGlobalApps = globalApplications.filter(matchesSearch);
  const filteredLocalApps = localApplications.filter(matchesSearch);
  const visibleGlobalApps = appFilter !== 'local' ? filteredGlobalApps : [];
  const visibleLocalApps = appFilter !== 'global' ? filteredLocalApps : [];
  const hasLocalApps = localApplications.length > 0;
  const hasGlobalApps = globalApplications.length > 0;
  const hasAnyApp = hasLocalApps || hasGlobalApps;
  const hasFilteredApps = visibleGlobalApps.length > 0 || visibleLocalApps.length > 0;

  const getAppLogoUrl = (app: Application) => {
    if (app.logoUrl && (app.logoUrl.startsWith('http://') || app.logoUrl.startsWith('https://') || app.logoUrl.startsWith('/'))) {
      return app.logoUrl;
    }

    if (app.icon && (app.icon.startsWith('http://') || app.icon.startsWith('https://'))) {
      return app.icon;
    }

    if (!app.url) {
      return null;
    }

    try {
      const url = new URL(app.url);
      return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(url.hostname)}`;
    } catch {
      return null;
    }
  };

  const renderAppCard = (app: Application) => {
    const logoSrc = getAppLogoUrl(app);

    return (
      <a
        key={app.id}
        href={app.url}
        target="_blank"
        rel="noreferrer"
        className="group block h-full rounded-[2rem] border border-white/15 bg-white/55 dark:bg-slate-900/40 backdrop-blur-xl shadow-[0_32px_90px_rgba(0,0,0,0.08)] hover:shadow-[0_35px_110px_rgba(0,0,0,0.14)] hover:-translate-y-1 transition-all duration-300 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#048343]"
      >
        <div className="relative overflow-hidden h-full flex flex-col">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[#048343]/20 via-[#048343]/10 to-slate-100/0 dark:from-[#048343]/25 dark:via-[#048343]/10 dark:to-slate-900/0 opacity-95" />
          <div className="relative p-4 sm:p-5 space-y-4 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-3xl bg-white/80 dark:bg-slate-950/70 border border-white/20 dark:border-slate-700/70 shadow-sm backdrop-blur-sm flex items-center justify-center overflow-hidden">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={`${app.name} logo`}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.currentTarget.remove(); }}
                    />
                  ) : (
                    <LucideIcon name={app.icon || 'Box'} size={24} className="text-slate-700 dark:text-slate-100" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-sm text-slate-900 dark:text-white leading-tight">{app.name}</h3>
                  <span className="inline-flex items-center rounded-full bg-white/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-700/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300 backdrop-blur-sm">
                    {app.category}
                  </span>
                </div>
              </div>
              <div className="text-xs font-mono uppercase tracking-[0.22em] text-[#048343] dark:text-emerald-300">Accès</div>
            </div>
            <p className="text-sm leading-snug text-slate-600 dark:text-slate-300 line-clamp-3">{app.description}</p>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 font-semibold">Ouvrir l'application</span>
          <LinkIcon size={18} className="text-[#048343] dark:text-emerald-300 transition-transform group-hover:translate-x-1" />
        </div>
      </a>
    );
  };

  return (
    <div id="portal-view-section" className="space-y-8 pb-16">

      <section className="rounded-3xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-[#0c0c0e] shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#048343]/10 dark:bg-[#048343]/15 px-3 py-1 text-[11px] uppercase tracking-[0.24em] font-bold text-[#048343] dark:text-[#10b981]">
              <Cpu size={16} className="text-[#048343] dark:text-[#10b981]" />
              Portail Applicatif
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Incontournable des outils EDG
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-6">
                Retrouvez tous les outils transverses et les applications métiers centralisées dans un espace unique et moderne, pensé pour l'accès rapide et sécurisé.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_0.75fr] items-end mt-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Recherche</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une application, une catégorie ou un mot-clé..."
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white/90 dark:bg-slate-950/80 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-[#048343] focus:ring-2 focus:ring-[#048343]/20 dark:focus:ring-[#048343]/30"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAppFilter('all')}
                className={`rounded-3xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${appFilter === 'all' ? 'bg-[#048343] text-white border-[#048343]' : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800'}`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setAppFilter('global')}
                className={`rounded-3xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${appFilter === 'global' ? 'bg-[#048343] text-white border-[#048343]' : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800'}`}
              >
                Transverses
              </button>
              <button
                type="button"
                onClick={() => setAppFilter('local')}
                className={`rounded-3xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition ${appFilter === 'local' ? 'bg-[#048343] text-white border-[#048343]' : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:border-slate-800'}`}
              >
                Métiers
              </button>
            </div>
          </div>
        </div>
      </section>

      {hasAnyApp ? (
        <div className="space-y-10">
          {hasFilteredApps ? (
            <>
              {hasGlobalApps && visibleGlobalApps.length > 0 && (
                <section className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Applications globales</p>
                      <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">Outils transverses EDG</h2>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                      {visibleGlobalApps.length} application{visibleGlobalApps.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {visibleGlobalApps.map(renderAppCard)}
                  </div>
                </section>
              )}

              {hasLocalApps && visibleLocalApps.length > 0 && (
                <section className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-[#048343]">Applications métiers</p>
                      <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">Outils dédiés à vos services</h2>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#048343]/10 dark:bg-[#048343]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#048343] dark:text-[#10b981]">
                      {visibleLocalApps.length} application{visibleLocalApps.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {visibleLocalApps.map(renderAppCard)}
                  </div>
                </section>
              )}

              {!hasFilteredApps && (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/70 p-10 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-300">
                    <Info size={24} />
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">Aucun résultat</h3>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                    Aucun outil ne correspond à votre recherche actuelle. Essayez un autre mot-clé ou ajustez le filtre.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/70 p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-300">
                <Info size={24} />
              </div>
              <h3 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">Aucun accès disponible pour le moment</h3>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                Aucun outil global ou métier n’est encore configuré pour le portail applicatif. Un administrateur peut enrichir cette page depuis la console d’administration, section <strong>Applications</strong>.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/70 p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-300">
            <Info size={24} />
          </div>
          <h3 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">Aucun accès disponible pour le moment</h3>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            Aucun outil global ou métier n’est encore configuré pour le portail applicatif. Un administrateur peut enrichir cette page depuis la console d’administration, section <strong>Applications</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
