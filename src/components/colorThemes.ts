/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DeptColorTheme {
  // Card styling
  cardBg: string;          // Light mode glass base, border, hover states
  cardBgDark: string;      // Dark mode glass base, border, hover states
  cardGlow: string;        // Ambient shadow glow on hover
  
  // Icon styling
  iconBg: string;          // Default glass icon holder color
  iconBgHover: string;     // Color of icon holder on card group hover
  
  // Category/Code tags
  tagBg: string;           // Minor badge/tag pill design
  
  // Typography highlights
  textHover: string;       // Title hover color change
  textPrimary: string;     // Header font color
  textAccent: string;      // Underlines or accent markings
  
  // Lower strip (actions and metadata)
  stripBg: string;         // Bottom strip backplate
  actionText: string;      // CTA "Rejoindre / Accéder" color
  
  // Badge/Pills for dynamic values or states
  badgePill: string;       // Accent pill
}

export const EMERALD_THEME: DeptColorTheme = {
  cardBg: "bg-white hover:bg-emerald-50/30 border-slate-200/60 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg",
  cardBgDark: "dark:bg-slate-900/60 dark:border-slate-805/80 dark:hover:bg-slate-800/40 dark:hover:border-emerald-500/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(16,185,129,0.08)]",
  cardGlow: "hover:shadow-[0_8px_24px_rgba(16,185,129,0.03)] dark:hover:shadow-[0_12px_32px_rgba(16,185,129,0.15)]",
  iconBg: "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40",
  iconBgHover: "group-hover:bg-[#048343] group-hover:text-white dark:group-hover:bg-[#10b981] dark:group-hover:text-black",
  tagBg: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  textHover: "group-hover:text-[#048343] dark:group-hover:text-emerald-400",
  textPrimary: "text-slate-900 dark:text-white",
  textAccent: "text-emerald-600 dark:text-emerald-400",
  stripBg: "bg-emerald-50/20 dark:bg-emerald-950/10 border-t border-slate-100 dark:border-emerald-950/30",
  actionText: "text-[#048343] group-hover:text-[#036a36] dark:text-[#10b981] dark:group-hover:text-emerald-300",
  badgePill: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30"
};

export const AMBER_THEME: DeptColorTheme = {
  cardBg: "bg-white hover:bg-amber-50/30 border-slate-200/60 hover:border-amber-300 transition-all duration-300 hover:shadow-lg",
  cardBgDark: "dark:bg-slate-900/60 dark:border-slate-805/80 dark:hover:bg-slate-800/40 dark:hover:border-amber-500/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(245,158,11,0.08)]",
  cardGlow: "hover:shadow-[0_8px_24px_rgba(245,158,11,0.03)] dark:hover:shadow-[0_12px_32px_rgba(245,158,11,0.15)]",
  iconBg: "bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40",
  iconBgHover: "group-hover:bg-amber-500 group-hover:text-white dark:group-hover:bg-amber-400 dark:group-hover:text-black",
  tagBg: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
  textHover: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
  textPrimary: "text-slate-900 dark:text-white",
  textAccent: "text-amber-600 dark:text-amber-400",
  stripBg: "bg-amber-50/20 dark:bg-amber-950/10 border-t border-slate-100 dark:border-amber-950/30",
  actionText: "text-amber-600 group-hover:text-amber-700 dark:text-amber-400 dark:group-hover:text-amber-350",
  badgePill: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-805"
};

export const BLUE_THEME: DeptColorTheme = {
  cardBg: "bg-white hover:bg-blue-50/30 border-slate-200/60 hover:border-blue-300 transition-all duration-300 hover:shadow-lg",
  cardBgDark: "dark:bg-slate-900/60 dark:border-slate-805/80 dark:hover:bg-slate-800/40 dark:hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(59,130,246,0.08)]",
  cardGlow: "hover:shadow-[0_8px_24px_rgba(59,130,246,0.03)] dark:hover:shadow-[0_12px_32px_rgba(59,130,246,0.15)]",
  iconBg: "bg-blue-50 text-blue-705 border border-blue-200/50 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40",
  iconBgHover: "group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-400 dark:group-hover:text-black",
  tagBg: "bg-blue-50 text-blue-700 border-blue-105 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
  textHover: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
  textPrimary: "text-slate-900 dark:text-white",
  textAccent: "text-blue-600 dark:text-blue-400",
  stripBg: "bg-blue-50/20 dark:bg-blue-950/10 border-t border-slate-100 dark:border-blue-950/30",
  actionText: "text-blue-600 group-hover:text-blue-755 dark:text-blue-400 dark:group-hover:text-blue-350",
  badgePill: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-805"
};

