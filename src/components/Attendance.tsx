import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, UserCheck, Users, Play, Square, Clock, AlertCircle, Calendar, MessageSquare, Send } from 'lucide-react';
import MotionLogo from './MotionLogo';
import { Socket } from 'socket.io-client';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';

export default function Attendance({ overrideClassId }: { overrideClassId?: string | number }) {
  const { user, apiFetch, socket } = useAuth();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(60);
  const [openingComment, setOpeningComment] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [classId, setClassId] = useState<string | number | ''>(overrideClassId || '');
  const [classes, setClasses] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (overrideClassId) {
      setClassId(overrideClassId);
    }
  }, [overrideClassId]);

  useEffect(() => {
    fetchActiveSession();
    if (user?.role === 'TEACHER') fetchClasses();
    
    if (!user || !socket) return;

    const s = socket;
    const currentId = overrideClassId || classId;
    if (currentId) {
      s.emit('join_class', currentId);
    }

    const h1 = (data: any) => {
      fetchActiveSession();
    };

    const h2 = (data: any) => {
      setWarning(data.message);
      setTimeout(() => setWarning(null), 10000);
    };

    const h3 = (data: any) => {
      setActiveSession(null);
      setTimeLeft(null);
      if (data.auto) {
        alert("Ora përfundoi automatikisht.");
      }
    };

    const h4 = (data: any) => {
      setActiveSession((prev: any) => {
        if (!prev || prev.id !== data.sessionId) return prev;
        const presence = prev.presence || [];
        if (presence.some((p: any) => p.userId === data.userId)) return prev;
        return {
          ...prev,
          presence: [...presence, { userId: data.userId, userName: data.userName, is_verified: 0 }]
        };
      });
    };

    const h5 = (data: any) => {
      setActiveSession((prev: any) => {
        if (!prev || prev.id !== data.sessionId) return prev;
        return {
          ...prev,
          presence: prev.presence.map((p: any) => p.userId === data.userId ? { ...p, is_verified: 1 } : p)
        };
      });
    };

    s.on('study_session_start', h1);
    s.on('study_session_warning', h2);
    s.on('study_session_end', h3);
    s.on('presence_confirmed', h4);
    s.on('presence_verified', h5);

    return () => {
      s.off('study_session_start', h1);
      s.off('study_session_warning', h2);
      s.off('study_session_end', h3);
      s.off('presence_confirmed', h4);
      s.off('presence_verified', h5);
    };
  }, [user?.id, socket, overrideClassId, classId]);


  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession && activeSession.status === 'ACTIVE') {
      const startTime = new Date(activeSession.created_at).getTime();
      const endTime = startTime + activeSession.duration * 60 * 1000;
      
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(diff);
        if (diff === 0) {
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const fetchClasses = async () => {
    try {
      const data = await apiFetch('/api/classes');
      if (Array.isArray(data)) {
        setClasses(data);
      } else {
        console.error("Expected array for classes, got:", data);
        setClasses([]);
      }
    } catch (e) { 
      console.error(e);
      setClasses([]);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const data = await apiFetch('/api/study/active');
      setActiveSession(data);
    } catch (e) { console.error(e); }
  };

  const startSession = async () => {
    if (!classId || !subject) return alert("Plotësoni të gjitha fushat");
    setLoading(true);
    try {
      const resp = await apiFetch('/api/study/start', {
        method: 'POST',
        body: JSON.stringify({ classId, subject, duration, comment: openingComment })
      });
      if (resp.error) throw new Error(resp.error);
      setOpeningComment('');
    } catch (e: any) { 
      console.error(e);
      alert(e.message || "Gabim gjatë fillimit të mësimit.");
    }
    setLoading(false);
  };

  const sendCommentOnly = async () => {
    if (!classId || !openingComment) return alert("Zgjidhni klasën dhe shkruani një koment");
    setLoading(true);
    try {
      await apiFetch(`/api/classes/${classId}/publish-comment`, {
        method: 'POST',
        body: JSON.stringify({ comment: openingComment })
      });
      setOpeningComment('');
      alert("Komenti u dërgua me sukses!");
    } catch (e) { 
      console.error(e); 
      alert("Gabim gjatë dërgimit të komentit.");
    }
    setLoading(false);
  };

  const endSession = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await apiFetch('/api/study/end', {
        method: 'POST',
        body: JSON.stringify({ sessionId: activeSession.id, note: sessionNote })
      });
      navigate('/');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const confirmPresence = async () => {
    try {
      await apiFetch('/api/study/confirm', {
        method: 'POST',
        body: JSON.stringify({ sessionId: activeSession.id })
      });
    } catch (e) { console.error(e); }
  };

  const verifyPresence = async (userId: any) => {
    if (!userId) return;
    try {
      await apiFetch('/api/study/verify', {
        method: 'POST',
        body: JSON.stringify({ sessionId: activeSession.id, userId })
      });
    } catch (e) { console.error(e); }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-8">
      {warning && (
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-20 right-4 z-50 bg-orange-500 text-white p-4 rounded-2xl shadow-xl flex items-center space-x-3"
        >
          <Clock className="animate-pulse" />
          <span className="font-bold">{warning}</span>
        </motion.div>
      )}

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Prezenca Digjitale</h2>
            <p className="text-slate-500">
              {activeSession 
                ? `Mësimi: ${activeSession.subject} (${activeSession.teacherName || 'Ju'})` 
                : 'Nuk ka asnjë sesion mësimi aktiv për momentin.'}
            </p>
          </div>
          
          {activeSession && timeLeft !== null && (
            <div className="flex items-center space-x-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
              <Clock size={20} className={timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-blue-500'} />
              <span className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-slate-700'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>

        {user.role === 'TEACHER' ? (
          !activeSession ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Zgjidh Klasën për të filluar</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {classes.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setClassId(c.id)}
                        disabled={!!overrideClassId}
                        className={`group p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 text-center aspect-square ${
                          classId === c.id 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50' 
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-white'
                        } ${overrideClassId && classId !== c.id ? 'opacity-30' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${classId === c.id ? 'bg-white/20' : 'bg-slate-200 group-hover:bg-blue-100'}`}>
                          <Users size={20} className={classId === c.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-tight line-clamp-2">{c.name}</span>
                        {c.virtual && (
                          <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded-full">SHTESË</span>
                        )}
                      </button>
                    ))}
                    {classes.length === 0 && !loading && (
                      <div className="col-span-full p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center">
                         <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-2">
                           <Users size={24} className="text-slate-400" />
                         </div>
                         <p className="text-sm font-bold text-slate-500">Nuk u gjet asnjë klasë pjesëmarrëse</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lënda</label>
                  <input 
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="P.sh. Analitika"
                    className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                <p className="text-xs text-blue-700 font-medium">
                  <strong>Shënim:</strong> Orët zgjasin 50 minuta dhe përfundojnë në minutën e 50-të të çdo ore (p.sh. 08:50, 09:50). Kohëzgjatja kalkulohet automatikisht.
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Komenti (Fakultativ - Shfaqet për 6 orë)</label>
                  <input 
                    type="text"
                    value={openingComment}
                    onChange={(e) => setOpeningComment(e.target.value)}
                    placeholder="Njoftim për orën e mësimit ose mesazh i pavarur..."
                    className="w-full p-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={sendCommentOnly}
                    disabled={loading || !openingComment || !classId}
                    className="flex-1 md:flex-none border border-blue-600 text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    title="Dërgo vetëm njoftimin pa filluar orën"
                  >
                    <Send size={18} />
                    <span>Dërgo Njoftimin</span>
                  </button>
                  <button 
                    onClick={startSession}
                    disabled={loading || !subject || !classId}
                    className="flex-1 md:flex-none bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <Play size={20} />
                    <span>Fillo Mësimin</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={20} className="text-blue-600" />
                  <h4 className="font-bold text-blue-900">Shënim për studentët (vlefshëm 1 ditë)</h4>
                </div>
                <textarea 
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  placeholder="Shkruani një shënim të rëndësishëm që do të shfaqet në panelin e studentëve..."
                  className="w-full p-4 bg-white rounded-xl border-none focus:ring-2 focus:ring-blue-500 shadow-inner min-h-[100px] text-sm"
                />
              </div>
              <button 
                onClick={endSession}
                disabled={loading}
                className="w-full bg-red-600 text-white p-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center space-x-2"
              >
                <XCircle size={20} />
                <span>Mbaro mësimin dhe konfirmo</span>
              </button>
            </div>
          )
        ) : (
          activeSession && !activeSession.presence?.find((p: any) => p.userId === user.id) && (
            <button 
              onClick={confirmPresence}
              className="w-full bg-green-600 text-white p-4 rounded-2xl font-bold hover:bg-green-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-green-100"
            >
              <UserCheck size={20} />
              <span>Konfirmo Prezencën (Vetëm 1 herë)</span>
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-8">Pjesëmarrësit në Sesion</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!activeSession?.presence || activeSession.presence.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-2xl">
                Nuk ka ende studentë të konfirmuar.
              </div>
            ) : (
              activeSession.presence.map((p: any, index: number) => (
                <div key={p.userId || index} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
                  <div className="flex items-center space-x-3">
                    <MotionLogo size="sm" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.userName}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {p.is_verified ? 'I Verifikuar' : 'Në Pritje'}
                      </p>
                    </div>
                  </div>
                  {user.role === 'TEACHER' && !p.is_verified && (
                    <button 
                      onClick={() => verifyPresence(p.userId)}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {p.is_verified && <CheckCircle size={20} className="text-green-500" />}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Statistikat e Pjesëmarrjes</h3>
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Pjesëmarrja Ditore</p>
              <div className="flex items-end space-x-2">
                <span className="text-2xl font-bold text-slate-900">88%</span>
                <span className="text-green-500 text-xs font-medium mb-1">+2% nga dje</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full mt-3">
                <div className="bg-green-500 h-2 rounded-full w-[88%]"></div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Pjesëmarrja Mujore</p>
              <div className="flex items-end space-x-2">
                <span className="text-2xl font-bold text-slate-900">92%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full mt-3">
                <div className="bg-blue-500 h-2 rounded-full w-[92%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
