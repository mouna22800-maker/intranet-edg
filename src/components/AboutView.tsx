/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Department } from '../types';
import LucideIcon from './LucideIcon';
import { Target, Calendar, HelpCircle, History, Briefcase, Award, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';

interface AboutViewProps {
  department: Department;
}

interface InterventionArea {
  title: string;
  desc: string;
  icon: string;
}

// Generate premium domains of intervention based on department code dynamically
function getDomainsForDept(code: string): InterventionArea[] {
  const norm = code.toLowerCase().trim();
  if (norm === 'dsi') {
    return [
      { title: "Sûreté Logique & Cybersécurité", desc: "Supervision continue des pares-feux, chiffrement des VPN d'agences et audit des accès.", icon: "ShieldAlert" },
      { title: "Transformation Digitale & Cloud", desc: "Migration vers des architectures évolutives et hébergement sécurisé des services intranets.", icon: "Laptop" },
      { title: "Maintenance & Support Technique", desc: "Résolution des incidents informatiques et assistance helpdesk sous 4h de l'ensemble d'EDG SA.", icon: "Wrench" },
      { title: "Déploiement d'Applications Métiers", desc: "Développement d'outils de facturation clientèle et de plateformes collaboratives.", icon: "Cpu" }
    ];
  }
  if (norm === 'rh') {
    return [
      { title: "GPEC & Gestion des Carrières", desc: "Valorisation des compétences techniques des électriciens et planification des promotions.", icon: "Users" },
      { title: "Plan de Formation Continue", desc: "Développement de modules certifiants en partenariat avec des universités d'électricité.", icon: "GraduationCap" },
      { title: "Administration & Conformité Sociale", desc: "Suivi rigoureux des contrats, gestion transparente de la paie et des congés des agents.", icon: "FileText" },
      { title: "Dialogue Social & Bien-être", desc: "Préservation d'un climat serein et accompagnement prévoyance santé pour tout le personnel.", icon: "HeartHandshake" }
    ];
  }
  if (norm === 'finance') {
    return [
      { title: "Contrôle Obligataire & Budgétaire", desc: "Élaboration des budgets annuels et supervision méticuleuse des charges tri-directionnelles.", icon: "Database" },
      { title: "Trésorerie & Opérations de Change", desc: "Sécurisation de la solvabilité à court terme et suivi des mouvements interbancaires d'EDG.", icon: "TrendingUp" },
      { title: "Financements Stratégiques", desc: "Négociation avec les bailleurs de fonds internationaux pour l'installation d'équipements lourds.", icon: "Briefcase" },
      { title: "Audit de Conformité Fiscale", desc: "Vérification systématique de l'efficience locale de chaque franc guinéen investi.", icon: "Search" }
    ];
  }
  return [
    { title: "Planification Stratégique", desc: "Alignement des objectifs opérationnels avec le Schéma Directeur National de l'Électricité.", icon: "Target" },
    { title: "Modernisation des Processus", desc: "Amélioration des indicateurs de performance et facilitation des tâches des collaborateurs.", icon: "Sparkles" },
    { title: "Gestion de la Performance", desc: "Coordination active des flux métiers et reporting consolidé pour la Direction Générale.", icon: "TrendingUp" },
    { title: "Rapprochement Régional", desc: "Instruction continue et mise à niveau des délégations provinciales et d'agences locales.", icon: "MapPin" }
  ];
}

// Custom written historical accounts based on foundation year
function getDeptHistoryNarrative(dept: Department): string {
  const code = dept.code.toUpperCase();
  return `Érigée en tant que structure stratégique lors des grandes réformes de l'Électricité de Guinée SA en ${dept.foundedYear}, la Direction ${dept.name} (${code}) a historiquement accompagné les mutations fondamentales de notre réseau d'énergie. Depuis plus de deux décennies, elle s'efforce de standardiser l'excellence opérationnelle et de doter nos collaborateurs d'outils à fort impact. À travers l'évolution constante de ses missions d'encadrement, sa trajectoire témoigne de son dévouement inébranlable pour la souveraineté technique de la Guinée.`;
}

export default function AboutView({ department }: AboutViewProps) {
  const domains = (department.domains && department.domains.length > 0)
    ? department.domains
    : getDomainsForDept(department.code);
  const historyText = department.historyText || getDeptHistoryNarrative(department);

  return (
    <div id="presentation-view-section" className="space-y-12 pb-16 font-sans">
      
      {/* Title Segment */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Présentation de la Direction {department.code.toUpperCase()}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Histoire, missions primaires et domaines d'exécution clés structurant l'activité de ce pôle.
        </p>
      </div>

      {/* Grid containing Sections */}
      <div className="space-y-10">
        
        {/* SECTION 1: Qui sommes-nous ? */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/45 dark:bg-[#0c0c0e] border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm"
          id="who-are-we-section"
        >
          <div className="flex items-center space-x-3.5 pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0">
              <HelpCircle size={22} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-950 dark:text-white">Qui sommes-nous ?</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">Identité & Mission globale de la Direction</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-8 space-y-4">
              <p className="text-sm text-slate-750 dark:text-slate-200 leading-relaxed font-sans font-medium">
                {department.description}
              </p>
              <div className="flex items-center space-x-1.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-850 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                <span className="text-xs font-semibold">Garante de la devise : {department.valueKey || "Sûreté & Unité EDG"}</span>
              </div>
            </div>

            <div className="md:col-span-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
              <div className="text-center pb-2 border-b border-slate-200/50 dark:border-white/5">
                <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">Directeur responsable</p>
                <p className="text-sm font-black text-slate-900 dark:text-white font-display mt-0.5">{department.directorName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] text-slate-400 font-sans tracking-tight">Staff Actif</p>
                  <p className="font-extrabold text-[#048343] dark:text-[#048343] mt-0.5">{department.staffCount} agents</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] text-slate-400 font-sans tracking-tight">Création</p>
                  <p className="font-extrabold text-[#048343] dark:text-[#048343] mt-0.5">{department.foundedYear}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* SECTION 2: Historique de la Direction */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/45 dark:bg-[#0c0c0e] border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm"
          id="history-narrative-section"
        >
          <div className="flex items-center space-x-3.5 pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 shrink-0">
              <History size={22} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-950 dark:text-white">Historique de la Direction</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">Ligne temporelle & Légitimité institutionnelle</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 leading-relaxed">
            <div className="p-4 bg-[#048343]/10 text-[#048343] dark:text-emerald-450 rounded-2xl border border-[#048343]/20 font-display font-black text-2xl sm:text-3xl tracking-tight shrink-0 flex flex-col items-center justify-center">
              <Calendar size={22} className="mb-1" />
              <span>{department.foundedYear}</span>
            </div>
            <div className="space-y-3.5">
              <div
                className="rich-content text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic font-medium space-y-1.5"
                dangerouslySetInnerHTML={{ __html: historyText }}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                De sa fondation primitive à son statut de pôle d'ingénierie moderne à Cité EDG (Conakry), la direction reste l'une des structures pionnières dans le maintien de notre souveraineté nationale guinéenne d'alimentation électrique.
              </p>
            </div>
          </div>
        </motion.section>

        {/* SECTION 3: Domaines d'intervention */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
          id="intervention-domains-segment"
        >
          <div className="border-b border-slate-100 dark:border-white/5 pb-2">
            <h3 className="text-xs uppercase font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 flex items-center space-x-2">
              <Briefcase size={15} />
              <span>Domaines d'intervention prioritaires</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {domains.map((dom, index) => (
              <div 
                key={index}
                className="bg-white/40 dark:bg-slate-900/40 border border-white/60 dark:border-white/10 rounded-2xl p-5 hover:bg-white/70 dark:hover:bg-slate-900/60 transition-all duration-300 flex items-start space-x-4 shadow-xs"
              >
                <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-white/5 rounded-xl shrink-0 text-emerald-500 dark:text-emerald-400 shadow-sm">
                  <LucideIcon name={dom.icon} size={18} />
                </div>
                <div className="min-w-0 space-y-1 text-left">
                  <h4 className="font-display font-extrabold text-sm text-slate-950 dark:text-white inline-flex items-center gap-1">
                    <span>{dom.title}</span>
                    <ArrowUpRight size={10} className="text-slate-400 invisible group-hover:visible" />
                  </h4>
                  <div
                    className="rich-content text-xs text-slate-500 dark:text-slate-400 leading-relaxed leading-normal"
                    dangerouslySetInnerHTML={{ __html: dom.desc }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

      </div>

    </div>
  );
}
