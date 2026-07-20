/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Department } from '../types';
import { Sparkles, Shield, Heart, Fingerprint, Award, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ValeursViewProps {
  department: Department;
}

interface ValueCard {
  title: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
}

// Habillage visuel (couleur + icône) attribué par position, cycle si plus de 4 valeurs
const CARD_STYLES = [
  { color: "from-emerald-500/15 via-emerald-650/5", icon: <Award className="text-[#048343] shrink-0" size={20} /> },
  { color: "from-amber-500/15 via-amber-600/5", icon: <Shield className="text-amber-500 shrink-0" size={20} /> },
  { color: "from-indigo-505/15 via-indigo-600/5", icon: <Heart className="text-indigo-500 shrink-0" size={20} /> },
  { color: "from-purple-500/15 via-purple-600/5", icon: <Sparkles className="text-purple-500 shrink-0" size={20} /> }
];

export default function ValeursView({ department }: ValeursViewProps) {
  // Valeurs pilotées par la base de données si présentes, sinon jeu de valeurs par défaut
  const rawValues = (department.values && department.values.length > 0)
    ? department.values
    : [
        { title: department.valueKey || "Sûreté & Unité EDG", desc: department.valueDesc || "Faire régner l'esprit de service public en plaçant la sécurité et l'équité nationale d'EDG au premier plan." },
        { title: "Intégrité Absolue", desc: "Exercer nos fonctions dans le respect total des procédures internes, de la déontologie professionnelle et de la transparence budgétaire." },
        { title: "Coopération & Cohésion", desc: "Brider les silos d'information. Agir de concert avec l'ensemble des directions techniques à travers l'intranet e-EDG." },
        { title: "Innovation Opérationnelle", desc: "Rechercher continuellement à moderniser nos architectures de fourniture, de comptabilité ou d'informatique pour le bien de la Guinée." }
      ];

  const values: ValueCard[] = rawValues
    .filter(v => v.title || v.desc)
    .map((v, i) => ({
      title: v.title,
      desc: v.desc,
      ...CARD_STYLES[i % CARD_STYLES.length]
    }));

  return (
    <div id="valeurs-view-section" className="space-y-12 pb-16 font-sans">
      
      {/* Title Segment */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Nos Valeurs Fondamentales ({department.code.toUpperCase()})
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Les principes moraux et directeurs régissant notre façon d'opérer, de collaborer et de servir au quotidien.
        </p>
      </div>

      {/* Grid of Values */}
      <section className="space-y-8">
        <h3 className="text-xs uppercase font-mono font-bold tracking-widest text-[#048343] dark:text-[#048343] flex items-center space-x-2">
          <Fingerprint size={15} />
          <span>Notre Empreinte Éthique</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {values.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative overflow-hidden bg-gradient-to-br ${v.color} to-transparent border border-zinc-200/55 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex items-start space-x-4`}
            >
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl shadow-sm">
                {v.icon}
              </div>

              <div className="space-y-2 min-w-0">
                <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-[#048343] dark:text-[#048343]">
                  Valeur Cardinal {i + 1}
                </span>

                <h4 className="font-display font-extrabold text-md text-slate-950 dark:text-white truncate">
                  {v.title}
                </h4>

                <div
                  className="rich-content text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-sans font-medium"
                  dangerouslySetInnerHTML={{ __html: v.desc }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer Rule block representing values safety */}
      <div className="p-5 border-2 border-dashed border-[#048343]/20 bg-emerald-500/5 rounded-3xl flex items-start space-x-4">
        <div className="w-9 h-9 rounded-full bg-[#048343]/15 text-[#048343] flex items-center justify-center shrink-0">
          <HelpCircle size={16} />
        </div>
        <div className="space-y-1">
          <h5 className="font-display font-bold text-xs text-slate-900 dark:text-white">Charte éthique e-EDG</h5>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">
            Ces valeurs sont une expression sincère de notre responsabilité vis-à-vis des contribuables, des partenaires financiers stratégiques et des abonnés. Une non-conformité à ces chartes est transmise immédiatement au Secrétariat d'Éthique.
          </p>
        </div>
      </div>

    </div>
  );
}