export const PURPLE_THEME: DeptColorTheme = {
  cardBg: "bg-white hover:bg-purple-50/30 border-slate-200/60 hover:border-purple-300 transition-all duration-300 hover:shadow-lg",
  cardBgDark: "dark:bg-slate-900/60 dark:border-slate-805/80 dark:hover:bg-slate-800/40 dark:hover:border-purple-500/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(168,85,247,0.08)]",
  cardGlow: "hover:shadow-[0_8px_24px_rgba(168,85,247,0.03)] dark:hover:shadow-[0_12px_32px_rgba(168,85,247,0.15)]",
  iconBg: "bg-purple-50 text-purple-705 border border-purple-200/50 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/40",
  iconBgHover: "group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-400 dark:group-hover:text-black",
  tagBg: "bg-purple-50 text-purple-705 border-purple-105 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50",
  textHover: "group-hover:text-purple-650 dark:group-hover:text-purple-400",
  textPrimary: "text-slate-900 dark:text-white",
  textAccent: "text-purple-600 dark:text-purple-400",
  stripBg: "bg-purple-50/20 dark:bg-purple-950/10 border-t border-slate-100 dark:border-purple-950/30",
  actionText: "text-purple-600 group-hover:text-purple-755 dark:text-purple-400 dark:group-hover:text-purple-350",
  badgePill: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-805"
};

export const ORANGE_THEME: DeptColorTheme = {
  cardBg: "bg-white hover:bg-orange-50/30 border-slate-200/60 hover:border-orange-300 transition-all duration-300 hover:shadow-lg",
  cardBgDark: "dark:bg-slate-900/60 dark:border-slate-805/80 dark:hover:bg-slate-800/40 dark:hover:border-orange-500/30 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(249,115,22,0.08)]",
  cardGlow: "hover:shadow-[0_8px_24px_rgba(249,115,22,0.03)] dark:hover:shadow-[0_12px_32px_rgba(249,115,22,0.15)]",
  iconBg: "bg-orange-50 text-orange-705 border border-orange-200/50 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40",
  iconBgHover: "group-hover:bg-orange-600 group-hover:text-white dark:group-hover:bg-orange-400 dark:group-hover:text-black",
  tagBg: "bg-orange-50 text-orange-705 border-orange-105 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/50",
  textHover: "group-hover:text-orange-650 dark:group-hover:text-orange-400",
  textPrimary: "text-slate-900 dark:text-white",
  textAccent: "text-orange-600 dark:text-orange-400",
  stripBg: "bg-orange-50/20 dark:bg-orange-950/10 border-t border-slate-100 dark:border-orange-950/30",
  actionText: "text-orange-600 group-hover:text-orange-755 dark:text-orange-400 dark:group-hover:text-orange-355",
  badgePill: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-805"
};

export const MONOCHROME_THEME: DeptColorTheme = EMERALD_THEME;

export const DEPT_COLOR_MAP: Record<string, DeptColorTheme> = {
  logistique: ORANGE_THEME,
  finance: AMBER_THEME,
  juridique: PURPLE_THEME,
  audit: PURPLE_THEME,
  commercial: AMBER_THEME,
  distribution: EMERALD_THEME,
  etudes: BLUE_THEME,
  innovation: BLUE_THEME,
  production: ORANGE_THEME,
  rh: EMERALD_THEME,
  dsi: BLUE_THEME,
  transport: BLUE_THEME
};

export const DEFAULT_COLOR_THEME: DeptColorTheme = MONOCHROME_THEME;

export function getDeptColorTheme(code?: string): DeptColorTheme {
  if (!code) return DEFAULT_COLOR_THEME;
  const normalized = code.toLowerCase().trim();
  return DEPT_COLOR_MAP[normalized] || DEFAULT_COLOR_THEME;
}
