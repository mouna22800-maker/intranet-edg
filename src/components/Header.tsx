/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Department, IntranetUser, Application, Article } from '../types';
import EdgLogo from './EdgLogo';
import { 
  Menu, X, ChevronDown, Home, ExternalLink, LogOut, Shield, User, 
  Search, FileText, Calendar, Building, Layers, Sparkles, Key, AlertCircle, ArrowRight, HelpCircle,
  Sun, Moon
} from 'lucide-react';
import LucideIcon from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';
import { getMediaBgStyle as getArticleBgStyle } from './imageStyle';

const ROLE_META: Record<string, { gradient: string; badge: string; label: string }> = {
  administrateur: { gradient: 'bg-gradient-to-tr from-violet-600 to-purple-500', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-400 border border-violet-200/10', label: 'Administrateur' },
  rh_direction: { gradient: 'bg-gradient-to-tr from-rose-600 to-pink-500', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/10', label: 'RH / Direction' },
  chef_service: { gradient: 'bg-gradient-to-tr from-amber-600 to-orange-500', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/10', label: 'Chef de Service' },
  agent: { gradient: 'bg-gradient-to-tr from-blue-600 to-indigo-500', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/10', label: 'Agent' }
};

interface HeaderProps {
  departments: Department[];
  currentDept?: Department;
  currentView: string;
  onNavigate: (view: string, deptCode?: string) => void;
  siteSettings?: Record<string, string>;
  currentUser?: IntranetUser | null;
  onLogout?: () => void;
  applications?: Application[];
  articles?: Article[];
}

export default function Header({ 
  departments, 
  currentDept, 
  currentView, 
  onNavigate, 
  siteSettings = {},
  currentUser,
  onLogout,
  applications = [],
  articles = []
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [equipeDropdownOpen, setEquipeDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Fermeture robuste des menus déroulants au clic à l'extérieur (remplace l'ancien
  // onBlur+setTimeout, sujet à une course : un clic lent sur un item du menu pouvait
  // se faire fermer avant que son onClick ne s'exécute, empêchant la navigation).
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(target)) {
        setDeptDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Dark mode theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // Sync theme to document.documentElement and localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  // Search Engine states
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Modals for Search Action Resolution
  const [selectedSearchArticle, setSelectedSearchArticle] = useState<Article | null>(null);
  const [simulatedSearchApp, setSimulatedSearchApp] = useState<Application | null>(null);

  // Global Keyboard listener for hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable
      );
      
      if (!isInput) {
        if (e.key === '/') {
          e.preventDefault();
          if (mobileMenuOpen) {
            mobileInputRef.current?.focus();
          } else {
            inputRef.current?.focus();
          }
        } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (mobileMenuOpen) {
            mobileInputRef.current?.focus();
          } else {
            inputRef.current?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Handle escape key inside input to blur
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      setIsFocused(false);
    }
  };

  // Search Matchers
  const searchLower = searchQuery.trim().toLowerCase();

  const matchedDepts = searchLower ? departments.filter(d => 
    d.name.toLowerCase().includes(searchLower) ||
    d.code.toLowerCase().includes(searchLower) ||
    d.description.toLowerCase().includes(searchLower) ||
    d.directorName.toLowerCase().includes(searchLower)
  ) : [];

  const matchedApps = searchLower ? applications.filter(app => 
    app.name.toLowerCase().includes(searchLower) ||
    app.description.toLowerCase().includes(searchLower) ||
    app.category.toLowerCase().includes(searchLower)
  ) : [];

  const matchedArticles = searchLower ? articles.filter(art => 
    art.title.toLowerCase().includes(searchLower) ||
    art.excerpt.toLowerCase().includes(searchLower) ||
    art.content.toLowerCase().includes(searchLower) ||
    art.tags.some(t => t.toLowerCase().includes(searchLower))
  ) : [];

  const totalMatches = matchedDepts.length + matchedApps.length + matchedArticles.length;

  return (
    <header id="edg-header" className="fixed top-0 left-0 right-0 z-50 bg-white/75 dark:bg-zinc-950/70 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-900/40 text-zinc-800 dark:text-zinc-100 shadow-md transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Name */}
          <div 
            onClick={() => onNavigate('hub')} 
            onDoubleClick={() => onNavigate('login')}
            className="flex items-center space-x-3 cursor-pointer group shrink-0"
            id="logo-container"
            title="Double-cliquer pour l'accès sécurisé"
          >
            {/* Dynamic Customisable Logo */}
            <div className="w-9 h-9 shrink-0 relative overflow-hidden group-hover:scale-102 transition-transform duration-200 flex items-center justify-center rounded-lg" id="official-edg-logo">
              {siteSettings && siteSettings.logo_type === 'custom_url' && siteSettings.logo_url ? (
                <img 
                  src={siteSettings.logo_url} 
                  alt="EDG Logo" 
                  className="w-full h-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : siteSettings && siteSettings.logo_type === 'custom_text' ? (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#048343] to-emerald-600 flex items-center justify-center text-white font-black text-[11px] border border-amber-400 shadow-md">
                  <span>{siteSettings.logo_text || 'EDG'}</span>
                </div>
              ) : (
                <EdgLogo className="w-full h-full" />
              )}
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-sans font-extrabold tracking-tight text-md text-zinc-900 dark:text-white">EDG</span>
                <span className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-[9px] font-mono font-medium px-2 py-0.5 rounded uppercase tracking-wider transition-colors">
                  INTRANET
                </span>
              </div>
              <p className="text-[9px] text-zinc-400 dark:text-zinc-550 font-mono tracking-wider uppercase hidden xl:block">
                {siteSettings.institution_name || 'Électricité de Guinée S.A.'}
              </p>
            </div>
          </div>

          {/* DESKTOP GLOBAL SEARCH BAR - EMBEDDED IN NAVBAR CENTER-LEFT */}
          <div className="relative flex-1 max-w-[240px] xl:max-w-xs mx-6 hidden md:block" id="global-search-container">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Search size={14} />
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 240)}
                onKeyDown={handleInputKeyDown}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-10 py-1.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-400 dark:focus:border-zinc-650 rounded text-xs text-zinc-800 dark:text-zinc-150 placeholder-zinc-450 dark:placeholder-zinc-550 focus:outline-none transition-all font-sans"
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center space-x-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Floating Overlay Results Panel */}
            <AnimatePresence>
              {isFocused && searchQuery.trim().length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 12, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2.5 w-[420px] lg:w-[480px] rounded-2xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/60 shadow-2xl overflow-hidden py-1 z-50 max-h-[460px] overflow-y-auto"
                  onMouseDown={(e) => e.preventDefault()} // Block blur event when selecting results
                  id="desktop-search-dropdown"
                >
                  <div className="px-3.5 py-2 bg-zinc-50/50 dark:bg-zinc-900/40 border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between text-[10px] font-mono font-bold text-zinc-500">
                    <span>Résultats ({totalMatches})</span>
                    <span>Terme : "{searchQuery}"</span>
                  </div>

                  {totalMatches === 0 ? (
                    <div className="py-8 px-4 text-center text-zinc-500 space-y-1 bg-transparent">
                      <HelpCircle size={28} className="mx-auto text-zinc-350" />
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Aucun résultat</p>
                      <p className="text-[10px] max-w-xs mx-auto leading-relaxed">Nous n'avons trouvé aucune direction, application ou actualité correspondante.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200/50 dark:divide-zinc-800/40 bg-transparent">
                      
                      {/* DIRECTIONS MATCHED */}
                      {matchedDepts.length > 0 && (
                        <div className="p-2">
                          <span className="px-2 py-1 block text-[9px] font-mono tracking-wider uppercase text-amber-700 font-bold bg-amber-50 rounded">
                            🏢 Directions correspondantes ({matchedDepts.length})
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {matchedDepts.map(dept => (
                              <button
                                key={dept.id}
                                id={`search-result-dept-${dept.id}`}
                                onClick={() => {
                                  onNavigate('home', dept.code);
                                  setIsFocused(false);
                                  setSearchQuery('');
                                }}
                                className="w-full flex items-start space-x-2.5 px-2.5 py-1.5 hover:bg-slate-50 text-left transition-colors rounded-lg"
                              >
                                <div className="p-1 bg-slate-100 rounded text-amber-600 mt-0.5 shrink-0">
                                  <LucideIcon name={dept.icon} size={12} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                                    <span>{dept.name}</span>
                                    <span className="bg-slate-200 text-slate-700 font-mono text-[8px] font-semibold px-1 py-0.2 rounded uppercase">
                                      {dept.code}
                                    </span>
                                  </p>
                                  <p className="text-[9px] text-slate-400 line-clamp-1">{dept.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* APPLICATIONS MATCHED */}
                      {matchedApps.length > 0 && (
                        <div className="p-2">
                          <span className="px-2 py-1 block text-[9px] font-mono tracking-wider uppercase text-indigo-700 font-bold bg-indigo-50/75 rounded">
                            🛠️ Outils & Applications ({matchedApps.length})
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {matchedApps.map(app => (
                              <button
                                key={app.id}
                                id={`search-result-app-${app.id}`}
                                onClick={() => {
                                  const targetDept = departments.find(d => d.id === app.departmentId);
                                  if (targetDept) {
                                    onNavigate('portal', targetDept.code);
                                  } else {
                                    onNavigate('portal', currentDept?.code || 'dsi');
                                  }
                                  setSimulatedSearchApp(app);
                                  setIsFocused(false);
                                  setSearchQuery('');
                                }}
                                className="w-full flex items-start space-x-2.5 px-2.5 py-1.5 hover:bg-slate-50 text-left transition-colors rounded-lg group"
                              >
                                <div className="p-1 bg-slate-150 group-hover:bg-indigo-500 group-hover:text-white rounded text-slate-700 mt-0.5 shrink-0 transition-colors">
                                  <LucideIcon name={app.icon} size={12} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                                      {app.name}
                                    </p>
                                    <span className={`text-[8px] font-mono font-bold px-1 rounded uppercase ${
                                      app.isGlobal ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {app.isGlobal ? 'Global' : 'Métier'}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-slate-400 line-clamp-1">{app.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ARTICLES MATCHED */}
                      {matchedArticles.length > 0 && (
                        <div className="p-2">
                          <span className="px-2 py-1 block text-[9px] font-mono tracking-wider uppercase text-emerald-700 font-bold bg-emerald-50 rounded">
                            📰 Actualités & Notes Circulaires ({matchedArticles.length})
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {matchedArticles.map(art => (
                              <button
                                key={art.id}
                                id={`search-result-article-${art.id}`}
                                onClick={() => {
                                  setSelectedSearchArticle(art);
                                  if (art.isGlobal) {
                                    onNavigate('hub');
                                  } else {
                                    const associatedDept = departments.find(d => d.id === art.departmentId);
                                    if (associatedDept) {
                                      onNavigate('home', associatedDept.code);
                                    }
                                  }
                                  setIsFocused(false);
                                  setSearchQuery('');
                                }}
                                className="w-full flex items-start space-x-2.5 px-2.5 py-1.5 hover:bg-slate-50 text-left transition-colors rounded-lg"
                              >
                                <div className="p-1 bg-slate-100 rounded text-emerald-600 mt-0.5 shrink-0">
                                  <FileText size={12} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 line-clamp-1">{art.title}</p>
                                  <p className="text-[9px] text-slate-400 line-clamp-1">{art.excerpt}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Navigation & Actions Block - Perfect alignment with identical spacing and no vertical separator */}
          <div className="hidden lg:flex items-center space-x-6 shrink-0" id="desktop-nav-right">
            {/* Accueil Button */}
            <button
              onClick={() => onNavigate('hub')}
              id="nav-home"
              className={`flex items-center space-x-2 text-sm font-medium transition-colors cursor-pointer ${
                currentView === 'hub' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Home size={15} />
              <span>Accueil</span>
            </button>

            {/* Department Dropdown Menu */}
            <div className="relative" ref={deptDropdownRef}>
              <button
                onClick={() => setDeptDropdownOpen(!deptDropdownOpen)}
                id="nav-dept-selector"
                className={`flex items-center space-x-2 text-sm font-medium transition-colors cursor-pointer ${
                  currentDept ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Directions</span>
                {currentDept && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    {currentDept.code.toUpperCase()}
                  </span>
                )}
                <ChevronDown size={14} className={`transform transition-transform text-slate-400 ${deptDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {deptDropdownOpen && (
                <div className="absolute right-0 mt-2 w-[720px] max-w-[92vw] max-h-[75vh] overflow-y-auto rounded-2xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/80 shadow-2xl py-1 z-50 animate-fade-in scrollbar-thin">
                  <div className="px-4.5 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-200/50 dark:border-zinc-800/50">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider block">
                      Espaces Particuliers (Directions)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 p-3.5">
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        onClick={() => {
                          onNavigate('home', dept.code);
                          setDeptDropdownOpen(false);
                        }}
                        className="flex items-start space-x-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 text-left transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 group"
                      >
                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <LucideIcon name={dept.icon} size={13} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors uppercase tracking-tight whitespace-normal">{dept.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5">{dept.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Theme Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/40 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
              aria-label="Basculez le thème"
              title={isDarkMode ? "Activer le mode clair" : "Activer le mode sombre"}
            >
              {isDarkMode ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-[#048343]" />
              )}
            </button>

            {currentUser ? (
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  id="nav-user-profile-btn"
                  className="flex items-center space-x-2.5 p-1.5 pl-2.5 pr-2.5 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/40 dark:border-slate-800 transition-all cursor-pointer shadow-sm active:scale-95 group"
                  aria-label="User profile menu"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black tracking-wider text-white select-none ${ROLE_META[currentUser.role]?.gradient || ROLE_META.agent.gradient}`}>
                    {getInitials(currentUser.name)}
                  </div>
                  <div className="text-left hidden md:block leading-none pr-1">
                    <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">{currentUser.name}</p>
                    <p className="text-[8px] font-mono font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-0.5">{currentUser.role.replace('_', ' ')}</p>
                  </div>
                  <ChevronDown size={12} className={`text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/60 shadow-2xl py-2 z-50 animate-fade-in text-left overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-250/50 dark:border-zinc-800/50 flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white ${ROLE_META[currentUser.role]?.gradient || ROLE_META.agent.gradient}`}>
                        {getInitials(currentUser.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {currentUser.name}
                        </h4>
                        <p className="text-[9.5px] font-mono text-slate-400 truncate mb-1">{currentUser.email}</p>
                        <span className={`text-[8.5px] px-2 py-0.5 rounded-md font-mono font-black uppercase tracking-wider ${ROLE_META[currentUser.role]?.badge || ROLE_META.agent.badge}`}>
                          {ROLE_META[currentUser.role]?.label || 'Agent'}
                        </span>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      {currentUser.role !== 'agent' && (
                        <button
                          onClick={() => {
                            onNavigate('admin');
                            setUserDropdownOpen(false);
                          }}
                          className={`w-full text-left font-bold text-xs px-3.5 py-2.5 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center space-x-2.5 cursor-pointer ${
                            currentView === 'admin' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <LucideIcon name="Settings" size={14} className="text-emerald-500" />
                          <span>Console Administration</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (onLogout) onLogout();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left font-bold text-xs px-3.5 py-2.5 hover:bg-red-500/10 rounded-xl text-slate-700 dark:text-slate-200 hover:text-red-650 dark:hover:text-red-400 transition-colors flex items-center space-x-2.5 cursor-pointer"
                      >
                        <LogOut size={14} className="text-red-500" />
                        <span>Se déconnecter</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-2 rounded-lg"
              aria-label="Toggle menu"
              id="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-[#0c1425] border-t border-slate-100 dark:border-slate-800/80 py-4 px-4 space-y-4 shadow-inner max-h-[85vh] overflow-y-auto">
          
          {/* MOBILE GLOBAL SEARCH BOX */}
          <div className="relative" id="mobile-search-container">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-450 dark:text-slate-500">
                <Search size={15} />
              </div>
              <input
                ref={mobileInputRef}
                type="text"
                placeholder="Rechercher (directions, outils, actualités)..."
                value={searchQuery}
                onKeyDown={handleInputKeyDown}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-[#111c34]/50 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Mobile Inline Results Panel */}
            {searchQuery.trim().length > 0 && (
              <div className="mt-2.5 bg-slate-50 dark:bg-[#111c34]/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-2.5 space-y-3" id="mobile-search-dropdown">
                <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 border-b border-slate-250 dark:border-slate-800 pb-1 flex justify-between">
                  <span>RÉSULTATS DE RECHERCHE ({totalMatches})</span>
                  <span>"{searchQuery}"</span>
                </p>

                {totalMatches === 0 ? (
                  <p className="text-center text-[10px] text-slate-450 dark:text-slate-505 py-2">Aucun résultat trouvé.</p>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto">
                    {/* Depts */}
                    {matchedDepts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono uppercase bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 p-1 rounded font-bold block">
                          🏢 Directions Metiers ({matchedDepts.length})
                        </span>
                        {matchedDepts.map(dept => (
                          <button
                            key={dept.id}
                            onClick={() => {
                              onNavigate('home', dept.code);
                              setSearchQuery('');
                              setMobileMenuOpen(false);
                            }}
                            className="w-full text-left text-xs font-semibold p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800/80 rounded flex items-center justify-between text-slate-800 dark:text-slate-200"
                          >
                            <span className="truncate">{dept.name}</span>
                            <span className="text-[9px] font-mono font-bold rounded px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase shrink-0 ml-1">
                              {dept.code}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Apps */}
                    {matchedApps.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono uppercase bg-indigo-50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-400 p-1 rounded font-bold block">
                          🛠️ Applications ({matchedApps.length})
                        </span>
                        {matchedApps.map(app => (
                          <button
                            key={app.id}
                            onClick={() => {
                              const targetDept = departments.find(d => d.id === app.departmentId);
                              if (targetDept) {
                                onNavigate('portal', targetDept.code);
                              } else {
                                onNavigate('portal', currentDept?.code || 'dsi');
                              }
                              setSimulatedSearchApp(app);
                              setSearchQuery('');
                              setMobileMenuOpen(false);
                            }}
                            className="w-full text-left text-xs font-semibold p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800/80 rounded flex items-center justify-between text-slate-800 dark:text-slate-200"
                          >
                            <span className="truncate">{app.name}</span>
                            <span className="text-[8px] font-mono uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-1.5 rounded font-bold shrink-0 ml-1">
                              {app.category}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Articles */}
                    {matchedArticles.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono uppercase bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-1 rounded font-bold block">
                          📰 Circulaires & Actualités ({matchedArticles.length})
                        </span>
                        {matchedArticles.map(art => (
                          <button
                            key={art.id}
                            onClick={() => {
                              setSelectedSearchArticle(art);
                              if (art.isGlobal) {
                                onNavigate('hub');
                              } else {
                                const associatedDept = departments.find(d => d.id === art.departmentId);
                                if (associatedDept) {
                                  onNavigate('home', associatedDept.code);
                                }
                              }
                              setSearchQuery('');
                              setMobileMenuOpen(false);
                            }}
                            className="w-full text-left text-xs font-semibold p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800/80 rounded block truncate text-slate-800 dark:text-slate-250"
                          >
                            {art.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Mobile Dark Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl mb-3 transition-colors">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mode Sombre (Interface Premium)</span>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-755 text-slate-700 dark:text-slate-100 shadow-sm transition-all flex items-center space-x-1.5"
            >
              {isDarkMode ? (
                <>
                  <Sun size={12} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-500">Actif</span>
                </>
              ) : (
                <>
                  <Moon size={12} className="text-[#048343] dark:text-[#048343]" />
                  <span className="text-[10px] font-bold text-[#048343]">Inactif</span>
                </>
              )}
            </button>
          </div>

          {currentUser && (
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${ROLE_META[currentUser.role]?.badge || ROLE_META.agent.badge}`}>
                  <Shield size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>{currentUser.name}</span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-mono tracking-wider font-bold ${ROLE_META[currentUser.role]?.badge || ROLE_META.agent.badge}`}>
                      {currentUser.role.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-[10px] font-mono text-slate-505">{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  setMobileMenuOpen(false);
                }}
                className="p-1 px-2.5 rounded-lg border border-slate-200 text-[10px] font-bold text-red-655 hover:bg-slate-100 flex items-center space-x-1 transition-colors block cursor-pointer"
                id="mobile-logout-btn"
              >
                <LogOut size={11} />
                <span>Déconnecter</span>
              </button>
            </div>
          )}

          <div className="space-y-1">
            <button
              onClick={() => {
                onNavigate('hub');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white text-left text-sm font-medium"
            >
              <Home size={18} className="text-emerald-500" />
              <span>Accueil</span>
            </button>
            {currentUser && currentUser.role !== 'agent' && (
              <button
                onClick={() => {
                  onNavigate('admin');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-705 dark:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white text-left text-sm font-semibold bg-emerald-50/50 dark:bg-emerald-950/20"
              >
                <LucideIcon name="Settings" size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>Administration</span>
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span className="px-3 pb-2 block text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Directions / Départements
            </span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => {
                    onNavigate('home', dept.code);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-start p-3 rounded-lg text-left transition-colors border ${
                    currentDept?.code === dept.code 
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/70 text-slate-900 dark:text-emerald-400 font-semibold'
                      : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-[#131e35]/65'
                  }`}
                >
                  <div className="text-emerald-650 dark:text-emerald-400 mb-1">
                    <LucideIcon name={dept.icon} size={16} />
                  </div>
                  <span className="text-xs font-semibold">{dept.code.toUpperCase()}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{dept.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rubriques are now handled dynamically on the active page context screen sidebar */}
        </div>
      )}

      {/* --- FLOATING MODALS TRIGGERED FROM SEARCH RESULTS --- */}
      
      {/* 1. ARTICLE DETAIL MODAL */}
      <AnimatePresence>
        {selectedSearchArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="search-article-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col"
            >
              <div 
                className="p-8 text-white relative shrink-0"
                style={getArticleBgStyle(selectedSearchArticle.image)}
              >
                <button
                  onClick={() => setSelectedSearchArticle(null)}
                  className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-[10px] font-extrabold bg-emerald-400 text-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {selectedSearchArticle.isGlobal ? 'Actualité Générale' : 'Actualité Métier'}
                  </span>
                  <span className="text-xs font-mono text-white/80">
                    {new Date(selectedSearchArticle.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>

                <h1 className="font-display font-extrabold text-xl sm:text-2xl leading-normal">
                  {selectedSearchArticle.title}
                </h1>
              </div>

              <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
                <p className="text-sm font-semibold text-slate-705 italic border-l-4 border-emerald-400 pl-4 py-1 leading-relaxed">
                  {selectedSearchArticle.excerpt}
                </p>

                <div
                  className="rich-content text-sm text-slate-600 leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: selectedSearchArticle.content }}
                />

                <div className="border-t border-slate-100 pt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">Mots-clés :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSearchArticle.tags.map((tag, i) => (
                        <span key={i} className="text-[9px] font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-semibold uppercase">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedSearchArticle(null);
                    }}
                    className="text-xs font-bold text-slate-900 hover:text-emerald-600 flex items-center space-x-1 transition-colors p-2 rounded-lg bg-slate-50 border border-slate-200/80 cursor-pointer"
                  >
                    <span>Fermer la note</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. APPLICATION LAUNCH SIMULATION MODAL */}
      <AnimatePresence>
        {simulatedSearchApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="search-app-launch-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6"
            >
              <div className="flex items-center space-x-4">
                <div className="p-4 bg-emerald-400 text-slate-950 rounded-2xl shrink-0 shadow-inner">
                  <LucideIcon name={simulatedSearchApp.icon} size={28} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold text-slate-500 block w-fit">
                    Ouverture d'application EDG
                  </span>
                  <h3 className="font-display font-extrabold text-lg text-slate-950 mt-1">{simulatedSearchApp.name}</h3>
                </div>
              </div>

              <div className="space-y-3.5 bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-600 leading-relaxed">
                <p>
                  Vous lancez <strong>{simulatedSearchApp.name}</strong> ({simulatedSearchApp.category}).
                </p>
                <p>
                  {simulatedSearchApp.url.startsWith('#')
                    ? "Vous allez être redirigé vers l'espace correspondant de l'intranet."
                    : "L'outil s'ouvrira dans un nouvel onglet. Munissez-vous de vos identifiants professionnels EDG si l'application vous les demande à l'ouverture."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <span className="text-[10px] font-mono text-slate-400">Réf: EDG-APP-{simulatedSearchApp.id.toString().padStart(3, '0')}</span>
                <div className="flex space-x-2.5 self-end">
                  <button
                    onClick={() => setSimulatedSearchApp(null)}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-all cursor-pointer"
                  >
                    Fermer
                  </button>
                  <a
                    href={simulatedSearchApp.url}
                    target={simulatedSearchApp.url.startsWith('#') ? undefined : '_blank'}
                    rel="noreferrer"
                    onClick={() => setSimulatedSearchApp(null)}
                    className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-950 shrink-0 transition-all rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>Lancer l'application</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </header>
  );
}
