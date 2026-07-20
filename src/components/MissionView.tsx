/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Department } from '../types';
import { Target, Quote, Shield, Zap, Compass, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface MissionViewProps {
  department: Department;
}

interface MissionPillar {
  title: string;
  desc: string;
}

function getMissionPillars(code: string): MissionPillar[] {
  const norm = code.toLowerCase().trim();
  switch (norm) {
    case 'dg':
      return [
        { title: "Gouvernance Stratégique", desc: "Orienter l'ensemble des pôles vers une gestion efficiente et conforme aux exigences de l'État." },
        { title: "Souveraineté Énergétique", desc: "Planifier l'électrification totale du territoire national pour soutenir la croissance industrielle." },
        { title: "Transformation & Alignement", desc: "Inspirer le changement culturel et technologique au sein de chaque direction métier d'EDG." }
      ];
    case 'dgaae':
      return [
        { title: "Modernisation Structurelle", desc: "Analyser et restructurer les workflows d'exploitation pour éradiquer les goulots d'étranglement." },
        { title: "Indice d’Efficacité", desc: "Mettre en œuvre des méthodes de contrôle de performance pour maximiser le rendement global." },
        { title: "Contrôle Qualité", desc: "Suivre la qualité des services clés et s'assurer du respect rigoureux des engagements de desserte." }
      ];
    case 'distribution':
      return [
        { title: "Continuité de Desserte", desc: "Acheminer en continu l'électricité moyenne et basse tension en limitant les pertes techniques." },
        { title: "Réseau de Proximité", desc: "Entretenir et moderniser les transformateurs de quartiers et réseaux de distribution urbains." },
        { title: "Sécurité Électrique", desc: "Garantir des raccordements conformes aux normes et sécuriser l'environnement des usagers." }
      ];
    case 'finance':
      return [
        { title: "Hautes Études Budgétaires", desc: "Modéliser la trajectoire de change, les amortissements d'équipements et la viabilité d'EDG." },
        { title: "Pérennité Financière", desc: "Optimiser les dépenses opérationnelles et négocier les financements pour l'expansion du réseau." },
        { title: "Transparence & Audit", desc: "Établir des états financiers clairs, traçables et vérifiés selon les normes internationales." }
      ];
    case 'rh':
      return [
        { title: "Valorisation des Talents", desc: "Attirer, former et fidéliser les électriciens de pointe indispensables à notre transition énergétique." },
        { title: "Climat Social Serein", desc: "Promouvoir un dialogue constructif et attentif avec les partenaires sociaux et syndicats." },
        { title: "Bien-être au Travail", desc: "Développer des programmes d'assurance santé mutuelle et de prévention des risques sur site." }
      ];
    case 'dsi':
      return [
        { title: "Transformation Numérique", desc: "Développer l'intranet, dématérialiser les métiers et outiller les agents de solutions digitales." },
        { title: "Zéro Panne Logique", desc: "Assurer la haute disponibilité des serveurs, des VPN d'agences et des réseaux informatiques." },
        { title: "Cybersécurité Avancée", desc: "Protéger les données clientèle et les systèmes de facturation contre les menaces persistantes." }
      ];
    case 'production':
      return [
        { title: "Exploitation Hydro-Thermique", desc: "Gérer l'exploitation optimale des barrages de Kaléta/Souapiti et centrales thermiques." },
        { title: "Équilibre Réseau", desc: "Ajuster la production en temps réel pour répondre précisément à la courbe de charge nationale." },
        { title: "Maintenance Productive", desc: "Planifier l'entretien lourd des turbines et alternateurs pour éviter les arrêts inopinés." }
      ];
    case 'logistique':
      return [
        { title: "Chaîne Logistique Agile", desc: "Coordonner les achats stratégiques et l'approvisionnement en pièces lourdes de rechange." },
        { title: "Zéro Rupture de Stock", desc: "Maintenir des réserves réactives de câbles, disjoncteurs et poteaux de béton critiques." },
        { title: "Flotte Opérationnelle", desc: "Gérer et déployer la flotte de véhicules légers et lourds pour les interventions d'urgence." }
      ];
    default:
      return [
        { title: "Alignement Opérationnel", desc: "Décliner le schéma directeur national au niveau des activités concrètes de la direction." },
        { title: "Sûreté & Vigilance", desc: "Faire respecter les protocoles de sécurité et maximiser l'efficience à chaque étape." },
        { title: "Qualité de Service", desc: "Mesurer et hausser de manière continue la satisfaction des collaborateurs et abonnés d'EDG." }
      ];
  }
}

export default function MissionView({ department }: MissionViewProps) {
  const pillars = (department.missionPillars && department.missionPillars.length > 0)
    ? department.missionPillars
    : getMissionPillars(department.code);

  return (
    <div id="mission-view-section" className="space-y-10 pb-16 font-sans">
      
      {/* Title Segment */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Notre Mission ({department.code.toUpperCase()})
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          La raison d'être institutionnelle de la direction et ses objectifs stratégiques pour l'énergie guinéenne.
        </p>
      </div>

      {/* Strategic Vision Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Card: Dynamic Director Blockquote (7/12 width) */}
        <div className="lg:col-span-7">
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden"
          >
            {/* Background design decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-5 text-[#048343]">
              <Compass size={120} />
            </div>

            <div className="flex items-center space-x-3.5 pb-2 border-b border-slate-100 dark:border-white/5 relative z-10">
              <div className="p-2 bg-emerald-500/15 rounded-xl text-[#048343]">
                <Target size={20} />
              </div>
              <h3 className="font-display font-extrabold text-md text-slate-950 dark:text-white">Le Cap Directeur</h3>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="text-slate-400 dark:text-slate-500">
                <Quote size={32} className="stroke-[1.5]" />
              </div>
              
              <p className="text-sm dark:text-slate-200 leading-relaxed font-serif italic text-slate-700">
                "{department.directorMessage || "Notre mission prioritaire est de construire un réseau moderne et connecté, fondé sur la rigueur, l'équité de traitement et un dévouement inébranlable pour la République de Guinée."}"
              </p>

              <div className="pt-4 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">{department.directorName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Directeur de la direction {department.code.toUpperCase()}</p>
                </div>
                <span className="text-[9px] font-mono bg-emerald-500/10 text-[#048343] px-2.5 py-1 rounded-md uppercase font-bold tracking-wider">
                  ÉDG SA / Sûreté
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Card: Dynamic Pillars (5/12 width) */}
        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-xs uppercase font-mono font-bold tracking-widest text-[#048343] dark:text-[#048343] flex items-center space-x-2">
            <Star size={14} className="fill-current" />
            <span>Piliers d'exécution clés</span>
          </h3>

          <div className="space-y-4">
            {pillars.map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl bg-white/40 dark:bg-slate-900/35 border border-slate-200/60 dark:border-white/5 flex items-start space-x-4"
              >
                <span className="w-6.5 h-6.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#048343] flex items-center justify-center font-mono font-extrabold text-[11px] shrink-0">
                  0{i + 1}
                </span>

                <div className="space-y-1">
                  <h4 className="font-display font-extrabold text-xs text-slate-950 dark:text-white">
                    {pillar.title}
                  </h4>
                  <div
                    className="rich-content text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans"
                    dangerouslySetInnerHTML={{ __html: pillar.desc }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
