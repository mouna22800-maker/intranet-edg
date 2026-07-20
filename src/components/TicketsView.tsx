/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Department, Ticket } from '../types';
import LucideIcon from './LucideIcon';
import { AlertCircle, CheckCircle2, Send, HelpCircle, ShieldAlert, PhoneCall, Search, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfettiBurst from './ConfettiBurst';

interface TicketsViewProps {
  department?: Department | null;
  departments: Department[];
  onNavigateBack?: () => void;
}

export default function TicketsView({ department, departments, onNavigateBack }: TicketsViewProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<number>(() => {
    if (department) return department.id;
    // Direction passée dans l'URL depuis la page Contact d'une direction (#ticket/dir/<code>)
    if (typeof window !== 'undefined') {
      const segs = window.location.hash.slice(1).split('/');
      if (segs[1] === 'dir' && segs[2] && departments) {
        const d = departments.find(x => x.code === segs[2]);
        if (d) return d.id;
      }
    }
    // Default to the first department if none is active (often Achats / DSI)
    return departments && departments.length > 0 ? departments[0].id : 1;
  });
  const [formType, setFormType] = useState<'contact' | 'incident'>('incident');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'Faible' | 'Moyenne' | 'Haute'>('Moyenne');
  const [successToast, setSuccessToast] = useState<{ show: boolean; msg: string; id: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Suivi en libre-service d'une demande déjà soumise (par email ou par identifiant de ticket) ---
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<Ticket[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackSearched, setTrackSearched] = useState(false);

  // Mode d'affichage : déposer une nouvelle demande OU suivre une demande existante (sans réécrire de message).
  // On ouvre directement sur le suivi si l'URL le demande (#ticket/track), ex. depuis la page Contact.
  const [mode, setMode] = useState<'submit' | 'track'>(
    () => (typeof window !== 'undefined' && window.location.hash.includes('/track')) ? 'track' : 'submit'
  );

  // Micro-célébration : incrémenté à chaque soumission réussie pour déclencher une salve de confettis.
  const [confettiFire, setConfettiFire] = useState(0);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = trackQuery.trim();
    setTrackError(null);
    if (!q) {
      setTrackError("Veuillez saisir votre email ou l'identifiant de votre ticket (ex: EDG-CON-3C06E1).");
      return;
    }
    setTrackLoading(true);
    try {
      const isEmail = q.includes('@');
      const param = isEmail ? `email=${encodeURIComponent(q)}` : `ticket_id=${encodeURIComponent(q)}`;
      const res = await fetch(`/api/tickets/track?${param}`);
      if (res.ok) {
        const data = await res.json();
        setTrackResults(Array.isArray(data) ? data : []);
        setTrackSearched(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        setTrackError(errData.detail || 'Erreur lors de la recherche.');
      }
    } catch (err) {
      setTrackError('Erreur réseau : impossible de contacter le serveur.');
    } finally {
      setTrackLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setFormError(null);

    // Dynamic field presence validation
    if (!senderName.trim()) {
      setFormError("Le nom et prénom sont obligatoires.");
      return;
    }

    if (!senderEmail.trim()) {
      setEmailError("L'adresse e-mail est requise.");
      return;
    }

    // Email validation using a robust standard regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail.trim())) {
      setEmailError("Le format de l'e-mail est invalide (ex: collaborateur@edg.com.gn).");
      return;
    }

    if (!subject.trim()) {
      setFormError("L'objet de la demande est requis.");
      return;
    }

    if (!message.trim()) {
      setFormError("La description détaillée ne peut pas être vide.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          subject: subject.trim(),
          message: message.trim(),
          departmentId: selectedDeptId,
          priority: formType === 'incident' ? priority : undefined
        })
      });

      if (!res.ok) {
        throw new Error('La requête a échoué');
      }

      const savedTicket: Ticket = await res.json();

      const targetDept = departments.find(d => d.id === selectedDeptId);
      const targetName = targetDept ? targetDept.code.toUpperCase() : "EDG";

      // Trigger feedback Toast
      setSuccessToast({
        show: true,
        msg: formType === 'incident'
          ? `Votre signalement d'incident a été consigné avec succès et assigné à la direction ${targetName}.`
          : `Votre demande de contact a été transmise au secrétariat de la direction ${targetName}.`,
        id: savedTicket.id
      });

      // 🎉 Micro-célébration
      setConfettiFire((k) => k + 1);

      // Reset Form Fields
      setSubject('');
      setMessage('');

      // Clear toast after 8 seconds for better readability
      setTimeout(() => {
        setSuccessToast(null);
      }, 8000);
    } catch (err) {
      setFormError("Erreur réseau : le ticket n'a pas pu être enregistré. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'Haute': return 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30';
      case 'Moyenne': return 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Résolu': return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-950/50';
      case 'En cours': return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-350 border border-slate-200 dark:border-slate-700/50';
    }
  };

  const targetDept = departments.find(d => d.id === selectedDeptId);

  return (
    <div id="tickets-view-container" className="space-y-12 pb-16 relative">

      {/* 🎉 Confettis à la soumission réussie */}
      <ConfettiBurst fire={confettiFire} />

      {/* Page header */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Guichet Unique de Signalement & Assistance
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Déposez une alerte technique urgente d'exploitation (réseau, coupure, cyber) ou contactez directement l'une des directions de l'Électricité de Guinée.
        </p>
      </div>

      {/* Floating Success Notification Toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, x: 50, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-6 right-6 z-[9999] max-w-md w-full bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md text-slate-100 rounded-2xl shadow-2xl border border-white/10 p-5 flex items-start space-x-4 overflow-hidden"
            id="success-toast-floating"
          >
            {/* Countdown progress bar at bottom */}
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 6, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-1 bg-emerald-500"
            />

            <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl shrink-0 shadow-sm mt-0.5 animate-bounce">
              <CheckCircle2 size={18} />
            </div>

            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center justify-between">
                <p className="font-display font-extrabold text-[10px] text-emerald-400 tracking-wide uppercase">
                  Fiche Validée !
                </p>
                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {successToast.id}
                </span>
              </div>
              <h4 className="font-display font-extrabold text-sm text-white mt-1">
                Soumission réussie
              </h4>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
                {successToast.msg} Les techniciens de permanence de la direction <strong>{targetDept ? targetDept.name : "sélectionnée"}</strong> en ont été informés.
              </p>
              <p className="text-[11px] text-emerald-300 mt-1.5 leading-relaxed font-sans">
                Conservez l'identifiant <strong className="font-mono">{successToast.id}</strong> : il vous permet de suivre votre demande dans « Suivre ma demande » ci-contre.
              </p>
            </div>

            <button
              onClick={() => setSuccessToast(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-lg transition-all"
              title="Fermer la notification"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sélecteur de mode : Déposer une demande / Suivre ma demande (accès direct au suivi) */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100/80 dark:bg-slate-850/65 backdrop-blur-xs rounded-xl p-1 border border-slate-200/40 dark:border-white/5">
          <button
            type="button"
            onClick={() => setMode('submit')}
            className={`flex items-center justify-center space-x-1.5 text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer ${
              mode === 'submit'
                ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Send size={14} />
            <span>Déposer une demande</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('track')}
            className={`flex items-center justify-center space-x-1.5 text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer ${
              mode === 'track'
                ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Search size={14} />
            <span>Suivre ma demande</span>
          </button>
        </div>
      </div>

      {/* Grid: Form and Live Tracking (une seule section visible selon le mode choisi) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Column: Interactive Submission Form */}
        <div className={`${mode === 'submit' ? '' : 'hidden'} lg:col-span-12 max-w-2xl w-full mx-auto bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl`}>
          
          {/* Form Switch tabs */}
          <div className="flex bg-slate-100/80 dark:bg-slate-850/65 backdrop-blur-xs rounded-xl p-1 border border-slate-200/40 dark:border-white/5">
            <button
              type="button"
              onClick={() => { 
                setFormType('incident'); 
                setSubject(''); 
                setMessage(''); 
                setEmailError(null);
                setFormError(null);
              }}
              className={`flex-1 flex items-center justify-center space-x-1.5 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer ${
                formType === 'incident' 
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert size={14} />
              <span>Incident</span>
            </button>
            <button
              type="button"
              onClick={() => { 
                setFormType('contact'); 
                setSubject(''); 
                setMessage(''); 
                setEmailError(null);
                setFormError(null);
              }}
              className={`flex-1 flex items-center justify-center space-x-1.5 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer ${
                formType === 'contact' 
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <PhoneCall size={14} />
              <span>Contact</span>
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="font-display font-extrabold text-sm text-slate-950 dark:text-white">
              {formType === 'incident' ? "Signaler une anomalie d'exploitation" : "Écrire au secrétariat"}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {formType === 'incident' 
                ? "Concerne les doutes cyber/phishing, bris de ligne de distribution ou surcharge de sous-stations."
                : "Demandes d'informations, modèles de documents ou clarification de procédures de carrières."}
            </p>
          </div>

          {/* Form tag */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs font-sans">
            
            <AnimatePresence>
              {formError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 rounded-xl flex items-start space-x-2 text-[11px] font-sans overflow-hidden animate-pulse"
                >
                  <AlertCircle size={14} className="shrink-0 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-red-950 dark:text-red-300">Champs requis manquants</p>
                    <p className="text-red-700 dark:text-red-400 font-medium leading-normal mt-0.5">{formError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label htmlFor="ticket-sender-name" className="text-slate-700 dark:text-slate-350 font-semibold block">Votre nom & prénom *</label>
              <input
                id="ticket-sender-name"
                type="text"
                required
                placeholder="Ex: Diallo Mamadou"
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-205 dark:border-white/10 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900/80 transition-all font-sans text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ticket-sender-email" className="text-slate-700 dark:text-slate-350 font-semibold block">Adresse courriel de contact *</label>
              <input
                id="ticket-sender-email"
                type="text"
                required
                placeholder="nom@edg.com.gn"
                value={senderEmail}
                onChange={(e) => {
                  setSenderEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                className={`w-full p-2.5 bg-slate-55/70 dark:bg-slate-950/40 border rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:bg-white dark:focus:bg-slate-900/80 transition-all duration-150 text-slate-800 dark:text-slate-101 ${
                  emailError 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/10' 
                    : 'border-slate-205 dark:border-white/10 focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-emerald-400 dark:focus:ring-emerald-505'
                }`}
              />
              <AnimatePresence>
                {emailError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[11px] text-red-600 font-semibold flex items-center space-x-1.5 mt-1 pl-1"
                  >
                    <AlertCircle size={12} className="shrink-0 text-red-500 animate-pulse" />
                    <span>{emailError}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Dynamic Directions choose dropdown list */}
            <div className="space-y-1.5 font-sans">
              <label htmlFor="ticket-target-dept" className="text-slate-700 dark:text-slate-350 font-bold block">Direction concernée *</label>
              <select
                id="ticket-target-dept"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-205 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:border-emerald-500 dark:focus:border-[#4ade80] focus:bg-white dark:focus:bg-slate-900/80 transition-all font-semibold font-sans text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                {departments && departments.map((dept) => (
                  <option key={dept.id} value={dept.id} className="text-slate-900 bg-white">
                    {dept.code.toUpperCase()} — {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* If incident, show priorities selection */}
            {formType === 'incident' && (
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-350 font-semibold block">Niveau d'Urgence / Gravité</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Faible', 'Moyenne', 'Haute'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all font-extrabold ${
                        priority === lvl
                          ? lvl === 'Haute' 
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-900/50 text-red-700 dark:text-red-400 font-black' 
                            : lvl === 'Moyenne' 
                            ? 'bg-amber-50 dark:bg-amber-955/20 border-amber-400 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 font-black' 
                            : 'bg-slate-100 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                          : 'bg-white/50 dark:bg-slate-900/35 border-slate-202 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="ticket-subject" className="text-slate-700 dark:text-slate-350 font-semibold block">Objet de la demande *</label>
              <input
                id="ticket-subject"
                type="text"
                required
                placeholder="Saisissez un titre synthétique..."
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full p-2.5 bg-slate-55/70 dark:bg-slate-950/40 border border-slate-205 dark:border-white/10 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-505 focus:bg-white dark:focus:bg-slate-900/80 transition-all text-slate-800 dark:text-slate-102"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ticket-message" className="text-slate-700 dark:text-slate-350 font-semibold block">Description détaillée *</label>
              <textarea
                id="ticket-message"
                required
                rows={4}
                placeholder="Décrivez avec minutie les détails de l'incident, la géo-localisation de l'avarie ou votre question administrative..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full p-2.5 bg-slate-55/70 dark:bg-slate-950/40 border border-slate-205 dark:border-white/10 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-505 focus:bg-white dark:focus:bg-slate-900/80 resize-none transition-all text-slate-800 dark:text-slate-103"
              />
            </div>

            {/* Note stating targeted direction */}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal bg-slate-50/70 dark:bg-slate-950/20 border border-slate-100 dark:border-white/5 rounded-xl p-3">
              * Ce ticket sera enregistré et assigné automatiquement à la cellule d’assistance de la <strong>{targetDept ? targetDept.name : "direction sélectionnée"}</strong>.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`btn-premium btn-premium-green w-full py-3.5 text-xs font-bold flex items-center justify-center space-x-1.5 tracking-wider uppercase cursor-pointer transition-all select-none ${
                isSubmitting ? 'opacity-80 cursor-wait bg-emerald-600' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0"></span>
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Consigner le ticket</span>
                </>
              )}
            </button>

          </form>

        </div>

        {/* Right Column: Self-service tracking of already-submitted requests */}
        <div className={`${mode === 'track' ? '' : 'hidden'} lg:col-span-12 max-w-3xl w-full mx-auto space-y-4`}>
          <div className="border-b border-slate-200 dark:border-white/10 pb-3">
            <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
              Suivre ma demande
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Retrouvez le statut de vos signalements et demandes déjà envoyés grâce à votre adresse email ou à l'identifiant reçu à la soumission (ex: EDG-CON-3C06E1).
            </p>
          </div>

          {/* Champ de recherche */}
          <form onSubmit={handleTrack} className="relative">
            <input
              type="text"
              placeholder="Votre email ou l'identifiant de votre ticket..."
              value={trackQuery}
              onChange={(e) => { setTrackQuery(e.target.value); if (trackError) setTrackError(null); }}
              className="w-full pl-9 pr-24 py-2.5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xs border border-slate-202 dark:border-white/10 rounded-xl text-xs placeholder-slate-400 dark:placeholder-slate-500 text-slate-803 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 dark:focus:ring-emerald-500 transition-all font-sans"
              id="ticket-track-input"
            />
            <div className="absolute left-3 top-3 text-slate-400">
              <Search size={14} />
            </div>
            <button
              type="submit"
              disabled={trackLoading}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#048343] hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer disabled:opacity-60 flex items-center"
            >
              {trackLoading ? 'Recherche...' : 'Rechercher'}
            </button>
          </form>

          <AnimatePresence>
            {trackError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl flex items-start space-x-2 text-[11px] font-sans overflow-hidden"
              >
                <AlertCircle size={14} className="shrink-0 text-red-500 mt-0.5" />
                <span className="font-semibold">{trackError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            {trackResults.length > 0 ? (
              trackResults.map((t) => (
                <div
                  key={t.id}
                  className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-2xl p-5 space-y-3"
                >
                  {/* Header card info */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 font-sans">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        {t.id}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                        t.type === 'incident'
                          ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
                          : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
                      }`}>
                        {t.type === 'incident' ? 'INCIDENT' : 'CONTACT'}
                      </span>
                      {(() => {
                        const ticketDept = departments && departments.find(d => d.id === t.departmentId);
                        if (!ticketDept) return null;
                        return (
                          <span
                            title={ticketDept.name}
                            className="text-[9px] font-extrabold px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-705"
                          >
                            {ticketDept.code.toUpperCase()}
                          </span>
                        );
                      })()}
                      {t.priority && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${getPriorityColor(t.priority)}`}>
                          {t.priority}
                        </span>
                      )}
                    </div>

                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${getStatusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </div>

                  {/* Sender metadata info */}
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex flex-wrap items-center gap-1 sm:gap-2">
                    <Clock size={11} className="shrink-0" />
                    <span>{new Date(t.createdAt).toLocaleDateString('fr-FR')} {new Date(t.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>

                  {/* Substantive content */}
                  <div className="space-y-1.5 bg-slate-50/60 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-white/5 transition-colors">
                    <h4 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">{t.subject}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">{t.message}</p>
                  </div>

                  {t.status === 'Résolu' && (
                    <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>Cette demande a été traitée.</span>
                    </div>
                  )}
                </div>
              ))
            ) : trackSearched ? (
              <div className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-8 text-center space-y-3 shadow-lg">
                <HelpCircle className="mx-auto text-slate-400 dark:text-slate-500" size={28} />
                <div className="space-y-1">
                  <p className="font-display font-extrabold text-sm text-slate-800 dark:text-white">Aucune demande trouvée</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Vérifiez l'orthographe de votre email ou l'identifiant exact de votre ticket, tel qu'indiqué lors de sa soumission.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-8 text-center space-y-2 shadow-lg">
                <Search className="mx-auto text-slate-300 dark:text-slate-600" size={26} />
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Saisissez votre email ou l'identifiant de votre ticket ci-dessus pour consulter son statut de traitement.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
