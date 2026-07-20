/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Mail, Phone, Globe } from 'lucide-react';

interface FooterProps {
  siteSettings?: Record<string, string>;
  onNavigate?: (view: string) => void;
  currentUser?: any;
}

export default function Footer({ siteSettings = {}, onNavigate, currentUser }: FooterProps) {
  const currentYear = new Date().getFullYear();

  // Safe default fallbacks for newly added keys or cached states
  const instName = siteSettings.institution_name || "Électricité de Guinée S.A.";
  const instDesc = siteSettings.institution_desc || "EDG SA est la société nationale d'utilité publique chargée de l'exploitation, de la régulation et de l'acheminement de l'énergie électrique en République de Guinée.";
  const supportTitle = siteSettings.footer_support_title || "Assistance & Réseau";
  const supportPhone = siteSettings.support_phone || "144 (Numéro Vert EDG)";
  const supportEmail = siteSettings.support_email || "helpdesk@edg.com.gn";
  const networkRegion = siteSettings.footer_network_region || "Réseau Intérieur Sécurisé : Conakry, Guinée";
  const securityTitle = siteSettings.footer_security_title || "Statut Sécurité & Accords";
  const isoStandard = siteSettings.iso_standard || "ISO 50001 : Performance Énergétique";
  const securityTextRaw = siteSettings.footer_security_text || "Ce portail intranet est déployé en consultation directe pour l'ensemble du personnel technique et administratif de l’EDG SA. Tout signalement d'incident émis est archivé conformément aux protocoles [ISO] de gestion énergétique.";
  const opVersion = siteSettings.operational_version || "v2.4.1 Stable";
  const officialUrl = siteSettings.official_website_url || "https://edg.com.gn";
  const officialLabel = siteSettings.official_website_label || "Site officiel";
  const copyrightCompany = siteSettings.copyright_company || "Électricité de Guinée (EDG) S.A. Tous droits réservés.";

  // Interpolate [ISO] mark with the real isoStandard if it exists
  const securityText = securityTextRaw.replace('[ISO]', isoStandard);

  return (
    <footer id="edg-footer" className="bg-white/40 dark:bg-slate-900/10 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-850/50 text-slate-650 dark:text-slate-400 py-10 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Institution Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              {/* Mini official institutional seal */}
              <div className="w-8 h-8 rounded shrink-0 overflow-hidden shadow-sm">
                <svg className="w-full h-full" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="160" height="160" rx="16" fill="#FCEF11" />
                  <path d="M115 54C115 42 103 31.4 87.2 31.4C67.2 31.4 50.8 48.1 50.8 79.4C50.8 110.7 67.2 127.4 87.2 127.4C100.3 127.4 110.5 117.5 111.5 105.4H87.2V92.4H124.8V84.4H129.8V111.4H121.8V103.4C125 122 108.2 139.4 87.2 139.4C56.1 139.4 34.5 113.1 34.5 79.4C34.5 45.7 56.1 18.5 87.2 18.5C108.2 18.5 122.5 31.5 125.5 50.5L125.5 64L115.5 64Z" fill="#048343" />
                  <path d="M86 35L64 85H77L71 125L97 75H84L86 35Z" fill="#E21B23" stroke="#FCEF11" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-display font-bold text-slate-900 text-md tracking-tight">
                {instName}
              </span>
            </div>
            <p className="text-xs text-slate-550 leading-relaxed max-w-sm font-sans">
              {instDesc}
            </p>
          </div>

          {/* Quick Support Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-800">
              {supportTitle}
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center space-x-2 hover:text-emerald-650 transition-colors cursor-pointer">
                <Phone size={14} className="text-emerald-500" />
                <span>Centre d'Appel EDG : {supportPhone}</span>
              </li>
              <li className="flex items-center space-x-2 hover:text-emerald-650 transition-colors cursor-pointer">
                <Mail size={14} className="text-emerald-500" />
                <span>Support d'Urgence : {supportEmail}</span>
              </li>
              <li className="flex items-center space-x-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>{networkRegion}</span>
              </li>
            </ul>
          </div>

          {/* Guidelines / Operational Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-800">
              {securityTitle}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              {securityText}
            </p>
            <div className="pt-1 flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
              <Globe size={12} className="text-emerald-500" />
              <span>Version {opVersion} • Libre Accès</span>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
          <p 
            onDoubleClick={() => onNavigate && onNavigate('login')} 
            className="cursor-default select-none"
          >
            © {currentYear} {copyrightCompany}
          </p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a href={officialUrl} target="_blank" rel="noreferrer" className="hover:text-emerald-650 transition-colors inline-flex items-center space-x-1">
              <span>{officialLabel}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span>•</span>
            <span>Portail Intranet EDG SA</span>
            <span>•</span>
            {currentUser && currentUser.role !== 'agent' ? (
              <span className="text-emerald-500 font-semibold flex items-center space-x-1 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
                <span>Session Admin Active</span>
              </span>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 select-none">
                SERP-SECURE
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
