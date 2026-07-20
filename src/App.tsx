/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import HubView from './components/HubView';
import EdgLogo from './components/EdgLogo';
import LoginView from './components/LoginView';
import ChangePasswordView from './components/ChangePasswordView';
import ResetPasswordView from './components/ResetPasswordView';
import NotificationPanel from './components/NotificationPanel';

// Vues chargées à la demande (code-splitting) : allège fortement le bundle initial
// (CKEditor via AdminView, Recharts via DepartmentHomeView, etc. ne sont chargés qu'au besoin).
const DepartmentHomeView = lazy(() => import('./components/DepartmentHomeView'));
const AboutView = lazy(() => import('./components/AboutView'));
const AttributionsView = lazy(() => import('./components/AttributionsView'));
const PortalView = lazy(() => import('./components/PortalView'));
const TicketsView = lazy(() => import('./components/TicketsView'));
const DocumentsView = lazy(() => import('./components/DocumentsView'));
const AgendaView = lazy(() => import('./components/AgendaView'));
const AnnuaireView = lazy(() => import('./components/AnnuaireView'));
const OrganigrammeView = lazy(() => import('./components/OrganigrammeView'));
const AdminView = lazy(() => import('./components/AdminView'));
const MissionView = lazy(() => import('./components/MissionView'));
const EngagementView = lazy(() => import('./components/EngagementView'));
const ValeursView = lazy(() => import('./components/ValeursView'));
const NewsView = lazy(() => import('./components/NewsView'));
const ProjectsView = lazy(() => import('./components/ProjectsView'));
const ContactsView = lazy(() => import('./components/ContactsView'));
import { getDeptColorTheme } from './components/colorThemes';
import { apiFetch } from './api';

