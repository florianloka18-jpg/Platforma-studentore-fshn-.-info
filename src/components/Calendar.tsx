import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, MapPin, Building, GraduationCap, FileText, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { User } from '../types';
import { useAuth } from '../App';

interface Schedule {
  id: number;
  teacher_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  program: string;
  year: string;
  building: string;
  classroom: string;
  teacher_name?: string;
}

const DAYS = ['E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë'];
const PROGRAMS = [
  "BIOLOGJI", "BIOTEKNOLOGJI", "KIMI", "KIMI INDUSTRIALE DHE MJEDISORE",
  "FIZIKE", "FIZIKE DHE SHKENCA KOMPJUTERIKE", "MATEMATIKE",
  "MATEMATIKE INFORMATIK", "TEKNOLOGJI INFORMACIONI DHE KOMUNIKIMI", "STATISTIKE", "Tjetër"
];
const YEARS = [
  "VITI 1 BACHELORE", "VITI 2 BACHELORE", "VITI 3 BACHELORE",
  "VITI 1 MASTER", "VITI 2 MASTER"
];
const GROUPS = ['A', 'B', 'C'];
const BUILDINGS = ['A', 'B', 'C', 'D'];

export default function Calendar() {
  const { user, apiFetch } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClassAdmin, setIsClassAdmin] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    day_of_week: 'E Hënë',
    start_time: '08:00',
    end_time: '09:00',
    program: 'BIOLOGJI',
    custom_program: '',
    year: 'VITI 1 BACHELORE',
    group_name: 'A',
    building: 'A',
    classroom: '',
    subject: ''
  });

  const fetchSchedules = async () => {
    try {
      const data = await apiFetch('/api/schedules');
      setSchedules(data);
      
      // Check if user is admin of their class
      const myClasses = await apiFetch('/api/classes/my');
      if (myClasses.some((c: any) => c.admin_id === user.id)) {
        setIsClassAdmin(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newSchedule,
      program: newSchedule.program === 'Tjetër' ? newSchedule.custom_program : newSchedule.program
    };
    try {
      await apiFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setShowAddModal(false);
      fetchSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('A jeni i sigurt që dëshironi ta fshini këtë orar?')) return;
    try {
      await apiFetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      });
      fetchSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kalendari i Mësimeve</h1>
          <p className="text-slate-500">Orari javor i leksioneve dhe seminareve</p>
        </div>
        {user?.role === 'TEACHER' && (
          <div className="flex flex-wrap gap-3">
            <Link
              to="/tests"
              className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
            >
              <FileText size={20} />
              <span>Shto Test</span>
            </Link>
            <Link
              to="/assignments"
              className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
            >
              <BookOpen size={20} />
              <span>Shto Detyrë</span>
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <Plus size={20} />
              <span>Shto Orar</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {DAYS.map(day => (
          <div key={day} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="bg-slate-50 p-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-center">{day}</h3>
            </div>
            <div className="p-3 space-y-3 flex-1 min-h-[200px]">
              {schedules
                .filter(s => s.day_of_week === day)
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(schedule => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={schedule.id}
                    className="p-3 rounded-xl bg-blue-50 border border-blue-100 relative group"
                  >
                    { (user?.role === 'TEACHER' || isClassAdmin) && (
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center text-xs font-bold text-blue-700">
                        <Clock size={12} className="mr-1" />
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                      <div className="text-sm font-bold text-slate-900 leading-tight">
                        {schedule.program}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center">
                        <GraduationCap size={10} className="mr-1" />
                        {schedule.year}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100/50">
                        <div className="text-[10px] font-medium text-slate-600 flex items-center">
                          <Building size={10} className="mr-1" />
                          Godina {schedule.building}
                        </div>
                        <div className="text-[10px] font-bold text-blue-600">
                          Salla {schedule.classroom}
                        </div>
                      </div>
                      {user?.role === 'STUDENT' && schedule.teacher_name && (
                        <div className="text-[10px] italic text-slate-500 mt-1">
                          Pedagogu: {schedule.teacher_name}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              {schedules.filter(s => s.day_of_week === day).length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-300 text-xs italic">
                  Nuk ka mësime
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Shto Orar të Ri</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Trash2 size={20} />
                </button>
              </div>
              <form onSubmit={handleAddSchedule} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dita</label>
                    <select
                      value={newSchedule.day_of_week}
                      onChange={e => setNewSchedule({ ...newSchedule, day_of_week: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lënda</label>
                    <input
                      type="text"
                      value={newSchedule.subject}
                      onChange={e => setNewSchedule({ ...newSchedule, subject: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="p.sh. Matematikë"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dega</label>
                    <select
                      value={newSchedule.program}
                      onChange={e => setNewSchedule({ ...newSchedule, program: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {newSchedule.program === 'Tjetër' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specifiko Degën</label>
                    <input
                      type="text"
                      value={newSchedule.custom_program}
                      onChange={e => setNewSchedule({ ...newSchedule, custom_program: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Shkruaj emrin e degës..."
                      required
                    />
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Viti</label>
                    <select
                      value={newSchedule.year}
                      onChange={e => setNewSchedule({ ...newSchedule, year: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Grupi</label>
                    <select
                      value={(newSchedule as any).group_name}
                      onChange={e => setNewSchedule({ ...newSchedule, group_name: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Godina</label>
                    <select
                      value={newSchedule.building}
                      onChange={e => setNewSchedule({ ...newSchedule, building: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ora Fillimit</label>
                    <input
                      type="time"
                      value={newSchedule.start_time}
                      onChange={e => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ora Mbarimit</label>
                    <input
                      type="time"
                      value={newSchedule.end_time}
                      onChange={e => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salla</label>
                  <input
                    type="text"
                    placeholder="p.sh. 204"
                    value={newSchedule.classroom}
                    onChange={e => setNewSchedule({ ...newSchedule, classroom: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Anulo
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  >
                    Ruaj Orarin
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
