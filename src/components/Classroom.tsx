import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Search, Mail, Phone, MessageSquare, CheckCircle, Clock, Star, Award, X } from 'lucide-react';
import MotionLogo from './MotionLogo';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../App';

export default function Classroom() {
  const { user, apiFetch, socket } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [ratingData, setRatingData] = useState({ score: 10, comment: '' });
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchPendingMembers();
    if (!socket) return;

    const h = (onlineUsers: any[]) => {
      const onlineIds = new Set(onlineUsers.map(u => u.id));
      setMembers(prev => prev.map(m => ({
        ...m,
        isOnline: onlineIds.has(m.id)
      })));
    };

    socket.on('user_status', h);

    return () => { socket.off('user_status', h); };
  }, [socket]);

  const fetchMembers = async () => {
    try {
      const data = await apiFetch('/api/class/members');
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingMembers = async () => {
    try {
      const data = await apiFetch('/api/admin/pending-members');
      setPendingMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (memberId: number, status: string) => {
    try {
      await apiFetch('/api/admin/approve-member', {
        method: 'POST',
        body: JSON.stringify({ memberId, status })
      });
      fetchMembers();
      fetchPendingMembers();
    } catch (e) {
      console.error(e);
      alert('Gabim gjatë procesimit të kërkesës.');
    }
  };

  const handleApproveAll = async () => {
    if (!confirm('A jeni të sigurt që dëshironi t\'i pranoni të gjithë studentët e kërkuar?')) return;
    try {
      await apiFetch('/api/admin/approve-all', { method: 'POST' });
      fetchMembers();
      fetchPendingMembers();
      alert('Të gjithë studentët u pranuan me sukses!');
    } catch (e) {
      console.error(e);
      alert('Gabim gjatë procesimit të kërkesës.');
    }
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setRatingLoading(true);
    try {
      await apiFetch('/api/teacher/rate-student', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          score: ratingData.score,
          comment: ratingData.comment
        })
      });
      setSelectedStudent(null);
      setRatingData({ score: 10, comment: '' });
      alert('Vlerësimi u ruajt me sukses!');
    } catch (e) {
      console.error(e);
      alert('Gabim gjatë vlerësimit.');
    } finally {
      setRatingLoading(false);
    }
  };

  const filteredMembers = members.filter(m => 
    `${m.name} ${m.surname}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {user.role === 'STUDENT' ? '🏫 Klasa Ime' : '🏫 Menaxhimi i Studentëve'}
          </h2>
          {user.role === 'STUDENT' && (
            <p className="text-slate-500">{user.program} • {user.year} • Grupi {user.group_name}</p>
          )}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Kërko shokët e klasës..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {pendingMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
              <Clock size={20} />
              Kërkesat për Anëtarësim ({pendingMembers.length})
            </h3>
            {user.role !== 'TEACHER' && (
              <button 
                onClick={handleApproveAll}
                className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
              >
                <CheckCircle size={16} />
                <span>Prano të Gjithë</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingMembers.map((member) => (
              <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MotionLogo size="sm" src={member.profile_photo} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{member.name} {member.surname}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{member.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApprove(member.id, 'CONFIRMED')}
                    className="p-2 bg-green-100 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all"
                    title="Prano"
                  >
                    <CheckCircle size={16} />
                  </button>
                  <button 
                    onClick={() => handleApprove(member.id, 'REFUSED')}
                    className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                    title="Refuzo"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <motion.div 
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="relative">
                  <MotionLogo size="lg" src={member.profile_photo} />
                  {member.isOnline && (
                    <div className="absolute -right-1 -bottom-1 w-5 h-5 bg-green-500 border-4 border-white rounded-full"></div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      // Navigate to chat with this member selected
                      window.location.href = `/chat?userId=${member.id}`;
                    }}
                    className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors"
                  >
                    <MessageSquare size={18} />
                  </button>
                  {user.role === 'TEACHER' && (
                    <button 
                      onClick={() => setSelectedStudent(member)}
                      className="p-2 text-slate-400 hover:bg-yellow-50 hover:text-yellow-600 rounded-xl transition-colors"
                      title="Vlerëso Studentin"
                    >
                      <Star size={18} />
                    </button>
                  )}
                  {member.phone && (
                    <a 
                      href={`tel:${member.phone}`}
                      className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors"
                    >
                      <Phone size={18} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {member.name} {member.surname}
                  {member.is_confirmed && (
                    <CheckCircle size={16} className="text-green-500 fill-green-50" />
                  )}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  {member.role === 'TEACHER' ? 'Mësues i Lëndës' : 'Student'}
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-600">
                    <Mail size={14} className="mr-2 opacity-40" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <CheckCircle size={14} className={`mr-2 ${member.is_confirmed ? 'text-green-500' : 'text-slate-300 opacity-40'}`} />
                    <span className={member.is_confirmed ? 'text-green-600 font-bold' : ''}>
                      {member.is_confirmed ? 'I Konfirmuar' : 'Pa Konfirmuar'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <Clock size={12} className="mr-1" />
                  {member.isOnline ? 'Aktiv Tani' : 'Jashtë Linje'}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.location.href = `/chat?userId=${member.id}`}
                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                    title="Dërgo Mesazh"
                  >
                    <MessageSquare size={16} />
                  </button>
                  {member.phone && (
                    <a 
                      href={`tel:${member.phone}`}
                      className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all"
                      title="Telefono"
                    >
                      <Phone size={16} />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filteredMembers.length === 0 && !loading && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <Users size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500">Nuk u gjet asnjë anëtar me këtë emër.</p>
        </div>
      )}

      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <MotionLogo size="sm" src={selectedStudent.profile_photo} />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Vlerëso Studentin</h2>
                    <p className="text-xs text-slate-500">{selectedStudent.name} {selectedStudent.surname}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleRate} className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Nota (1-10)</label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRatingData({ ...ratingData, score: num })}
                        className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                          ratingData.score === num 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Komenti / Feedback</label>
                  <textarea
                    value={ratingData.comment}
                    onChange={e => setRatingData({ ...ratingData, comment: e.target.value })}
                    className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium h-32 resize-none"
                    placeholder="Shkruaj një koment për performancën e studentit..."
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                  >
                    Anulo
                  </button>
                  <button
                    type="submit"
                    disabled={ratingLoading}
                    className="flex-1 px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
                  >
                    {ratingLoading ? 'Duke ruajtur...' : 'Ruaj Vlerësimin'}
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
