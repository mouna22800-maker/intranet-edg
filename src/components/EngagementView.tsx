/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Department } from '../types';
import { ShieldCheck, Award, TrendingUp, Sparkles, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface EngagementViewProps {
  department: Department;
}

interface Commitment {
  title: string;
  metric: string;
  description: string;
  objective: string;
}

function getCommitmentsForDept(code: string): Commitment[] {
  const norm = code.toLowerCase().trim();
  switch (norm) {
    case 'dsi':
      return [
        { title: "Disponibilité de l'Intranet", metric: "99.9%", description: "Assurer l’accès ininterrompu des collaborateurs aux outils collaboratifs et applications.", objective: "Continuité de production" },
        { title: "Résolution des incidents (Helpdesk)", metric: "< 4h", description: "Prise en charge et correction sous 4 heures de tout incident d'accès logique clé.", objective: "Efficacité réseau" },
        { title: "Audits de sécurité", metric: "Mensuel", description: "Contrôles systématiques des correctifs OS et tests de pénétration des pare-feux.", objective: "Zéro intrusion" }
      ];
    case 'rh':
      return [
        { title: "Traitement de la paie", metric: "100%", description: "Garantir un virement transparent et sans écart de l'ensemble des agents avant le 28 du mois.", objective: "Garantie sociale" },
        { title: "Délai de formation continue", metric: "Annuel", description: "S'assurer que chaque agent technique d'EDG bénéficie d'une mise à niveau sécurité.", objective: "Développement" },
        { title: "Suivi médical & Prévoyance", metric: "Actif", description: "Couverture santé active et audits réguliers de sécurité sur le terrain opérationnel.", objective: "Hygiène & Sécurité" }
      ];
    case 'finance':
      return [
        { title: "Rapprochement des comptes", metric: "Quotidien", description: "Régularisation stricte de l’ensemble des mouvements interbancaires d'EDG.", objective: "Transparence" },
        { title: "Déclenchement budgétaire", metric: "< 5 jours", description: "Traitement et accord de décaissement logistique pour les urgences réseau.", objective: "Liquidité" },
        { title: "Indice d'efficience fiscale", metric: "1.0", description: "Optimiser le ratio d’exploitation fiscale pour chaque milliard engagé d'énergie.", objective: "Rendement" }
      ];
    case 'distribution':
      return [
        { title: "Temps de rétablissement (MTTR)", metric: "< 2.5h", description: "Intervention rapide des équipes d'exploitation suite à un incident Basse Tension.", objective: "Sûreté locale" },
        { title: "Équilibre de phase urbain", metric: "98.5%", description: "Stabilisation des équilibres de charge pour soulager les transformateurs.", objective: "Qualité d'énergie" },
        { title: "Conformité de raccordement", metric: "100%", description: "Inspections techniques obligatoires de toute nouvelle ligne avant mise en service.", objective: "Protection physique" }
      ];
    default:
      return [
        { title: "Taux de disponibilité active", metric: "99.5%", description: "Assurer la disponibilité permanente des services opérationnels de la direction.", objective: "Excellence" },
        { title: "Délai de traitement de dossier", metric: "48 Heures", description: "Toutes les requêtes de service ou correspondances hiérarchiques traitées et actées.", objective: "Rigueur" },
        { title: "Respect du cadre réglementaire", metric: "100%", description: "Ajustement continu de toutes les décisions selon les chartes de déontologie d'EDG.", objective: "Intégrité" }
      ];
  }
}

export default function EngagementView({ department }: EngagementViewProps) {
  const commitments = (department.commitments && department.commitments.length > 0)
    ? department.commitments
    : getCommitmentsForDept(department.code);

  return (
    <div id="engagement-view-section" className="space-y-12 pb-16 font-sans">
      
      {/* Title Segment */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Nos Engagements de Service ({department.code.toUpperCase()})
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Notre charte de responsabilité professionnelle, indicateurs de qualité et accords de services opérationnels.
        </p>
      </div>

      {/* Intro Charter */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-gradient-to-r from-emerald-500/10 via-emerald-650/5 to-transparent border border-emerald-500/20 dark:border-emerald-550/15 rounded-3xl space-y-4"
      >
        <div className="flex items-center space-x-3 text-[#048343] dark:text-emerald-400 font-extrabold text-sm uppercase tracking-wider font-mono">
          <ShieldCheck size={18} />
          <span>Charte de Qualité et Performance Clé</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
          Chaque agent de la Direction {department.name} s’oblige à respecter les règles de ponctualité, d’intégrité professionnelle absolue et de disponibilité continue. Nous mettons à niveau nos processus pour que nos collègues d'autres pôles et l'ensemble des citoyens d'EDG puissent s'appuyer sur des services prévisibles, fluides et transparents.
        </p>
      </motion.div>

      {/* Grid of Commitments */}
      <section className="space-y-6">
        <h3 className="text-xs uppercase font-mono font-bold tracking-widest text-[#048343] dark:text-[#048343] flex items-center space-x-2">
          <TrendingUp size={14} />
          <span>Indicateurs de Performance & Objectifs Clés</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {commitments.map((commit, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white/45 dark:bg-[#0c0c0e] border border-zinc-200/50 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                  {commit.objective}
                </span>
                
                <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                  {commit.title}
                </h4>
                
                <div
                  className="rich-content text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium"
                  dangerouslySetInnerHTML={{ __html: commit.description }}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <Clock size={11} /> Cible EDG
                </span>
                <span className="text-md font-black text-[#048343] dark:text-[#048343] font-mono">
                  {commit.metric}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Compliance Box */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
          <Award size={18} />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center sm:text-left">
          Ces objectifs sont évalués tous les semestres par le Bureau de la Performance Générale de l’EDG S.A. sous la supervision du Comité de Direction et de la Direction Générale Adjointe pour certifier notre alignement avec les normes de la sous-région Ouest-Africaine.
        </p>
      </div>

    </div>
  );
}
