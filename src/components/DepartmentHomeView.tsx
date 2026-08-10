/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Department, Article, DashboardData, IntranetUser } from '../types';
import LucideIcon from './LucideIcon';
import { Calendar, User2, MapPin, Layers, ArrowRight, Quote, MessageSquare, ChevronRight, GraduationCap, Share2, Check, ExternalLink, Mail, Phone, Clock, Briefcase, Award, Paperclip, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDeptColorTheme } from './colorThemes';
import { getMediaBgStyle } from './imageStyle';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Tableau de bord affiché lorsqu'aucune donnée n'a encore été enregistrée en base pour cette direction
const EMPTY_DASHBOARD: DashboardData = {
  title: "Tableau de Bord de Performance",
  subtitle: "Aucun indicateur n'a encore été configuré pour cette direction depuis la console d'administration.",
  chartType: 'line',
  kpis: [],
  series: [],
  chartData: []
};

interface DepartmentHomeViewProps {
  department: Department;
  localArticles: Article[];
  onNavigate: (view: string, deptCode?: string) => void;
  currentUser?: IntranetUser | null;
}

export default function DepartmentHomeView({ department, localArticles, onNavigate, currentUser }: DepartmentHomeViewProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copiedArticleId, setCopiedArticleId] = useState<string | number | null>(null);
  const [copiedModal, setCopiedModal] = useState(false);
  const theme = getDeptColorTheme(department.code);
  const stats = department.dashboard || EMPTY_DASHBOARD;
  const hasStats = stats.kpis.length > 0 || stats.chartData.length > 0;
  // Tableau de bord KPI : réservé à l'Administrateur, à la RH centrale, ou au Directeur de cette direction précise
  const canViewDashboard = !!currentUser && (
    currentUser.role === 'administrateur' ||
    (currentUser.role === 'rh_direction' && (currentUser.departmentId == null || currentUser.departmentId === department.id))
  );

  // Nouvel état pour les données réelles reliées du schéma de 10 tables
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(true);

  useEffect(() => {
    setLoadingProjects(true);
    setLoadingContacts(true);
    
    // Récupérer les projets réels de la table 'projet'
    fetch(`/api/departments/${department.id}/projects`)
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'success' && Array.isArray(data.data)) {
          setProjects(data.data);
        }
        setLoadingProjects(false);
      })
      .catch(err => {
        console.error("Erreur de récupération des projets:", err);
        setLoadingProjects(false);
      });

    // Récupérer les contacts et destinataires de la table 'recipient' et 'contact'
    fetch(`/api/departments/${department.id}/contacts`)
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'success' && Array.isArray(data.data)) {
          setContacts(data.data);
        }
        setLoadingContacts(false);
      })
      .catch(err => {
        console.error("Erreur de récupération des contacts:", err);
        setLoadingContacts(false);
      });
  }, [department.id]);

  return (
    <div id={`dept-home-${department.code}`} className="space-y-10 pb-16 font-sans">
      
      {/* 1. Header Hero Segment with refined Liquid Glass look & stats */}
      <section className="bg-white dark:bg-[#0b0b0d] border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl p-6 sm:p-10 text-zinc-800 dark:text-zinc-100 relative shadow-sm overflow-hidden transition-all duration-300">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.07] pointer-events-none hidden md:block">
          <LucideIcon name={department.icon} size={280} className={theme.textPrimary} />
        </div>

        <span className={`inline-flex items-center space-x-1.5 px-3 py-1 bg-white/60 dark:bg-slate-850/60 border border-white/85 dark:border-white/10 rounded-full text-xs font-mono font-bold uppercase tracking-wider mb-4 shadow-sm ${theme.textPrimary}`}>
          <LucideIcon name={department.icon} size={12} className={theme.textAccent} />
          <span>Espace Direction • {department.code.toUpperCase()}</span>
        </span>

        <h1 className="font-display font-black text-2xl sm:text-4xl tracking-tight leading-tight text-slate-900 dark:text-white uppercase animate-fade-in">
          {department.name}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl mt-3 font-sans leading-relaxed">
          {department.description}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-200/50 dark:border-white/10">
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 font-bold">Collaborateurs</p>
            <p className="text-md sm:text-lg font-black text-slate-900 dark:text-slate-100 font-display mt-0.5">👥 {department.staffCount} agents</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 font-bold">Création nationale</p>
            <p className="text-md sm:text-lg font-black text-slate-900 dark:text-slate-100 font-display mt-0.5">🏛️ {department.foundedYear}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 font-bold">Localisation</p>
            <p className="text-md sm:text-lg font-black text-slate-900 dark:text-slate-100 font-display mt-0.5 flex items-center space-x-1">
              <MapPin size={14} className={`${theme.textAccent} inline shrink-0`} />
              <span>Cité EDG</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 font-bold">Autorité</p>
            <p className={`text-sm sm:text-md md:text-lg font-black font-display mt-0.5 truncate uppercase tracking-tight ${theme.textPrimary}`}>{department.directorName}</p>
          </div>
        </div>
      </section>

      {/* 2. Quick navigation tiles for current department */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "Présentation & Histoire", desc: "Valeurs de sûreté, qui sommes nous, et chronologie d'évolution.", icon: "Layers", view: "presentation" },
          { title: "Organigramme d'Équipe", desc: "Membres de la direction, structure et rôles hiérarchiques.", icon: "Users", view: "team" },
          { title: "Attributions & Métiers", desc: "Tableau d'honneur et fiches de tâches individuelles des agents.", icon: "Award", view: "attributions" },
          { title: "Actualités de la Direction", desc: "Publications, communiqués officiels et notes de service internes.", icon: "Newspaper", view: "news" },
          { title: "Nos Projets Stratégiques", desc: "Suivi détaillé de l'avancement des grands chantiers techniques.", icon: "Briefcase", view: "projects" },
          { title: "Contact & Destinataires", desc: "Canaux de communication directs et points de liaison de l'unité.", icon: "Mail", view: "contacts" }
        ].map((tile, idx) => (
          <motion.button
            key={idx}
            onClick={() => onNavigate(tile.view, department.code)}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`flex items-start p-5 rounded-xl text-left hover:shadow-md transition-all duration-300 group cursor-pointer border ${theme.cardBg} ${theme.cardBgDark} ${theme.cardGlow}`}
          >
            <div className={`p-2.5 rounded-xl mr-4 shadow-sm transition-all duration-300 shrink-0 group-hover:scale-110 group-hover:rotate-6 ${theme.iconBg} ${theme.iconBgHover}`}>
              <LucideIcon name={tile.icon} size={20} />
            </div>
            <div>
              <h3 className={`font-display font-black text-sm transition-colors duration-300 ${theme.textHover}`}>
                {tile.title}
              </h3>
              <p className="text-[11.5px] text-slate-550 dark:text-slate-400 mt-1 leading-normal line-clamp-2 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200">
                {tile.desc}
              </p>
            </div>
          </motion.button>
        ))}
      </section>

      {/* 2.5 Valeur institutionnelle phare — version compacte */}
      {department.valueKey && (
        <div className={`border border-l-4 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm transition-all duration-350 ${theme.badgePill}`}>
          <div className="p-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-md shrink-0">
            <LucideIcon name="Award" size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="leading-tight">
              <span className={`text-[9px] uppercase font-mono font-bold tracking-wider ${theme.textPrimary}`}>Valeur phare · </span>
              <span className="font-display font-black text-xs text-slate-900 dark:text-white uppercase">{department.valueKey}</span>
            </p>
            <div
              className="rich-content text-[11px] text-slate-600 dark:text-slate-300 leading-snug font-sans font-medium line-clamp-1"
              dangerouslySetInnerHTML={{ __html: department.valueDesc || "" }}
            />
          </div>
        </div>
      )}

      {/* 2.7 Statistics and Performance Dashboard Segment (réservé Administrateur / RH Direction) */}
      {canViewDashboard && (
      <section className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="space-y-1">
            <h3 className="font-display font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className={`p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500`}>
                <LucideIcon name="BarChart3" size={16} />
              </span>
              <span>{stats.title}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.subtitle}
            </p>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Données de la Direction</span>
          </div>
        </div>

        {!hasStats ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 italic">
            Aucun indicateur n'a encore été renseigné pour cette direction depuis la console d'administration.
          </div>
        ) : (
          <>
            {/* Quick KPI blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.kpis.map((kpi, idx) => (
                <div key={idx} className="p-4 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-150 dark:border-white/5 rounded-xl flex items-start space-x-3.5">
                  <div className={`p-2.5 rounded-lg shrink-0 ${theme.iconBg} ${theme.textPrimary}`}>
                    <LucideIcon name={kpi.icon} size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-500 font-bold block">{kpi.label}</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white font-display block leading-none my-0.5">{kpi.value}</span>
                    <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 block">{kpi.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Recharts Container */}
            {stats.chartData.length > 0 && (
              <div className="w-full h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {stats.chartType === 'area' ? (
                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        {stats.series.map((s, idx) => (
                          <linearGradient key={idx} id={`color-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={s.color} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={s.color} stopOpacity={0.01}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800/60" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontFamily: 'sans-serif'
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      {stats.series.map((s, idx) => (
                        <Area key={idx} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={`url(#color-${s.key})`} strokeWidth={2.5} />
                      ))}
                    </AreaChart>
                  ) : stats.chartType === 'bar' ? (
                    <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800/60" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontFamily: 'sans-serif'
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      {stats.series.map((s, idx) => (
                        <Bar key={idx} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} barSize={16} />
                      ))}
                    </BarChart>
                  ) : (
                    <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800/60" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontFamily: 'sans-serif'
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      {stats.series.map((s, idx) => (
                        <Line key={idx} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>
      )}

      {/* 3. Le mot du directeur (pleine largeur) */}
      <section className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/50 dark:border-zinc-800 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm transition-all duration-300">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-white/5">
            <MessageSquare size={18} className="text-emerald-500 dark:text-emerald-400" />
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500">Le mot du directeur</span>
          </div>

          <div className="relative">
            <Quote size={40} className="text-slate-100 dark:text-slate-800/40 absolute -top-4 -left-3 z-0" />
            <div
              className="rich-content text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic relative z-10 font-medium whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: department.directorMessage ? `"${department.directorMessage}"` : '"Message en attente d\'enregistrement."' }}
            />
          </div>

          <div className="flex items-center space-x-3.5 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="w-12 h-12 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-slate-950 dark:text-white border-2 border-emerald-200 dark:border-emerald-500/30 font-extrabold text-sm font-display shadow-md shrink-0">
              {department.directorName.split(' ').map(n => n[0]).slice(1, 3).join('')}
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-950 dark:text-white font-display">{department.directorName}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-wider uppercase">Directeur de Direction, EDG SA</p>
            </div>
          </div>
      </section>

      {/* 4. Aperçu de la direction — Actualités, Projets et Contacts empilés verticalement */}
      <section className="space-y-6">

        {/* Actualités */}
        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 sm:p-8 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-205 dark:border-white/10 pb-3 mb-4">
            <h3 className="font-display font-black text-lg text-slate-900 dark:text-white">
              Actualités {department.code.toUpperCase()}
            </h3>
            <button
              onClick={() => onNavigate('news', department.code)}
              className="text-xs font-bold text-[#048343] hover:underline cursor-pointer flex items-center space-x-1"
            >
              <span>Page dédiée</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {localArticles.length === 0 ? (
            <div className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border border-slate-150 dark:border-white/5 p-8 rounded-2xl text-center text-slate-500 dark:text-slate-400 transition-all">
              <p className="text-sm font-semibold">Aucune actualité exclusive pour ce département.</p>
              <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">Reportez-vous aux actualités globales du Hub central.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className={`group p-4.5 border rounded-xl flex gap-4 cursor-pointer items-start hover:scale-[1.01] transition-all duration-300 ease-out ${theme.cardBg} ${theme.cardBgDark} ${theme.cardGlow}`}
                >
                  <div className="w-20 h-20 rounded-xl shrink-0 hidden sm:block relative overflow-hidden shadow-inner border border-white/10">
                    <div
                      className="absolute inset-0 transform-gpu transition-transform duration-[1200ms] ease-out group-hover:scale-115"
                      style={getMediaBgStyle(article.image)}
                    />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const shareUrl = `${window.location.origin}${window.location.pathname}?dept=${department.code}&article=${article.id}`;
                        navigator.clipboard.writeText(shareUrl).then(() => {
                          setCopiedArticleId(article.id);
                          setTimeout(() => setCopiedArticleId(null), 2000);
                        });
                      }}
                      className="absolute right-0 top-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/85 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all duration-200 cursor-pointer flex items-center justify-center border border-slate-200/50 dark:border-white/5 shadow-xs"
                      title="Copier le lien direct de l'article"
                    >
                      {copiedArticleId === article.id ? (
                        <div className="flex items-center space-x-1 px-1">
                          <Check size={11} className="text-emerald-500 animate-scale-up" />
                          <span className="text-[9px] font-mono text-emerald-500 font-bold">Copié</span>
                        </div>
                      ) : (
                        <Share2 size={11} />
                      )}
                    </button>

                    <span className="text-[10px] text-slate-450 dark:text-slate-400 font-mono block pr-12">
                      Publié le {new Date(article.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    <h4 className={`font-display font-black text-sm pr-12 transition-colors ${theme.textHover}`}>
                      {article.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                    <div className={`flex items-center space-x-1.5 text-xs font-semibold pt-1 ${theme.actionText}`}>
                      <span>Consulter l'article</span>
                      <ChevronRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projets */}
        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 sm:p-8 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Briefcase size={18} className="text-emerald-500 dark:text-emerald-400" />
              <h3 className="font-display font-black text-base text-slate-900 dark:text-white uppercase tracking-tight">
                Nos Projets Stratégiques ({projects.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('projects', department.code)}
              className="text-xs font-bold text-[#048343] hover:underline cursor-pointer flex items-center space-x-1"
            >
              <span>Page dédiée</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {loadingProjects ? (
            <div className="py-8 text-center text-xs font-mono text-slate-400">Chargement des projets de la direction...</div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">Aucun projet répertorié pour cette direction pour le moment.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((proj: any) => (
                <div key={proj.id} className="border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl overflow-hidden flex flex-col justify-between bg-zinc-50/40 dark:bg-zinc-900/30">
                  {proj.image && (
                    <div className="w-full h-28" style={getMediaBgStyle(proj.image)} />
                  )}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-md">
                        {proj.type_label || proj.type || "Projet"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        📅 {proj.date_debut} - {proj.date_fin}
                      </span>
                    </div>
                    <h4 className="font-display font-black text-sm text-slate-900 dark:text-white">
                      {proj.label}
                    </h4>
                    <div
                      className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-sans line-clamp-3 overflow-hidden [&_img]:hidden"
                      dangerouslySetInnerHTML={{ __html: proj.description }}
                    />
                  </div>
                  <div className="px-5 py-3 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-between bg-zinc-100/50 dark:bg-slate-900/20">
                    <span className="text-[10px] font-mono font-bold text-slate-450 dark:text-slate-500">STATUT</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      proj.niveau === 'Terminé' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      proj.niveau === 'En cours' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse' :
                      'bg-slate-400/10 text-slate-500'
                    }`}>
                      {proj.niveau}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 sm:p-8 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Mail size={18} className="text-blue-500 dark:text-blue-400" />
              <h3 className="font-display font-black text-base text-slate-900 dark:text-white uppercase tracking-tight">
                Contact & Destinataires Directs
              </h3>
            </div>
            <button
              onClick={() => onNavigate('contacts', department.code)}
              className="text-xs font-bold text-[#048343] hover:underline cursor-pointer flex items-center space-x-1"
            >
              <span>Page dédiée</span>
              <ChevronRight size={13} />
            </button>
          </div>

          {loadingContacts ? (
            <div className="py-8 text-center text-xs font-mono text-slate-400">Chargement des destinataires...</div>
          ) : contacts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              Pour toute demande d'assistance, merci de passer par le formulaire général.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contacts.map((rec: any, idx: number) => (
                <div key={idx} className="p-5 border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl space-y-4 bg-zinc-50/40 dark:bg-slate-900/30">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-display font-bold text-sm">
                      <User2 size={15} className={theme.textPrimary} />
                      <span>Point de contact officiel</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-sans italic">
                      "{rec.raison}"
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-zinc-100 dark:border-white/5 pt-3">
                    <a href={`mailto:${rec.email}`} className="flex items-center space-x-2 text-xs text-slate-650 dark:text-slate-300 hover:text-emerald-500 transition-colors">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate font-mono">{rec.email}</span>
                    </a>
                    {rec.numero && (
                      <a href={`tel:${rec.numero}`} className="flex items-center space-x-2 text-xs text-slate-650 dark:text-slate-300 hover:text-emerald-500 transition-colors">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span className="font-mono">{rec.numero}</span>
                      </a>
                    )}
                  </div>

                  {rec.associated_contacts && rec.associated_contacts.length > 0 && (
                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 space-y-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Lignes complémentaires</span>
                      {rec.associated_contacts.map((subC: any, subIdx: number) => (
                        <div key={subIdx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] font-mono text-slate-500">
                          <span className="truncate">{subC.email}</span>
                          <span className="shrink-0 text-slate-400">{subC.numero}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modern AnimatePresence Modal for local article read */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0c0c0e] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col"
            >
              {/* Cover Header */}
              <div
                className="p-8 text-white relative"
                style={getMediaBgStyle(selectedArticle.image)}
              >
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-[10px] font-extrabold bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full uppercase">
                    {department.code} INFOS
                  </span>
                  <span className="text-xs font-mono text-white/80">
                    {new Date(selectedArticle.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>

                <h1 className="font-display font-extrabold text-xl sm:text-2xl leading-normal">
                  {selectedArticle.title}
                </h1>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8 space-y-5 overflow-y-auto bg-white dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 italic border-l-4 border-emerald-500 pl-4 py-1 leading-relaxed">
                  {selectedArticle.excerpt}
                </p>

                <div
                  className="rich-content text-sm text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                />

                {selectedArticle.files && selectedArticle.files.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-white/5 pt-5 space-y-2">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Paperclip size={13} />
                      <span>Pièces jointes ({selectedArticle.files.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {selectedArticle.files.map((f, idx) => (
                        <a
                          key={idx}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="truncate">{f.name}</span>
                          <Download size={13} className="shrink-0 ml-2 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100 dark:border-white/5 pt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1">
                    {selectedArticle.tags.map((tag, index) => (
                      <span key={index} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const shareUrl = `${window.location.origin}${window.location.pathname}?dept=${department.code}&article=${selectedArticle.id}`;
                        navigator.clipboard.writeText(shareUrl).then(() => {
                          setCopiedModal(true);
                          setTimeout(() => setCopiedModal(false), 2000);
                        });
                      }}
                      className="px-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      {copiedModal ? (
                        <>
                          <Check size={12} className="text-emerald-500 animate-scale-up" />
                          <span className="text-emerald-500">Lien copié !</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={12} />
                          <span>Partager l'article</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="btn-premium btn-premium-green px-5 py-2 text-xs font-bold tracking-wide cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