import { Department, Article, Application, IntranetUser } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Building, Zap, Layers, Users, Cpu, ShieldAlert, ArrowLeft, Home, User, Settings, HelpCircle, LogOut, ChevronLeft, Moon, Sun, AlertCircle, Award, Target, ShieldCheck, Sparkles, Newspaper, Briefcase, Mail } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('hub'); // 'hub', 'home', 'about', 'team', 'portal', 'ticket', 'admin'
  const [currentDeptCode, setCurrentDeptCode] = useState<string | undefined>(undefined);

  // Sync the theme list locally to allow sidebar to toggle dark mode
  const [sidebarDarkMode, setSidebarDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const handleObserver = () => {
      setSidebarDarkMode(document.documentElement.classList.contains('dark'));
    };
    window.addEventListener('theme_changed', handleObserver);
    const observer = new MutationObserver(handleObserver);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('theme_changed', handleObserver);
      observer.disconnect();
    };
  }, []);

  const toggleSidebarTheme = () => {
    const isDarkNow = document.documentElement.classList.contains('dark');
    if (isDarkNow) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    window.dispatchEvent(new Event('theme_changed'));
  };

  // --- AUTHENTICATION (session via cookie httpOnly côté serveur ; aucun jeton en JavaScript) ---
  // Le visiteur démarre déconnecté ; la session éventuelle est restaurée via /api/auth/me au montage.
  const [currentUser, setCurrentUser] = useState<IntranetUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Message affiché sur l'écran de connexion après une expiration de session (inactivité / 401).
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);
  // Session portée par le cookie httpOnly `edg_session` : plus de jeton manipulé en JS.
  // authToken reste à null (les requêtes s'authentifient via le cookie envoyé automatiquement).
  const authToken = null;

  // Restaure la session au démarrage / rafraîchissement à partir du cookie de session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data && data.user) setCurrentUser(data.user as IntranetUser);
        }
      } catch (e) {
        // Pas de session : navigation en visiteur, comportement normal.
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLoginSuccess = (user: IntranetUser) => {
    // Le cookie de session a déjà été posé par le serveur lors du POST /api/auth/login.
    setExpiredNotice(null);
    setCurrentUser(user);
    setAuthChecked(true);
    setCurrentView('hub');
    window.location.hash = '';
  };

  // Déconnexion (volontaire ou forcée). `notice` s'affiche sur l'écran de connexion (ex: expiration).
  const forceLogout = (notice?: string) => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setCurrentUser(null);
    setCurrentView('hub');
    window.location.hash = '';
    if (notice) setExpiredNotice(notice);
  };

  const handleLogout = () => forceLogout();

  // Le renouvellement de mot de passe forcé est terminé : on lève le blocage.
  const handleMustChangeDone = () => {
    setCurrentUser(prev => (prev ? { ...prev, mustChangePassword: false } : prev));
  };

  // Expiration de session automatique après 30 minutes d'INACTIVITÉ (aligné sur le cookie glissant serveur).
  useEffect(() => {
    if (!currentUser) return;
    const IDLE_MS = 30 * 60 * 1000;
    let timer: number;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        forceLogout("Votre session a expiré après 30 minutes d'inactivité. Veuillez vous reconnecter.");
      }, IDLE_MS);
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [currentUser]);

  // Toute réponse 401 d'une requête authentifiée (session expirée côté serveur) => déconnexion propre.
  useEffect(() => {
    const onUnauth = () => {
      if (currentUser) forceLogout('Votre session a expiré. Veuillez vous reconnecter.');
    };
    window.addEventListener('auth:unauthorized', onUnauth);
    return () => window.removeEventListener('auth:unauthorized', onUnauth);
  }, [currentUser]);

  // --- CMS STATE MANAGERS (source unique = backend ; vide au démarrage jusqu'au fetch) ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({
    site_title: 'Électricité de Guinée - Portail Collaboratif Intranet',
    support_phone: '144 (Numéro Vert EDG)',
    support_email: 'helpdesk@edg.com.gn',
    iso_standard: 'ISO 50001 : Performance Énergétique',
    operational_version: 'v2.4.1 Stable',
    welcome_title: 'Bienvenue à EDG S.A.',
    welcome_subtitle: "Communiqués officiels, applications métiers et données des directions d'Électricité de Guinée, réunis dans votre espace de travail sécurisé."
  });

  // Persist writers wrappers
  const onChangeDepartments = async (newDepts: Department[]) => {
    setDepartments(newDepts);

    try {
      if (newDepts.length > departments.length) {
        const added = newDepts.find(n => !departments.some(o => o.id === n.id));
        if (added) {
          const formData = new FormData();
          formData.append('code', added.code);
          formData.append('name', added.name);
          formData.append('description', added.description || '');
          formData.append('director_name', added.directorName || '');
          formData.append('founded_year', String(added.foundedYear || 1987));
          formData.append('staff_count', String(added.staffCount || 10));
          formData.append('parent_id', String(added.parentId ?? 0));
          formData.append('icon', added.icon || 'Layers');
          formData.append('director_message', added.directorMessage || '');
          formData.append('value_key', added.valueKey || '');
          formData.append('value_desc', added.valueDesc || '');
          formData.append('mission_pillars', JSON.stringify(added.missionPillars || []));
          formData.append('commitments', JSON.stringify(added.commitments || []));
          formData.append('domains', JSON.stringify(added.domains || []));
          formData.append('values', JSON.stringify(added.values || []));
          formData.append('history_text', added.historyText || '');
          if (added.dashboard) {
            formData.append('dashboard', JSON.stringify(added.dashboard));
          }

          const res = await apiFetch('/api/admin/direction/save', {
            method: 'POST',
            body: formData
          }, authToken);
          if (res.ok) {
            const saved = await res.json();
            if (saved && saved.data) {
              setDepartments(prev => prev.map(d => d.id === added.id ? { ...d, id: saved.data.id } : d));
            }
          }
        }
      } else if (newDepts.length < departments.length) {
        const deleted = departments.find(o => !newDepts.some(n => n.id === o.id));
        if (deleted) {
          await apiFetch(`/api/admin/direction/${deleted.id}`, {
            method: 'DELETE'
          }, authToken);
        }
      } else {
        const updated = newDepts.find(n => {
          const old = departments.find(o => o.id === n.id);
          return old && (
            old.code !== n.code ||
            old.parentId !== n.parentId ||
            old.name !== n.name ||
            old.description !== n.description ||
            old.directorName !== n.directorName ||
            old.foundedYear !== n.foundedYear ||
            old.staffCount !== n.staffCount ||
            old.icon !== n.icon ||
            old.directorMessage !== n.directorMessage ||
            old.valueKey !== n.valueKey ||
            old.valueDesc !== n.valueDesc ||
            JSON.stringify(old.missionPillars) !== JSON.stringify(n.missionPillars) ||
            JSON.stringify(old.commitments) !== JSON.stringify(n.commitments) ||
            JSON.stringify(old.domains) !== JSON.stringify(n.domains) ||
            JSON.stringify(old.values) !== JSON.stringify(n.values) ||
            old.historyText !== n.historyText ||
            JSON.stringify(old.dashboard) !== JSON.stringify(n.dashboard)
          );
        });
        if (updated) {
          const formData = new FormData();
          formData.append('id', String(updated.id));
          formData.append('code', updated.code);
          formData.append('name', updated.name);
          formData.append('description', updated.description || '');
          formData.append('director_name', updated.directorName || '');
          formData.append('founded_year', String(updated.foundedYear || 1987));
          formData.append('staff_count', String(updated.staffCount || 10));
          formData.append('parent_id', String(updated.parentId ?? 0));
          formData.append('icon', updated.icon || 'Layers');
          formData.append('director_message', updated.directorMessage || '');
          formData.append('value_key', updated.valueKey || '');
          formData.append('value_desc', updated.valueDesc || '');
          formData.append('mission_pillars', JSON.stringify(updated.missionPillars || []));
          formData.append('commitments', JSON.stringify(updated.commitments || []));
          formData.append('domains', JSON.stringify(updated.domains || []));
          formData.append('values', JSON.stringify(updated.values || []));
          formData.append('history_text', updated.historyText || '');
          if (updated.dashboard) {
            formData.append('dashboard', JSON.stringify(updated.dashboard));
          }

          await apiFetch('/api/admin/direction/save', {
            method: 'POST',
            body: formData
          }, authToken);
        }
      }
    } catch (err) {
      console.error("Erreur de synchronisation des directions :", err);
    }
  };

  const onChangeApplications = async (newApps: Application[]) => {
    setApplications(newApps);

    try {
      if (newApps.length > applications.length) {
        const added = newApps.find(n => !applications.some(o => o.id === n.id));
        if (added) {
          const formData = new FormData();
          formData.append('name', added.name);
          formData.append('description', added.description);
          formData.append('url', added.url);
          formData.append('icon', added.icon || 'ExternalLink');
          formData.append('isGlobal', String(added.isGlobal));
          formData.append('category', added.category);
          if (added.departmentId) {
            formData.append('department_id', String(added.departmentId));
          }

          const res = await apiFetch('/api/admin/application/save', {
            method: 'POST',
            body: formData
          }, authToken);
          if (res.ok) {
            const saved = await res.json();
            if (saved && saved.data) {
              setApplications(prev => prev.map(a => a.id === added.id ? { ...a, id: saved.data.id } : a));
            }
          }
        }
      } else if (newApps.length < applications.length) {
        const deleted = applications.find(o => !newApps.some(n => n.id === o.id));
        if (deleted) {
          await apiFetch(`/api/admin/application/${deleted.id}`, {
            method: 'DELETE'
          }, authToken);
        }
      } else {
        const updated = newApps.find(n => {
          const old = applications.find(o => o.id === n.id);
          return old && (
            old.name !== n.name ||
            old.description !== n.description ||
            old.url !== n.url ||
            old.icon !== n.icon ||
            old.isGlobal !== n.isGlobal ||
            old.category !== n.category ||
            old.departmentId !== n.departmentId
          );
        });
        if (updated) {
          const formData = new FormData();
          formData.append('id', String(updated.id));
          formData.append('name', updated.name);
          formData.append('description', updated.description);
          formData.append('url', updated.url);
          formData.append('icon', updated.icon || 'ExternalLink');
          formData.append('isGlobal', String(updated.isGlobal));
          formData.append('category', updated.category);
          if (updated.departmentId) {
            formData.append('department_id', String(updated.departmentId));
          }

          await apiFetch('/api/admin/application/save', {
            method: 'POST',
            body: formData
          }, authToken);
        }
      }
    } catch (err) {
      console.error("Erreur de synchronisation des applications :", err);
    }
  };

  const onChangeArticles = async (newArticles: Article[]) => {
    setArticles(newArticles);

    try {
      if (newArticles.length > articles.length) {
        const added = newArticles.find(n => !articles.some(o => o.id === n.id));
        if (added) {
          const res = await apiFetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: added.title,
              excerpt: added.excerpt,
              content: added.content,
              tags: added.tags,
              isGlobal: added.isGlobal,
              departmentId: added.departmentId || null,
              image: added.image || '',
              files: added.files || []
            })
          }, authToken);
          if (res.ok) {
            const saved = await res.json();
            setArticles(prev => prev.map(a => a.id === added.id ? saved : a));
          }
        }
      } else if (newArticles.length < articles.length) {
        const deleted = articles.find(o => !newArticles.some(n => n.id === o.id));
        if (deleted) {
          await apiFetch(`/api/articles/${deleted.id}`, {
            method: 'DELETE'
          }, authToken);
        }
      } else {
        const updated = newArticles.find(n => {
          const old = articles.find(o => o.id === n.id);
          return old && (
            old.title !== n.title ||
            old.excerpt !== n.excerpt ||
            old.content !== n.content ||
            JSON.stringify(old.tags) !== JSON.stringify(n.tags) ||
            old.isGlobal !== n.isGlobal ||
            old.departmentId !== n.departmentId ||
            old.image !== n.image ||
            JSON.stringify(old.files) !== JSON.stringify(n.files)
          );
        });
        if (updated) {
          await apiFetch(`/api/articles/${updated.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: updated.title,
              excerpt: updated.excerpt,
              content: updated.content,
              tags: updated.tags,
              isGlobal: updated.isGlobal,
              departmentId: updated.departmentId || null,
              image: updated.image || '',
              files: updated.files || []
            })
          }, authToken);
        }
      }
    } catch (err) {
      console.error("Erreur de synchronisation de l'article :", err);
    }
  };

  const onChangeTeamMembers = async (newMembers: any[]) => {
    setTeamMembers(newMembers);

    try {
      if (newMembers.length > teamMembers.length) {
        const added = newMembers.find(n => !teamMembers.some(o => o.id === n.id));
        if (added) {
          const res = await apiFetch('/api/team-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              departmentId: added.departmentId,
              name: added.name,
              role: added.role,
              email: added.email,
              phone: added.phone,
              bio: added.bio,
              responsibilities: added.responsibilities,
              hierarchy_order: added.hierarchy_order
            })
          }, authToken);
          if (res.ok) {
            const saved = await res.json();
            setTeamMembers(prev => prev.map(m => m.id === added.id ? saved : m));
          }
        }
      } else if (newMembers.length < teamMembers.length) {
        const deleted = teamMembers.find(o => !newMembers.some(n => n.id === o.id));
        if (deleted) {
          await apiFetch(`/api/team-members/${deleted.id}`, {
            method: 'DELETE'
          }, authToken);
        }
      } else {
        const updated = newMembers.find(n => {
          const old = teamMembers.find(o => o.id === n.id);
          return old && (
            old.departmentId !== n.departmentId ||
            old.name !== n.name ||
            old.role !== n.role ||
            old.email !== n.email ||
            old.phone !== n.phone ||
            old.bio !== n.bio ||
            JSON.stringify(old.responsibilities) !== JSON.stringify(n.responsibilities) ||
            old.hierarchy_order !== n.hierarchy_order
          );
        });
        if (updated) {
          await apiFetch(`/api/team-members/${updated.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              departmentId: updated.departmentId,
              name: updated.name,
              role: updated.role,
              email: updated.email,
              phone: updated.phone,
              bio: updated.bio,
              responsibilities: updated.responsibilities,
              hierarchy_order: updated.hierarchy_order
            })
          }, authToken);
        }
      }
    } catch (err) {
      console.error("Erreur de synchronisation de l'organigramme :", err);
    }
  };

  const onChangeSiteSettings = async (newSettings: Record<string, string>) => {
    setSiteSettings(newSettings);

    try {
      await apiFetch('/api/admin/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      }, authToken);
    } catch (err) {
      console.error("Erreur de synchronisation des paramètres :", err);
    }
  };

  // Synchronize state on startup from the real database
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        // Tous les appels initiaux lancés EN PARALLÈLE (accueil affiché bien plus tôt qu'en séquentiel).
        const [deptsRes, articlesRes, appsRes, teamRes, settingsRes] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/articles'),
          fetch('/api/admin/applications'),
          fetch('/api/team-members'),
          fetch('/api/admin/settings'),
        ]);

        // 1. Departments
        if (deptsRes.ok) {
          const deptsData = await deptsRes.json();
          if (Array.isArray(deptsData) && deptsData.length > 0) {
            const formattedDepts = deptsData.map((d: any) => ({
              id: d.id,
              parentId: d.parentId ?? null,
              code: d.code,
              name: d.name,
              description: d.description || '',
              icon: d.icon || 'Layers',
              directorName: d.director_name || d.directorName || '',
              directorMessage: d.director_message || d.directorMessage || '',
              foundedYear: d.founded_year || d.foundedYear || 1987,
              staffCount: d.staff_count || d.staffCount || 10,
              valueKey: d.value_key || d.valueKey || '',
              valueDesc: d.value_desc || d.valueDesc || '',
              themeColor: d.theme_color || d.themeColor || 'emerald',
              applicationIds: d.application_ids || [],
              missionPillars: d.missionPillars || [],
              commitments: d.commitments || [],
              domains: d.domains || [],
              values: d.values || [],
              historyText: d.historyText || '',
              dashboard: d.dashboard || undefined
            }));
            setDepartments(formattedDepts);
          }
        }

        // 2. Articles
        if (articlesRes.ok) {
          const articlesData = await articlesRes.json();
          if (Array.isArray(articlesData)) {
            setArticles(articlesData);
          }
        }

        // 3. Applications
        if (appsRes.ok) {
          const appsData = await appsRes.json();
          if (appsData && appsData.status === 'success' && Array.isArray(appsData.data)) {
            setApplications(appsData.data);
          }
        }

        // 3b. Team Members (organigramme nominatif)
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (Array.isArray(teamData) && teamData.length > 0) {
            setTeamMembers(teamData);
          }
        }

        // 4. Settings
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData && settingsData.status === 'success' && settingsData.data && Object.keys(settingsData.data).length > 0) {
            setSiteSettings(prev => ({ ...prev, ...settingsData.data }));
          }
        }
      } catch (err) {
        console.warn("Le backend n'a pas pu être contacté, utilisation de l'état local :", err);
      }
    };

    fetchBackendData();
  }, []);

  // Synchronize state with URL Hash for dynamic deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);

      // Page de réinitialisation de mot de passe (#reset/<token>) : gérée hors authentification par le rendu.
      if (hash.startsWith('reset')) return;

      if (!hash) {
        setCurrentView('hub');
        setCurrentDeptCode(undefined);
        return;
      }

      if (hash === 'admin') {
        setCurrentView('admin');
        setCurrentDeptCode(undefined);
        return;
      }

      if (hash === 'login') {
        setCurrentView('login');
        setCurrentDeptCode(undefined);
        return;
      }

      if (hash === 'ticket' || hash.startsWith('ticket/')) {
        setCurrentView('ticket');
        setCurrentDeptCode(undefined);
        return;
      }

      if (['documents', 'agenda', 'annuaire', 'organigramme'].includes(hash)) {
        setCurrentView(hash);
        setCurrentDeptCode(undefined);
        return;
      }

      const segments = hash.split('/');
      const deptCode = segments[0];

      const validDeptCodes = departments.map(d => d.code);
      
      if (validDeptCodes.includes(deptCode)) {
        setCurrentDeptCode(deptCode);
        const subView = segments[1] || 'home';
        setCurrentView(subView);
      } else if (departments.length === 0) {
        // Directions pas encore chargées depuis le backend : on préserve le hash sans rediriger.
        // Cet effet dépend de [departments] et se relancera pour valider une fois les données arrivées.
        return;
      } else {
        // Fallback on root
        setCurrentView('hub');
        setCurrentDeptCode(undefined);
        window.location.hash = '';
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Sync initially

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [departments]);

  // Synchronize document.title with the dynamic platform title of EDG
  useEffect(() => {
    document.title = siteSettings.site_title || 'Électricité de Guinée - Portail Intranet';
  }, [siteSettings.site_title]);

  // Custom simulation routing function
  const onNavigate = (view: string, deptCode?: string) => {
    if (view === 'hub' || !deptCode) {
      if (view === 'admin') {
        window.location.hash = '#admin';
      } else if (view === 'login') {
        window.location.hash = '#login';
      } else if (view === 'ticket') {
        window.location.hash = '#ticket';
      } else if (view === 'documents' || view === 'agenda' || view === 'annuaire' || view === 'organigramme') {
        window.location.hash = '#' + view;
      } else {
        window.location.hash = '';
      }
    } else if (view === 'home') {
      window.location.hash = `#${deptCode}`;
    } else {
      window.location.hash = `#${deptCode}/${view}`;
    }
  };

  // Find active department object in the stateful list
  const activeDept = departments.find(d => d.code === currentDeptCode);

  // Répartit le contenu selon la portée (globale vs. direction active), à partir des données du backend
  const globalArticles = articles.filter(art => art.isGlobal);
  const localArticles = articles.filter(art => !art.isGlobal && art.departmentId === activeDept?.id);

  const globalApplications = applications.filter(app => app.isGlobal);
  const localApplications = applications.filter(app => !app.isGlobal && activeDept &&
    (app.departmentId === activeDept.id ||
     app.url.includes(activeDept.code) ||
     // Liaisons applicatives réelles issues du backend
     (activeDept.applicationIds && activeDept.applicationIds.includes(app.id)))
  );



  // Page de réinitialisation de mot de passe (accessible SANS authentification, via le lien reçu par e-mail)
  const resetToken = (() => {
    if (typeof window === 'undefined') return null;
    const h = window.location.hash.replace(/^#/, '');
    return h.startsWith('reset/') ? h.slice('reset/'.length) : null;
  })();
  if (resetToken) {
    return (
      <div className="min-h-screen relative bg-zinc-50 dark:bg-[#09090b] flex flex-col justify-center font-sans text-zinc-900 dark:text-zinc-100 py-10">
        <ResetPasswordView token={resetToken} onDone={() => { window.location.hash = ''; }} />
      </div>
    );
  }

  // === Barrière d'authentification : connexion obligatoire avant TOUT accès à la plateforme ===
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#09090b] text-slate-400 text-sm font-mono">
        Vérification de la session…
      </div>
    );
  }
  if (!currentUser) {
    return (
      <div className="min-h-screen relative bg-zinc-50 dark:bg-[#09090b] flex flex-col justify-center font-sans text-zinc-900 dark:text-zinc-100 py-10">
        <LoginView onLoginSuccess={handleLoginSuccess} notice={expiredNotice} />
      </div>
    );
  }
  if (currentUser.mustChangePassword) {
    return (
      <div className="min-h-screen relative bg-zinc-50 dark:bg-[#09090b] flex flex-col justify-center font-sans text-zinc-900 dark:text-zinc-100 py-10">
        <ChangePasswordView currentUser={currentUser} forced reason={currentUser.passwordChangeReason} onSuccess={handleMustChangeDone} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pt-18 bg-zinc-50 dark:bg-[#09090b] flex flex-col justify-between font-sans selection:bg-emerald-600 dark:selection:bg-emerald-500 selection:text-white text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      
      {/* Dynamic Header Navbar Wrapper */}
      <Header 
        departments={departments} 
        currentDept={activeDept} 
        currentView={currentView}
        onNavigate={onNavigate}
        siteSettings={siteSettings}
        currentUser={currentUser}
        onLogout={handleLogout}
        applications={applications}
        articles={articles}
      />


      {/* Main content body */}
      <main className="flex-1 w-full mx-auto relative z-10">
        <Suspense fallback={<div className="py-24 text-center text-slate-400 text-sm font-mono animate-pulse">Chargement…</div>}>

        {/* Sliding Viewports Content using AnimatePresence */}
        {activeDept && ['home', 'about', 'team', 'portal', 'presentation', 'attributions', 'mission', 'engagement', 'valeurs', 'news', 'projects', 'contacts'].includes(currentView) ? (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in flex-1">


            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Premium e-EDG Corporate Interactive Sidebar */}
              <div className="lg:col-span-3 lg:sticky lg:top-24 space-y-4">
                <div 
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/80 rounded-[24px] p-5 shadow-xl space-y-6 animate-fade-in"
                  id="e-edg-intranet-sidebar-panel"
                >
                  
                  {/* e-EDG Design-Aligned Intranet Branding Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-150 dark:border-slate-850/80">
                    <div className="flex items-center space-x-3">
                      {/* Custom circular EDG Green logo with gold accents */}
                      <EdgLogo className="w-9 h-9 shrink-0 rounded-xl shadow-md" />
                      <div className="min-w-0">
                        <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none uppercase tracking-tight">EDG S.A.</h1>
                        <span className="text-[9px] font-sans font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">PORTAIL INTRANET</span>
                      </div>
                    </div>
                    {/* Retro collapse chevron button representing the left header arrow */}
                    <button 
                      onClick={() => onNavigate('hub')}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
                      title="Retour au Hub Global"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>

                  {/* Main Navigation Stack Menu with Yellow Dot active indicators */}
                  <div className="space-y-1.5 relative">
                    {[
                      { type: 'label', text: 'Général' },
                      { label: "Vue d'ensemble", icon: <Home size={15} />, view: "home" },
                      { label: "Actualités", icon: <Newspaper size={15} />, view: "news" },
                      { label: "Projets", icon: <Briefcase size={15} />, view: "projects" },
                      { label: "Contact & Destinataires", icon: <Mail size={15} />, view: "contacts" },
                      { type: 'label', text: 'À Propos' },
                      { label: "Mission", icon: <Target size={15} />, view: "mission" },
                      { label: "Engagement", icon: <ShieldCheck size={15} />, view: "engagement" },
                      { label: "Valeurs", icon: <Sparkles size={15} />, view: "valeurs" },
                      { type: 'label', text: 'Notre équipe' },
                      { label: "Présentation", icon: <Layers size={15} />, view: "presentation" },
                      { label: "Organigramme", icon: <Users size={15} />, view: "team" },
                      { label: "Attributions", icon: <Award size={15} />, view: "attributions" },
                      { type: 'label', text: 'Applications' },
                      { label: "Portails applicatifs", icon: <Cpu size={15} />, view: "portal" }
                    ].map((item) => {
                      if ('type' in item && item.type === 'label') {
                        return (
                          <div key={item.text} className="pt-2 px-1 pb-1">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#048343] dark:text-[#048343]">
                              {item.text}
                            </span>
                          </div>
                        );
                      }
                      
                      const tab = item as { label: string; icon: React.ReactNode; view: string };
                      const isActive = currentView === tab.view || (tab.view === 'presentation' && currentView === 'about');
                      return (
                        <motion.button
                          key={tab.label}
                          onClick={() => onNavigate(tab.view, activeDept.code)}
                          whileHover={{ 
                            scale: 1.015, 
                            x: isActive ? 0 : 4,
                            boxShadow: isActive 
                              ? "0 10px 25px -5px rgba(4, 131, 67, 0.3)" 
                              : "0 4px 12px rgba(0, 0, 0, 0.05)"
                          }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 450, damping: 28 }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold font-sans cursor-pointer relative overflow-hidden group/tab ${
                            isActive
                              ? 'text-white shadow-md shadow-emerald-950/10'
                              : 'bg-transparent border border-transparent text-slate-550 dark:text-slate-405 hover:text-slate-900 dark:hover:text-white hover:bg-white/90 dark:hover:bg-slate-800/40 hover:border-slate-200/50 dark:hover:border-slate-700/50 transition-colors duration-300'
                          }`}
                        >
                          {/* Nano-Banana style sliding background pill */}
                          {isActive && (
                            <motion.div
                              layoutId="activeTabPill"
                              className="absolute inset-0 bg-gradient-to-r from-[#048343] to-[#108548] dark:from-emerald-700/90 dark:to-emerald-800/80 z-0"
                              transition={{ type: "spring", stiffness: 350, damping: 26 }}
                            />
                          )}

                          {/* Hover left accent indicator bar for inactive items */}
                          {!isActive && (
                            <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-gradient-to-b from-[#048343] to-[#108548] dark:from-emerald-500 dark:to-emerald-400 rounded-r-md opacity-0 group-hover/tab:opacity-100 scale-y-0 group-hover/tab:scale-y-100 transition-all duration-300 origin-center z-20" />
                          )}

                          <div className="flex items-center space-x-2.5 relative z-10 transition-transform duration-300 group-hover/tab:translate-x-1">
                            <span className={`transition-all duration-300 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-555 group-hover/tab:text-[#048343] dark:group-hover/tab:text-emerald-400 group-hover/tab:scale-110 group-hover/tab:rotate-3"}`}>
                              {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                          </div>
                          
                          {/* Active Yellow/Amber Indicator Dot */}
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 border border-emerald-600 shadow-sm animate-pulse shrink-0 relative z-10"></span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Themes Configuration Control */}
                  <div className="pt-3 border-t border-slate-150 dark:border-slate-850/80">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        THÈME
                      </span>
                      {/* Theme switcher toggle representing the circular switch */}
                      <button
                        onClick={toggleSidebarTheme}
                        className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 border border-slate-200/40 dark:border-slate-850 text-slate-600 dark:text-amber-300 shadow-sm transition-all cursor-pointer"
                        title="Basculer le style de couleur"
                      >
                        {sidebarDarkMode ? <Sun size={12} className="text-amber-400" /> : <Moon size={12} className="text-emerald-700" />}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Clean layout-aligned Content Panel */}
              <div className="lg:col-span-9 min-w-0">
                <AnimatePresence mode="wait">
                  {currentView === 'home' && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DepartmentHomeView
                        department={activeDept}
                        localArticles={localArticles}
                        onNavigate={onNavigate}
                        currentUser={currentUser}
                      />
                    </motion.div>
                  )}

                  {currentView === 'news' && (
                    <motion.div
                      key="news"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <NewsView 
                        department={activeDept}
                        localArticles={localArticles}
                      />
                    </motion.div>
                  )}

                  {currentView === 'projects' && (
                    <motion.div
                      key="projects"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProjectsView 
                        department={activeDept}
                      />
                    </motion.div>
                  )}

                  {currentView === 'contacts' && (
                    <motion.div
                      key="contacts"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ContactsView 
                        department={activeDept}
                      />
                    </motion.div>
                  )}

                   {currentView === 'mission' && (
                    <motion.div
                      key="mission"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <MissionView department={activeDept} />
                    </motion.div>
                  )}

                  {currentView === 'engagement' && (
                    <motion.div
                      key="engagement"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <EngagementView department={activeDept} />
                    </motion.div>
                  )}

                  {currentView === 'valeurs' && (
                    <motion.div
                      key="valeurs"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ValeursView department={activeDept} />
                    </motion.div>
                  )}

                  {(currentView === 'about' || currentView === 'presentation') && (
                    <motion.div
                      key="presentation"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AboutView department={activeDept} />
                    </motion.div>
                  )}

                  {currentView === 'team' && (
                    <motion.div
                      key="team"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <OrganigrammeView departmentId={activeDept.id} />
                    </motion.div>
                  )}

                  {currentView === 'attributions' && (
                    <motion.div
                      key="attributions"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AttributionsView department={activeDept} teamMembers={teamMembers} />
                    </motion.div>
                  )}

                  {currentView === 'portal' && (
                    <motion.div
                      key="portal"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PortalView
                        department={activeDept}
                        globalApplications={globalApplications}
                        localApplications={localApplications}
                        onNavigate={onNavigate}
                        currentUser={currentUser}
                        appHubUrl={siteSettings.app_hub_url}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>
        ) : (
          /* General widescreen templates for non-department workflows */
          /* Hub View, Admin View, etc. */
          <AnimatePresence mode="wait">
            {currentView === 'hub' && (
              <motion.div
                key="hub"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <HubView
                  departments={departments}
                  globalArticles={globalArticles}
                  globalApplications={globalApplications}
                  onNavigate={onNavigate}
                  currentUser={currentUser}
                  articles={articles}
                  siteSettings={siteSettings}
                  teamMembers={teamMembers}
                  authToken={authToken}
                />
              </motion.div>
            )}

            {currentView === 'login' && (
              <motion.div
                key="login"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {currentUser && currentUser.role !== 'agent' ? (
                  <div className="text-center p-12 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl max-w-md mx-auto space-y-4">
                    <p className="text-emerald-500 font-bold text-sm">✓ Connecté en tant qu'administrateur</p>
                    <button 
                      onClick={() => onNavigate('admin')} 
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[#048343] hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                    >
                      Aller à la console d'administration
                    </button>
                  </div>
                ) : (
                  <LoginView onLoginSuccess={handleLoginSuccess} />
                )}
              </motion.div>
            )}

            {currentView === 'admin' && (
              <motion.div
                key="admin"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {!authChecked ? (
                  <div className="text-center p-16 text-slate-400 text-sm font-mono">Vérification de la session…</div>
                ) : !currentUser || currentUser.role === 'agent' ? (
                  <LoginView onLoginSuccess={handleLoginSuccess} />
                ) : (
                  <AdminView
                    departments={departments}
                    onChangeDepartments={onChangeDepartments}
                    applications={applications}
                    onChangeApplications={onChangeApplications}
                    teamMembers={teamMembers}
                    onChangeTeamMembers={onChangeTeamMembers}
                    siteSettings={siteSettings}
                    onChangeSiteSettings={onChangeSiteSettings}
                    currentUser={currentUser}
                    articles={articles}
                    onChangeArticles={onChangeArticles}
                    authToken={authToken}
                  />
                )}
              </motion.div>
            )}

            {currentView === 'ticket' && (
              <motion.div
                key="ticket"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <TicketsView
                  department={null}
                  departments={departments}
                  onNavigateBack={() => onNavigate('hub')}
                />
              </motion.div>
            )}

            {currentView === 'documents' && (
              <motion.div
                key="documents"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DocumentsView onNavigateBack={() => onNavigate('hub')} />
              </motion.div>
            )}

            {currentView === 'agenda' && (
              <motion.div
                key="agenda"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AgendaView currentUser={currentUser} authToken={authToken} onNavigateBack={() => onNavigate('hub')} />
              </motion.div>
            )}

            {currentView === 'annuaire' && (
              <motion.div
                key="annuaire"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AnnuaireView onNavigateBack={() => onNavigate('hub')} />
              </motion.div>
            )}

            {currentView === 'organigramme' && (
              <motion.div
                key="organigramme"
                className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <OrganigrammeView onNavigateBack={() => onNavigate('hub')} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
        </Suspense>
      </main>

      {/* Standard Footer */}
      <Footer 
        siteSettings={siteSettings} 
        onNavigate={onNavigate}
        currentUser={currentUser}
      />

      {/* Floating Announcements & System Updates Notification Hub */}
      <NotificationPanel currentUser={currentUser} authToken={authToken} />

    </div>
  );
}
