/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Poste {
  id: number;
  title: string;              // intitulé du poste (ex: Directeur des Systèmes d'Information)
  unityId?: number | null;    // direction/service de rattachement
  unityLabel?: string;
  unityCode?: string;
  parentId?: number | null;   // poste supérieur (null = racine)
  occupantName?: string;      // personne occupant le poste (optionnel)
  occupantEmail?: string;
  ordre?: number;
}

export interface Department {
  id: number;
  parentId?: number | null; // entité parente dans l'organigramme (null/absent = racine)
  code: string; // 'dsi', 'rh', 'finance', 'exploitation', etc.
  name: string;
  description: string;
  icon: string; // Lucide icon name
  directorName: string;
  directorMessage: string;
  foundedYear: number;
  staffCount: number;
  valueKey?: string;
  valueDesc?: string;
  themeColor?: string;

  // Fully dynamic fields for admin customization of subsections
  missionPillars?: { title: string; desc: string }[];
  commitments?: { title: string; metric: string; description: string; objective: string }[];
  domains?: { title: string; desc: string; icon: string }[];
  values?: { title: string; desc: string }[];
  historyText?: string;
  applicationIds?: number[];
  dashboard?: DashboardData;
}

export interface DashboardKPI {
  label: string;
  value: string;
  sub: string;
  icon: string;
}

export interface DashboardSeriesCfg {
  key: string;
  label: string;
  color: string;
}

export interface DashboardData {
  title: string;
  subtitle: string;
  chartType: 'area' | 'bar' | 'line';
  kpis: DashboardKPI[];
  series: DashboardSeriesCfg[];
  chartData: { name: string; [key: string]: string | number }[];
}

export interface FileAttachment {
  name: string;
  url: string;
}

export interface Article {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  isGlobal: boolean;
  departmentId?: number; // associated department id
  createdAt: string;
  image: string; // URL or premium CSS color representation
  files?: FileAttachment[]; // documents joints (PDF, Word, Excel...)
}

export interface Application {
  id: number;
  name: string;
  description: string;
  url: string;
  icon: string; // Lucide icon name
  isGlobal: boolean;
  category: string; // ex: 'Productivité', 'Métier', 'Ressources'
  departmentId?: number; // associated department id for routing
}

export interface Ticket {
  id: string;
  type: 'contact' | 'incident';
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  departmentId: number;
  createdAt: string;
  status: 'Nouveau' | 'Reçu' | 'En cours' | 'Résolu';
  priority?: 'Faible' | 'Moyenne' | 'Haute';
}

export interface IntranetUser {
  id?: number;
  email: string;
  name: string;
  role: 'agent' | 'chef_service' | 'rh_direction' | 'administrateur';
  departmentId?: number | null;
  departmentName?: string;
  departmentCode?: string;
  title?: string;
  mustChangePassword?: boolean;
  passwordChangeReason?: 'initial' | 'expired' | null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  responsibilities: string[];
}

