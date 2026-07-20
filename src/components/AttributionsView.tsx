/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Department, TeamMember } from '../types';
import { Mail, Phone, Award, ShieldAlert, Sparkles, Medal, Star, BookmarkCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDeptTeamMembers } from './TeamView';

interface AttributionsViewProps {
  department: Department;
  teamMembers?: any[];
}

export default function AttributionsView({ department, teamMembers }: AttributionsViewProps) {
  // Use stateful or cached team members representing each department
  const rawFiltered = teamMembers ? teamMembers.filter(m => m.departmentId === department.id) : [];
  const members: TeamMember[] = rawFiltered.length > 0
    ? [...rawFiltered]
        .sort((a, b) => a.hierarchy_order - b.hierarchy_order)
        .map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          email: m.email,
          phone: m.phone,
          bio: m.bio || `${m.name} occupe une fonction d'encadrement ou technique au sein d'EDG S.A.`,
          responsibilities: m.responsibilities || [
            "Participer activement à la performance opérationnelle de la direction.",
            "Rendre compte de l'avancement des objectifs techniques liés au service."
          ]
        }))
    : getDeptTeamMembers(department.code, department.name, department.directorName);

  const [selectedID, setSelectedID] = useState<string>(members[1]?.id || members[0]?.id || '');
  const activeDetailMember = members.find(m => m.id === selectedID) || members[0];

  // Outstanding member of the month citation generator
  const honoree = members[0]; // The Director / Chief
  const secondHonoree = members[1] || members[0]; // Next operational tier

  return (
    <div id="attributions-view-section" className="space-y-12 pb-16 font-sans">
      
      {/* Title Segment */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-5">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Attributions RH & Tableau d'Honneur ({department.code.toUpperCase()})
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Célébration du mérite professionnel, fiches de postes et responsabilités opérationnelles individuelles des agents.
        </p>
      </div>

      {/* 1. Tableau d'honneur (Honor Roll Board) */}
      <section className="space-y-6">
        <h3 className="text-xs uppercase font-mono font-bold tracking-widest text-[#048343] dark:text-[#048343] flex items-center space-x-2">
          <Medal size={15} />
          <span>Tableau d'Honneur de la Direction</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Honoree Card - Leader */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent dark:from-amber-500/20 dark:via-zinc-950/20 border-2 border-amber-400/60 dark:border-amber-500/30 rounded-3xl p-6 shadow-xl"
            id="honor-card-1"
          >
            {/* Absolute badge decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-15">
              <Award size={100} className="text-amber-550 dark:text-amber-400" />
            </div>

            <div className="flex items-start space-x-4 relative z-10">
              <div className="w-14 h-14 rounded-full bg-amber-400 dark:bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-md">
                👑
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black uppercase tracking-wider">
                  <Star size={8} fill="currentColor" className="mr-0.5" />
                  Directeur Lauréat l'EDG
                </span>
                <h4 className="font-display font-extrabold text-md text-slate-900 dark:text-white truncate">
                  {honoree?.name}
                </h4>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 leading-normal">
                  {honoree?.role}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-350 italic pt-2 border-t border-amber-300/30 dark:border-white/5 leading-relaxed">
                  "Distingué par le Comité de Direction Général d'EDG SA pour son leadership inspirant et l'atteinte exceptionnelle des objectifs annuels d'infrastructure."
                </p>
              </div>
            </div>
          </motion.div>

          {/* Second Honoree Card - Operational Star */}
          {secondHonoree && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent dark:from-emerald-950/20 dark:via-zinc-950/10 border border-emerald-500/30 rounded-3xl p-6 shadow-md"
              id="honor-card-2"
            >
              {/* Absolute badge decoration */}
              <div className="absolute top-0 right-0 p-4 opacity-15">
                <Sparkles size={80} className="text-emerald-500" />
              </div>

              <div className="flex items-start space-x-4 relative z-10">
                <div className="w-14 h-14 rounded-full bg-emerald-500 text-white font-black text-lg flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-md">
                  ✨
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-emerald-500 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                    <BookmarkCheck size={9} className="mr-0.5" />
                    Collaborateur Étoile
                  </span>
                  <h4 className="font-display font-extrabold text-md text-slate-900 dark:text-white truncate">
                    {secondHonoree.name}
                  </h4>
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400/90 leading-normal">
                    {secondHonoree.role}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-350 italic pt-2 border-t border-emerald-300/20 dark:border-white/5 leading-relaxed">
                    "Nominé par la direction RH d'EDG pour son intégrité professionnelle de haut niveau, sa ponctualité exemplaire et l'assistance technique continue auprès du réseau."
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* 2. Présentation des membres de l'équipe et de leurs métiers */}
      <section className="space-y-6">
        <div className="border-b border-slate-100 dark:border-white/5 pb-2">
          <h3 className="text-xs uppercase font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 flex items-center space-x-2">
            <BookmarkCheck size={15} />
            <span>Présentation des métiers de l'équipe</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Interactive list of profiles (5/12 width) */}
          <div className="lg:col-span-12 xl:col-span-5 space-y-3.5">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium px-1">
              Cliquez pour consulter le détail du poste et les attributions professionnelles individuelles de l'agent :
            </p>

            <div className="space-y-2.5">
              {members.map((member, index) => {
                const isActive = member.id === selectedID;
                return (
                  <motion.div
                    key={member.id}
                    onClick={() => setSelectedID(member.id)}
                    whileHover={{ scale: 1.015, x: 2 }}
                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500 dark:border-emerald-500 shadow-md' 
                        : 'bg-white/40 hover:bg-white/60 dark:bg-slate-900/30 dark:hover:bg-slate-900/55 border-slate-200/80 dark:border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${
                        isActive 
                          ? 'bg-emerald-500 text-white border-emerald-400' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-700'
                      }`}>
                        {member.name.split(' ').map(n => n[0]).slice(1,3).join('')}
                      </div>

                      <div className="min-w-0 text-left">
                        <h4 className="font-display font-extrabold text-xs text-slate-900 dark:text-white truncate">
                          {member.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    {/* Active dynamic indicator dot */}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-550 dark:bg-emerald-400 shadow-lg animate-ping"></span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Member duties card (7/12 width) */}
          <div className="lg:col-span-12 xl:col-span-7">
            <AnimatePresence mode="wait">
              {activeDetailMember && (
                <motion.div 
                  key={activeDetailMember.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl"
                >
                  <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase font-mono tracking-wider font-extrabold bg-[#048343] text-white px-2 py-0.5 rounded-md">
                        MÉTIER STATUTAIRE EDG
                      </span>
                      <h4 className="font-display font-black text-lg text-slate-955 dark:text-white mt-1 pt-1">
                        {activeDetailMember.name}
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold font-mono">
                        {activeDetailMember.role}
                      </p>
                    </div>

                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Award size={20} />
                    </div>
                  </div>

                  {/* Bio Context */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">Présentation du Métier</h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans font-medium">
                      {activeDetailMember.bio}
                    </p>
                  </div>

                  {/* Responsibilities list */}
                  <div className="space-y-3.5 pt-2">
                    <h5 className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold border-b border-slate-50 dark:border-white/5 pb-1">
                      Attributions & Tâches Régulières
                    </h5>
                    
                    <div className="space-y-3">
                      {activeDetailMember.responsibilities.map((resp, i) => (
                        <div key={i} className="flex items-start space-x-3 group/item">
                          <span className="w-4.5 h-4.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            ✓
                          </span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{resp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Call-to-action Action buttons for contact */}
                  <div className="border-t border-slate-100 dark:border-white/5 pt-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex space-x-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <a href={`mailto:${activeDetailMember.email}`} className="hover:text-amber-600 dark:hover:text-amber-400 hover:underline">{activeDetailMember.email}</a>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span>{activeDetailMember.phone}</span>
                      </div>
                    </div>

                    <span className="text-[9px] font-mono font-bold uppercase text-slate-400 dark:text-slate-550 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded">
                      Réf: LH-{department.code.toUpperCase()}-{selectedID}
                    </span>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </section>

    </div>
  );
}
