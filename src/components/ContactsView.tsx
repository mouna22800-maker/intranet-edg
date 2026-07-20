import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, User2, MessageSquare, Send, ArrowRight } from 'lucide-react';
import { Department } from '../types';
import { getDeptColorTheme } from './colorThemes';

interface ContactsViewProps {
  department: Department;
}

export default function ContactsView({ department }: ContactsViewProps) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const theme = getDeptColorTheme(department.code);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/departments/${department.id}/contacts`)
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'success' && Array.isArray(data.data)) {
          setContacts(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur de récupération des contacts:", err);
        setLoading(false);
      });
  }, [department.id]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div id={`dept-contacts-${department.code}`} className="space-y-6 pb-16 font-sans">

      {/* Header card with information */}
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg ${theme.iconBg} ${theme.textPrimary}`}>
            <Mail className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h2 className="font-display font-black text-xl text-slate-900 dark:text-white uppercase tracking-tight">
              Contact & Destinataires Directs
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Canaux de communication directs avec les services, gestionnaires de la direction {department.name}.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Direct Recipient Cards list */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border-b border-slate-150 dark:border-white/5 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">
              Points de contact officiels ({contacts.length})
            </h3>
          </div>

          {loading ? (
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-8 rounded-xl text-center shadow-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#048343] mx-auto"></div>
              <p className="text-xs font-mono text-slate-400 mt-3">Récupération des destinataires...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 p-8 rounded-xl text-center shadow-sm">
              <Mail className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-medium text-slate-500 italic">
                Aucun contact direct n'est actuellement listé pour ce département. Utilisez le bouton « Écrire à cette direction ».
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {contacts.map((rec: any, idx: number) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -2 }}
                  className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-display font-black text-sm uppercase tracking-tight">
                        <User2 size={15} className={theme.textPrimary} />
                        <span>{rec.raison || "Point de contact officiel"}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal italic font-medium">
                        Service lié à l'unité opérationnelle d'EDG.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md shrink-0 uppercase">
                      ID: #{rec.recipient_id}
                    </span>
                  </div>

                  {/* Contact channels */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-100 dark:border-white/5 pt-3">
                    <div
                      onClick={() => handleCopy(rec.email)}
                      className="p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-150 dark:border-zinc-800/40 rounded-lg flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Mail size={14} className="text-slate-400 shrink-0 group-hover:text-emerald-500 transition-colors" />
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">{rec.email}</span>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition-all ml-1 whitespace-nowrap shrink-0">
                        {copiedText === rec.email ? 'Copié' : 'Copier'}
                      </span>
                    </div>

                    {rec.numero && (
                      <div
                        onClick={() => handleCopy(rec.numero)}
                        className="p-3 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-150 dark:border-zinc-800/40 rounded-lg flex items-center justify-between cursor-pointer group transition-all"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Phone size={14} className="text-slate-400 shrink-0 group-hover:text-emerald-500 transition-colors" />
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">{rec.numero}</span>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition-all ml-1 whitespace-nowrap shrink-0">
                          {copiedText === rec.numero ? 'Copié' : 'Copier'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Associated Contacts list */}
                  {rec.associated_contacts && rec.associated_contacts.length > 0 && (
                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 space-y-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Lignes complémentaires</span>
                      {rec.associated_contacts.map((subC: any, subIdx: number) => (
                        <div key={subIdx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 p-2 rounded-lg bg-slate-50/50 dark:bg-zinc-900/20 border border-slate-100 dark:border-white/5">
                          <span className="truncate">{subC.email}</span>
                          <span className="shrink-0 text-slate-400 dark:text-slate-500">{subC.numero}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: actions vers le guichet unique (plus de formulaire en double) */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <MessageSquare className={`w-4 h-4 ${theme.textPrimary}`} />
                <h3 className="font-display font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
                  Contacter cette direction
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Une question, une demande ou un incident concernant la direction {department.name} ? Tout passe par le
                <strong> guichet unique</strong> : votre demande est enregistrée, aiguillée automatiquement, et vous recevez un
                numéro de suivi.
              </p>
            </div>

            <button
              type="button"
              onClick={() => { window.location.hash = `#ticket/dir/${department.code}`; }}
              className="w-full py-2.5 bg-[#048343] hover:bg-[#108548] text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
            >
              <Send size={13} />
              <span>Écrire à cette direction</span>
            </button>

            <button
              type="button"
              onClick={() => { window.location.hash = '#ticket/track'; }}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer border border-slate-200 dark:border-white/5"
            >
              <span>Suivre ma demande</span>
              <ArrowRight size={13} />
            </button>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal pt-1 border-t border-slate-100 dark:border-white/5">
              Pour un contact hors application, utilisez les coordonnées directes des services ci-contre.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
