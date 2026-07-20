/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 max-w-md w-[calc(100%-3rem)] sm:w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 50, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="pointer-events-auto relative w-full bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md text-slate-100 rounded-2xl shadow-2xl border border-white/10 p-5 flex items-start space-x-4 overflow-hidden"
            >
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-1 ${t.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}
              />

              <div className={`p-2 rounded-xl shrink-0 shadow-sm mt-0.5 ${
                t.type === 'success' ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
              }`}>
                {t.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </div>

              <div className="flex-1 min-w-0 pr-3">
                <p className={`font-display font-extrabold text-[10px] tracking-wide uppercase ${
                  t.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {t.type === 'success' ? 'Action réussie' : "Échec de l'action"}
                </p>
                <h4 className="font-display font-extrabold text-sm text-white mt-1 leading-snug">
                  {t.title}
                </h4>
                {t.message && (
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
                    {t.message}
                  </p>
                )}
              </div>

              <button
                onClick={() => dismiss(t.id)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-lg transition-all cursor-pointer"
                title="Fermer la notification"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être utilisé à l\'intérieur de <ToastProvider>.');
  }
  return ctx;
}
