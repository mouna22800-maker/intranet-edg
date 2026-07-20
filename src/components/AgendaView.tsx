/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Download, Plus, Lock, ArrowLeft } from 'lucide-react';
import { IntranetUser } from '../types';
import LucideIcon from './LucideIcon';
import { apiFetch } from '../api';

interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  dept: string;
  date: string;
  time: string;
  location: string;
  host: string;
}

interface AgendaViewProps {
  currentUser: IntranetUser | null;
  authToken?: string | null;
  onNavigateBack?: () => void;
}

export default function AgendaView({ currentUser, authToken, onNavigateBack }: AgendaViewProps) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [eventFilter, setEventFilter] = useState('Tous');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime] = useState('09:00 - 10:30');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventHost] = useState(currentUser?.name ?? '');
  const [newEventSubmitted, setNewEventSubmitted] = useState(false);
  const [eventSubmitError, setEventSubmitError] = useState<string | null>(null);

  const loadEvents = () => {
    fetch('/api/events')
      .then(res => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setCalendarEvents(data.map(e => ({
            id: e.id,
            title: e.title,
            type: e.type,
            dept: e.departmentLabel || 'Institutionnel',
            date: e.date,
            time: e.time || '',
            location: e.location || '',
            host: e.host || ''
          })));
        }
      })
      .catch(() => {});
  };

  useEffect(() => { loadEvents(); }, []);

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;
    setEventSubmitError(null);

    const eventType = currentUser?.role === 'rh_direction'
      ? 'RH / Direction'
      : currentUser?.departmentCode === 'finance'
        ? 'Finance'
        : 'Technique';

    try {
      const res = await apiFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEventTitle,
          type: eventType,
          departmentId: currentUser?.departmentId ?? null,
          date: newEventDate,
          time: newEventTime,
          location: newEventLocation || 'Salle de réunion (Siège)',
          host: newEventHost || currentUser?.name || ''
        })
      }, authToken);

      if (res.ok) {
        loadEvents();
        setNewEventSubmitted(true);
        setNewEventTitle('');
        setNewEventDate('');
        setNewEventLocation('');
        setTimeout(() => setNewEventSubmitted(false), 4000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setEventSubmitError(errData.detail || "Erreur lors de la planification de l'événement.");
      }
    } catch (err) {
      setEventSubmitError('Erreur réseau lors de la planification.');
    }
  };

  const exportEventsToICS = (eventsToExport: CalendarEvent[], fileName: string = 'agenda_edg_global.ics') => {
    if (eventsToExport.length === 0) return;

    const sanitizeText = (str: string) => str
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    let icsLines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Électricité de Guinée S.A.//Intranet Calendar//FR',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'
    ];

    eventsToExport.forEach(ev => {
      const dbDate = ev.date;
      const timeRange = ev.time || '09:00 - 10:00';
      const [startHourMin, endHourMin] = timeRange.split(' - ').map((s) => s ? s.trim() : '');
      const startClean = (startHourMin || '09:00').replace(':', '') + '00';
      const endClean = (endHourMin || '10:00').replace(':', '') + '00';
      const dateClean = dbDate.replace(/-/g, '');

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:edg-evt-${ev.id}@edg.com.gn`);
      icsLines.push(`DTSTAMP:${dateClean}T000000Z`);
      icsLines.push(`DTSTART;TZID=Africa/Conakry:${dateClean}T${startClean}`);
      icsLines.push(`DTEND;TZID=Africa/Conakry:${dateClean}T${endClean}`);
      icsLines.push(`SUMMARY:${sanitizeText(ev.title)}`);
      icsLines.push(`DESCRIPTION:${sanitizeText(`Type : ${ev.type}\nDépartement : ${ev.dept}\nHôte : ${ev.host}`)}`);
      icsLines.push(`LOCATION:${sanitizeText(ev.location)}`);
      icsLines.push('END:VEVENT');
    });

    icsLines.push('END:VCALENDAR');

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCalendarEvents = calendarEvents.filter(evt => eventFilter === 'Tous' || evt.type === eventFilter);
  const canCreate = ['chef_service', 'rh_direction', 'administrateur'].includes(currentUser?.role || '');

  return (
    <div className="space-y-6 pb-16 font-sans">
      {onNavigateBack && (
        <button onClick={onNavigateBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer">
          <ArrowLeft size={14} /> Retour à l'accueil
        </button>
      )}

      {/* Page header */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-white/10 pb-5">
        <div className="p-2.5 rounded-xl bg-[#048343]/10 text-[#048343] dark:bg-emerald-500/10 dark:text-emerald-400">
          <Clock size={20} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Agenda National & Réunions Institutionnelles
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Réunions, revues techniques et événements planifiés de l'Électricité de Guinée.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

        {/* Left: Events listing */}
        <div className="md:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2 gap-2">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-mono font-black text-slate-550 dark:text-zinc-400 uppercase tracking-widest block">Événements planifiés</h3>
              <button
                onClick={() => exportEventsToICS(filteredCalendarEvents)}
                className="inline-flex items-center space-x-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded text-[9px] font-sans font-bold border border-zinc-200/50 dark:border-zinc-800 cursor-pointer select-none transition-colors"
                title="Exporter au format .ICS pour Outlook, Gmail, Apple Calendar"
              >
                <Download size={9} />
                <span>Exporter (.ics)</span>
              </button>
            </div>

            <div className="flex items-center space-x-1">
              {['Tous', 'RH / Direction', 'Technique', 'Finance'].map((f) => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  className={`px-2 py-1 rounded text-[9px] font-bold font-mono uppercase cursor-pointer ${
                    eventFilter === f
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredCalendarEvents.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                Aucun événement planifié pour ce filtre.
              </div>
            ) : filteredCalendarEvents.map((evt) => (
              <div key={evt.id} className="p-4 bg-white/50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-850 rounded-2xl flex items-start space-x-3.5 shadow-sm">
                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border font-mono font-black text-center shrink-0 min-w-[50px]">
                  <span className="text-[9px] text-[#048343] block uppercase leading-none">{new Date(evt.date).toLocaleString('fr-FR', { month: 'short' })}</span>
                  <span className="text-xl text-slate-800 dark:text-white block leading-none pt-1">{new Date(evt.date).getDate()}</span>
                </div>
                <div className="flex-grow min-w-0 text-left">
                  <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded ${
                    evt.type === 'RH / Direction'
                      ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40'
                      : evt.type === 'Finance'
                      ? 'bg-[#108548]/10 text-emerald-700'
                      : 'bg-blue-50 text-blue-800 dark:bg-blue-950/40'
                  }`}>
                    {evt.type}
                  </span>
                  <h4 className="text-xs font-black text-slate-850 dark:text-white mt-1 leading-tight truncate">{evt.title}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Heure : <span className="font-bold text-slate-700 dark:text-slate-300">{evt.time}</span> • Lieu : <span className="font-bold text-slate-700 dark:text-slate-300">{evt.location}</span>
                  </p>
                  <p className="text-[9.5px] text-slate-400 mt-1 font-mono">Organisateur : {evt.host} ({evt.dept})</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Quick Agenda Creator */}
        <div className="md:col-span-4 bg-slate-50 dark:bg-slate-950/40 p-4.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-4">
          <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest block pb-1 border-b">
            Organiser un événement
          </span>

          {canCreate ? (
            newEventSubmitted ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 text-xs text-emerald-800 dark:text-emerald-400 rounded-xl">
                Événement ajouté au calendrier institutionnel de l'EDG SA !
              </div>
            ) : (
              <form onSubmit={handleEventSubmit} className="space-y-3">
                {eventSubmitError && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 text-[10px] text-red-700 dark:text-red-400 rounded-lg">
                    {eventSubmitError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-black text-slate-400 uppercase">Intitulé de la rencontre</label>
                  <input
                    type="text" required value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="ex: Réunion technique VSAT"
                    className="w-full bg-white dark:bg-slate-900 border text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#048343]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-black text-slate-400 uppercase">Date</label>
                  <input
                    type="date" required value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border text-xs px-2.5 py-1.5 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-black text-slate-400 uppercase">Lieu (Salle/Siège)</label>
                  <input
                    type="text" value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="ex: Salon d'honneur ou Bureau"
                    className="w-full bg-white dark:bg-slate-900 border text-xs px-2.5 py-1.5 rounded-lg focus:outline-none shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#048343] hover:bg-[#036d37] text-white text-[11px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-sm"
                >
                  <Plus size={12} />
                  <span>Planifier la réunion</span>
                </button>
              </form>
            )
          ) : (
            <div className="p-4 bg-slate-100 dark:bg-slate-900 text-[11px] text-slate-500 rounded-xl leading-relaxed text-center space-y-2">
              <Lock className="mx-auto text-slate-450" size={16} />
              <p className="font-extrabold text-[#048343] dark:text-emerald-450 uppercase text-[9px]">Accès réservé</p>
              <p>Seuls les Directeurs, RH et Chefs de service détiennent les privilèges d'écriture pour l'agenda institutionnel national.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
