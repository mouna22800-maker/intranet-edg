/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Department, Article, Application, IntranetUser } from '../types';
import LucideIcon from './LucideIcon';
import { 
  ArrowRight, Search, ExternalLink, Calendar, HelpCircle, FileText, Globe, Clock, 
  BookOpen, Award, Play, Pause, Radio, ChevronLeft, ChevronRight, Megaphone, Flame,
  Shield, Download, User, Briefcase, Plus, Phone, Mail, Check, AlertCircle, Trash2, Folder, Lock, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EMERALD_THEME } from './colorThemes';
import { getMediaBgStyle as getArticleBgStyle } from './imageStyle';
import { apiFetch } from '../api';
import { ARTICLE_CATEGORIES, getArticleCategory } from './articleCategories';

interface DirectoryTeamMember {
  id: string;
  departmentId: number;
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface HubViewProps {
  departments: Department[];
  globalArticles: Article[];
  globalApplications: Application[];
  onNavigate: (view: string, deptCode?: string) => void;
  currentUser: IntranetUser | null;
  articles: Article[];
  siteSettings?: Record<string, string>;
  teamMembers?: DirectoryTeamMember[];
  authToken?: string | null;
}

// Cartes de directions (accueil) :
//  - l'ICÔNE est ROUGE EDG en permanence (plus marquée au survol) ;
//  - la CARTE prend un accent rouge discret au survol (bordure + ombre) ;
//  - les ÉCRITURES (titre, « Rejoindre ») ne changent PAS de couleur.
const DIRECTION_CARD_THEME = {
  ...EMERALD_THEME,
  cardBg: "bg-white hover:bg-red-50/40 border-slate-200/60 hover:border-red-300 transition-all duration-300 hover:shadow-lg",
  cardBgDark: "dark:bg-slate-900/60 dark:border-slate-805/80 dark:hover:bg-slate-800/40 dark:hover:border-red-500/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(226,27,35,0.10)]",
  cardGlow: "hover:shadow-[0_8px_24px_rgba(226,27,35,0.05)] dark:hover:shadow-[0_12px_32px_rgba(226,27,35,0.16)]",
  // Icône rouge par défaut, remplissage rouge plein au survol.
  iconBg: "bg-red-50 text-[#E21B23] border border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40",
  iconBgHover: "group-hover:bg-[#E21B23] group-hover:text-white dark:group-hover:bg-[#E21B23] dark:group-hover:text-white",
  // Aucune coloration rouge sur les textes.
  textHover: "",
  actionText: "text-[#048343] dark:text-[#10b981]",
};


export default function HubView({ departments, globalArticles, globalApplications, onNavigate, currentUser, articles, siteSettings, teamMembers = [], authToken }: HubViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Filtre par catégorie : l'Actualité est le point unique qui regroupe TOUTES les annonces,
  // triables par catégorie (communiqués, décès, mariages, lancements de projet…).
  const matchesCategory = (art: Article) => activeCategory === 'all' || (art.category || 'communique') === activeCategory;

  // Filter global articles & apps if search query is active
  const filteredArticles = globalArticles.filter(art =>
    matchesCategory(art) && (
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

  const filteredApps = globalApplications.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // States for the dynamic journal slideshow carrousel
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSlideAutoplay, setIsSlideAutoplay] = useState(true);
  const [slideProgress, setSlideProgress] = useState(0);


  // Get exactly the 3 most recent articles across all departments for 'À la une'
  const alaUneArticles = [...articles]
    .filter(matchesCategory)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Effect for sliding auto-play trigger of "À la une" Carousel
  useEffect(() => {
    if (!isSlideAutoplay || alaUneArticles.length <= 1) {
      setSlideProgress(0);
      return;
    }

    const duration = 5000; // 5 seconds per slide
    const intervalTime = 50; // increment state every 50ms for smooth progress bar
    const steps = duration / intervalTime;
    let stepCount = 0;

    const progressTimer = setInterval(() => {
      stepCount += 1;
      const progressPercent = Math.min((stepCount / steps) * 100, 100);
      setSlideProgress(progressPercent);

      if (stepCount >= steps) {
        setActiveSlideIndex((prevIdx) => (prevIdx + 1) % alaUneArticles.length);
        setSlideProgress(0);
        stepCount = 0;
      }
    }, intervalTime);

    return () => {
      clearInterval(progressTimer);
    };
  }, [isSlideAutoplay, alaUneArticles.length, activeSlideIndex]);

  // Reset active slide index when "À la une" lists change size (safe fallback)
  useEffect(() => {
    setActiveSlideIndex(0);
    setSlideProgress(0);
  }, [alaUneArticles.length]);

  const BACKGROUNDS = [
    '/images/edg_guinea_engineer_1780698171539.webp',
    '/images/edg_guinea_control_1780698187539.webp',
    '/images/edg_guinea_grid_1780698204240.webp'
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUNDS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);







  return (
    <div id="edg-hub-view" className="pb-16 font-sans">
      
      {/* 1. Portrait d'Accueil Officiel EDG S.A. avec Diaporama d'arrière-plan */}
      <section 
        className="relative w-full overflow-hidden py-32 sm:py-44 md:py-56 flex flex-col justify-center border-b border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-950"
      >
        {/* Background image carousel with smooth CSS crossfade */}
        <div className="absolute inset-0 overflow-hidden z-0 bg-zinc-950">
          {BACKGROUNDS.map((bg, idx) => {
            const isActive = currentImageIndex === idx;
            return (
              <div
                key={idx}
                className={`absolute inset-0 bg-cover bg-center transition-all duration-[2000ms] ease-in-out ${
                  isActive 
                    ? 'opacity-100 scale-100 z-10' 
                    : 'opacity-0 scale-105 pointer-events-none z-0'
                }`}
                style={{ backgroundImage: `url('${bg}')` }}
              />
            );
          })}
          {/* Animated gradient overlay - super clear and readable but lets images be fully seen */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/20 to-zinc-950/65 z-0" />
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} />

          {/* 3 Interactive Glowing Slide Indicators (traits lumineux) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-25 flex items-center space-x-3 bg-zinc-900/40 backdrop-blur-md py-2 px-3.5 rounded-full border border-white/5 shadow-lg">
            {BACKGROUNDS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer text-transparent select-none relative ${
                  currentImageIndex === idx
                    ? 'w-7 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                    : 'w-2 bg-white/35 hover:bg-white/60'
                }`}
                title={`Image ${idx + 1}`}
              >
                *
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center space-y-10 px-4 sm:px-6 md:px-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-zinc-900/60 backdrop-blur border border-zinc-700/60 rounded text-[9px] sm:text-[10px] font-mono text-zinc-300 font-medium uppercase tracking-widest select-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Intranet Officiel • Électricité de Guinée S.A.</span>
          </div>

          <h1 className="font-sans font-extrabold text-3xl sm:text-5xl md:text-6xl tracking-tight text-white leading-[1.12] uppercase max-w-4xl mx-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
            {siteSettings?.welcome_title || 'Bienvenue à EDG S.A.'}
          </h1>

          <p className="text-xs sm:text-base md:text-lg text-zinc-200 hover:text-white transition-colors max-w-3xl mx-auto font-sans leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] font-medium">
            {siteSettings?.welcome_subtitle || "Communiqués officiels, applications métiers et données des directions d'Électricité de Guinée, réunis dans votre espace de travail sécurisé."}
          </p>

          {/* Action links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 max-w-2xl mx-auto pt-6 relative z-20">
            <button
              onClick={() => {
                const element = document.getElementById('directions-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#048343] hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-full transition-all duration-300 flex items-center justify-center space-x-2 shadow-[0_6px_20px_rgba(4,131,67,0.25)] hover:shadow-[0_12px_28px_rgba(4,131,67,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
            >
              <LucideIcon name="Compass" size={12} className="text-white" />
              <span>Explorer les directions</span>
            </button>

            <button
              onClick={() => {
                const element = document.getElementById('applications-section');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-zinc-150/10 hover:bg-zinc-155/18 backdrop-blur-xl border border-zinc-500/40 text-zinc-100 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            >
              <LucideIcon name="LayoutGrid" size={12} className="text-zinc-300" />
              <span>Accéder aux applications</span>
            </button>
          </div>
        </div>
      </section>

      {/* Rest of the homepage container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">

        {/* 1.5 Quick access to institutional tools (GED, Agenda, Annuaire, Organigrammes) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            { key: 'ged' as const, icon: 'Folder', title: 'Bibliothèque de Documents', desc: 'Notes de service, directives, modèles et formulaires téléchargeables.' },
            { key: 'agenda' as const, icon: 'Calendar', title: 'Agenda Institutionnel', desc: 'Réunions, revues techniques et événements planifiés d\'EDG.' },
            { key: 'annuaire' as const, icon: 'Phone', title: 'Annuaire du Personnel', desc: 'Retrouvez les coordonnées directes de vos collègues et directions.' },
            { key: 'organigramme' as const, icon: 'Network', title: 'Organigramme des postes', desc: 'La hiérarchie des fonctions et des personnes qui les occupent.' },
            { key: 'structure' as const, icon: 'Workflow', title: 'Organigrammes des directions', desc: 'Organigramme général et circuits de validation : la hiérarchie selon le contexte.' }
          ].map((tool) => (
            <button
              key={tool.key}
              onClick={() => onNavigate(tool.key === 'ged' ? 'documents' : tool.key)}
              className="flex items-start p-5 rounded-2xl text-left bg-white/45 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/60 hover:border-[#048343]/50 dark:hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group cursor-pointer shadow-sm"
            >
              <div className="p-2.5 bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl mr-3.5 shrink-0 group-hover:scale-110 transition-transform">
                <LucideIcon name={tool.icon} size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-white font-sans">{tool.title}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{tool.desc}</p>
              </div>
            </button>
          ))}
        </section>


        {/* 2. Primary Choice of Departments Section */}
        <section id="directions-section" className="space-y-6 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200 dark:border-zinc-805 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white uppercase font-sans">
                Directions & Espaces de l'Entreprise
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Sélectionnez votre direction métier pour accéder à son organigramme, ses documents contractuels et son portail d’assistance de bureau.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 rounded-full shadow-[0_2px_10px_rgba(16,185,129,0.15)] mt-2 sm:mt-0 self-start">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>{departments.length} Directions Métiers Actives</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {departments.map((dept, index) => {
              // Vert EDG par défaut, accent rouge EDG au survol (voir DIRECTION_CARD_THEME).
              const theme = DIRECTION_CARD_THEME;
              return (
                <motion.div
                  key={dept.id}
                  onClick={() => onNavigate('home', dept.code)}
                  whileHover={{ 
                    y: -4, 
                    scale: 1.015,
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`group cursor-pointer border rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm transition-all ${theme.cardBg} ${theme.cardBgDark} ${theme.cardGlow}`}
                >
                  <div className="p-6">
                    {/* Header Icon Block */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/80 transition-all duration-300 ${theme.iconBg} ${theme.iconBgHover}`}>
                        <LucideIcon name={dept.icon} size={18} className="transition-transform duration-300" />
                      </div>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${theme.tagBg}`}>
                        {dept.code}
                      </span>
                    </div>

                    {/* Info block */}
                    <h3 className={`font-display font-black text-base text-slate-900 dark:text-white transition-colors duration-300 ${theme.textHover} uppercase tracking-tight`}>
                      {dept.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-404 mt-1.5 line-clamp-3 leading-relaxed font-sans font-medium transition-all duration-300 group-hover:text-slate-700 dark:group-hover:text-slate-305">
                      {dept.description}
                    </p>
                  </div>

                  {/* Action and Stats strip */}
                  <div className={`px-6 py-4 border-t flex items-center justify-between transition-colors duration-300 ${theme.stripBg}`}>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-black">
                      👥 {dept.staffCount} collaborateurs
                    </span>
                    <span className={`text-[11px] font-black uppercase flex items-center space-x-1.5 transition-colors ${theme.actionText}`}>
                      <span>Rejoindre</span>
                      <ArrowRight size={14} className="transform group-hover:translate-x-2 transition-transform duration-300" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 📰 LIVE JOURNAL TV-STYLE BREAKING NEWS TICKER */}
        {filteredArticles.length > 0 && (
          <section className="bg-slate-900 dark:bg-slate-950 border-y border-slate-200/50 dark:border-slate-800/85 mb-8 relative overflow-hidden h-12 flex items-center select-none rounded-2xl shadow-inner shadow-black/40">
            {/* Static Ticker Badge */}
            <div className="absolute left-0 top-0 bottom-0 px-4 bg-gradient-to-r from-red-650 to-red-600 text-white flex items-center space-x-2 z-10 font-sans font-black text-[10px] tracking-widest uppercase shadow-lg select-none border-r border-[#C22026]/30 px-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="font-black flex items-center gap-1 text-white">
                <Radio size={12} className="opacity-90 animate-pulse text-white" />
                DIRECT INFO
              </span>
            </div>

            {/* Marquee sliding track container */}
            <div className="flex-1 overflow-hidden h-full flex items-center pl-36 relative">
              <div className="animate-marquee-news hover:pause-marquee flex items-center space-x-12">
                {[...filteredArticles, ...filteredArticles, ...filteredArticles].map((art, idx) => (
                  <div 
                    key={`${art.id}-${idx}`}
                    onClick={() => setSelectedArticle(art)}
                    className="inline-flex items-center space-x-2 text-slate-100 hover:text-emerald-450 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap group/ticker-item"
                  >
                    <span className="text-[9px] font-mono text-[#048343] dark:text-emerald-400 font-extrabold uppercase tracking-wider bg-emerald-550/10 dark:bg-emerald-550/5 border border-emerald-500/20 px-1.5 py-0.5 rounded select-none group-hover/ticker-item:bg-emerald-600 group-hover/ticker-item:text-white group-hover/ticker-item:border-emerald-500 transition-all">
                      ALERTE INFO
                    </span>
                    <span className="font-sans text-slate-100 font-semibold group-hover/ticker-item:underline decoration-[#048343] dark:decoration-emerald-400 decoration-2 underline-offset-2">
                      {art.title}
                    </span>
                    <span className="text-emerald-400 font-extrabold pl-4">✦</span>
                  </div>
                ))}
              </div>

              {/* Fading glass bounds for premium looks */}
              <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-slate-900 dark:from-slate-950 to-transparent pointer-events-none z-10"></div>
            </div>
          </section>
        )}

        {/* 3. Actualités + Portail applicatif — grille unifiée à 3 colonnes de même hauteur */}
        <section id="actualites-section" className="space-y-6 scroll-mt-24">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white uppercase font-sans">
              {searchQuery ? `Résultats de recherche actualités (${filteredArticles.length})` : 'Espace Actualités • Électricité de Guinée S.A.'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {searchQuery ? 'Filtre appliqué d\'après votre saisie' : 'Toutes les annonces d’EDG S.A. regroupées ici : communiqués, vie de l’entreprise, projets… triables par catégorie.'}
            </p>
          </div>

          {/* Filtre par catégorie — regroupe et trie toutes les annonces au même endroit */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveCategory('all'); setActiveSlideIndex(0); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${activeCategory === 'all' ? 'bg-[#048343] text-white border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:border-white/10'}`}
            >
              Tout <span className="opacity-70 tabular-nums">{articles.length}</span>
            </button>
            {ARTICLE_CATEGORIES.map((cat) => {
              const count = articles.filter((a) => (a.category || 'communique') === cat.id).length;
              if (count === 0) return null;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setActiveSlideIndex(0); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${active ? `${cat.badgeClass} font-bold shadow-sm` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:border-white/10'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`}></span>
                  {cat.short} <span className="opacity-70 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          {alaUneArticles.length === 0 && filteredArticles.length === 0 && (
            <div className="p-10 text-center text-sm text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              Aucune annonce dans cette catégorie pour l’instant.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">

            {/* Ligne 1 — Focus À la une (occupe 2 colonnes) */}
            {alaUneArticles.length > 0 && (() => {
              const activeSlide = alaUneArticles[activeSlideIndex] || alaUneArticles[0];
              const wordsCount = activeSlide.content.split(' ').length;
              const readTime = Math.max(1, Math.ceil(wordsCount / 140));
              return (
                <div className="sm:col-span-2 lg:col-span-2 bg-zinc-950 rounded-xl border border-zinc-800 shadow-xl overflow-hidden relative group/carousel">
                  {/* Active image back with slow animation */}
                  <div className="relative h-64 sm:h-80 w-full overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeSlide.id}
                        initial={{ scale: 1.12, opacity: 0 }}
                        animate={{ scale: 1.02, opacity: 0.95 }}
                        exit={{ scale: 0.98, opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="absolute inset-0 w-full h-full transform-gpu"
                        style={getArticleBgStyle(activeSlide.image)}
                      />
                    </AnimatePresence>

                    {/* Gradient overlay for absolute legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent"></div>

                    {/* Focus Tag */}
                    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-md border border-zinc-800 z-10 shadow select-none">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest pl-1">FOCUS À LA UNE</span>
                    </div>

                    {/* Left / Right trigger arrows overlay */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 flex justify-between z-20 pointer-events-none opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSlideIndex(prev => (prev === 0 ? alaUneArticles.length - 1 : prev - 1));
                          setSlideProgress(0);
                        }}
                        className="p-2 rounded-full bg-slate-950/90 hover:bg-[#048343] text-white hover:scale-105 pointer-events-auto cursor-pointer transition-all border border-white/5 active:scale-95 shadow-lg"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSlideIndex(prev => (prev === alaUneArticles.length - 1 ? 0 : prev + 1));
                          setSlideProgress(0);
                        }}
                        className="p-2 rounded-full bg-slate-950/90 hover:bg-[#048343] text-white hover:scale-105 pointer-events-auto cursor-pointer transition-all border border-white/5 active:scale-95 shadow-lg"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* Overlaid Title and description */}
                    <div className="absolute bottom-4 inset-x-4 sm:inset-x-6 z-10 select-none text-left">
                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={activeSlide.id}
                          initial={{ y: 22, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -22, opacity: 0 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-300 font-mono">
                            {(() => { const cat = getArticleCategory(activeSlide.category); return (
                              <span className="inline-flex items-center gap-1.5 bg-black/50 border border-white/20 text-white font-extrabold px-2 py-0.5 rounded text-[8.5px] uppercase tracking-wider">
                                <LucideIcon name={cat.icon} size={10} />
                                {cat.short}
                              </span>
                            ); })()}
                            <span className="bg-emerald-400 text-slate-950 font-extrabold px-2 py-0.5 rounded text-[8.5px] uppercase tracking-wider">
                              À LA UNE CORPORATE
                            </span>
                            {activeSlide.isGlobal ? (
                              <span className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-extrabold px-2 py-0.5 rounded text-[8.5px] uppercase tracking-wider">
                                GLOBAL • EDG S.A.
                              </span>
                            ) : (() => {
                              const dept = departments.find(d => d.id === activeSlide.departmentId);
                              return (
                                <span className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-extrabold px-2 py-0.5 rounded text-[8.5px] uppercase tracking-wider">
                                  DIRECTION • {dept ? dept.code.toUpperCase() : 'MÉTIER'}
                                </span>
                              );
                            })()}
                            <span className="flex items-center space-x-1 font-medium text-slate-200">
                              <Calendar size={11} className="text-[#048343]" />
                              <span>{new Date(activeSlide.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </span>
                            <span className="flex items-center space-x-1 text-emerald-400 font-black">
                              <Clock size={11} className="animate-pulse" />
                              <span>{readTime} min de lecture</span>
                            </span>
                          </div>

                          <h3 
                            onClick={() => setSelectedArticle(activeSlide)}
                            className="font-display font-black text-lg sm:text-2xl text-white hover:text-emerald-350 transition-colors leading-tight cursor-pointer drop-shadow-lg"
                          >
                            {activeSlide.title}
                          </h3>

                          <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-2xl leading-relaxed font-sans">
                            {activeSlide.excerpt}
                          </p>

                          <div className="pt-2.5 flex items-center justify-between">
                            <button
                              onClick={() => setSelectedArticle(activeSlide)}
                              className="btn-premium btn-premium-green px-4.5 py-2.5 text-xs font-bold rounded-xl cursor-pointer text-white shadow-xl flex items-center space-x-2"
                            >
                              <span>Lire cet article complet</span>
                              <ArrowRight size={13} />
                            </button>

                            {/* Control actions */}
                            <div className="flex items-center space-x-3 pointer-events-auto">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsSlideAutoplay(!isSlideAutoplay);
                                }}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors cursor-pointer border border-white/5"
                              >
                                {isSlideAutoplay ? <Pause size={12} /> : <Play size={12} />}
                              </button>

                              <div className="flex items-center space-x-1.5">
                                {alaUneArticles.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveSlideIndex(idx);
                                      setSlideProgress(0);
                                    }}
                                    className={`h-2 rounded-full transition-all cursor-pointer ${activeSlideIndex === idx ? 'bg-emerald-400 w-4' : 'bg-white/30 w-2'}`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Horizontal progress bar */}
                    <div className="absolute bottom-0 left-0 h-[4px] bg-slate-800 w-full overflow-hidden z-20 animate-fade-in">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 via-[#ffd45e] to-red-500 transition-all ease-linear"
                        style={{ width: `${slideProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Ligne 1 — Portail applicatif (1 colonne, même hauteur que le focus) */}
            <div id="applications-section" className="lg:col-span-1 scroll-mt-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm p-5 flex flex-col min-h-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0">
                    <LucideIcon name="LayoutGrid" size={16} />
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white font-sans">Portail applicatif</h3>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">Accédez aux outils métiers et espaces de travail de l'EDG.</p>
              </div>

              {filteredApps.length > 0 && (
                <div className="mt-3 space-y-2 overflow-y-auto flex-1 min-h-0">
                  {filteredApps.map((app) => (
                    <a
                      key={app.id}
                      href={app.url.startsWith('#') ? undefined : app.url}
                      onClick={(e) => {
                        if (app.url.startsWith('#')) {
                          e.preventDefault();
                          const targetHash = app.url.replace('#', '');
                          const [dept, sub] = targetHash.split('/');
                          onNavigate(sub || 'home', dept);
                        }
                      }}
                      target={app.url.startsWith('#') ? undefined : '_blank'}
                      rel="noreferrer"
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-400/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors group"
                    >
                      <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300 group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                        <LucideIcon name={app.icon} size={14} />
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{app.name}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Bouton poussé en bas de la carte (mt-auto) pour éviter le vide */}
              {siteSettings?.app_hub_url ? (
                <a
                  href={siteSettings.app_hub_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#048343] hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer shrink-0"
                >
                  <ExternalLink size={14} />
                  <span>Accéder au portail</span>
                </a>
              ) : filteredApps.length === 0 ? (
                <p className="mt-auto text-[11px] text-zinc-400 dark:text-zinc-500 italic">Aucun outil configuré pour le moment.</p>
              ) : null}
            </div>

            {/* Lignes suivantes — Communiqués (3 par ligne, cartes de même taille) */}
            {filteredArticles.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-8 border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-500 space-y-3">
                <HelpCircle size={32} className="mx-auto" />
                <p className="text-sm font-semibold dark:text-slate-300">Aucune actualité officielle ne correspond à cette recherche.</p>
              </div>
            ) : (
              <>
                {filteredArticles.map((article) => {
                  const wordsCount = article.content.split(' ').length;
                  const readTime = Math.max(1, Math.ceil(wordsCount / 140));
                  const cat = getArticleCategory(article.category);
                  return (
                    <div
                      key={article.id}
                      onClick={() => setSelectedArticle(article)}
                      className="group bg-white dark:bg-[#09090b] rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm h-full"
                    >
                      <div className="h-44 w-full shrink-0 relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-900">
                        <div 
                          className="absolute inset-0 transform-gpu transition-transform duration-[1500ms] group-hover:scale-105 opacity-90"
                          style={getArticleBgStyle(article.image)}
                        />
                        <div className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded text-[8.5px] font-bold uppercase tracking-wide z-10 leading-none shadow-sm border ${cat.badgeClass}`}>
                          <LucideIcon name={cat.icon} size={9} />
                          {cat.short}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/70 to-transparent h-16 z-0"></div>
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 text-[8px] font-mono text-zinc-300 font-bold uppercase tracking-wider">
                          <span>EDG S.A.</span>
                          <span>{readTime} MIN</span>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2 text-left">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                            <span className="flex items-center space-x-1">
                              <Calendar size={10} className="text-zinc-400" />
                              <span>{new Date(article.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}</span>
                            </span>
                          </div>

                          <h3 className="font-sans font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors text-sm sm:text-md leading-snug line-clamp-2">
                            {article.title}
                          </h3>

                          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed font-sans">
                            {article.excerpt}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-900">
                          <div className="flex flex-wrap gap-1 max-w-[65%]">
                            {article.tags.slice(0, 2).map((tag, tIndex) => (
                              <span key={tIndex} className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded block">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-900 dark:text-zinc-200 flex items-center space-x-1 pr-1">
                            <span>Lire</span>
                            <ArrowRight size={10} className="transform group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>

      </div>

      {/* 4. Elegant AnimatePresence Modal for Full Article Expansion */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/90 dark:bg-zinc-900/85 backdrop-blur-xl rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-zinc-200/50 dark:border-zinc-800/60 flex flex-col"
            >
              {/* Colored header representation */}
              <div 
                className="p-8 text-white relative"
                style={getArticleBgStyle(selectedArticle.image)}
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
                  <span className="text-[10px] font-extrabold bg-emerald-400 text-slate-900 px-2 py-0.5 rounded-full">
                    Actualité Générale
                  </span>
                  <span className="text-xs font-mono text-white/80">
                    {new Date(selectedArticle.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>

                <h1 className="font-display font-black text-xl sm:text-2xl leading-normal">
                  {selectedArticle.title}
                </h1>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 italic border-l-4 border-emerald-400 pl-4 py-1 leading-relaxed">
                  {selectedArticle.excerpt}
                </p>

                <div
                  className="rich-content text-sm text-slate-650 dark:text-slate-400 leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                />

                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1">
                    {selectedArticle.tags.map((tag, index) => (
                      <span key={index} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 px-2.5 py-1 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedArticle(null)}
                    className="btn-premium btn-premium-green px-5 py-2 text-xs font-bold tracking-wide cursor-pointer"
                  >
                    Fermer la lecture
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
