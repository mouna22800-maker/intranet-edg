/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, FileText, Download, Folder, ArrowLeft } from 'lucide-react';

interface GedDoc {
  id: number;
  title: string;
  category: string;
  dept: string;
  author: string;
  date: string;
  size: string;
  fileUrl: string;
}

interface DocumentsViewProps {
  onNavigateBack?: () => void;
  /** Si fourni, n'affiche que les documents de cette direction (bibliothèque intégrée à un espace direction). */
  departmentId?: number;
  departmentName?: string;
}

export default function DocumentsView({ onNavigateBack, departmentId, departmentName }: DocumentsViewProps) {
  const [gedDocs, setGedDocs] = useState<GedDoc[]>([]);
  const [gedFilterCategory, setGedFilterCategory] = useState('Tous');
  const [gedSearchQuery, setGedSearchQuery] = useState('');
  const [gedLoading, setGedLoading] = useState(true);

  const formatGedFileSize = (bytes: number) => {
    if (!bytes) return '0 Ko';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  useEffect(() => {
    setGedLoading(true);
    // En contexte direction, on ne charge QUE ses documents (paramètre department_id de l'API).
    const url = departmentId != null ? `/api/documents?department_id=${departmentId}` : '/api/documents';
    fetch(url)
      .then(res => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setGedDocs(data.map(d => ({
            id: d.id,
            title: d.title,
            category: d.category,
            dept: d.departmentLabel || 'Transverse',
            author: d.author || '',
            date: new Date(d.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
            size: formatGedFileSize(d.fileSize),
            fileUrl: d.fileUrl
          })));
        }
        setGedLoading(false);
      })
      .catch(() => setGedLoading(false));
  }, [departmentId]);

  const filteredGedDocs = gedDocs.filter(doc => {
    const matchesCategory = gedFilterCategory === 'Tous' || doc.category === gedFilterCategory;
    const matchesKeyword = doc.title.toLowerCase().includes(gedSearchQuery.toLowerCase()) ||
                           doc.dept.toLowerCase().includes(gedSearchQuery.toLowerCase()) ||
                           doc.author.toLowerCase().includes(gedSearchQuery.toLowerCase());
    return matchesCategory && matchesKeyword;
  });

  return (
    <div className="space-y-6 pb-16 font-sans">
      {onNavigateBack && (
        <button onClick={onNavigateBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer">
          <ArrowLeft size={14} /> Retour à l'accueil
        </button>
      )}

      {/* Page header */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="p-2.5 rounded-xl bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400">
          <Folder size={20} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {departmentId != null ? 'Bibliothèque de la direction' : 'Bibliothèque de Documents (G.E.D.)'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {departmentId != null
              ? `Notes de service, directives, modèles et formulaires propres à ${departmentName || 'cette direction'}.`
              : "Notes de service, directives, modèles officiels et formulaires téléchargeables de l'Électricité de Guinée."}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={14} />
          <input
            type="text"
            value={gedSearchQuery}
            onChange={(e) => setGedSearchQuery(e.target.value)}
            placeholder="Filtre par titre, référent ou direction..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl text-xs placeholder-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {['Tous', 'Note de service', 'Directive', 'Modèle officiel', 'Formulaire'].map((cat) => (
            <button
              key={cat}
              onClick={() => setGedFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                gedFilterCategory === cat
                  ? 'bg-[#048343] text-white border-transparent shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {gedLoading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#048343] mx-auto"></div>
            <p className="text-xs font-mono mt-3">Chargement de la bibliothèque...</p>
          </div>
        ) : filteredGedDocs.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-slate-500">
            Aucun document GED répertorié pour cette catégorie d'archives.
          </div>
        ) : (
          filteredGedDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 bg-white/50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl hover:border-[#048343] dark:hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-[#048343]/10 text-[#048343] rounded-xl shrink-0 mt-0.5">
                  <FileText size={16} fill="currentColor" />
                </div>
                <div className="min-w-0">
                  <span className={`text-[8.5px] border font-black uppercase px-2 py-0.5 rounded font-mono ${
                    doc.category === 'Note de service'
                      ? 'bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30'
                      : doc.category === 'Directive'
                      ? 'bg-blue-50 text-blue-800 border-blue-105 dark:bg-blue-950/40 dark:text-blue-400'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-110 dark:bg-emerald-950/40 dark:text-emerald-400'
                  }`}>
                    {doc.category}
                  </span>
                  <h4 className="text-xs font-black text-slate-805 dark:text-white mt-1.5 leading-snug">{doc.title}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {doc.author && <>Publié par <span className="font-bold">{doc.author}</span> ({doc.dept}) • </>}
                    Date : {doc.date}
                  </p>
                </div>
              </div>

              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3.5 py-2 hover:bg-[#048343] dark:hover:bg-emerald-600 hover:text-white bg-white dark:bg-slate-850 text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer flex items-center space-x-1.5 transition-all shadow-sm shrink-0"
              >
                <Download size={12} />
                <span>Télécharger ({doc.size})</span>
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
