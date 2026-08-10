/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Department, Application, IntranetUser, Article, FileAttachment, DashboardData, Ticket } from '../types';
import LucideIcon from './LucideIcon';
import { getMediaBgStyle } from './imageStyle';
import RichTextEditor from './RichTextEditor';
import AuditLogView from './AuditLogView';
import PostesAdmin from './PostesAdmin';
import OrganigrammeAdmin from './OrganigrammeAdmin';
import EdgLogo from './EdgLogo';
import { ARTICLE_CATEGORIES } from './articleCategories';
import { apiFetch } from '../api';
import { useToast } from './Toast';
import { 
  Building2,
  Link2,
  Sliders,
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  FileText,
  ArrowUp,
  ArrowDown, 
  PlusCircle,
  Database,
  Terminal,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  FolderKanban,
  PhoneCall,
  UploadCloud,
  BarChart3,
  Inbox,
  AlertTriangle,
  MessageCircle,
  Clock,
  Network,
  User2,
  Download,
  BookOpen,
  Layers,
  Workflow
} from 'lucide-react';

interface TeamMember {
  id: string;
  departmentId: number; // Linked to department
  name: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  responsibilities: string[];
  hierarchy_order: number; // 1 for Director, 2 for head, etc.
}

// Métadonnées d'affichage de l'utilisateur connecté dans la sidebar (dégradé d'avatar + libellé de rôle).
const ADMIN_ROLE_META: Record<string, { gradient: string; label: string }> = {
  administrateur: { gradient: 'bg-gradient-to-tr from-violet-600 to-purple-500', label: 'Administrateur' },
  rh_direction: { gradient: 'bg-gradient-to-tr from-rose-600 to-pink-500', label: 'RH / Direction' },
  chef_service: { gradient: 'bg-gradient-to-tr from-amber-600 to-orange-500', label: 'Chef de Service' },
  agent: { gradient: 'bg-gradient-to-tr from-blue-600 to-indigo-500', label: 'Agent' },
};

function getUserInitials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

/**
 * Intitulé de groupe du rail de navigation de la console.
 * Masqué en mobile, où le rail devient une simple barre défilante horizontale.
 */
function AdminNavSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden lg:block px-3 pt-4 pb-1 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 select-none">
      {children}
    </div>
  );
}

/**
 * Entrée du rail de navigation de la console d'administration.
 * Un seul composant pour les onze onglets : le style se règle ici, plus dans chaque bouton.
 * L'onglet actif est signalé par une barre d'accent verte EDG et un fond très légèrement teinté,
 * plutôt que par un aplat saturé qui écrasait le reste du menu.
 */
function AdminNavItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative w-full text-left pl-4 pr-2.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
        active
          ? 'bg-[#2FB344] text-white font-bold'
          : 'text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Icon
        size={15}
        className={`shrink-0 ${
          active
            ? 'text-white'
            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`}
      />
      <span className="flex-1 truncate">{label}</span>
      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md tabular-nums shrink-0 ${
            active
              ? 'bg-white/25 text-white'
              : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// --- HELPER FUNCTIONS FOR ALL DYNAMIC SUBSECTIONS ---
function getDefaultMissionPillars(code: string) {
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

function getDefaultCommitments(code: string) {
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

function getDefaultDomains(code: string) {
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

function getDefaultHistoryText(dept: Department | Partial<Department>): string {
  const code = (dept.code || '').toUpperCase();
  return `Érigée en tant que structure stratégique lors des grandes réformes de l'Électricité de Guinée SA en ${dept.foundedYear || 2026}, la Direction ${dept.name || ''} (${code}) a historiquement accompagné les mutations fondamentales de notre réseau d'énergie. Depuis plus de deux décennies, elle s'efforce de standardiser l'excellence opérationnelle et de doter nos collaborateurs d'outils à fort impact. À travers l'évolution constante de ses missions d'encadrement, sa trajectoire témoigne de son dévouement inébranlable pour la souveraineté technique de la Guinée.`;
}

function getDefaultValues(dept: Department | Partial<Department>) {
  return [
    { title: dept.valueKey || "Sûreté & Unité EDG", desc: dept.valueDesc || "Faire régner l'esprit de service public en plaçant la sécurité et l'équité nationale d'EDG au premier plan." },
    { title: "Intégrité Absolue", desc: "Exercer nos fonctions dans le respect total des procédures internes, de la déontologie professionnelle et de la transparence budgétaire." },
    { title: "Coopération & Cohésion", desc: "Brider les silos d'information. Agir de concert avec l'ensemble des directions techniques à travers l'intranet e-EDG." },
    { title: "Innovation Opérationnelle", desc: "Rechercher continuellement à moderniser nos architectures de fourniture, de comptabilité ou d'informatique pour le bien de la Guinée." }
  ];
}

interface AdminViewProps {
  departments: Department[];
  onChangeDepartments: (depts: Department[]) => void;
  applications: Application[];
  onChangeApplications: (apps: Application[]) => void;
  teamMembers: TeamMember[];
  onChangeTeamMembers: (members: TeamMember[]) => void;
  siteSettings: Record<string, string>;
  onChangeSiteSettings: (settings: Record<string, string>) => void;
  currentUser?: IntranetUser;
  articles: Article[];
  onChangeArticles: (newArticles: Article[]) => void;
  authToken: string | null;
  /** Navigation globale (utilisée par le logo EDG de la sidebar pour revenir à l'accueil). */
  onNavigate?: (view: string, deptCode?: string) => void;
}

export default function AdminView({
  departments,
  onChangeDepartments,
  applications,
  onChangeApplications,
  teamMembers,
  onChangeTeamMembers,
  siteSettings,
  onChangeSiteSettings,
  currentUser,
  articles,
  onChangeArticles,
  authToken,
  onNavigate
}: AdminViewProps) {
  const isAdministrateur = currentUser?.role === 'administrateur';
  const isRhDirection = currentUser?.role === 'rh_direction';
  const isChefService = currentUser?.role === 'chef_service';
  const userUnityId = currentUser?.departmentId ?? null;
  // Chef de service, ou RH/Direction rattaché à une direction (Directeur) : sélecteur de direction verrouillé sur sa propre direction
  const isDeptScopedRole = (isChefService || isRhDirection) && userUnityId != null;

  const [activeTab, setActiveTab] = useState<'depts' | 'apps' | 'teams' | 'settings' | 'articles' | 'projects' | 'recipients' | 'tickets' | 'documents' | 'users' | 'audit' | 'postes'>(
    isAdministrateur ? 'depts' : isRhDirection ? 'postes' : 'articles'
  );

  const [editingApp, setEditingApp] = useState<Partial<Application> | null>(null);
  const [appForm, setAppForm] = useState<Partial<Application>>({
    id: 0,
    name: '',
    description: '',
    url: '',
    icon: 'ExternalLink',
    logoUrl: undefined,
    isGlobal: true,
    category: 'Productivité',
    departmentId: departments[0]?.id
  });

  const generateTempAppId = () => Math.min(0, ...applications.map((a) => a.id)) - 1;

  const resetAppForm = () => setAppForm({
    id: 0,
    name: '',
    description: '',
    url: '',
    icon: 'ExternalLink',
    logoUrl: undefined,
    isGlobal: true,
    category: 'Productivité',
    departmentId: departments[0]?.id
  });

  const handleCreateAppClick = () => {
    setEditingApp({ id: 0 });
    resetAppForm();
  };

  const handleEditAppClick = (app: Application) => {
    setEditingApp(app);
    setAppForm({ ...app, logoUrl: app.logoUrl });
  };

  const handleCancelAppEdit = () => {
    setEditingApp(null);
    resetAppForm();
  };

  const handleSaveApp = (e: React.FormEvent) => {
    e.preventDefault();

    if (!appForm.name?.trim() || !appForm.url?.trim()) {
      showNotification('err', 'Le nom et l’URL sont requis pour enregistrer une application.');
      return;
    }

    const isGlobal = appForm.isGlobal !== false;
    const storedApp: Application = {
      id: editingApp?.id === 0 ? generateTempAppId() : (appForm.id as number),
      name: appForm.name.trim(),
      description: appForm.description?.trim() || '',
      url: appForm.url.trim(),
      icon: appForm.icon || 'ExternalLink',
      logoUrl: appForm.logoUrl?.trim() || undefined,
      isGlobal,
      category: appForm.category?.trim() || 'Productivité',
      departmentId: isGlobal ? undefined : Number(appForm.departmentId) || departments[0]?.id
    };

    const updatedApps = editingApp?.id === 0
      ? [...applications, storedApp]
      : applications.map((currentApp) => (currentApp.id === storedApp.id ? storedApp : currentApp));

    onChangeApplications(updatedApps);
    setEditingApp(null);
    resetAppForm();
    showNotification('success', `Application ${editingApp?.id === 0 ? 'ajoutée' : 'mise à jour'} avec succès.`);
  };

  const handleDeleteApp = (app: Application) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'application "${app.name}" ?`)) return;
    onChangeApplications(applications.filter((currentApp) => currentApp.id !== app.id));
    if (editingApp?.id === app.id) {
      setEditingApp(null);
      resetAppForm();
    }
    showNotification('success', 'Application supprimée.');
  };

  // Status feedback messages (bandeau flottant global, cohérent sur toute l'application)
  const { showToast } = useToast();

  const showNotification = (type: 'success' | 'err', text: string) => {
    showToast(type === 'success' ? 'success' : 'error', text);
  };

  // Miroir côté UI de can_write_department() côté backend (api/auth.py)
  const canManage = (targetUnityId?: number | null): boolean => {
    if (isAdministrateur) return true;
    if (isRhDirection && userUnityId == null) return true;
    if ((isRhDirection || isChefService) && userUnityId != null && targetUnityId != null) {
      return Number(userUnityId) === Number(targetUnityId);
    }
    return false;
  };

  // Directions, applications, paramètres, comptes : réservé à l'Administrateur
  const checkAdministrateurAccess = (): boolean => {
    if (!isAdministrateur) {
      showNotification('err', "Sécurité Intranet : cette action est réservée à l'Administrateur.");
      return false;
    }
    return true;
  };

  // Organigramme, contacts d'urgence : réservé à RH/Direction ou Administrateur, cloisonné par direction
  const checkTeamWriteAccess = (targetUnityId?: number | null): boolean => {
    if (!isAdministrateur && !isRhDirection) {
      showNotification('err', "Sécurité Intranet : cette action est réservée au service RH / Direction ou à l'Administrateur.");
      return false;
    }
    if (!canManage(targetUnityId)) {
      showNotification('err', "Sécurité Intranet : cette action est réservée aux responsables de cette direction.");
      return false;
    }
    return true;
  };

  // Actualités, projets, documents, tickets : Chef de Service / RH/Direction / Administrateur, cloisonné par direction
  const checkDeptWriteAccess = (targetUnityId?: number | null): boolean => {
    if (!currentUser || currentUser.role === 'agent') {
      showNotification('err', "Sécurité Intranet : cette action nécessite un rôle habilité (Chef de Service, RH/Direction ou Administrateur).");
      return false;
    }
    if (!canManage(targetUnityId)) {
      showNotification('err', "Sécurité Intranet : cette action est réservée aux responsables de cette direction.");
      return false;
    }
    return true;
  };

  // --- 1. STATES FOR GESTION DIRECTIONS (DEPARTMENTS) ---
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    description: '',
    icon: 'Layers',
    directorName: '',
    directorMessage: '',
    foundedYear: 2026,
    staffCount: 1,
    themeColor: 'amber',
    parentId: null as number | null,
    historyText: ''
  });

  // Sections librement extensibles (nombre illimité de cartes, ajout/suppression libre)
  const [valuesForm, setValuesForm] = useState<{ title: string; desc: string }[]>([]);
  const [missionPillarsForm, setMissionPillarsForm] = useState<{ title: string; desc: string }[]>([]);
  const [commitmentsForm, setCommitmentsForm] = useState<{ objective: string; title: string; metric: string; description: string }[]>([]);
  const [domainsForm, setDomainsForm] = useState<{ title: string; desc: string; icon: string }[]>([]);

  const updateValueItem = (idx: number, field: 'title' | 'desc', val: string) => {
    setValuesForm(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));
  };
  const addValueItem = () => setValuesForm(prev => [...prev, { title: '', desc: '' }]);
  const removeValueItem = (idx: number) => setValuesForm(prev => prev.filter((_, i) => i !== idx));

  const updateMissionPillar = (idx: number, field: 'title' | 'desc', val: string) => {
    setMissionPillarsForm(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };
  const addMissionPillar = () => setMissionPillarsForm(prev => [...prev, { title: '', desc: '' }]);
  const removeMissionPillar = (idx: number) => setMissionPillarsForm(prev => prev.filter((_, i) => i !== idx));

  const updateCommitment = (idx: number, field: 'objective' | 'title' | 'metric' | 'description', val: string) => {
    setCommitmentsForm(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };
  const addCommitment = () => setCommitmentsForm(prev => [...prev, { objective: '', title: '', metric: '', description: '' }]);
  const removeCommitment = (idx: number) => setCommitmentsForm(prev => prev.filter((_, i) => i !== idx));

  const updateDomain = (idx: number, field: 'title' | 'desc' | 'icon', val: string) => {
    setDomainsForm(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };
  const addDomain = () => setDomainsForm(prev => [...prev, { title: '', desc: '', icon: 'Target' }]);
  const removeDomain = (idx: number) => setDomainsForm(prev => prev.filter((_, i) => i !== idx));

  const getDefaultDashboard = (code: string): DashboardData => ({
    title: `Indicateurs Globaux & Progression des Chantiers (${(code || '???').toUpperCase()})`,
    subtitle: "Rendement de gouvernance, avancement des livrables et conformité réglementaire",
    chartType: 'line',
    kpis: [
      { label: "Objectifs Atteints", value: "84.5%", sub: "Indicateur consolidé", icon: "TrendingUp" },
      { label: "Traitement Dossiers", value: "48h", sub: "Fluidité administrative", icon: "Clock" },
      { label: "Taux de Conformité", value: "100.0%", sub: "Zéro non-conformité", icon: "ShieldCheck" }
    ],
    series: [
      { key: "Progression (%)", label: "Progression Générale (%)", color: "#f59e0b" },
      { key: "Taux de Qualité (%)", label: "Taux de Qualité (%)", color: "#10b981" }
    ],
    chartData: [
      { name: "Trimestre 1", "Progression (%)": 45, "Taux de Qualité (%)": 92 },
      { name: "Trimestre 2", "Progression (%)": 58, "Taux de Qualité (%)": 94 },
      { name: "Trimestre 3", "Progression (%)": 70, "Taux de Qualité (%)": 96 },
      { name: "Trimestre 4", "Progression (%)": 84.5, "Taux de Qualité (%)": 98 }
    ]
  });

  const [dashboardForm, setDashboardForm] = useState<DashboardData>(getDefaultDashboard(''));

  // Renomme une clé de série dans le dashboardForm en propageant le changement sur tous les points du graphique
  const renameSeriesKey = (oldKey: string, newKey: string) => {
    setDashboardForm(prev => ({
      ...prev,
      series: prev.series.map(s => s.key === oldKey ? { ...s, key: newKey } : s),
      chartData: prev.chartData.map(point => {
        if (!(oldKey in point) || oldKey === newKey) return point;
        const { [oldKey]: value, ...rest } = point;
        return { ...rest, [newKey]: value };
      })
    }));
  };

  const updateDashboardKpi = (idx: number, field: 'label' | 'value' | 'sub' | 'icon', val: string) => {
    setDashboardForm(prev => ({ ...prev, kpis: prev.kpis.map((k, i) => i === idx ? { ...k, [field]: val } : k) }));
  };
  const addDashboardKpi = () => {
    setDashboardForm(prev => ({ ...prev, kpis: [...prev.kpis, { label: '', value: '', sub: '', icon: 'TrendingUp' }] }));
  };
  const removeDashboardKpi = (idx: number) => {
    setDashboardForm(prev => ({ ...prev, kpis: prev.kpis.filter((_, i) => i !== idx) }));
  };

  const updateDashboardSeries = (idx: number, field: 'label' | 'color', val: string) => {
    setDashboardForm(prev => ({ ...prev, series: prev.series.map((s, i) => i === idx ? { ...s, [field]: val } : s) }));
  };
  const addDashboardSeries = () => {
    const newKey = `Série ${dashboardForm.series.length + 1}`;
    setDashboardForm(prev => ({
      ...prev,
      series: [...prev.series, { key: newKey, label: newKey, color: '#10b981' }],
      chartData: prev.chartData.map(point => ({ ...point, [newKey]: 0 }))
    }));
  };
  const removeDashboardSeries = (key: string) => {
    setDashboardForm(prev => ({
      ...prev,
      series: prev.series.filter(s => s.key !== key),
      chartData: prev.chartData.map(point => {
        const { [key]: _omit, ...rest } = point;
        return rest;
      })
    }));
  };

  const updateDashboardPoint = (idx: number, field: string, val: string | number) => {
    setDashboardForm(prev => ({ ...prev, chartData: prev.chartData.map((p, i) => i === idx ? { ...p, [field]: val } : p) }));
  };
  const addDashboardPoint = () => {
    const blank: { name: string; [key: string]: string | number } = { name: '' };
    dashboardForm.series.forEach(s => { blank[s.key] = 0; });
    setDashboardForm(prev => ({ ...prev, chartData: [...prev.chartData, blank] }));
  };
  const removeDashboardPoint = (idx: number) => {
    setDashboardForm(prev => ({ ...prev, chartData: prev.chartData.filter((_, i) => i !== idx) }));
  };

  const handleEditDeptClick = (dept: Department) => {
    setEditingDept(dept);
    setDashboardForm(dept.dashboard || getDefaultDashboard(dept.code));

    // Dynamic field defaults loaded from model arrays OR compiled fallbacks
    const fallbackMissions = getDefaultMissionPillars(dept.code);
    const mPillars = dept.missionPillars || fallbackMissions;

    const fallbackCommitments = getDefaultCommitments(dept.code);
    const mCommitments = dept.commitments || fallbackCommitments;

    const fallbackDomains = getDefaultDomains(dept.code);
    const mDomains = dept.domains || fallbackDomains;

    const fallbackHistory = getDefaultHistoryText(dept);
    const mHistory = dept.historyText || fallbackHistory;

    const fallbackValues = getDefaultValues(dept);
    const mValues = (dept.values && dept.values.length > 0) ? dept.values : fallbackValues;

    // La 1ère valeur reflète toujours la "valeur clé" historique (dept.valueKey/valueDesc) si présente
    const initialValues = mValues.length > 0 ? mValues.map(v => ({ ...v })) : [{ title: '', desc: '' }];
    if (dept.valueKey || dept.valueDesc) {
      initialValues[0] = { title: dept.valueKey || initialValues[0]?.title || '', desc: dept.valueDesc || initialValues[0]?.desc || '' };
    }
    setValuesForm(initialValues);
    setMissionPillarsForm(mPillars.map(p => ({ ...p })));
    setCommitmentsForm(mCommitments.map(c => ({ objective: c.objective || '', title: c.title || '', metric: c.metric || '', description: c.description || '' })));
    setDomainsForm(mDomains.map(d => ({ ...d })));

    setDeptForm({
      code: dept.code,
      name: dept.name,
      description: dept.description,
      icon: dept.icon || 'Layers',
      directorName: dept.directorName || '',
      directorMessage: dept.directorMessage || '',
      foundedYear: dept.foundedYear || 2026,
      staffCount: dept.staffCount || 1,
      themeColor: dept.themeColor || 'amber',
      parentId: dept.parentId ?? null,
      historyText: mHistory
    });
  };

  const handleCreateDeptClick = () => {
    setEditingDept({ id: 0 }); // id 0 means creating new
    setDashboardForm(getDefaultDashboard(''));

    setValuesForm([
      { title: 'Efficience', desc: '' },
      { title: 'Intégrité Absolue', desc: "Exercer nos fonctions dans le respect total des procédures internes, de la déontologie professionnelle et de la transparence budgétaire." },
      { title: 'Coopération & Cohésion', desc: "Brider les silos d'information. Agir de concert avec l'ensemble des directions techniques à travers l'intranet e-EDG." },
      { title: 'Innovation Opérationnelle', desc: "Rechercher continuellement à moderniser nos architectures de fourniture, de comptabilité ou d'informatique pour le bien de la Guinée." }
    ]);

    setMissionPillarsForm([
      { title: 'Gouvernance Opérationnelle', desc: "Aligner les objectifs opérationnels de l'entité avec la charte générale." },
      { title: "Sûreté & Vigilance", desc: "Faire respecter les protocoles de conformité et maximiser l'efficience à chaque étape." },
      { title: "Qualité de Service", desc: "Hisser de manière continue la satisfaction de l'ensemble des collaborateurs d'EDG." }
    ]);

    setCommitmentsForm([
      { objective: 'Excellence', title: 'Taux de disponibilité active', metric: '99.5%', description: 'Assurer la disponibilité permanente des services opérationnels de la direction.' },
      { objective: 'Rigueur', title: 'Délai de traitement de dossier', metric: '48 Heures', description: 'Toutes les requêtes de service ou correspondances hiérarchiques traitées et actées.' },
      { objective: 'Intégrité', title: 'Respect du cadre réglementaire', metric: '100%', description: 'Ajustement continu de toutes les décisions selon les chartes de déontologie d\'EDG.' }
    ]);

    setDomainsForm([
      { title: 'Planification Stratégique', desc: 'Alignement des objectifs opérationnels avec le Schéma Directeur National de l\'Électricité.', icon: 'Target' },
      { title: 'Modernisation des Processus', desc: 'Amélioration des indicateurs de performance et facilitation des tâches des collaborateurs.', icon: 'Sparkles' },
      { title: 'Gestion de la Performance', desc: 'Coordination active des flux métiers et reporting consolidé pour la Direction Générale.', icon: 'TrendingUp' },
      { title: 'Rapprochement Régional', desc: 'Instruction continue et mise à niveau des délégations provinciales et d\'agences locales.', icon: 'MapPin' }
    ]);

    setDeptForm({
      code: '',
      name: '',
      description: '',
      icon: 'Layers',
      directorName: '',
      directorMessage: '',
      foundedYear: 2026,
      staffCount: 1,
      themeColor: 'amber',
      parentId: null,
      historyText: ''
    });
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkAdministrateurAccess()) return;
    if (!deptForm.code || !deptForm.name || !deptForm.directorName) {
      showNotification('err', 'Erreur : Les champs Sigle, Nom complet et Directeur sont obligatoires.');
      return;
    }

    const codeClean = deptForm.code.toLowerCase().trim().replace(/\s+/g, '-');

    const missionPillars = missionPillarsForm.map(p => ({ title: p.title.trim(), desc: p.desc.trim() }));
    const commitments = commitmentsForm.map(c => ({ title: c.title.trim(), metric: c.metric.trim(), description: c.description.trim(), objective: c.objective.trim() }));
    const domains = domainsForm.map(d => ({ title: d.title.trim(), desc: d.desc.trim(), icon: d.icon }));
    const values = valuesForm.map(v => ({ title: v.title.trim(), desc: v.desc.trim() }));

    const valueKey = values[0]?.title || '';
    const valueDesc = values[0]?.desc || '';

    const historyText = deptForm.historyText.trim();
    
    if (editingDept?.id === 0) {
      // Check code uniqueness
      if (departments.some(d => d.code === codeClean)) {
        showNotification('err', `Erreur : Le code "${codeClean}" existe déjà.`);
        return;
      }
      const newId = departments.length > 0 ? Math.max(...departments.map(d => d.id)) + 1 : 1;
      const newDept: Department = {
        id: newId,
        parentId: deptForm.parentId ?? null,
        code: codeClean,
        name: deptForm.name.trim(),
        description: deptForm.description.trim(),
        icon: deptForm.icon,
        directorName: deptForm.directorName.trim(),
        directorMessage: deptForm.directorMessage.trim(),
        foundedYear: Number(deptForm.foundedYear),
        staffCount: Number(deptForm.staffCount),
        valueKey,
        valueDesc,
        themeColor: deptForm.themeColor,
        missionPillars,
        commitments,
        domains,
        values,
        historyText,
        dashboard: dashboardForm
      };

      // Auto-generate a default team lead member for this new director
      const newTeamMember: TeamMember = {
        id: `team_gen_${Date.now()}`,
        departmentId: newId,
        name: deptForm.directorName.trim(),
        role: `Directeur - ${deptForm.name.trim()}`,
        email: `${deptForm.directorName.toLowerCase().replace(/\s+/g, '.')}@edg.com.gn`,
        phone: '+224 622 14 00 00',
        bio: `${deptForm.directorName} est le Directeur titulaire de cette direction de l'Électricité de Guinée S.A.`,
        responsibilities: [
          `Gouvernance globale et d'orientation de la direction`,
          `Supervision opérationnelle des dossiers`
        ],
        hierarchy_order: 1
      };
      
      onChangeDepartments([...departments, newDept]);
      onChangeTeamMembers([...teamMembers, newTeamMember]);
      showNotification('success', `Direction "${newDept.name}" créée avec succès.`);
    } else if (editingDept?.id) {
      const updated = departments.map(d => {
        if (d.id === editingDept.id) {
          return {
            ...d,
            parentId: deptForm.parentId ?? null,
            code: codeClean,
            name: deptForm.name.trim(),
            description: deptForm.description.trim(),
            icon: deptForm.icon,
            directorName: deptForm.directorName.trim(),
            directorMessage: deptForm.directorMessage.trim(),
            foundedYear: Number(deptForm.foundedYear),
            staffCount: Number(deptForm.staffCount),
            valueKey,
            valueDesc,
            themeColor: deptForm.themeColor,
            missionPillars,
            commitments,
            domains,
            values,
            historyText,
            dashboard: dashboardForm
          };
        }
        return d;
      });
      onChangeDepartments(updated);
      showNotification('success', `Direction "${deptForm.name}" modifiée de manière persistante.`);
    }

    setEditingDept(null);
  };

  const handleDeleteDept = (id: number, code: string) => {
    if (!checkAdministrateurAccess()) return;
    if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement la direction "${code.toUpperCase()}" ? Les applications associées et l'organigramme y correspondant seront désassociés.`)) {
      const updated = departments.filter(d => d.id !== id);
      onChangeDepartments(updated);
      // Supprimer les membres d'équipe associés
      const filteredTeams = teamMembers.filter(m => m.departmentId !== id);
      onChangeTeamMembers(filteredTeams);
      showNotification('success', `Direction supprimée avec succès.`);
    }
  };

  // --- STATES & HANDLERS FOR PROJECTS ---
  const [adminProjects, setAdminProjects] = useState<any[]>([]);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [projectForm, setProjectForm] = useState({
    id: 0,
    unity_id: departments[0]?.id || 1,
    label: '',
    description: '',
    image: '',
    date_debut: '',
    date_fin: '',
    niveau: 'En cours',
    type_id: 1
  });

  // --- STATES & HANDLERS FOR RECIPIENTS / EMERGENCY CONTACTS ---
  const [adminRecipients, setAdminRecipients] = useState<any[]>([]);
  const [editingRecipient, setEditingRecipient] = useState<any | null>(null);
  const [recipientForm, setRecipientForm] = useState({
    id: 0,
    unity_id: departments[0]?.id || 1,
    email: '',
    numero: '',
    raison: '',
    associated_contacts: [] as any[]
  });

  const fetchAdminProjects = async () => {
    try {
      const res = await fetch('/api/admin/projects');
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success') {
          setAdminProjects(data.data);
        }
      }
    } catch (err) {
      console.error("Erreur de chargement des projets administratifs :", err);
    }
  };

  const fetchAdminRecipients = async () => {
    try {
      const res = await fetch('/api/admin/recipients');
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success') {
          setAdminRecipients(data.data);
        }
      }
    } catch (err) {
      console.error("Erreur de chargement des destinataires :", err);
    }
  };

  // --- STATES & HANDLERS FOR TICKETS (signalements & demandes de contact) ---
  const TICKETS_PAGE_SIZE = 10;
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([]);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'Nouveau' | 'En cours' | 'Résolu'>('all');
  const [ticketTypeFilter, setTicketTypeFilter] = useState<'all' | 'contact' | 'incident'>('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const fetchAdminTickets = async () => {
    try {
      const params = new URLSearchParams();
      if (ticketStatusFilter !== 'all') params.set('status', ticketStatusFilter);
      if (ticketTypeFilter !== 'all') params.set('type', ticketTypeFilter);
      if (ticketSearch.trim()) params.set('search', ticketSearch.trim());
      params.set('page', String(ticketPage));
      params.set('page_size', String(TICKETS_PAGE_SIZE));
      const res = await apiFetch(`/api/tickets?${params.toString()}`, {}, authToken);
      if (res.ok) {
        const data = await res.json();
        setAdminTickets(Array.isArray(data.items) ? data.items : []);
        setTicketTotal(typeof data.total === 'number' ? data.total : 0);
      }
    } catch (err) {
      console.error("Erreur de chargement des tickets :", err);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: string) => {
    const targetTicket = adminTickets.find(t => t.id === id);
    if (!checkDeptWriteAccess(targetTicket?.departmentId)) return;
    try {
      const res = await apiFetch(`/api/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }, authToken);
      if (res.ok) {
        const updated = await res.json();
        setAdminTickets(prev => prev.map(t => t.id === id ? updated : t));
        showNotification('success', `Ticket ${id} marqué "${status}".`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        showNotification('err', errorData.detail || "Erreur lors de la mise à jour du ticket.");
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors de la mise à jour du ticket.');
    }
  };

  const handleDeleteTicketAdmin = async (id: string) => {
    const targetTicket = adminTickets.find(t => t.id === id);
    if (!checkDeptWriteAccess(targetTicket?.departmentId)) return;
    if (!confirm(`Voulez-vous vraiment supprimer définitivement le ticket ${id} ?`)) return;
    try {
      const res = await apiFetch(`/api/tickets/${id}`, { method: 'DELETE' }, authToken);
      if (res.ok) {
        showNotification('success', 'Ticket supprimé.');
        fetchAdminTickets();
      } else {
        showNotification('err', 'Erreur lors de la suppression du ticket.');
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors de la suppression du ticket.');
    }
  };

  // Le filtrage/pagination des tickets est fait côté serveur : on rend directement adminTickets.
  const filteredAdminTickets = adminTickets;

  // Retour à la page 1 quand un filtre ou la recherche change
  React.useEffect(() => {
    setTicketPage(1);
  }, [ticketStatusFilter, ticketTypeFilter, ticketSearch]);

  // Recharge les tickets (debounce léger pour la recherche) selon le périmètre courant
  React.useEffect(() => {
    if (activeTab !== 'tickets') return;
    const t = setTimeout(fetchAdminTickets, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ticketStatusFilter, ticketTypeFilter, ticketSearch, ticketPage]);

  // --- STATES & HANDLERS FOR DOCUMENTS (Bibliothèque GED) ---
  const [adminDocuments, setAdminDocuments] = useState<any[]>([]);
  const [documentForm, setDocumentForm] = useState({
    title: '',
    category: 'Note de service',
    unity_id: (isDeptScopedRole && userUnityId != null ? userUnityId : '') as number | '',
    author: '',
    file: null as File | null
  });
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState<'all' | string>('all');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentPage, setDocumentPage] = useState(1);
  const DOCUMENTS_PAGE_SIZE = 8;

  const DOCUMENT_CATEGORIES = ['Note de service', 'Directive', 'Modèle officiel', 'Formulaire'];

  const fetchAdminDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setAdminDocuments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Erreur de chargement de la bibliothèque de documents :", err);
    }
  };

  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkDeptWriteAccess(documentForm.unity_id === '' ? null : Number(documentForm.unity_id))) return;
    if (!documentForm.title.trim() || !documentForm.file) {
      showNotification('err', 'Erreur : le titre et le fichier sont obligatoires.');
      return;
    }
    setUploadingDocument(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', documentForm.file);
      const uploadRes = await apiFetch('/api/upload/document', { method: 'POST', body: uploadData }, authToken);
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || uploadJson.status !== 'success') {
        showNotification('err', uploadJson.detail || 'Erreur lors du téléversement du fichier.');
        setUploadingDocument(false);
        return;
      }

      const res = await apiFetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: documentForm.title.trim(),
          category: documentForm.category,
          departmentId: documentForm.unity_id === '' ? null : Number(documentForm.unity_id),
          author: documentForm.author.trim(),
          fileUrl: uploadJson.url,
          fileSize: documentForm.file.size
        })
      }, authToken);

      if (res.ok) {
        showNotification('success', `Document "${documentForm.title.trim()}" ajouté à la bibliothèque.`);
        setDocumentForm({ title: '', category: 'Note de service', unity_id: '', author: '', file: null });
        fetchAdminDocuments();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showNotification('err', errorData.detail || "Erreur lors de l'ajout du document.");
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors du téléversement.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (id: number, title: string) => {
    const targetDoc = adminDocuments.find(d => d.id === id);
    if (!checkDeptWriteAccess(targetDoc?.departmentId)) return;
    if (confirm(`Voulez-vous vraiment retirer définitivement le document "${title}" de la bibliothèque ?`)) {
      try {
        const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' }, authToken);
        if (res.ok) {
          showNotification('success', 'Document retiré de la bibliothèque.');
          fetchAdminDocuments();
        } else {
          showNotification('err', 'Erreur lors du retrait du document.');
        }
      } catch (err) {
        showNotification('err', 'Erreur réseau.');
      }
    }
  };

  // Recherche + filtre catégorie (côté client : /api/documents est partagé avec le portail public,
  // et le volume de documents reste modéré comparé aux 1150 comptes agents)
  const documentsMatching = adminDocuments.filter(d => {
    if (documentCategoryFilter !== 'all' && d.category !== documentCategoryFilter) return false;
    if (documentSearch.trim()) {
      const q = documentSearch.trim().toLowerCase();
      return (d.title || '').toLowerCase().includes(q) ||
             (d.author || '').toLowerCase().includes(q) ||
             (d.departmentLabel || '').toLowerCase().includes(q);
    }
    return true;
  });
  const documentTotalPages = Math.max(1, Math.ceil(documentsMatching.length / DOCUMENTS_PAGE_SIZE));
  const filteredAdminDocuments = documentsMatching.slice(
    (documentPage - 1) * DOCUMENTS_PAGE_SIZE,
    documentPage * DOCUMENTS_PAGE_SIZE
  );

  // Retour à la page 1 quand la recherche/le filtre change
  React.useEffect(() => {
    setDocumentPage(1);
  }, [documentSearch, documentCategoryFilter]);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Ko';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  React.useEffect(() => {
    fetchAdminProjects();
    fetchAdminRecipients();
    fetchAdminTickets();
    fetchAdminDocuments();
  }, [departments]);

  // File Upload Helper
  const handleFileUpload = async (file: File, onUploadSuccess: (url: string) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      }, authToken);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success') {
          onUploadSuccess(data.url);
          showNotification('success', 'Fichier téléversé avec succès !');
        } else {
          showNotification('err', data.detail || 'Erreur lors du téléversement.');
        }
      } else {
        const errorData = await res.json();
        showNotification('err', errorData.detail || 'Erreur de téléversement.');
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors du téléversement.');
    }
  };

  // Téléversement d'image dédié (actualités / projets) via /api/upload/image
  const handleImageUpload = async (file: File, onUploadSuccess: (url: string) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload/image', {
        method: 'POST',
        body: formData
      }, authToken);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.status === 'success') {
        onUploadSuccess(data.url);
        showNotification('success', 'Image téléversée avec succès !');
      } else {
        showNotification('err', data.detail || "Erreur lors du téléversement de l'image.");
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors du téléversement.');
    }
  };

  // Téléversement de document joint (PDF, Word, Excel...) via /api/upload/document
  const handleDocumentUpload = async (file: File, onUploadSuccess: (attachment: FileAttachment) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload/document', {
        method: 'POST',
        body: formData
      }, authToken);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.status === 'success') {
        onUploadSuccess({ name: file.name, url: data.url });
        showNotification('success', 'Document joint avec succès !');
      } else {
        showNotification('err', data.detail || 'Erreur lors du téléversement du document.');
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors du téléversement.');
    }
  };

  const handleCreateProjectClick = () => {
    if (!checkDeptWriteAccess(userUnityId ?? departments[0]?.id)) return;
    setEditingProject({ id: 0 });
    setProjectForm({
      id: 0,
      unity_id: userUnityId || departments[0]?.id || 13,
      label: '',
      description: '',
      image: '',
      date_debut: new Date().toISOString().split('T')[0],
      date_fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      niveau: 'En cours',
      type_id: 1
    });
  };

  const handleEditProjectClick = (proj: any) => {
    if (!checkDeptWriteAccess(proj.unity_id)) return;
    setEditingProject(proj);
    setProjectForm({
      id: proj.id,
      unity_id: proj.unity_id,
      label: proj.label,
      description: proj.description || '',
      image: proj.image || '',
      date_debut: proj.date_debut || '',
      date_fin: proj.date_fin || '',
      niveau: proj.niveau || 'En cours',
      type_id: proj.type_id || 1
    });
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkDeptWriteAccess(Number(projectForm.unity_id))) return;

    if (!projectForm.label.trim() || !projectForm.description.trim()) {
      showNotification('err', 'Erreur : Le titre et la description sont requis.');
      return;
    }

    try {
      const formData = new FormData();
      if (projectForm.id !== 0) {
        formData.append('id', String(projectForm.id));
      }
      formData.append('unity_id', String(projectForm.unity_id));
      formData.append('label', projectForm.label.trim());
      formData.append('description', projectForm.description.trim());
      formData.append('image', projectForm.image.trim());
      formData.append('date_debut', projectForm.date_debut);
      formData.append('date_fin', projectForm.date_fin);
      formData.append('niveau', projectForm.niveau);
      formData.append('type_id', String(projectForm.type_id));

      const res = await apiFetch('/api/admin/project/save', {
        method: 'POST',
        body: formData
      }, authToken);

      if (res.ok) {
        showNotification('success', 'Projet enregistré avec succès !');
        setEditingProject(null);
        fetchAdminProjects();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showNotification('err', `Erreur de sauvegarde : ${errorData.detail || "Erreur de serveur"}`);
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors de la sauvegarde.');
    }
  };

  const handleDeleteProject = async (id: number) => {
    const targetProject = adminProjects.find((p: any) => p.id === id);
    if (!checkDeptWriteAccess(targetProject?.unity_id)) return;
    if (confirm('Voulez-vous vraiment retirer définitivement ce projet stratégique ?')) {
      try {
        const res = await apiFetch(`/api/admin/project/${id}`, {
          method: 'DELETE'
        }, authToken);
        if (res.ok) {
          showNotification('success', 'Projet retiré avec succès.');
          fetchAdminProjects();
        } else {
          showNotification('err', 'Erreur lors du retrait du projet.');
        }
      } catch (err) {
        showNotification('err', 'Erreur réseau.');
      }
    }
  };

  const handleCreateRecipientClick = () => {
    if (!checkTeamWriteAccess(userUnityId ?? departments[0]?.id)) return;
    setEditingRecipient({ id: 0 });
    setRecipientForm({
      id: 0,
      unity_id: userUnityId || departments[0]?.id || 13,
      email: '',
      numero: '',
      raison: '',
      associated_contacts: []
    });
  };

  const handleEditRecipientClick = (rec: any) => {
    if (!checkTeamWriteAccess(rec.unity_id)) return;
    setEditingRecipient(rec);
    setRecipientForm({
      id: rec.id,
      unity_id: rec.unity_id,
      email: rec.email,
      numero: rec.numero || '',
      raison: rec.raison || '',
      associated_contacts: rec.associated_contacts || []
    });
  };

  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkTeamWriteAccess(Number(recipientForm.unity_id))) return;

    if (!recipientForm.email.trim()) {
      showNotification('err', "Erreur : L'adresse courriel du réceptionnaire est requise.");
      return;
    }

    try {
      const formData = new FormData();
      if (recipientForm.id !== 0) {
        formData.append('id', String(recipientForm.id));
      }
      formData.append('unity_id', String(recipientForm.unity_id));
      formData.append('email', recipientForm.email.trim());
      formData.append('numero', recipientForm.numero.trim());
      formData.append('raison', recipientForm.raison.trim());
      formData.append('associated_contacts_json', JSON.stringify(recipientForm.associated_contacts));

      const res = await apiFetch('/api/admin/recipient/save', {
        method: 'POST',
        body: formData
      }, authToken);

      if (res.ok) {
        showNotification('success', "Destinataire d'urgence enregistré avec succès !");
        setEditingRecipient(null);
        fetchAdminRecipients();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showNotification('err', `Erreur lors de l'enregistrement : ${errorData.detail || "Erreur de serveur"}`);
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors de la sauvegarde.');
    }
  };

  const handleDeleteRecipient = async (id: number) => {
    const targetRecipient = adminRecipients.find((r: any) => r.id === id);
    if (!checkTeamWriteAccess(targetRecipient?.unity_id)) return;
    if (confirm("Voulez-vous vraiment retirer définitivement ce point de contact d'urgence ?")) {
      try {
        const res = await apiFetch(`/api/admin/recipient/${id}`, {
          method: 'DELETE'
        }, authToken);
        if (res.ok) {
          showNotification('success', 'Destinataire d\'urgence supprimé.');
          fetchAdminRecipients();
        } else {
          showNotification('err', 'Erreur lors de la suppression.');
        }
      } catch (err) {
        showNotification('err', 'Erreur réseau.');
      }
    }
  };


  // --- 5. STATES FOR GLOBAL SETTINGS ---
  const [emergencyPhone, setEmergencyPhone] = useState(siteSettings.support_phone || '144');
  const [emergencyEmail, setEmergencyEmail] = useState(siteSettings.support_email || 'helpdesk@edg.com.gn');
  const [platformTitle, setPlatformTitle] = useState(siteSettings.site_title || 'Électricité de Guinée - Portail Intranet');
  const [operationalStandard, setOperationalStandard] = useState(siteSettings.iso_standard || 'ISO 50001 : Performance Énergétique');
  const [appVersion, setAppVersion] = useState(siteSettings.operational_version || 'v2.4.1 Stable');
  const [welcomeTitle, setWelcomeTitle] = useState(siteSettings.welcome_title || 'Bienvenue à EDG S.A.');
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(siteSettings.welcome_subtitle || "Communiqués officiels, applications métiers et données des directions d'Électricité de Guinée, réunis dans votre espace de travail sécurisé.");
  const [appHubUrl, setAppHubUrl] = useState(siteSettings.app_hub_url || '');

  // Extended Logo settings
  const [logoType, setLogoType] = useState(siteSettings.logo_type || 'official');
  const [logoText, setLogoText] = useState(siteSettings.logo_text || 'EDG');
  const [logoUrl, setLogoUrl] = useState(siteSettings.logo_url || '');

  // Extended editable Footer fields
  const [instName, setInstName] = useState(siteSettings.institution_name || "Electricité de Guinée");
  const [instDesc, setInstDesc] = useState(siteSettings.institution_desc || "EDG SA est la société nationale d'utilité publique chargée de l'exploitation, de la régulation et de l'acheminement de l'énergie électrique en République de Guinée.");
  const [footerSupportTitle, setFooterSupportTitle] = useState(siteSettings.footer_support_title || "Assistance & Réseau");
  const [footerNetworkRegion, setFooterNetworkRegion] = useState(siteSettings.footer_network_region || "Réseau Intérieur Sécurisé : Conakry, Guinée");
  const [footerSecurityTitle, setFooterSecurityTitle] = useState(siteSettings.footer_security_title || "Statut Sécurité & Accords");
  const [footerSecurityText, setFooterSecurityText] = useState(siteSettings.footer_security_text || "Ce portail intranet est déployé en consultation directe pour l'ensemble du personnel technique et administratif de l’EDG SA. Tout signalement d'incident émis est archivé conformément aux protocoles [ISO] de gestion énergétique.");
  const [officialWebsiteLabel, setOfficialWebsiteLabel] = useState(siteSettings.official_website_label || "Site officiel");
  const [officialWebsiteUrl, setOfficialWebsiteUrl] = useState(siteSettings.official_website_url || "https://edg.com.gn");
  const [copyrightCompany, setCopyrightCompany] = useState(siteSettings.copyright_company || "Electricité de Guinée (EDG) S.A. Tous droits réservés.");

  // Bi-directional synchronization for reset actions or initial loads
  React.useEffect(() => {
    setPlatformTitle(siteSettings.site_title || 'Électricité de Guinée - Portail Intranet');
    setEmergencyPhone(siteSettings.support_phone || '144');
    setEmergencyEmail(siteSettings.support_email || 'helpdesk@edg.com.gn');
    setOperationalStandard(siteSettings.iso_standard || 'ISO 50001 : Performance Énergétique');
    setAppVersion(siteSettings.operational_version || 'v2.4.1 Stable');
    setLogoType(siteSettings.logo_type || 'official');
    setLogoText(siteSettings.logo_text || 'EDG');
    setLogoUrl(siteSettings.logo_url || '');
    setInstName(siteSettings.institution_name || "Electricité de Guinée");
    setInstDesc(siteSettings.institution_desc || "EDG SA est la société nationale d'utilité publique chargée de l'exploitation, de la régulation et de l'acheminement de l'énergie électrique en République de Guinée.");
    setFooterSupportTitle(siteSettings.footer_support_title || "Assistance & Réseau");
    setFooterNetworkRegion(siteSettings.footer_network_region || "Réseau Intérieur Sécurisé : Conakry, Guinée");
    setFooterSecurityTitle(siteSettings.footer_security_title || "Statut Sécurité & Accords");
    setFooterSecurityText(siteSettings.footer_security_text || "Ce portail intranet est déployé en consultation directe pour l'ensemble du personnel technique et administratif de l’EDG SA. Tout signalement d'incident émis est archivé conformément aux protocoles [ISO] de gestion énergétique.");
    setOfficialWebsiteLabel(siteSettings.official_website_label || "Site officiel");
    setOfficialWebsiteUrl(siteSettings.official_website_url || "https://edg.com.gn");
    setCopyrightCompany(siteSettings.copyright_company || "Electricité de Guinée (EDG) S.A. Tous droits réservés.");
  }, [siteSettings]);

  // --- 5. GESTION DES ACTUALITÉS / ARTICLES ---
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: 'communique',
    tags: '',
    isGlobal: true,
    departmentId: departments[0]?.id || 13,
    image: 'linear-gradient(135deg, #048343 0%, #10b981 100%)',
    files: [] as FileAttachment[]
  });

  const handleCreateArticleClick = () => {
    const canCreateGlobal = isAdministrateur || (isRhDirection && userUnityId == null);
    if (!checkDeptWriteAccess(userUnityId ?? departments[0]?.id)) return;
    setEditingArticle({ id: 0 });
    setArticleForm({
      title: '',
      excerpt: '',
      content: '',
      category: 'communique',
      tags: 'EDG, Note, Circulaire',
      isGlobal: canCreateGlobal,
      departmentId: userUnityId || departments[0]?.id || 13,
      image: 'linear-gradient(135deg, #048343 0%, #10b981 100%)',
      files: []
    });
  };

  const handleEditArticleClick = (art: Article) => {
    if (!checkDeptWriteAccess(art.departmentId ?? null)) return;
    setEditingArticle(art);
    setArticleForm({
      title: art.title,
      excerpt: art.excerpt,
      content: art.content,
      category: art.category || 'communique',
      tags: art.tags.join(', '),
      isGlobal: art.isGlobal,
      departmentId: art.departmentId || departments[0]?.id || 13,
      image: art.image || '#048343',
      files: art.files || []
    });
  };

  const handleSaveArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkDeptWriteAccess(articleForm.isGlobal ? null : Number(articleForm.departmentId))) return;

    if (!articleForm.title.trim() || !articleForm.content.trim()) {
      showNotification('err', 'Erreur : Le titre et le contenu sont requis.');
      return;
    }

    const tagsArray = articleForm.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Chapeau auto-généré depuis le contenu : on retire les balises HTML (sinon on verrait des <strong> en clair).
    const contentPlain = articleForm.content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const autoExcerpt = contentPlain.length > 160 ? contentPlain.slice(0, 160).trimEnd() + '…' : contentPlain;

    const articleData: Article = {
      id: editingArticle?.id === 0 ? (articles.length > 0 ? Math.max(...articles.map(a => a.id)) + 1 : 1) : (editingArticle?.id as number),
      title: articleForm.title.trim(),
      excerpt: articleForm.excerpt.trim() || autoExcerpt,
      content: articleForm.content.trim(),
      category: articleForm.category,
      tags: tagsArray,
      isGlobal: articleForm.isGlobal,
      departmentId: articleForm.isGlobal ? undefined : Number(articleForm.departmentId),
      image: articleForm.image,
      files: articleForm.files,
      createdAt: editingArticle?.createdAt || new Date().toISOString()
    };

    let updatedList: Article[];
    if (editingArticle?.id === 0) {
      updatedList = [articleData, ...articles];
      showNotification('success', 'Actualité / Note Circulaire ajoutée avec succès !');
    } else {
      updatedList = articles.map(art => art.id === editingArticle?.id ? articleData : art);
      showNotification('success', 'Actualité / Note Circulaire mise à jour avec succès !');
    }

    onChangeArticles(updatedList);
    setEditingArticle(null);
  };

  const handleDeleteArticle = (id: number, title: string) => {
    const targetArticle = articles.find(a => a.id === id);
    if (!checkDeptWriteAccess(targetArticle?.departmentId ?? null)) return;
    if (window.confirm(`Voulez-vous vraiment supprimer l'actualité "${title}" ?`)) {
      const updatedList = articles.filter(art => art.id !== id);
      onChangeArticles(updatedList);
      showNotification('success', 'Actualité / Note Circulaire supprimée définitivement.');
    }
  };

  // Handle immediate keypress propagation for real-time live preview & active footer styling
  const handleLiveUpdateField = (key: string, value: string) => {
    if (!isAdministrateur) return;
    onChangeSiteSettings({
      ...siteSettings,
      [key]: value
    });
  };

  // --- STATES & HANDLERS FOR USER ACCOUNTS (Comptes) — réservé à l'Administrateur ---
  interface AdminUserAccount {
    id: number;
    name: string;
    email: string;
    role: 'agent' | 'chef_service' | 'rh_direction' | 'administrateur';
    departmentId: number | null;
    departmentLabel: string;
    title: string;
  }
  const [adminUsers, setAdminUsers] = useState<AdminUserAccount[]>([]);
  const [editingUserAccount, setEditingUserAccount] = useState<Partial<AdminUserAccount> | null>(null);
  const [userAccountForm, setUserAccountForm] = useState({
    name: '',
    email: '',
    role: 'agent' as AdminUserAccount['role'],
    departmentId: (departments[0]?.id || '') as number | '',
    title: '',
    password: ''
  });
  // Recherche / filtres / pagination côté serveur (indispensable pour ~1150 agents)
  const USERS_PAGE_SIZE = 12;
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | AdminUserAccount['role']>('all');
  const [userDeptFilter, setUserDeptFilter] = useState<'all' | number>('all');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  const fetchAdminUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.set('search', userSearch.trim());
      if (userRoleFilter !== 'all') params.set('role', userRoleFilter);
      if (userDeptFilter !== 'all') params.set('department_id', String(userDeptFilter));
      params.set('page', String(userPage));
      params.set('page_size', String(USERS_PAGE_SIZE));
      const res = await apiFetch(`/api/admin/users?${params.toString()}`, {}, authToken);
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(Array.isArray(data.items) ? data.items : []);
        setUserTotal(typeof data.total === 'number' ? data.total : 0);
      }
    } catch (err) {
      console.error("Erreur de chargement des comptes :", err);
    }
  };

  // Remet la pagination à la page 1 quand la recherche ou un filtre change
  React.useEffect(() => {
    setUserPage(1);
  }, [userSearch, userRoleFilter, userDeptFilter]);

  // Recharge (avec léger debounce pour la recherche) dès que le périmètre change
  React.useEffect(() => {
    if (activeTab !== 'users' || !isAdministrateur) return;
    const t = setTimeout(fetchAdminUsers, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userSearch, userRoleFilter, userDeptFilter, userPage]);

  const handleCreateUserClick = () => {
    setEditingUserAccount({ id: 0 });
    setUserAccountForm({ name: '', email: '', role: 'agent', departmentId: departments[0]?.id || '', title: '', password: '' });
  };

  const handleEditUserClick = (u: AdminUserAccount) => {
    setEditingUserAccount(u);
    setUserAccountForm({ name: u.name, email: u.email, role: u.role, departmentId: u.departmentId ?? '', title: u.title || '', password: '' });
  };

  const handleSaveUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdministrateur) return;
    if (!userAccountForm.name.trim() || !userAccountForm.email.trim()) {
      showNotification('err', 'Erreur : le nom et l\'email sont obligatoires.');
      return;
    }
    if ((userAccountForm.role === 'agent' || userAccountForm.role === 'chef_service') && !userAccountForm.departmentId) {
      showNotification('err', 'Erreur : une direction de rattachement est obligatoire pour ce rôle.');
      return;
    }
    const isCreate = editingUserAccount?.id === 0;
    if (isCreate && !userAccountForm.password.trim()) {
      showNotification('err', 'Erreur : un mot de passe initial est requis pour un nouveau compte.');
      return;
    }

    const payload: Record<string, unknown> = {
      name: userAccountForm.name.trim(),
      email: userAccountForm.email.trim(),
      role: userAccountForm.role,
      departmentId: userAccountForm.role === 'administrateur' || userAccountForm.departmentId === '' ? null : Number(userAccountForm.departmentId),
      title: userAccountForm.title.trim()
    };
    if (userAccountForm.password.trim()) {
      payload.password = userAccountForm.password.trim();
    }

    try {
      const res = isCreate
        ? await apiFetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, authToken)
        : await apiFetch(`/api/admin/users/${editingUserAccount!.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, authToken);
      if (res.ok) {
        showNotification('success', isCreate ? 'Compte créé avec succès.' : 'Compte mis à jour avec succès.');
        setEditingUserAccount(null);
        fetchAdminUsers();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showNotification('err', errorData.detail || "Erreur lors de l'enregistrement du compte.");
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors de la sauvegarde du compte.');
    }
  };

  const handleDeleteUserAccount = async (id: number) => {
    if (!isAdministrateur) return;
    if (!confirm('Voulez-vous vraiment supprimer définitivement ce compte ?')) return;
    try {
      const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }, authToken);
      if (res.ok) {
        showNotification('success', 'Compte supprimé.');
        fetchAdminUsers();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showNotification('err', errorData.detail || 'Erreur lors de la suppression du compte.');
      }
    } catch (err) {
      showNotification('err', 'Erreur réseau lors de la suppression du compte.');
    }
  };

  return (
    <div id="cms-dashboard-container" className="font-sans">
      <div className="lg:flex">

        {/* Sidebar app-shell : rail de nav FIXE collé au mur gauche, comme les espaces direction */}
        <div className="lg:w-56 lg:shrink-0">
          <nav
            aria-label="Sections d'administration"
            className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible p-4 lg:p-0 max-lg:border-b max-lg:border-slate-200 lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:w-56 lg:bg-white lg:dark:bg-slate-900/40 lg:border-r lg:border-slate-200 lg:dark:border-white/10 lg:z-20"
          >
            {/* Logo EDG en haut de la sidebar (le header est décalé à droite sur la console) */}
            <div
              onClick={() => onNavigate?.('hub')}
              title="Retour à l'accueil"
              className="hidden lg:flex items-center gap-3 h-16 px-4 border-b border-slate-200/70 dark:border-white/10 shrink-0 cursor-pointer group"
            >
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg group-hover:scale-102 transition-transform duration-200">
                <EdgLogo className="w-full h-full" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-extrabold tracking-tight text-md text-zinc-900 dark:text-white">EDG</span>
                <span className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-[9px] font-mono font-medium px-2 py-0.5 rounded uppercase tracking-wider">ADMIN</span>
              </div>
            </div>

            {/* Zone défilante : tout SAUF le logo (qui reste fixe en haut de la sidebar) */}
            <div className="contents lg:flex lg:flex-col lg:gap-1 lg:flex-1 lg:overflow-y-auto lg:p-4 scrollbar-hide">

            {/* Carte « utilisateur connecté » */}
            {currentUser && (
              <div className="hidden lg:block mb-3 rounded-2xl bg-gradient-to-br from-[#E21B23] to-[#b0141a] p-3.5 text-white shadow-lg shadow-[#E21B23]/25">
                {/* Identité */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/20 ring-1 ring-white/40 flex items-center justify-center text-[12px] font-black shrink-0">
                    {getUserInitials(currentUser.name)}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="text-[12.5px] font-extrabold truncate">{currentUser.name}</p>
                    <p className="text-[9px] font-mono uppercase tracking-wider text-white/85 truncate">
                      {ADMIN_ROLE_META[currentUser.role]?.label || 'Agent'}
                    </p>
                  </div>
                </div>
                {/* Infos complémentaires */}
                <div className="mt-3 pt-2.5 border-t border-white/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/90">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0 animate-pulse"></span>
                    <span className="font-semibold">Session active</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/85 min-w-0">
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{currentUser.email}</span>
                  </div>
                </div>
              </div>
            )}

          {(isChefService || isRhDirection || isAdministrateur) && (
            <>
              <AdminNavSection>Contenu</AdminNavSection>
              <AdminNavItem
                icon={FileText}
                label="Actualités & circulaires"
                count={articles.length}
                active={activeTab === 'articles'}
                onClick={() => { setActiveTab('articles'); setEditingArticle(null); }}
              />
              <AdminNavItem
                icon={FolderKanban}
                label="Projets de directions"
                count={adminProjects.length}
                active={activeTab === 'projects'}
                onClick={() => { setActiveTab('projects'); setEditingProject(null); }}
              />
              <AdminNavItem
                icon={BookOpen}
                label="Bibliothèque"
                count={adminDocuments.length}
                active={activeTab === 'documents'}
                onClick={() => setActiveTab('documents')}
              />
              <AdminNavItem
                icon={Inbox}
                label="Tickets"
                count={ticketTotal}
                active={activeTab === 'tickets'}
                onClick={() => setActiveTab('tickets')}
              />
            </>
          )}

          {(isRhDirection || isAdministrateur) && (
            <>
              <AdminNavSection>Organisation</AdminNavSection>
              <AdminNavItem
                icon={Network}
                label="Organigramme (postes)"
                active={activeTab === 'postes'}
                onClick={() => setActiveTab('postes')}
              />
              <AdminNavItem
                icon={Workflow}
                label="Organigrammes / circuits"
                active={activeTab === 'workflows'}
                onClick={() => setActiveTab('workflows')}
              />
              <AdminNavItem
                icon={PhoneCall}
                label="Contacts d'urgence"
                count={adminRecipients.length}
                active={activeTab === 'recipients'}
                onClick={() => { setActiveTab('recipients'); setEditingRecipient(null); }}
              />
            </>
          )}

          {isAdministrateur && (
            <>
              <AdminNavSection>Système</AdminNavSection>
              <AdminNavItem
                icon={Building2}
                label="Directions"
                count={departments.length}
                active={activeTab === 'depts'}
                onClick={() => { setActiveTab('depts'); setEditingDept(null); }}
              />
              <AdminNavItem
                icon={Link2}
                label="Portail applicatif"
                count={applications.length}
                active={activeTab === 'apps'}
                onClick={() => setActiveTab('apps')}
              />
              <AdminNavItem
                icon={User2}
                label="Comptes"
                active={activeTab === 'users'}
                onClick={() => setActiveTab('users')}
              />
              <AdminNavItem
                icon={Sliders}
                label="Configurations"
                active={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              />
              <AdminNavItem
                icon={ShieldCheck}
                label="Journal de sécurité"
                active={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
              />
            </>
          )}
          </div>
          </nav>
        </div>

        {/* Colonne contenu — décalée à droite de la sidebar fixe */}
        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* Bandeau titre de la console */}
          <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-300 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase mb-1">
                <Sliders size={11} className="inline mr-1" />
                <span>Panneau d'Administration de l'Intranet</span>
              </span>
              <h2 className="font-display font-black text-2xl text-slate-900 dark:text-white tracking-tight">
                Espace d'Administration Général de l'EDG
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl font-sans leading-relaxed">
                Créez et configurez les directions, raccordez les logiciels métiers, organisez l'organigramme de l'équipe et modifiez les paramètres institutionnels d'EDG SA.
              </p>
            </div>
          </div>

          {/* Dynamic Action Content panel */}
          <div className="bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-3xl shadow-xl p-6 sm:p-8 text-slate-800 dark:text-slate-200">

          {/* TAB 1: GESTION DIRECTIONS */}
          {activeTab === 'depts' && (
            <div className="space-y-6">
              {!editingDept ? (
                <>
                  <div className="flex items-center justify-between border-b border-slide-100 dark:border-white/5 pb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        Directions EDG SA enregistrées sur le portail
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Cliquez sur une entité pour éditer ses dossiers de missions, ses valeurs ou son autorité de direction.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateDeptClick}
                      className="btn-premium btn-premium-green px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      <span>Ajouter une Direction</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {departments.map((dept) => (
                      <div
                        key={dept.id}
                        onClick={() => handleEditDeptClick(dept)}
                        className="group relative overflow-hidden border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-slate-900/40 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                      >
                        {/* Accent vert EDG discret (gauche), se renforce au survol */}
                        <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/70 group-hover:bg-emerald-500 group-hover:w-1.5 transition-all" />

                        <div className="p-4.5 pl-5">
                          {/* En-tête : sigle + icône */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono font-bold text-[10px] uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                              {dept.code}
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <LucideIcon name={dept.icon} size={18} />
                            </div>
                          </div>

                          <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white mt-2.5 line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">{dept.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed min-h-[2.25rem]">
                            {dept.description || <span className="italic text-slate-400">Aucune description renseignée.</span>}
                          </p>

                          {/* Directeur + méta */}
                          <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-black shrink-0">
                                {getUserInitials(dept.directorName)}
                              </div>
                              <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">{dept.directorName}</p>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">{dept.staffCount} agents · {dept.foundedYear}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1.5 px-4.5 pb-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditDeptClick(dept); }}
                            className="px-2.5 py-1.5 bg-[#FCE500]/20 dark:bg-[#FCE500]/15 text-amber-800 dark:text-amber-300 border border-[#FCE500]/60 dark:border-[#FCE500]/30 hover:bg-[#FCE500]/35 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Edit3 size={12} />
                            <span>Modifier</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept.id, dept.code); }}
                            className="p-1.5 bg-slate-100 dark:bg-white/5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors"
                            title="Supprimer la direction"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveDept} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900">
                        {editingDept.id === 0 ? "Ajouter une nouvelle Direction" : `Modifier la Direction ${deptForm.code.toUpperCase()}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Assurez-vous de renseigner les valeurs clés pour l'affichage dynamique sur le gabarit.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingDept(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Code / Sigle de l'entité</label>
                      <input
                        type="text"
                        required
                        placeholder="ex: logistique, dsi, rh"
                        value={deptForm.code}
                        onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Direction : Nom Complet</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="ex: Direction des Achats, Approvisionnement et Logistique"
                        value={deptForm.name}
                        onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm resize-y leading-normal"
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mission en chef (Une ligne d'introduction)</label>
                      {/* Texte simple : cette phrase est affichée en texte brut partout (cartes, recherche, à-propos). */}
                      <textarea
                        rows={2}
                        value={deptForm.description}
                        onChange={(e) => setDeptForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Une phrase courte résumant le périmètre d'action..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-400 shadow-sm resize-y leading-normal"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mot du Directeur / Message d'accueil</label>
                      <RichTextEditor
                        value={deptForm.directorMessage}
                        onChange={(html) => setDeptForm(prev => ({ ...prev, directorMessage: html }))}
                        placeholder="Assurer la disponibilité permanente de nos équipes..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nom du Directeur Titulaire</label>
                      <input
                        type="text"
                        required
                        placeholder="M. Ibrahima Diallo"
                        value={deptForm.directorName}
                        onChange={(e) => setDeptForm({ ...deptForm, directorName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nombre d'agents du personnel</label>
                      <input
                        type="number"
                        placeholder="84"
                        value={deptForm.staffCount}
                        onChange={(e) => setDeptForm({ ...deptForm, staffCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Année de Fondation nationale</label>
                      <input
                        type="number"
                        placeholder="2005"
                        value={deptForm.foundedYear}
                        onChange={(e) => setDeptForm({ ...deptForm, foundedYear: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Entité parente (organigramme)</label>
                      <select
                        value={deptForm.parentId ?? ''}
                        onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm cursor-pointer"
                      >
                        <option value="">Aucune (racine de l'organigramme)</option>
                        {departments
                          .filter(d => d.id !== editingDept?.id)
                          .map(d => (
                            <option key={d.id} value={d.id}>{d.code.toUpperCase()} — {d.name}</option>
                          ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">Rattachez cette entité à une direction/service parent, ou laissez « racine » (ex : DSI peut être racine ou rattachée au DG).</p>
                    </div>
                  </div>

                  {/* SECONDARY EXTENDED DYNAMIC SECTIONS (nombre de cartes illimité, ajout/suppression libre) */}
                  <div className="border-t border-slate-200 dark:border-white/10 pt-6 mt-6 space-y-6">

                    {/* Values section */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-display font-extrabold text-xs text-emerald-850 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                          <span>💎 Valeurs Fondamentales</span>
                        </h4>
                        <button
                          type="button"
                          onClick={addValueItem}
                          className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Ajouter une valeur</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                        La 1ère valeur est la "valeur clé" affichée en bannière sur la page d'accueil de la direction. Ajoutez ou supprimez librement des valeurs.
                      </p>

                      <div className="space-y-4">
                        {valuesForm.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">Aucune valeur. Ajoutez-en une ci-dessus.</p>
                        )}
                        {valuesForm.map((v, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs relative">
                            <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Valeur {idx + 1}{idx === 0 ? ' (clé)' : ''} : Titre court</label>
                              <input
                                type="text"
                                value={v.title}
                                onChange={(e) => updateValueItem(idx, 'title', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-md text-xs text-slate-850 dark:text-white"
                              />
                            </div>
                            <div className="md:col-span-2 flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Valeur {idx + 1} : Description détaillée</label>
                                <RichTextEditor
                                  value={v.desc}
                                  onChange={(html) => updateValueItem(idx, 'desc', html)}
                                />
                              </div>
                              <button
                                type="button" onClick={() => removeValueItem(idx)}
                                className="mt-6 flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer shrink-0"
                                title="Supprimer cette valeur"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mission Pillars section */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-display font-extrabold text-xs text-emerald-850 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                          <span>🎯 Piliers de la "Mission"</span>
                        </h4>
                        <button
                          type="button"
                          onClick={addMissionPillar}
                          className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Ajouter un pilier</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                        Modifiez les titres et phrases d’explication clés qui s'affichent sous l'onglet Mission de cette direction. Ajoutez ou supprimez librement des piliers.
                      </p>

                      <div className="space-y-4">
                        {missionPillarsForm.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">Aucun pilier. Ajoutez-en un ci-dessus.</p>
                        )}
                        {missionPillarsForm.map((p, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                            <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pilier {idx + 1} : Titre court</label>
                              <input
                                type="text"
                                value={p.title}
                                onChange={(e) => updateMissionPillar(idx, 'title', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-md text-xs text-slate-850 dark:text-white"
                              />
                            </div>
                            <div className="md:col-span-2 flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pilier {idx + 1} : Description détaillée</label>
                                <RichTextEditor
                                  value={p.desc}
                                  onChange={(html) => updateMissionPillar(idx, 'desc', html)}
                                />
                              </div>
                              <button
                                type="button" onClick={() => removeMissionPillar(idx)}
                                className="mt-6 flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer shrink-0"
                                title="Supprimer ce pilier"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Commitments dynamic fields section */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-display font-extrabold text-xs text-emerald-850 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                          <span>🛡️ Charte et indicateurs d'engagement de service</span>
                        </h4>
                        <button
                          type="button"
                          onClick={addCommitment}
                          className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Ajouter un engagement</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                        Modifiez les engagements statutaires et leurs objectifs d'excellence. Ajoutez ou supprimez librement des engagements.
                      </p>

                      <div className="space-y-4">
                        {commitmentsForm.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">Aucun engagement. Ajoutez-en un ci-dessus.</p>
                        )}
                        {commitmentsForm.map((c, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-3.5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-emerald-600">Engagement {idx + 1}</span>
                              <button
                                type="button" onClick={() => removeCommitment(idx)}
                                className="flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer"
                                title="Supprimer cet engagement"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Objectif généraux (ex: Rigueur)</label>
                                <input
                                  type="text"
                                  value={c.objective}
                                  onChange={(e) => updateCommitment(idx, 'objective', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-md text-xs text-slate-850 dark:text-white"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Titre de l'engagement de service</label>
                                <input
                                  type="text"
                                  value={c.title}
                                  onChange={(e) => updateCommitment(idx, 'title', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-md text-xs text-slate-850 dark:text-white"
                                />
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Cible de performance (ex: 99%)</label>
                                <input
                                  type="text"
                                  value={c.metric}
                                  onChange={(e) => updateCommitment(idx, 'metric', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-md text-xs text-slate-850 dark:text-white"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description explicative détaillée de l'engagement</label>
                              <RichTextEditor
                                value={c.description}
                                onChange={(html) => updateCommitment(idx, 'description', html)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* About details & Intervention Domains section */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                      <div>
                        <h4 className="font-display font-extrabold text-xs text-emerald-850 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center space-x-2">
                          <span>💡 Historique complet & Domaines d'intervention</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Rédigez l’historique institutionnel personnalisé de l’entité et gérez librement les domaines d’intervention opérationnels.
                        </p>
                      </div>

                      {/* History Narrative */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Historique personnalisé de la Direction (Affiché globalement)</label>
                        <RichTextEditor
                          value={deptForm.historyText}
                          onChange={(html) => setDeptForm(prev => ({ ...prev, historyText: html }))}
                          placeholder="Écrivez le récit historique ou laissez vide par défaut..."
                        />
                      </div>

                      {/* Intervention Domains */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-emerald-600">Domaines d'Intervention</span>
                        <button
                          type="button"
                          onClick={addDomain}
                          className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Ajouter un domaine</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {domainsForm.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic md:col-span-2">Aucun domaine. Ajoutez-en un ci-dessus.</p>
                        )}
                        {domainsForm.map((d, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-2.5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-emerald-600">Secteur d'Activité {idx + 1}</span>
                              <button
                                type="button" onClick={() => removeDomain(idx)}
                                className="flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer"
                                title="Supprimer ce domaine"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Titre du domaine</label>
                                <input
                                  type="text"
                                  value={d.title}
                                  onChange={(e) => updateDomain(idx, 'title', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-xs text-slate-850 dark:text-white font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Icône Lucide</label>
                                <input
                                  type="text"
                                  value={d.icon}
                                  onChange={(e) => updateDomain(idx, 'icon', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-xs text-slate-850 dark:text-white font-semibold"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Description de l'activité</label>
                              <RichTextEditor
                                value={d.desc}
                                onChange={(html) => updateDomain(idx, 'desc', html)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance Dashboard: KPIs + Graphique */}
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
                      <div>
                        <h4 className="font-display font-extrabold text-xs text-emerald-850 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center space-x-2">
                          <BarChart3 size={14} />
                          <span>Tableau de Bord : Indicateurs & Graphique de Performance</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Ces cartes et ce graphique sont affichés sur la page d'accueil de la direction. Renseignez des données réelles pour qu'ils cessent d'être des exemples.
                        </p>
                      </div>

                      {/* Titre / Sous-titre / Type de graphique */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Titre du tableau de bord</label>
                          <input
                            type="text"
                            value={dashboardForm.title}
                            onChange={(e) => setDashboardForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-xs text-slate-850 dark:text-white font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Type de graphique</label>
                          <select
                            value={dashboardForm.chartType}
                            onChange={(e) => setDashboardForm(prev => ({ ...prev, chartType: e.target.value as 'area' | 'bar' | 'line' }))}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-xs text-slate-850 dark:text-white font-semibold"
                          >
                            <option value="area">Aires</option>
                            <option value="bar">Barres</option>
                            <option value="line">Lignes</option>
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Sous-titre</label>
                          <input
                            type="text"
                            value={dashboardForm.subtitle}
                            onChange={(e) => setDashboardForm(prev => ({ ...prev, subtitle: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-xs text-slate-850 dark:text-white font-semibold"
                          />
                        </div>
                      </div>

                      {/* Cartes KPI */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-emerald-600">Cartes Indicateurs (KPI)</span>
                          <button
                            type="button"
                            onClick={addDashboardKpi}
                            className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>Ajouter un KPI</span>
                          </button>
                        </div>
                        {dashboardForm.kpis.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">Aucun indicateur. Ajoutez-en un ci-dessus.</p>
                        )}
                        {dashboardForm.kpis.map((kpi, idx) => (
                          <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center border-b border-slate-100 dark:border-white/5 pb-2.5 last:border-0 last:pb-0">
                            <input
                              type="text" placeholder="Libellé" value={kpi.label}
                              onChange={(e) => updateDashboardKpi(idx, 'label', e.target.value)}
                              className="col-span-2 sm:col-span-1 px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                            />
                            <input
                              type="text" placeholder="Valeur (ex: 99.98%)" value={kpi.value}
                              onChange={(e) => updateDashboardKpi(idx, 'value', e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                            />
                            <input
                              type="text" placeholder="Sous-texte" value={kpi.sub}
                              onChange={(e) => updateDashboardKpi(idx, 'sub', e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                            />
                            <input
                              type="text" placeholder="Icône Lucide" value={kpi.icon}
                              onChange={(e) => updateDashboardKpi(idx, 'icon', e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                            />
                            <button
                              type="button" onClick={() => removeDashboardKpi(idx)}
                              className="flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer"
                              title="Supprimer ce KPI"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Séries du graphique */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-emerald-600">Séries du Graphique</span>
                          <button
                            type="button"
                            onClick={addDashboardSeries}
                            className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>Ajouter une série</span>
                          </button>
                        </div>
                        {dashboardForm.series.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">Aucune série. Ajoutez-en une ci-dessus.</p>
                        )}
                        {dashboardForm.series.map((s, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center border-b border-slate-100 dark:border-white/5 pb-2.5 last:border-0 last:pb-0">
                            <input
                              type="text" placeholder="Clé technique" value={s.key}
                              onChange={(e) => renameSeriesKey(s.key, e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white font-mono"
                            />
                            <input
                              type="text" placeholder="Libellé affiché" value={s.label}
                              onChange={(e) => updateDashboardSeries(idx, 'label', e.target.value)}
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                            />
                            <input
                              type="color" value={s.color}
                              onChange={(e) => updateDashboardSeries(idx, 'color', e.target.value)}
                              className="w-9 h-8 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded cursor-pointer"
                              title="Couleur de la série"
                            />
                            <button
                              type="button" onClick={() => removeDashboardSeries(s.key)}
                              className="flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer"
                              title="Supprimer cette série"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Points du graphique */}
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2.5 overflow-x-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-emerald-600">Points du Graphique (mois, trimestres...)</span>
                          <button
                            type="button"
                            onClick={addDashboardPoint}
                            className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer shrink-0"
                          >
                            <Plus size={12} />
                            <span>Ajouter un point</span>
                          </button>
                        </div>
                        {dashboardForm.chartData.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">Aucun point de données. Ajoutez-en un ci-dessus.</p>
                        )}
                        {dashboardForm.chartData.length > 0 && (
                          <table className="w-full text-[11px] min-w-max">
                            <thead>
                              <tr className="text-left">
                                <th className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] pb-1.5 pr-2">Nom (axe X)</th>
                                {dashboardForm.series.map(s => (
                                  <th key={s.key} className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] pb-1.5 px-2">{s.label || s.key}</th>
                                ))}
                                <th className="pb-1.5"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardForm.chartData.map((point, idx) => (
                                <tr key={idx}>
                                  <td className="pr-2 py-1">
                                    <input
                                      type="text" value={point.name}
                                      onChange={(e) => updateDashboardPoint(idx, 'name', e.target.value)}
                                      className="w-24 px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                                    />
                                  </td>
                                  {dashboardForm.series.map(s => (
                                    <td key={s.key} className="px-2 py-1">
                                      <input
                                        type="number" step="any" value={point[s.key] ?? 0}
                                        onChange={(e) => updateDashboardPoint(idx, s.key, e.target.value === '' ? 0 : Number(e.target.value))}
                                        className="w-20 px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded text-[11px] text-slate-850 dark:text-white"
                                      />
                                    </td>
                                  ))}
                                  <td className="py-1">
                                    <button
                                      type="button" onClick={() => removeDashboardPoint(idx)}
                                      className="flex items-center justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded cursor-pointer"
                                      title="Supprimer ce point"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-155 dark:border-white/5 pt-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-2">Icône Métier (Lucide)</label>
                      <select
                        value={deptForm.icon}
                        onChange={(e) => setDeptForm({ ...deptForm, icon: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-400 shadow-sm"
                      >
                        <option value="Laptop">Ordinateur (Laptop)</option>
                        <option value="Briefcase">Mallette (Briefcase)</option>
                        <option value="Users">Profils (Users)</option>
                        <option value="Zap">Énergie (Zap)</option>
                        <option value="Search">Contrôleur (Search)</option>
                        <option value="Truck">Camion (Truck)</option>
                        <option value="FileText">Contrat (FileText)</option>
                        <option value="Cpu">Serveur/Générateur (Cpu)</option>
                        <option value="TrendingUp">Statistiques (TrendingUp)</option>
                        <option value="Sparkles">Baguette (Sparkles)</option>
                        <option value="Target">Cible (Target)</option>
                        <option value="Milestone">Autoroute (Milestone)</option>
                        <option value="Layers">Feuillet (Layers)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-2">Thème de Couleur d'Affichage</label>
                      <select
                        value={deptForm.themeColor}
                        onChange={(e) => setDeptForm({ ...deptForm, themeColor: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-400 shadow-sm"
                      >
                        <option value="amber">Jaune Institutionnel (Amber)</option>
                        <option value="emerald">Vert Énergie (Emerald)</option>
                        <option value="red">Rouge Guinéen (Red)</option>
                        <option value="indigo">Bleu Intense (Indigo)</option>
                        <option value="blue">Bleu Ciel (Blue)</option>
                        <option value="orange">Orange Puissance (Orange)</option>
                        <option value="violet">Violet Innovation (Violet)</option>
                        <option value="slate">Gris Neutre (Slate)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2 bg-[#048343] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-colors cursor-pointer h-9"
                      >
                        <Save size={14} />
                        <span>{editingDept.id === 0 ? "Créer l'Entité" : "Enregistrer les modifications"}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: PORTAIL APPLICATIF */}
          {activeTab === 'apps' && (
            <div className="space-y-6">
              {/* Hub applicatif : le lien UNIQUE regroupant toutes les applis EDG (accès direct depuis le Portail) */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">Gestion des applications</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                    Ajoutez des cartes d'accès direct vers les applications métiers. Les applications globales sont affichées pour toutes les directions ; les applications locales sont liées à une direction spécifique.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateAppClick}
                  className="inline-flex items-center justify-center rounded-xl bg-[#048343] hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition-colors"
                >
                  <PlusCircle size={14} className="mr-2" />
                  Ajouter une application
                </button>
              </div>

              {editingApp ? (
                <form onSubmit={handleSaveApp} className="space-y-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-5 sm:p-6 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Nom de l'application</label>
                      <input
                        type="text"
                        value={appForm.name || ''}
                        onChange={(e) => setAppForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-400 transition-all"
                        placeholder="Ex : Gestion des interventions"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">URL de l'application</label>
                      <input
                        type="url"
                        value={appForm.url || ''}
                        onChange={(e) => setAppForm((prev) => ({ ...prev, url: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-400 transition-all"
                        placeholder="https://app.edg.com.gn/gestion"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={appForm.description || ''}
                        onChange={(e) => setAppForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-400 transition-all resize-y"
                        placeholder="Décrivez l'usage principal de l'application."
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Logo de l'application</label>
                      <div className="grid gap-2">
                        <label className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                          Choisir un fichier de logo
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.gif"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                await handleImageUpload(file, (url) => setAppForm((prev) => ({ ...prev, logoUrl: url })));
                              }
                            }}
                            className="sr-only"
                          />
                        </label>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Formats : JPG, PNG, WEBP, GIF. Max 5 Mo.</p>
                        {appForm.logoUrl && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                            <img src={appForm.logoUrl} alt="Aperçu du logo" className="w-full h-20 object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Catégorie</label>
                      <input
                        type="text"
                        value={appForm.category || 'Productivité'}
                        onChange={(e) => setAppForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-400 transition-all"
                        placeholder="Productivité"
                      />
                    </div>
                    <div className="lg:col-span-2 grid gap-3 sm:grid-cols-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Portée</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAppForm((prev) => ({ ...prev, isGlobal: true }))}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${appForm.isGlobal ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'}`}
                        >Global</button>
                        <button
                          type="button"
                          onClick={() => setAppForm((prev) => ({ ...prev, isGlobal: false }))}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${appForm.isGlobal ? 'border-slate-200 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200' : 'border-emerald-500 bg-emerald-50 text-emerald-700'}`}
                        >Locale</button>
                      </div>
                      {!appForm.isGlobal && (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Direction associée</label>
                          <select
                            value={appForm.departmentId || departments[0]?.id || ''}
                            onChange={(e) => setAppForm((prev) => ({ ...prev, departmentId: Number(e.target.value) }))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-400 transition-all"
                          >
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>{dept.name} ({dept.code.toUpperCase()})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Les applications sont enregistrées immédiatement dans la console une fois validées.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#048343] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        <Save size={14} /> Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelAppEdit}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  {applications.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-950/60 p-8 text-center">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Aucune application configurée pour l’instant.</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cliquez sur "Ajouter une application" pour créer la première carte d’accès direct.</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {applications.filter((app) => app.isGlobal).length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Applications globales</p>
                              <h4 className="font-display font-extrabold text-base text-slate-900 dark:text-white">Accès partagé EDG</h4>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{applications.filter((app) => app.isGlobal).length} application{applications.filter((app) => app.isGlobal).length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {applications.filter((app) => app.isGlobal).map((app) => (
                              <div key={app.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-sm p-5 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-100 overflow-hidden">
                                      {app.logoUrl ? (
                                        <img src={app.logoUrl} alt={`${app.name} logo`} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.remove(); }} />
                                      ) : (
                                        <LucideIcon name={app.icon || 'ExternalLink'} size={20} />
                                      )}
                                    </div>
                                    <div>
                                      <h5 className="font-display font-bold text-sm text-slate-900 dark:text-white">{app.name}</h5>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{app.url}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <span className="text-[10px] uppercase tracking-[0.18em]">{app.category}</span>
                                  </div>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">{app.description || 'Aucune description fournie.'}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => handleEditAppClick(app)} className="inline-flex items-center gap-2 rounded-full border border-emerald-500 px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition">
                                    <Edit3 size={14} /> Modifier
                                  </button>
                                  <button type="button" onClick={() => handleDeleteApp(app)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition dark:border-slate-800 dark:hover:bg-rose-500/10">
                                    <Trash2 size={14} /> Supprimer
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {applications.filter((app) => !app.isGlobal).length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Applications locales</p>
                              <h4 className="font-display font-extrabold text-base text-slate-900 dark:text-white">Accès par direction</h4>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{applications.filter((app) => !app.isGlobal).length} application{applications.filter((app) => !app.isGlobal).length > 1 ? 's' : ''}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {applications.filter((app) => !app.isGlobal).map((app) => {
                              const department = departments.find((dept) => dept.id === app.departmentId);
                              return (
                                <div key={app.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-sm p-5 space-y-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-100 overflow-hidden">
                                        {app.logoUrl ? (
                                          <img src={app.logoUrl} alt={`${app.name} logo`} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.remove(); }} />
                                        ) : (
                                          <LucideIcon name={app.icon || 'ExternalLink'} size={20} />
                                        )}
                                      </div>
                                      <div>
                                        <h5 className="font-display font-bold text-sm text-slate-900 dark:text-white">{app.name}</h5>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{app.url}</p>
                                      </div>
                                    </div>
                                    <div className="text-right text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                      {department ? `${department.name}` : 'Direction non associée'}
                                    </div>
                                  </div>
                                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">{app.description || 'Aucune description fournie.'}</p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={() => handleEditAppClick(app)} className="inline-flex items-center gap-2 rounded-full border border-emerald-500 px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 transition">
                                      <Edit3 size={14} /> Modifier
                                    </button>
                                    <button type="button" onClick={() => handleDeleteApp(app)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition dark:border-slate-800 dark:hover:bg-rose-500/10">
                                      <Trash2 size={14} /> Supprimer
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 5: GENERAL CONFIG SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-extrabold text-lg text-slate-900">
                    Administration de l'Identité & Pied de Page (Footer)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bénéficiez d'une modification en direct clé-par-clé. Tous vos changements se propagent de manière fluide sur le site et l'en-tête.
                  </p>
                </div>
                {/* Live saver badge */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 flex items-center space-x-2 shrink-0 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span className="text-[9px] text-emerald-800 font-mono font-bold uppercase tracking-wider">Temps Réel Actif</span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                
                {/* Left side editor form: xl:col-span-7 */}
                <div className="xl:col-span-7 space-y-6">
                  
                  {/* SECTION 1: IDENTITY & STANDARD PARAMETERS */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/70 space-y-4 shadow-sm">
                    <h4 className="font-display font-black text-xs text-slate-900 tracking-wider uppercase flex items-center space-x-2">
                      <span className="w-1.5 h-3 bg-emerald-400 rounded-sm inline-block"></span>
                      <span>1. En-tête & Identité Majeure</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nom / Titre du Portail</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Électricité de Guinée - Portail Intranet"
                          value={platformTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPlatformTitle(val);
                            handleLiveUpdateField('site_title', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all resize-y leading-normal"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rapport de Version Stable</label>
                        <input
                          type="text"
                          required
                          placeholder="v2.4.1 Production"
                          value={appVersion}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAppVersion(val);
                            handleLiveUpdateField('operational_version', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Titre du Bandeau d'Accueil (Page Hub)</label>
                        <input
                          type="text"
                          required
                          placeholder="Bienvenue à EDG S.A."
                          value={welcomeTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWelcomeTitle(val);
                            handleLiveUpdateField('welcome_title', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sous-texte du Bandeau d'Accueil</label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Communiqués officiels, applications métiers et données des directions…"
                          value={welcomeSubtitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWelcomeSubtitle(val);
                            handleLiveUpdateField('welcome_subtitle', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all resize-y leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Centre d'Appels Vert (Assistance)</label>
                        <input
                          type="text"
                          required
                          placeholder="144"
                          value={emergencyPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmergencyPhone(val);
                            handleLiveUpdateField('support_phone', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Courriel de l'Équipe d'Alerte</label>
                        <input
                          type="text"
                          required
                          placeholder="helpdesk@edg.com.gn"
                          value={emergencyEmail}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmergencyEmail(val);
                            handleLiveUpdateField('support_email', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">Norme Énergétique / Accords</label>
                        <input
                          type="text"
                          required
                          placeholder="ISO 50001 : Performance Énergétique"
                          value={operationalStandard}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOperationalStandard(val);
                            handleLiveUpdateField('iso_standard', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>
                    </div>

                    {/* Logo Customisation Sub-section */}
                    <div className="border-t border-slate-200/60 pt-4 mt-4 space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-slate-805 tracking-wider">Configuration du Logo de la plateforme</h5>

                      {/* Aperçu + téléversement direct d'une image de logo (un seul clic) */}
                      <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-200/70">
                        <div className="w-16 h-16 rounded-xl border border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                          {logoType === 'custom_url' && logoUrl ? (
                            <img src={logoUrl} alt="Logo actuel" className="w-full h-full object-contain" />
                          ) : logoType === 'custom_text' ? (
                            <span className="font-black text-emerald-700 text-lg">{logoText || 'EDG'}</span>
                          ) : (
                            <EdgLogo className="w-12 h-12" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-700">Logo de la plateforme (affiché dans l'en-tête)</p>
                          <p className="text-[10px] text-slate-400 mb-2">Téléversez le logo officiel EDG — PNG, JPG, SVG ou WEBP.</p>
                          <label className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer shadow-sm">
                            <UploadCloud size={13} />
                            <span>Téléverser une image du logo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(file, (url) => {
                                    setLogoUrl(url);
                                    setLogoType('custom_url');
                                    handleLiveUpdateField('logo_url', url);
                                    handleLiveUpdateField('logo_type', 'custom_url');
                                  });
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">Type de Logo</label>
                          <select
                            value={logoType}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLogoType(val);
                              handleLiveUpdateField('logo_type', val);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-450 font-semibold cursor-pointer"
                          >
                            <option value="official">Officiel (Avec Éclair)</option>
                            <option value="custom_text">Texte Personnalisé</option>
                            <option value="custom_url">Image (URL externe)</option>
                          </select>
                        </div>
                        {logoType === 'custom_text' && (
                          <div className="md:col-span-2">
                            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">Texte du Logo (3-4 lettres max)</label>
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="EDG"
                              value={logoText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLogoText(val);
                                handleLiveUpdateField('logo_text', val);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>
                        )}
                        {logoType === 'custom_url' && (
                          <div className="md:col-span-2">
                            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">Source du Logo (URL ou Téléversement)</label>
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                placeholder="https://example.com/logo.png ou uploads/file.png"
                                value={logoUrl}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLogoUrl(val);
                                  handleLiveUpdateField('logo_url', val);
                                }}
                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-mono text-[10px]"
                              />
                              <label className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer shrink-0">
                                <UploadCloud size={12} />
                                <span>Déposer...</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleFileUpload(file, (url) => {
                                        setLogoUrl(url);
                                        handleLiveUpdateField('logo_url', url);
                                      });
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* SECTION 2: FOOTER INSTITUTION & LINKS */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/70 space-y-4 shadow-sm">
                    <h4 className="font-display font-black text-xs text-slate-900 tracking-wider uppercase flex items-center space-x-2">
                      <span className="w-1.5 h-3 bg-emerald-400 rounded-sm inline-block"></span>
                      <span>2. Pied de Page — Identité Institutionnelle & Droits</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nom de l'Institution (Footer)</label>
                        <input
                          type="text"
                          required
                          placeholder="Electricité de Guinée"
                          value={instName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInstName(val);
                            handleLiveUpdateField('institution_name', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ligne de Copyright</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Electricité de Guinée (EDG) S.A. Tous droits réservés."
                          value={copyrightCompany}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCopyrightCompany(val);
                            handleLiveUpdateField('copyright_company', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all resize-y leading-normal"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description Institutionnelle (Footer)</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Courte description de l'institution..."
                        value={instDesc}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInstDesc(val);
                          handleLiveUpdateField('institution_desc', val);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Libellé du Lien du Site Officiel</label>
                        <input
                          type="text"
                          required
                          placeholder="Site officiel"
                          value={officialWebsiteLabel}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOfficialWebsiteLabel(val);
                            handleLiveUpdateField('official_website_label', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">URL du Site Officiel</label>
                        <input
                          type="text"
                          required
                          placeholder="https://edg.com.gn"
                          value={officialWebsiteUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOfficialWebsiteUrl(val);
                            handleLiveUpdateField('official_website_url', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: ASSISTANCE & SECURITY OF FOOTER */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/70 space-y-4 shadow-sm">
                    <h4 className="font-display font-black text-xs text-slate-900 tracking-wider uppercase flex items-center space-x-2">
                      <span className="w-1.5 h-3 bg-emerald-400 rounded-sm inline-block"></span>
                      <span>3. Pied de Page — Blocs d'Assistance & Engagements Sécurité</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Titre de la Colonne d'Assistance</label>
                        <input
                          type="text"
                          required
                          placeholder="Assistance & Réseau"
                          value={footerSupportTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFooterSupportTitle(val);
                            handleLiveUpdateField('footer_support_title', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Label de la Zone de Couverture Réseau</label>
                        <input
                          type="text"
                          required
                          placeholder="Réseau Intérieur Sécurisé : Conakry, Guinée"
                          value={footerNetworkRegion}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFooterNetworkRegion(val);
                            handleLiveUpdateField('footer_network_region', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Titre de la Colonne Sécurité</label>
                        <input
                          type="text"
                          required
                          placeholder="Statut Sécurité & Accords"
                          value={footerSecurityTitle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFooterSecurityTitle(val);
                            handleLiveUpdateField('footer_security_title', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Texte de Sécurité <span className="text-emerald-600 font-mono text-[9px] lowercase">(utilisez [ISO] pour la norme)</span>
                        </label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Texte de sécurité avec le tag [ISO]..."
                          value={footerSecurityText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFooterSecurityText(val);
                            handleLiveUpdateField('footer_security_text', val);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 font-medium transition-all leading-normal"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-100 border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-emerald-500 text-slate-900 dark:text-slate-900 rounded-xl p-2 shrink-0">
                        <Save className="text-white" size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Enregistrement Automatique</p>
                        <p className="text-[10px] text-slate-500">Chaque lettre saisie est immédiatement enregistrée dans la configuration locale.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => showNotification('success', 'Toutes les configurations d\'identité institutionnelle sont enregistrées !')}
                      className="btn-premium btn-premium-green px-4 py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>

                {/* Right side live interactive preview panel: xl:col-span-5 */}
                <div className="xl:col-span-5 space-y-4 xl:sticky xl:top-24">
                  <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-md">
                    
                    {/* Header of Sandbox */}
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <h4 className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300">
                          Pied de Page — Aperçu Direct (Footer)
                        </h4>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded uppercase">
                        BAC À SABLE
                      </span>
                    </div>

                    {/* Miniature live view body */}
                    <div className="bg-white p-6 space-y-6 text-slate-650 font-sans border-b border-slate-200">
                      
                      {/* Brand portion */}
                      <div className="space-y-2.5">
                        <div className="flex items-center space-x-2.5">
                          {/* Miniature official seal */}
                          <div className="w-7 h-7 rounded shrink-0 overflow-hidden shadow-sm">
                            <svg className="w-full h-full" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect width="160" height="160" rx="16" fill="#FCEF11" />
                              <path d="M115 54C115 42 103 31.4 87.2 31.4C67.2 31.4 50.8 48.1 50.8 79.4C50.8 110.7 67.2 127.4 87.2 127.4C100.3 127.4 110.5 117.5 111.5 105.4H87.2V92.4H124.8V84.4H129.8V111.4H121.8V103.4C125 122 108.2 139.4 87.2 139.4C56.1 139.4 34.5 113.1 34.5 79.4C34.5 45.7 56.1 18.5 87.2 18.5C108.2 18.5 122.5 31.5 125.5 50.5L125.5 64L115.5 64Z" fill="#048343" />
                              <path d="M86 35L64 85H77L71 125L97 75H84L86 35Z" fill="#E21B23" stroke="#FCEF11" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <span className="font-display font-black text-slate-900 text-xs tracking-tight uppercase">
                            {instName || "Électricité de Guinée"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans line-clamp-3">
                          {instDesc || "Pas de description configurée pour le pied de page."}
                        </p>
                      </div>

                      {/* Assistance portion */}
                      <div className="space-y-2">
                        <h5 className="text-[9px] font-mono font-bold tracking-wider uppercase text-slate-800 border-b border-slate-100 pb-1">
                          {footerSupportTitle || "Assistance & Réseau"}
                        </h5>
                        <ul className="space-y-1.5 text-[10px]">
                          <li className="flex items-center space-x-2">
                            <Phone size={11} className="text-emerald-500" />
                            <span>Tél : <strong className="text-slate-850">{emergencyPhone}</strong></span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <Mail size={11} className="text-emerald-500" />
                            <span className="truncate">Email : <strong className="text-slate-850">{emergencyEmail}</strong></span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <ShieldCheck size={11} className="text-emerald-500" />
                            <span className="text-slate-500 line-clamp-1">{footerNetworkRegion}</span>
                          </li>
                        </ul>
                      </div>

                      {/* Security text and norm */}
                      <div className="space-y-1.5 border-t border-slate-100 pt-4">
                        <h5 className="text-[9px] font-mono font-bold tracking-wider uppercase text-slate-800 flex items-center space-x-1.5">
                          <span>{footerSecurityTitle || "Statut Sécurité & Accords"}</span>
                        </h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                          {footerSecurityText.replace('[ISO]', operationalStandard || "ISO 50001")}
                        </p>
                        <div className="pt-1 flex items-center space-x-1 text-[9px] text-slate-400 font-mono">
                          <Globe size={10} className="text-emerald-500" />
                          <span>Version {appVersion || "v2.0.0"} • Libre Accès</span>
                        </div>
                      </div>

                      {/* Copyright line */}
                      <div className="border-t border-slate-150 pt-4 flex flex-col space-y-2 text-[9px] text-slate-400">
                        <p>© {new Date().getFullYear()} {copyrightCompany || "Electricité de Guinée"}</p>
                        <div className="flex items-center justify-between pt-1">
                          <a 
                            href={officialWebsiteUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-emerald-600 hover:underline inline-flex items-center space-x-1 font-semibold"
                          >
                            <span>{officialWebsiteLabel || "Site web"}</span>
                            <ExternalLink size={8} />
                          </a>
                          <span className="font-mono text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded">
                            PORTAIL ACTIF
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Bottom notes */}
                    <div className="bg-emerald-50 p-3.5 text-[10px] text-emerald-950 flex items-start space-x-2">
                      <div className="bg-emerald-400 text-slate-900 dark:text-slate-900 rounded p-1 shrink-0">
                        <Sliders size={12} strokeWidth={2.5} />
                      </div>
                      <p className="leading-relaxed">
                        <strong>Test d'intégration instantané :</strong> Modifiez les champs du formulaire à gauche et observez de quelle manière les textes, la norme <strong>{operationalStandard}</strong> et les URL se recompilent en direct.
                      </p>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              {!editingProject ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        Projets Stratégiques de l'EDG
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Gérez les projets métiers, les chantiers d'électrification et les initiatives technologiques de chaque direction.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateProjectClick}
                      className="btn-premium btn-premium-green px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <PlusCircle size={14} />
                      <span>Nouveau Projet</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white/50">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 font-bold text-slate-700">
                          <th className="p-3.5">Projet / Direction</th>
                          <th className="p-3.5">Type de Projet</th>
                          <th className="p-3.5">Calendrier</th>
                          <th className="p-3.5">Statut / Niveau</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {adminProjects.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400 font-mono italic">
                              Aucun projet répertorié dans la base de données.
                            </td>
                          </tr>
                        ) : (
                          adminProjects.map((proj) => (
                            <tr key={proj.id} className="hover:bg-slate-55/40 transition-colors">
                              <td className="p-3.5 max-w-sm">
                                <div className="flex items-start space-x-3">
                                  {proj.image && (
                                    <div className="w-10 h-10 rounded-lg shrink-0 border border-slate-200/50 overflow-hidden" style={getMediaBgStyle(proj.image)} />
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white leading-tight">{proj.label}</div>
                                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 [&_img]:hidden" dangerouslySetInnerHTML={{ __html: proj.description }} />
                                    <div className="mt-1">
                                      <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border">
                                        Direction : {proj.unity_label || `ID ${proj.unity_id}`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                                  {proj.type_label || "Métier"}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-[10px]">
                                <div>Déb: {proj.date_debut}</div>
                                <div className="text-slate-400">Fin: {proj.date_fin}</div>
                              </td>
                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  proj.niveau === 'Terminé' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : proj.niveau === 'Planifié' 
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {proj.niveau}
                                </span>
                              </td>
                              <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleEditProjectClick(proj)}
                                  className="p-1.5 hover:bg-emerald-100 text-emerald-900 border rounded-lg transition-all inline-block cursor-pointer font-bold text-[10px]"
                                >
                                  Modifier
                                </button>
                                <button
                                  onClick={() => handleDeleteProject(proj.id)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 border rounded-lg transition-all inline-block cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveProject} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900">
                        {projectForm.id === 0 ? "Lancer un nouveau projet stratégique" : `Éditer le projet : ${projectForm.label}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Renseignez les jalons, le pôle d'ingénierie et l'état de livraison opérationnelle du projet.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Intitulé du Projet</label>
                      <input
                        type="text"
                        required
                        placeholder="Interconnexion du réseau haute tension Conakry-Kankan"
                        value={projectForm.label}
                        onChange={(e) => setProjectForm(prev => ({ ...prev, label: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Direction Porteuse</label>
                        <select
                          disabled={isDeptScopedRole}
                          value={projectForm.unity_id}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, unity_id: Number(e.target.value) }))}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-450 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.code.toUpperCase()} - {d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type de Projet</label>
                        <select
                          value={projectForm.type_id}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, type_id: Number(e.target.value) }))}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-450 cursor-pointer"
                        >
                          <option value={1}>Énergie & Production</option>
                          <option value={2}>Digital & SI Intranet</option>
                          <option value={3}>Infrastructures & Travaux</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description et Objectifs du Projet</label>
                    <RichTextEditor
                      value={projectForm.description}
                      onChange={(html) => setProjectForm(prev => ({ ...prev, description: html }))}
                      placeholder="Décrivez de manière exhaustive les livrables, l'impact opérationnel et les jalons technologiques de l'EDG..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date de Début</label>
                        <input
                          type="date"
                          required
                          value={projectForm.date_debut}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, date_debut: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date de Fin estimée</label>
                        <input
                          type="date"
                          required
                          value={projectForm.date_fin}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, date_fin: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Niveau de Réalisation</label>
                        <select
                          value={projectForm.niveau}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, niveau: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <option value="Planifié">Planifié (Études en cours)</option>
                          <option value="En cours">En cours de déploiement</option>
                          <option value="Terminé">Terminé & Livré au réseau</option>
                          <option value="Suspendu">Suspendu / En attente</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image d'Illustration</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            placeholder="/uploads/img_xyz.png ou URL"
                            value={projectForm.image}
                            onChange={(e) => setProjectForm(prev => ({ ...prev, image: e.target.value }))}
                            className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono text-slate-800"
                          />
                          <label className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer shrink-0">
                            <UploadCloud size={13} />
                            <span>Déposer</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, (url) => setProjectForm(prev => ({ ...prev, image: url })));
                              }}
                            />
                          </label>
                        </div>
                        {projectForm.image && (
                          <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 mt-2" style={getMediaBgStyle(projectForm.image)} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-premium btn-premium-green px-5 py-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save size={14} />
                      <span>Publier le Projet Stratégique</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'recipients' && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              {!editingRecipient ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        Destinataires & Contacts d'Urgence
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Configurez les canaux d'alertes directes, les boîtes emails de support et les réseaux d'assistance par direction métier.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateRecipientClick}
                      className="btn-premium btn-premium-green px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <PlusCircle size={14} />
                      <span>Ajouter un Point d'Alerte</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {adminRecipients.length === 0 ? (
                      <div className="col-span-2 py-12 text-center text-slate-400 font-mono italic border rounded-2xl bg-white/50">
                        Aucun point de contact d'urgence configuré.
                      </div>
                    ) : (
                      adminRecipients.map((rec) => (
                        <div key={rec.id} className="border border-slate-200 rounded-2xl p-5 bg-white/60 hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                              <div>
                                <span className="font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {rec.unity_label || `Direction ID ${rec.unity_id}`}
                                </span>
                                <h4 className="font-extrabold text-slate-900 mt-1.5 text-xs">{rec.raison || "Support Général"}</h4>
                              </div>
                              <div className="text-emerald-500">
                                <PhoneCall size={16} />
                              </div>
                            </div>

                            <div className="space-y-2 mt-4 text-xs">
                              <div className="flex items-center space-x-2 text-slate-600">
                                <Mail size={13} className="text-slate-400 shrink-0" />
                                <span className="font-medium font-mono">{rec.email}</span>
                              </div>
                              {rec.numero && (
                                <div className="flex items-center space-x-2 text-slate-600">
                                  <Phone size={13} className="text-slate-400 shrink-0" />
                                  <span className="font-mono">{rec.numero}</span>
                                </div>
                              )}
                            </div>

                            {rec.associated_contacts && rec.associated_contacts.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                                <h5 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Agents / Relais associés ({rec.associated_contacts.length})</h5>
                                <div className="space-y-2">
                                  {rec.associated_contacts.map((sub: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 p-2 rounded-lg text-[11px] flex justify-between items-center font-mono">
                                      <span className="truncate max-w-[130px] font-semibold text-slate-700">{sub.email}</span>
                                      <span className="text-slate-500 text-[10px] shrink-0 ml-1">{sub.numero || "Sans tél"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end space-x-2 mt-6 pt-3 border-t border-slate-100/60">
                            <button
                              onClick={() => handleEditRecipientClick(rec)}
                              className="p-1.5 px-3 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
                            >
                              <Edit3 size={11} />
                              <span>Modifier</span>
                            </button>
                            <button
                              onClick={() => handleDeleteRecipient(rec.id)}
                              className="p-1.5 bg-slate-100 hover:bg-red-100 hover:text-red-900 text-slate-400 rounded-lg cursor-pointer transition-all"
                              title="Retirer ce point de contact"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveRecipient} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900">
                        {recipientForm.id === 0 ? "Ajouter un canal de support direct" : `Modifier le point de support`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Associez les adresses emails officielles et configurez les relais techniques d'assistance.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingRecipient(null)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Direction Concernée</label>
                      <select
                        disabled={isDeptScopedRole}
                        value={recipientForm.unity_id}
                        onChange={(e) => setRecipientForm(prev => ({ ...prev, unity_id: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-450 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.code.toUpperCase()} - {d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Adresse Email Principale</label>
                      <input
                        type="email"
                        required
                        placeholder="support.reseau@edg.com.gn"
                        value={recipientForm.email}
                        onChange={(e) => setRecipientForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Téléphone d'Urgence</label>
                      <input
                        type="text"
                        placeholder="+224 622 00 00 00"
                        value={recipientForm.numero}
                        onChange={(e) => setRecipientForm(prev => ({ ...prev, numero: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Raison / Remarque (Libellé d'affichage)</label>
                    <input
                      type="text"
                      required
                      placeholder="Service d'Assistance Informatique de la DSI"
                      value={recipientForm.raison}
                      onChange={(e) => setRecipientForm(prev => ({ ...prev, raison: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  {/* SUB-CONTACTS DYNAMIC LIST */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-extrabold uppercase text-slate-900 tracking-wider">Agents / Relais d'astreinte associés</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientForm(prev => ({
                            ...prev,
                            associated_contacts: [...prev.associated_contacts, { email: '', numero: '' }]
                          }));
                        }}
                        className="px-2.5 py-1.5 bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg flex items-center space-x-1 hover:bg-emerald-600 transition-all cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Ajouter un Relais d'Astreinte</span>
                      </button>
                    </div>

                    {recipientForm.associated_contacts.length === 0 ? (
                      <p className="text-[11px] text-slate-400 font-mono italic">Aucun relais secondaire associé. Les alertes arriveront sur l'adresse principale uniquement.</p>
                    ) : (
                      <div className="space-y-2">
                        {recipientForm.associated_contacts.map((sub, idx) => (
                          <div key={idx} className="flex items-center space-x-3 bg-white p-3 border rounded-xl shadow-sm">
                            <span className="font-mono text-[10px] text-slate-400 w-5">#{idx + 1}</span>
                            <input
                              type="email"
                              required
                              placeholder="agent.relais@edg.com.gn"
                              value={sub.email}
                              onChange={(e) => {
                                const updated = [...recipientForm.associated_contacts];
                                updated[idx].email = e.target.value;
                                setRecipientForm(prev => ({ ...prev, associated_contacts: updated }));
                              }}
                              className="flex-1 px-2 py-1.5 bg-white border rounded-lg text-[11px] font-mono"
                            />
                            <input
                              type="text"
                              placeholder="+224 ..."
                              value={sub.numero}
                              onChange={(e) => {
                                const updated = [...recipientForm.associated_contacts];
                                updated[idx].numero = e.target.value;
                                setRecipientForm(prev => ({ ...prev, associated_contacts: updated }));
                              }}
                              className="w-40 px-2 py-1.5 bg-white border rounded-lg text-[11px] font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = recipientForm.associated_contacts.filter((_, i) => i !== idx);
                                setRecipientForm(prev => ({ ...prev, associated_contacts: updated }));
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditingRecipient(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-premium btn-premium-green px-5 py-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save size={14} />
                      <span>Publier le Point d'Alerte</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                    Tickets : Signalements & Demandes de Contact
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consultez et traitez les incidents signalés et les demandes de contact soumis depuis le portail public.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative">
                    <LucideIcon name="Search" size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      placeholder="Rechercher (objet, émetteur, ID)..."
                      className="w-full sm:w-56 pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <select
                    value={ticketTypeFilter}
                    onChange={(e) => setTicketTypeFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <option value="all">Tous les types</option>
                    <option value="incident">Incidents</option>
                    <option value="contact">Contacts</option>
                  </select>
                  <select
                    value={ticketStatusFilter}
                    onChange={(e) => setTicketStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="Nouveau">Nouveau</option>
                    <option value="En cours">En cours</option>
                    <option value="Résolu">Résolu</option>
                  </select>
                </div>
              </div>

              {filteredAdminTickets.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-mono italic border rounded-2xl bg-white/50 dark:bg-slate-900/30 dark:border-white/10">
                  Aucun ticket ne correspond à ces filtres.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAdminTickets.map((t) => {
                    const dept = departments.find(d => d.id === t.departmentId);
                    const isExpanded = expandedTicketId === t.id;
                    const statusStyle =
                      t.status === 'Résolu' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500/20' :
                      t.status === 'En cours' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/20' :
                      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/20';
                    return (
                      <div key={t.id} className="border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 bg-slate-50/20 dark:bg-slate-900/20 hover:border-emerald-400 transition-all">
                        <div
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer"
                          onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                        >
                          <div className="flex items-start space-x-3 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 ${t.type === 'incident' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                              {t.type === 'incident' ? <AlertTriangle size={15} /> : <MessageCircle size={15} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold text-slate-400">{t.id}</span>
                                <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${statusStyle}`}>
                                  {t.status}
                                </span>
                                {t.priority && (
                                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    {t.priority}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-xs mt-1 truncate">{t.subject}</h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1"><User2 size={11} />{t.senderName}</span>
                                <span className="flex items-center gap-1"><Mail size={11} />{t.senderEmail}</span>
                                {dept && <span>{dept.code.toUpperCase()}</span>}
                                <span className="flex items-center gap-1"><Clock size={11} />{new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateTicketStatus(t.id, e.target.value)}
                              className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              <option value="Nouveau">Nouveau</option>
                              <option value="En cours">En cours</option>
                              <option value="Résolu">Résolu</option>
                            </select>
                            <button
                              onClick={() => handleDeleteTicketAdmin(t.id)}
                              className="p-1.5 bg-slate-100 hover:bg-red-100 hover:text-red-900 text-slate-400 rounded-lg cursor-pointer transition-all"
                              title="Supprimer ce ticket"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {t.message}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {ticketTotal > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-slate-500">
                  <span>
                    {ticketTotal} ticket{ticketTotal > 1 ? 's' : ''} · page {ticketPage} / {Math.max(1, Math.ceil(ticketTotal / TICKETS_PAGE_SIZE))}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                      disabled={ticketPage <= 1}
                      className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setTicketPage(p => (p < Math.ceil(ticketTotal / TICKETS_PAGE_SIZE) ? p + 1 : p))}
                      disabled={ticketPage >= Math.ceil(ticketTotal / TICKETS_PAGE_SIZE)}
                      className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              <div className="border-b border-slate-100 dark:border-white/5 pb-4">
                <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                  Bibliothèque de Documents (GED)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Publiez des notes de service, directives, modèles officiels et formulaires téléchargeables depuis le portail public.
                </p>
              </div>

              {/* Upload form */}
              <form onSubmit={handleUploadDocumentSubmit} className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-white/5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Titre du document</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Note de service 2026-08 : Politique de gestion des absences"
                      value={documentForm.title}
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Référent / Auteur</label>
                    <input
                      type="text"
                      placeholder="Ex: DRH Mariama Barry"
                      value={documentForm.author}
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, author: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Catégorie</label>
                    <select
                      value={documentForm.category}
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      {DOCUMENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Direction associée {isDeptScopedRole ? '' : '(optionnel)'}</label>
                    <select
                      disabled={isDeptScopedRole}
                      value={documentForm.unity_id}
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, unity_id: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs text-slate-850 dark:text-white focus:outline-none focus:border-emerald-400 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {!isDeptScopedRole && <option value="">Toutes directions (transverse)</option>}
                      {departments.map(d => <option key={d.id} value={d.id}>{d.code.toUpperCase()} - {d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Fichier (PDF, Word, Excel, PowerPoint)</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, file: e.target.files ? e.target.files[0] : null }))}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-[11px] text-slate-850 dark:text-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={uploadingDocument}
                    className="btn-premium btn-premium-green px-4 py-2.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <UploadCloud size={14} />
                    <span>{uploadingDocument ? 'Téléversement...' : 'Publier le document'}</span>
                  </button>
                </div>
              </form>

              {/* Search */}
              <div className="relative">
                <LucideIcon name="Search" size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                  placeholder="Rechercher par titre, référent ou direction..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setDocumentCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                    documentCategoryFilter === 'all' ? 'bg-[#048343] text-white border-transparent' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Tous ({adminDocuments.length})
                </button>
                {DOCUMENT_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setDocumentCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                      documentCategoryFilter === cat ? 'bg-[#048343] text-white border-transparent' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    {cat} ({adminDocuments.filter(d => d.category === cat).length})
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="space-y-2.5">
                {filteredAdminDocuments.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-mono italic border rounded-2xl bg-white/50 dark:bg-slate-900/30 dark:border-white/10">
                    {documentSearch || documentCategoryFilter !== 'all'
                      ? 'Aucun document ne correspond à ces critères.'
                      : 'Aucun document. Publiez-en un ci-dessus.'}
                  </div>
                ) : (
                  filteredAdminDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 bg-white dark:bg-slate-900/40 border border-slate-200/70 dark:border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="p-2 bg-[#048343]/10 text-[#048343] rounded-lg shrink-0 mt-0.5">
                          <FileText size={15} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {doc.category}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1 truncate">{doc.title}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {doc.author && <>Par <strong>{doc.author}</strong> • </>}
                            {doc.departmentLabel || 'Transverse'} • {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
                        >
                          <Download size={12} />
                          <span>Voir</span>
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc.id, doc.title)}
                          className="p-1.5 bg-slate-100 hover:bg-red-100 hover:text-red-900 text-slate-400 dark:bg-slate-800 dark:hover:bg-red-950/40 rounded-lg cursor-pointer transition-all"
                          title="Retirer ce document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {documentsMatching.length > DOCUMENTS_PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-slate-500">
                  <span>{documentsMatching.length} document{documentsMatching.length > 1 ? 's' : ''} · page {documentPage} / {documentTotalPages}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDocumentPage(p => Math.max(1, p - 1))}
                      disabled={documentPage <= 1}
                      className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setDocumentPage(p => (p < documentTotalPages ? p + 1 : p))}
                      disabled={documentPage >= documentTotalPages}
                      className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'articles' && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              {!editingArticle ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        Actualités & Notes Circulaires EDG SA
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ajoutez, modifiez ou archivez les communiqués et les notes de service publiés à l'attention des agents guinéens.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateArticleClick}
                      className="btn-premium btn-premium-green px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <PlusCircle size={14} />
                      <span>Publier un Communiqué</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {articles.map((art) => {
                      const associatedDept = departments.find(d => d.id === art.departmentId);
                      return (
                        <div 
                          key={art.id} 
                          className="border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-400 transition-all bg-slate-50/20"
                        >
                          <div className="flex items-start space-x-3.5 min-w-0">
                            {/* Graphic indicator (image, gradient or color) */}
                            <div
                              className="w-12 h-12 rounded-xl shrink-0 border border-slate-200/30 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden"
                              style={getMediaBgStyle(art.image)}
                            >
                              {!art.image ? "NEWS" : art.image.startsWith('#') ? "EDG" : ""}
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {art.isGlobal ? (
                                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#048343]">
                                    Diffusion Générale
                                  </span>
                                ) : (
                                  <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                                    Direction : {associatedDept?.code?.toUpperCase() || `ID ${art.departmentId}`}
                                  </span>
                                )}
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {new Date(art.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white truncate pr-4">
                                {art.title}
                              </h4>
                              <p className="text-xs text-slate-500 line-clamp-1">
                                {art.excerpt}
                              </p>
                              <div className="flex items-center space-x-1 flex-wrap gap-1 mt-1">
                                {art.tags.map((tag, idx) => (
                                  <span key={idx} className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-1 rounded">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 md:self-center self-end shrink-0 pt-2 md:pt-0">
                            <button
                              onClick={() => handleEditArticleClick(art)}
                              className="p-1.5 bg-white border border-slate-200 hover:bg-emerald-100 hover:text-emerald-900 hover:border-emerald-200 text-slate-650 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                            >
                              <Edit3 size={12} />
                              <span>Modifier</span>
                            </button>
                            <button
                              onClick={() => handleDeleteArticle(art.id, art.title)}
                              className="p-1.5 bg-white border border-slate-200 hover:bg-red-100 hover:text-red-900 hover:border-red-200 text-slate-405 rounded-lg cursor-pointer"
                              title="Supprimer la circulaire"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveArticle} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        {editingArticle.id === 0 ? "Publier un nouveau communiqué" : `Modifier la circulaire`}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Votre note sera directement intégrée sur le Hub e-EDG ou dans les archives de la direction sélectionnée.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingArticle(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    
                    {/* Main parameters: 8 cols */}
                    <div className="md:col-span-8 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Titre du Communiqué / Actualité</label>
                        <input
                          type="text"
                          required
                          placeholder="ex: Note de service DG : Nomination du nouveau chef de service DSI"
                          value={articleForm.title}
                          onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 shadow-sm font-medium transition-all"
                        />
                      </div>

                      {/* Catégorie de l'annonce — détermine icône/couleur/ton sur l'accueil */}
                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Catégorie de l'annonce</label>
                        <div className="flex flex-wrap gap-2">
                          {ARTICLE_CATEGORIES.map((cat) => {
                            const selected = articleForm.category === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setArticleForm({ ...articleForm, category: cat.id })}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${selected ? `${cat.badgeClass} font-bold shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'}`}
                              >
                                <LucideIcon name={cat.icon} size={12} />
                                <span>{cat.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">Choisit comment l'annonce sera présentée sur l'accueil (icône, couleur, ton). « Décès » adopte un ton sobre.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Résumé d'accroche (Excerpt)</label>
                        <input
                          type="text"
                          placeholder="Une courte phrase d'une ligne pour capter l'attention sous le titre..."
                          value={articleForm.excerpt}
                          onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:outline-none focus:border-emerald-450 focus:ring-1 focus:ring-emerald-400 shadow-sm transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Contenu Complet de l'Article</label>
                        <RichTextEditor
                          value={articleForm.content}
                          onChange={(html) => setArticleForm(prev => ({ ...prev, content: html }))}
                          placeholder="Saisissez le communiqué complet officiel de l'EDG ici..."
                        />
                      </div>
                    </div>

                    {/* Meta parameters: 4 cols */}
                    <div className="md:col-span-4 space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80">
                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Portée de Publication</label>
                        <div className="flex items-center space-x-3 mt-1">
                          <label className={`flex items-center space-x-1.5 text-xs font-medium text-slate-700 ${isDeptScopedRole ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="radio"
                              disabled={isDeptScopedRole}
                              checked={articleForm.isGlobal}
                              onChange={() => setArticleForm({ ...articleForm, isGlobal: true })}
                              className="accent-[#048343]"
                            />
                            <span className="dark:text-slate-250">Générale (Tout le Hub)</span>
                          </label>
                          <label className="flex items-center space-x-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              checked={!articleForm.isGlobal}
                              onChange={() => setArticleForm({ ...articleForm, isGlobal: false })}
                              className="accent-emerald-500"
                            />
                            <span className="dark:text-slate-250">Locale (Direction spécifique)</span>
                          </label>
                        </div>
                      </div>

                      {!articleForm.isGlobal && (
                        <div className="animate-fade-in">
                          <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Direction Cible</label>
                          <select
                            disabled={isDeptScopedRole}
                            value={articleForm.departmentId}
                            onChange={(e) => setArticleForm({ ...articleForm, departmentId: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:border-emerald-450 font-medium disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          >
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.code.toUpperCase()} — {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Mots clés (Séparés par une virgule)</label>
                        <input
                          type="text"
                          placeholder="Nomination, RH, Technique, DG"
                          value={articleForm.tags}
                          onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs text-slate-850 focus:border-emerald-450 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Arrière-Plan / Image d'Illustration</label>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <input
                            type="text"
                            placeholder="Image URL, chemin /uploads/... ou dégradé CSS"
                            value={articleForm.image}
                            onChange={(e) => setArticleForm({ ...articleForm, image: e.target.value })}
                            className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-mono text-slate-750 focus:border-emerald-450"
                          />
                          <label className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shrink-0">
                            <UploadCloud size={13} />
                            <span>Déposer</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, (url) => setArticleForm(prev => ({ ...prev, image: url })));
                              }}
                            />
                          </label>
                        </div>

                        {articleForm.image && !articleForm.image.startsWith('linear-gradient') && !articleForm.image.startsWith('radial-gradient') && !articleForm.image.startsWith('#') && !articleForm.image.startsWith('rgb') && (
                          <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 mb-2" style={getMediaBgStyle(articleForm.image)} />
                        )}

                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Raccourcis Dégradés EDG</span>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            title="Vert Institutionnel"
                            onClick={() => setArticleForm({ ...articleForm, image: 'linear-gradient(135deg, #048343 0%, #10b981 100%)' })}
                            className="w-6 h-6 rounded-full border border-slate-300 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #048343 0%, #10b981 100%)' }}
                          />
                          <button
                            type="button"
                            title="Bleu Corporatif"
                            onClick={() => setArticleForm({ ...articleForm, image: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' })}
                            className="w-6 h-6 rounded-full border border-slate-300 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}
                          />
                          <button
                            type="button"
                            title="Rouge Sécurité"
                            onClick={() => setArticleForm({ ...articleForm, image: 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)' })}
                            className="w-6 h-6 rounded-full border border-slate-300 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)' }}
                          />
                          <button
                            type="button"
                            title="Orange Vigilance"
                            onClick={() => setArticleForm({ ...articleForm, image: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)' })}
                            className="w-6 h-6 rounded-full border border-slate-300 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)' }}
                          />
                          <button
                            type="button"
                            title="Sombre Nuit"
                            onClick={() => setArticleForm({ ...articleForm, image: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)' })}
                            className="w-6 h-6 rounded-full border border-slate-300 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Documents joints (PDF, Word, Excel, PowerPoint)</label>
                        <label className="inline-flex bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold items-center space-x-1.5 cursor-pointer">
                          <UploadCloud size={13} />
                          <span>Joindre un document</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleDocumentUpload(file, (attachment) => {
                                  setArticleForm(prev => ({ ...prev, files: [...prev.files, attachment] }));
                                });
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>

                        {articleForm.files.length > 0 && (
                          <ul className="mt-2.5 space-y-1.5">
                            {articleForm.files.map((f, idx) => (
                              <li key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                                <a href={f.url} target="_blank" rel="noreferrer" className="text-slate-700 font-semibold truncate hover:text-emerald-700 hover:underline">
                                  {f.name}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setArticleForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== idx) }))}
                                  className="text-slate-400 hover:text-red-500 shrink-0 ml-2 cursor-pointer"
                                  title="Retirer ce document"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                    </div>

                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingArticle(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-premium btn-premium-green px-5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save size={14} />
                      <span>{editingArticle.id === 0 ? "Publier l'Actualité" : "Enregistrer les modifications"}</span>
                    </button>
                  </div>

                </form>
              )}
            </div>
          )}

          {/* TAB: GESTION DES COMPTES (réservé à l'Administrateur) */}
          {activeTab === 'audit' && isAdministrateur && (
            <AuditLogView />
          )}

          {activeTab === 'postes' && (isAdministrateur || isRhDirection) && (
            <PostesAdmin departments={departments} />
          )}

          {activeTab === 'workflows' && (isAdministrateur || isRhDirection) && (
            <OrganigrammeAdmin />
          )}

          {activeTab === 'users' && isAdministrateur && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              {!editingUserAccount ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white">
                        Comptes utilisateurs de l'Intranet EDG
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Créez les comptes, attribuez les rôles (Agent, Chef de Service, RH/Direction, Administrateur) et leur direction de rattachement.
                      </p>
                    </div>
                    <button
                      onClick={handleCreateUserClick}
                      className="btn-premium btn-premium-green px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <PlusCircle size={14} />
                      <span>Créer un compte</span>
                    </button>
                  </div>

                  {/* Barre de recherche + filtres (côté serveur, pour passer à l'échelle des 1150 agents) */}
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative flex-1">
                      <LucideIcon name="Search" size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Rechercher par nom ou email..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value as typeof userRoleFilter)}
                      className="px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm cursor-pointer"
                    >
                      <option value="all">Tous les rôles</option>
                      <option value="agent">Agent</option>
                      <option value="chef_service">Chef de Service</option>
                      <option value="rh_direction">RH / Direction</option>
                      <option value="administrateur">Administrateur</option>
                    </select>
                    <select
                      value={userDeptFilter}
                      onChange={(e) => setUserDeptFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className="px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm cursor-pointer"
                    >
                      <option value="all">Toutes les directions</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.code.toUpperCase()} - {d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                          <th className="p-3">Agent</th>
                          <th className="p-3">Rôle</th>
                          <th className="p-3">Direction</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{u.name}</div>
                              <div className="text-[10px] text-slate-400">{u.email}</div>
                            </td>
                            <td className="p-3">
                              <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                u.role === 'administrateur' ? 'bg-violet-50 text-violet-700 border-violet-200'
                                : u.role === 'rh_direction' ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : u.role === 'chef_service' ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}>
                                {u.role === 'administrateur' ? 'ADMINISTRATEUR' : u.role === 'rh_direction' ? 'RH / DIRECTION' : u.role === 'chef_service' ? 'CHEF DE SERVICE' : 'AGENT'}
                              </span>
                            </td>
                            <td className="p-3">
                              {u.departmentLabel ? (
                                <span className="font-mono bg-slate-100 border px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-bold">
                                  {u.departmentLabel}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Central / Aucune</span>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              <button
                                onClick={() => handleEditUserClick(u)}
                                className="p-1 px-2 hover:bg-emerald-50 hover:text-emerald-800 border rounded text-[10px] font-semibold transition-colors inline-block cursor-pointer"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteUserAccount(u.id)}
                                className="p-1 hover:bg-red-50 text-red-600 border rounded text-[10px] inline-block cursor-pointer"
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                        {adminUsers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                              {userSearch || userRoleFilter !== 'all' || userDeptFilter !== 'all'
                                ? 'Aucun compte ne correspond à ces critères.'
                                : 'Aucun compte enregistré.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {userTotal > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                      <span>
                        {userTotal} compte{userTotal > 1 ? 's' : ''} · page {userPage} / {Math.max(1, Math.ceil(userTotal / USERS_PAGE_SIZE))}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setUserPage(p => Math.max(1, p - 1))}
                          disabled={userPage <= 1}
                          className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          Précédent
                        </button>
                        <button
                          onClick={() => setUserPage(p => (p < Math.ceil(userTotal / USERS_PAGE_SIZE) ? p + 1 : p))}
                          disabled={userPage >= Math.ceil(userTotal / USERS_PAGE_SIZE)}
                          className="px-3 py-1.5 border rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSaveUserAccount} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-slate-900">
                        {editingUserAccount.id === 0 ? "Créer un nouveau compte" : `Modifier le compte de ${userAccountForm.name}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Le rôle et la direction de rattachement déterminent les permissions accordées sur l'ensemble du portail.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUserAccount(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nom complet</label>
                      <input
                        type="text"
                        required
                        placeholder="Mme Aminata Keita"
                        value={userAccountForm.name}
                        onChange={(e) => setUserAccountForm({ ...userAccountForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email professionnel</label>
                      <input
                        type="email"
                        required
                        placeholder="a.keita@edg.com.gn"
                        value={userAccountForm.email}
                        onChange={(e) => setUserAccountForm({ ...userAccountForm, email: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Rôle</label>
                      <select
                        value={userAccountForm.role}
                        onChange={(e) => setUserAccountForm({ ...userAccountForm, role: e.target.value as AdminUserAccount['role'] })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      >
                        <option value="agent">Agent</option>
                        <option value="chef_service">Chef de Service</option>
                        <option value="rh_direction">RH / Direction</option>
                        <option value="administrateur">Administrateur</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Direction de rattachement {userAccountForm.role === 'rh_direction' ? '(optionnelle — vide = RH centrale)' : userAccountForm.role === 'administrateur' ? '(non applicable)' : '(obligatoire)'}
                      </label>
                      <select
                        disabled={userAccountForm.role === 'administrateur'}
                        value={userAccountForm.departmentId}
                        onChange={(e) => setUserAccountForm({ ...userAccountForm, departmentId: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {(userAccountForm.role === 'rh_direction' || userAccountForm.role === 'administrateur') && (
                          <option value="">— Aucune (central) —</option>
                        )}
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.code.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Intitulé du poste</label>
                      <input
                        type="text"
                        placeholder="Chef du Service Comptabilité"
                        value={userAccountForm.title}
                        onChange={(e) => setUserAccountForm({ ...userAccountForm, title: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      {editingUserAccount.id === 0 ? 'Mot de passe initial' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}
                    </label>
                    <input
                      type="password"
                      required={editingUserAccount.id === 0}
                      placeholder="ex : mot de passe par défaut"
                      value={userAccountForm.password}
                      onChange={(e) => setUserAccountForm({ ...userAccountForm, password: e.target.value })}
                      className="w-full md:w-1/2 px-3 py-2 bg-white border border-slate-250 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-400 shadow-sm"
                    />
                    <p className="mt-2 text-[11px] text-slate-500 leading-relaxed max-w-xl">
                      Mot de passe <span className="font-bold">temporaire</span> — il peut être simple (même un mot de passe par défaut).
                      Transmettez-le à l'agent (e-mail ou en personne) ; <span className="font-bold text-slate-700">il devra choisir un mot de passe sécurisé</span> (8 car., majuscule, minuscule, chiffre) à sa première connexion.
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingUserAccount(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-premium btn-premium-green px-5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save size={14} />
                      <span>{editingUserAccount.id === 0 ? 'Créer le compte' : 'Enregistrer les modifications'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
        </div>
      </div>
    </div>
  );
}
