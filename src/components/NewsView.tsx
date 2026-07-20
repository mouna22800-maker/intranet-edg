import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Newspaper, Calendar, Share2, Check, ChevronRight, Search, Clock, Tag, Paperclip, Download } from 'lucide-react';
import { Department, Article } from '../types';
import { getDeptColorTheme } from './colorThemes';
import { getMediaBgStyle } from './imageStyle';

interface NewsViewProps {
  department: Department;
  localArticles: Article[];
}

// Estime le temps de lecture réel à partir du contenu HTML (moyenne de 200 mots/minute)
function estimateReadingMinutes(content: string): number {
  const plainText = content.replace(/<[^>]*>/g, ' ');
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

export default function NewsView({ department, localArticles }: NewsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copiedArticleId, setCopiedArticleId] = useState<number | null>(null);
  const [copiedModal, setCopiedModal] = useState(false);
  const theme = getDeptColorTheme(department.code);

  const filteredArticles = localArticles.filter(article => 
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id={`dept-news-${department.code}`} className="space-y-6 pb-16 font-sans">
      {/* Header section with description */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Newspaper className={`w-5 h-5 ${theme.textPrimary}`} />
            <h2 className="font-display font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">
              Actualités & Communiqués
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Retrouvez tous les communiqués officiels, notes de service et actualités exclusives de la direction {department.name}.
          </p>
        </div>

        {/* Premium search bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher une actualité..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-[#048343] dark:focus:border-emerald-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Articles Grid */}
      {filteredArticles.length === 0 ? (
        <div className="bg-white dark:bg-[#0c0c0e] border border-slate-200/60 dark:border-zinc-800 p-12 rounded-xl text-center space-y-3 shadow-sm">
          <Newspaper className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aucune publication trouvée</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
            {searchTerm ? "Modifiez vos critères de recherche ou essayez un mot-clé différent." : "Il n'y a pas encore d'articles publiés pour ce département."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredArticles.map((article) => (
            <motion.div
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`group p-5 border rounded-xl flex flex-col justify-between cursor-pointer items-stretch transition-all duration-300 ease-out bg-white dark:bg-[#0c0c0e] border-zinc-200/60 dark:border-zinc-800/80 hover:shadow-lg ${theme.cardGlow}`}
            >
              <div className="space-y-4">
                {/* Thumbnail Header */}
                <div className="w-full h-40 rounded-xl relative overflow-hidden shadow-inner border border-zinc-200/30 dark:border-white/5">
                  <div
                    className="absolute inset-0 transform-gpu transition-transform duration-[1200ms] ease-out group-hover:scale-110"
                    style={getMediaBgStyle(article.image)}
                  />
                  {/* Share button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const shareUrl = `${window.location.origin}${window.location.pathname}?dept=${department.code}&article=${article.id}`;
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        setCopiedArticleId(article.id);
                        setTimeout(() => setCopiedArticleId(null), 2000);
                      });
                    }}
                    className="absolute right-3 top-3 p-2 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all duration-200 cursor-pointer flex items-center justify-center border border-white/10 shadow-md z-10"
                    title="Copier le lien direct de l'article"
                  >
                    {copiedArticleId === article.id ? (
                      <div className="flex items-center space-x-1 px-1">
                        <Check size={12} className="text-emerald-400 animate-scale-up" />
                        <span className="text-[9px] font-mono text-emerald-400 font-bold">Copié</span>
                      </div>
                    ) : (
                      <Share2 size={12} />
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-[10px] text-slate-450 dark:text-slate-400 font-mono">
                    <Calendar size={12} />
                    <span>Publié le {new Date(article.createdAt).toLocaleDateString('fr-FR')}</span>
                    {article.files && article.files.length > 0 && (
                      <span className="flex items-center gap-0.5 text-slate-400" title={`${article.files.length} pièce(s) jointe(s)`}>
                        <Paperclip size={11} />
                        {article.files.length}
                      </span>
                    )}
                  </div>

                  <h4 className={`font-display font-black text-base transition-colors leading-snug text-slate-900 dark:text-white ${theme.textHover}`}>
                    {article.title}
                  </h4>

                  <p className="text-xs text-slate-550 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center space-x-1">
                  <Clock size={12} className="text-slate-400" />
                  <span className="text-[10px] text-slate-400 font-mono">Lecture : {estimateReadingMinutes(article.content)} min</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${theme.actionText}`}>
                  <span>Consulter l'article</span>
                  <ChevronRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modern AnimatePresence Modal for article reading */}
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
                className="p-8 text-white relative min-h-[200px] flex flex-col justify-end"
                style={getMediaBgStyle(selectedArticle.image)}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors cursor-pointer z-10"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                <div className="flex items-center space-x-2 mb-3 relative z-10">
                  <span className="text-[10px] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">
                    {department.code} INFOS
                  </span>
                  <span className="text-xs font-mono text-white/80">
                    {new Date(selectedArticle.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>

                <h1 className="font-display font-extrabold text-xl sm:text-2xl leading-normal relative z-10">
                  {selectedArticle.title}
                </h1>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8 space-y-5 overflow-y-auto bg-white dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 italic border-l-4 border-[#048343] pl-4 py-1 leading-relaxed">
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
                      <span key={index} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md flex items-center gap-1">
                        <Tag size={10} />
                        {tag}
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
                          <span className="text-emerald-500 font-bold">Lien copié !</span>
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
                      className="px-5 py-2 text-xs font-bold tracking-wide rounded-lg bg-[#048343] hover:bg-[#108548] text-white transition-colors cursor-pointer"
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
