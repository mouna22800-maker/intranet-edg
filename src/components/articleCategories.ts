/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Catégories d'annonce des actualités — le point unique où EDG regroupe TOUT ce qui est
 * annonçable (communiqués, vie de l'entreprise, projets…), classé par catégorie.
 * L'auteur choisit la catégorie au moment de publier ; l'affichage s'adapte (icône, couleur, ton).
 *
 * Les identifiants (`id`) doivent rester synchronisés avec VALID_CATEGORIES côté backend
 * (api/routes/articles.py).
 */
export interface ArticleCategoryMeta {
  id: string;
  label: string;        // libellé complet (formulaire admin)
  short: string;        // libellé court (badge / filtre)
  icon: string;         // nom d'icône lucide-react (rendu via <LucideIcon />)
  badgeClass: string;   // teinte douce du badge (fond + texte + bordure)
  dotClass: string;     // pastille de couleur (puces de filtre)
  sober?: boolean;      // ton sobre et respectueux (décès)
}

export const ARTICLE_CATEGORIES: ArticleCategoryMeta[] = [
  {
    id: 'communique', label: 'Communiqué officiel', short: 'Communiqués', icon: 'Megaphone',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClass: 'bg-emerald-500',
  },
  {
    id: 'deces', label: 'Décès / Nécrologie', short: 'Décès', icon: 'Flower2',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
    dotClass: 'bg-slate-400', sober: true,
  },
  {
    id: 'mariage', label: 'Mariage', short: 'Mariages', icon: 'Gem',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    dotClass: 'bg-rose-500',
  },
  {
    id: 'naissance', label: 'Naissance', short: 'Naissances', icon: 'Baby',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    dotClass: 'bg-sky-500',
  },
  {
    id: 'retraite', label: 'Départ à la retraite', short: 'Retraites', icon: 'Award',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  {
    id: 'recrue', label: 'Nouvelle recrue / Promotion', short: 'Recrues', icon: 'UserPlus',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20',
    dotClass: 'bg-violet-500',
  },
  {
    id: 'projet', label: 'Lancement de projet', short: 'Projets', icon: 'Rocket',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
    dotClass: 'bg-indigo-500',
  },
  {
    id: 'evenement', label: 'Événement', short: 'Événements', icon: 'CalendarDays',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20',
    dotClass: 'bg-teal-500',
  },
];

/** Retourne la catégorie correspondante (ou « Communiqué officiel » par défaut). */
export function getArticleCategory(id?: string): ArticleCategoryMeta {
  return ARTICLE_CATEGORIES.find((c) => c.id === id) || ARTICLE_CATEGORIES[0];
}
