import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCheck, AlertCircle, Bookmark, Compass } from 'lucide-react';
import { IntranetUser } from '../types';
import { apiFetch } from '../api';

interface NotificationItem {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  icon: string;
  isNew?: boolean;
}

interface NotificationPanelProps {
  currentUser?: IntranetUser | null;
  authToken?: string | null;
}

const POLL_INTERVAL_MS = 20000;

export default function NotificationPanel({ currentUser, authToken }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Charge les notifications personnelles temps réel de l'utilisateur connecté
  const loadPersonalNotifications = useCallback(async () => {
    // La session passe par le cookie httpOnly : authToken est toujours null désormais.
    // On ne conditionne donc QU'À la présence de l'utilisateur connecté (sinon les notifications
    // ne se chargeaient jamais — régression de la migration vers le cookie de session).
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    try {
      const res = await apiFetch('/api/my-notifications', {}, authToken);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data.map((n: any) => ({
            id: String(n.id),
            title: n.title,
            date: new Date(n.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
            excerpt: n.message,
            content: n.message,
            icon: n.icon,
            isNew: !n.isRead
          })));
        }
      }
    } catch (e) {
      console.warn("Erreur de chargement des notifications personnelles", e);
    }
  }, [currentUser, authToken]);

  // Chargement initial + rafraîchissement périodique (~20s) pour un effet "temps réel"
  useEffect(() => {
    loadPersonalNotifications();
    const interval = setInterval(loadPersonalNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadPersonalNotifications]);

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, isNew: false })));
    if (currentUser) {
      try {
        await apiFetch('/api/my-notifications/mark-all-read', { method: 'POST' }, authToken);
      } catch (e) {
        console.error("Erreur lors du marquage des notifications comme lues :", e);
      }
    }
  };

  const markAsRead = async (notif: NotificationItem) => {
    setExpandedId(expandedId === notif.id ? null : notif.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isNew: false } : n));
    try {
      await apiFetch(`/api/my-notifications/${notif.id}/read`, { method: 'PATCH' }, authToken);
    } catch (e) {
      console.error("Erreur lors du marquage de la notification comme lue :", e);
    }
  };

  const unreadCount = notifications.filter(n => n.isNew).length;
  const filteredNotifs = notifications;

  const getIcon = (name: string) => {
    const baseClass = "w-4 h-4 text-violet-500";
    switch (name) {
      case 'AlertCircle':
        return <AlertCircle className={baseClass} />;
      case 'Bookmark':
        return <Bookmark className={baseClass} />;
      case 'Compass':
        return <Compass className={baseClass} />;
      case 'CheckCheck':
        return <CheckCheck className={baseClass} />;
      default:
        return <Bell className={baseClass} />;
    }
  };

  return (
    <>
      {/* 🔔 Floating Action Button with beautiful glass ring & pulse effects */}
      <div className="fixed bottom-6 right-6 z-40 select-none">
        <button
          onClick={() => setIsOpen(!isOpen)}
          id="floating-notification-trigger"
          className="relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:scale-110 active:scale-95 transition-all duration-300 bg-white/40 dark:bg-white/10 backdrop-blur-xl border border-white/60 dark:border-white/15 text-zinc-800 dark:text-white group animate-[bounce_2.5s_infinite]"
          title="Consulter mes notifications EDG"
        >
          {/* Internal rotating glowing ring */}
          <div className="absolute inset-0.5 rounded-full border border-dashed border-zinc-400/40 dark:border-white/20 group-hover:rotate-180 transition-transform duration-1000 ease-in-out" />
          
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-60 pointer-events-none" />
          
          <Bell className="w-6 h-6 group-hover:rotate-12 transition-transform duration-250 text-zinc-700 dark:text-zinc-100 drop-shadow-sm" />
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E21C21] text-[9px] font-mono font-black tracking-tight text-white px-1.5 border-2 border-white dark:border-slate-900 shadow">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 📱 Floating Elegant Minimalist Notification Hub Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            id="floating-announcements-hub"
            className="fixed bottom-24 right-4 sm:right-6 z-40 w-[94vw] sm:w-[390px] rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[70vh] shadow-2xl"
          >
            {/* Header section */}
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-100/60 dark:bg-zinc-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight text-zinc-900 dark:text-white uppercase font-sans">
                    Centre de Notifications EDG
                  </h3>
                  <p className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-bold">
                    {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Aucune notification'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1 px-2 rounded-lg bg-zinc-250 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-750 border border-zinc-300 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck size={11} />
                    <span>Marquer Lu</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 px-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notification Cards List with Slate rows */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin max-h-[46vh]">
              {filteredNotifs.length === 0 ? (
                <div className="py-12 px-4 text-center text-zinc-400 dark:text-zinc-500 flex flex-col items-center justify-center space-y-2">
                  <Bell className="w-8 h-8 opacity-25" />
                  <p className="text-xs font-semibold">
                    {currentUser ? "Aucune notification pour l'instant." : "Connectez-vous pour recevoir vos notifications."}
                  </p>
                </div>
              ) : (
                filteredNotifs.map((notif) => {
                  const isExpanded = expandedId === notif.id;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif)}
                      className={`group/card text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                        notif.isNew
                          ? 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 shadow-sm animate-pulse'
                          : 'bg-zinc-100/50 hover:bg-zinc-100/85 dark:bg-zinc-950/20 dark:hover:bg-zinc-950/40 border-zinc-200/50 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Bullet / Icon */}
                        <div className="relative mt-0.5 shrink-0">
                          <div className={`p-2.5 rounded-lg ${
                            notif.isNew 
                              ? 'bg-zinc-100 dark:bg-zinc-850 border border-zinc-250 dark:border-zinc-750' 
                              : 'bg-zinc-50 dark:bg-zinc-900 border border-transparent'
                          }`}>
                            {getIcon(notif.icon)}
                          </div>
                        </div>

                        {/* Text Block */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[8px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">
                              Notification
                            </span>
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
                              {notif.date}
                            </span>
                          </div>

                          <h4 className={`text-xs font-bold leading-snug transition-colors group-hover/card:text-emerald-500 dark:group-hover/card:text-emerald-400 truncate ${
                            notif.isNew ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'
                          }`}>
                            {notif.title}
                          </h4>

                          <p className="text-[10px] text-zinc-500 dark:text-zinc-405 line-clamp-2 mt-0.5 leading-normal">
                            {notif.excerpt}
                          </p>
                        </div>
                      </div>

                      {/* Expandable detailed content wrapper */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800"
                          >
                            <p className="text-[10px] text-zinc-650 dark:text-zinc-300 leading-relaxed font-sans bg-zinc-100/60 dark:bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-850 whitespace-pre-wrap">
                              {notif.content}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with branding */}
            <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/30 flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-455 font-mono">
              <span>Électricité de Guinée SA • Intranet</span>
              <span className="flex items-center gap-1">
                Disponible en temps réel <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
