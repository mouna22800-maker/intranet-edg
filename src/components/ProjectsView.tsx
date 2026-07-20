import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Briefcase, Calendar, Search, Filter, TrendingUp, CheckCircle, Clock, FileText } from 'lucide-react';
import { Department } from '../types';
import { getDeptColorTheme } from './colorThemes';
import { getMediaBgStyle } from './imageStyle';

interface ProjectsViewProps {
  department: Department;
}

export default function ProjectsView({ department }: ProjectsViewProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'En cours' | 'Terminé'>('all');
  const theme = getDeptColorTheme(department.code);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/departments/${department.id}/projects`)
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'success' && Array.isArray(data.data)) {
          setProjects(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur de récupération des projets:", err);
        setLoading(false);
      });
  }, [department.id]);

  // Calculations for stats
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.niveau === 'Terminé').length;
  const ongoingProjects = projects.filter(p => p.niveau === 'En cours').length;

  const filteredProjects = projects.filter(proj => {
    const matchesSearch = 
      proj.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proj.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (proj.type_label || proj.type || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || proj.niveau === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div id={`dept-projects-${department.code}`} className="space-y-6 pb-16 font-sans">
      
      {/* 1. Statistics Cards Block */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
            <Briefcase size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Projets Totaux</span>
            <span className="text-xl font-display font-black text-slate-900 dark:text-white leading-none">
              {loading ? '...' : totalProjects}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Projets Terminés</span>
            <span className="text-xl font-display font-black text-slate-900 dark:text-white leading-none">
              {loading ? '...' : completedProjects}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-5 rounded-xl shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">En Cours</span>
            <span className="text-xl font-display font-black text-slate-900 dark:text-white leading-none animate-pulse">
              {loading ? '...' : ongoingProjects}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Status buttons */}
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#048343] text-white'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tous les projets
          </button>
          <button
            onClick={() => setStatusFilter('En cours')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'En cours'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            En cours
          </button>
          <button
            onClick={() => setStatusFilter('Terminé')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'Terminé'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Terminé
          </button>
        </div>

        {/* Premium search bar */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un projet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-[#048343] dark:focus:border-emerald-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 3. Projects List or Cards Grid */}
      {loading ? (
        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-12 rounded-xl text-center shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#048343] mx-auto"></div>
          <p className="text-xs font-mono text-slate-400 mt-4">Chargement des données de projets de la direction...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-12 rounded-xl text-center space-y-3 shadow-sm">
          <Briefcase className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aucun projet répertorié</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'all' 
              ? "Essayez d'ajuster vos filtres de recherche pour afficher d'autres projets." 
              : "Il n'y a actuellement aucun projet stratégique listé pour ce département."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredProjects.map((proj: any) => (
            <motion.div
              key={proj.id}
              whileHover={{ y: -2, scale: 1.005 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between transition-all"
            >
              {proj.image && (
                <div className="w-full h-44 sm:h-56" style={getMediaBgStyle(proj.image)} />
              )}
              <div className="p-6 sm:p-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                      {proj.type_label || proj.type || "Projet"}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md ${
                      proj.niveau === 'Terminé' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      proj.niveau === 'En cours' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse' :
                      'bg-slate-450/10 text-slate-500'
                    }`}>
                      {proj.niveau}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-400">
                    <Calendar size={13} />
                    <span>{proj.date_debut} — {proj.date_fin}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-display font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                    {proj.label}
                  </h4>
                  <div
                    className="rich-content text-xs sm:text-sm text-slate-600 dark:text-slate-350 leading-relaxed font-sans whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: proj.description }}
                  />
                </div>
              </div>

              {/* Real Project metadata footer */}
              <div className="px-6 sm:px-8 py-3.5 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="flex items-center space-x-2 text-slate-400">
                  <TrendingUp size={14} className={theme.textPrimary} />
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-450">Objectif Stratégique lié</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#048343] dark:text-emerald-400">
                  <FileText size={13} />
                  <span className="text-[10px] font-mono">ID Projet: #{proj.id}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
