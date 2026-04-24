import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, User, CheckCircle, XCircle, Play, Send, Award, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../App';

interface LiveQuestion {
  id: number;
  content: string;
  student_id: number;
  student_name: string;
  status: 'PENDING' | 'CONFIRMED' | 'ANSWERED' | 'GRADED' | 'EXPIRED';
  score?: number;
  answer?: string;
  created_at: string | { seconds: number };
}

export default function LiveQuestions({ overrideClassId }: { overrideClassId?: string | number }) {
  const { user, apiFetch, socket } = useAuth();
  const [searchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const classId = overrideClassId || classIdFromUrl;
  
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [activeQuestion, _setActiveQuestion] = useState<LiveQuestion | null>(null);
  const activeQuestionRef = useRef<LiveQuestion | null>(null);
  const setActiveQuestion = (q: LiveQuestion | null) => {
    activeQuestionRef.current = q;
    _setActiveQuestion(q);
  };
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(100);
  const [loading, setLoading] = useState(false);
  const [ timeLeft, setTimeLeft] = useState<number | null>(null);
  const [handRaises, setHandRaises] = useState<any[]>([]);

  useEffect(() => {
    fetchHandRaises();
    if (!socket) return;

    const hrHandler = (hr: any) => {
      setHandRaises(prev => {
        if (prev.find(p => p.user_id === hr.user_id)) return prev;
        return [hr, ...prev];
      });
    };

    const clearHandler = () => {
      setHandRaises([]);
    };

    socket.on('student_raised_hand', hrHandler);
    socket.on('hand_raises_cleared', clearHandler);

    return () => {
      socket.off('student_raised_hand', hrHandler);
      socket.off('hand_raises_cleared', clearHandler);
    };
  }, [classId, socket]);

  const fetchHandRaises = async () => {
    if (!classId) return;
    try {
      const data = await apiFetch(`/api/classes/${classId}/hand-raises`);
      setHandRaises(data);
    } catch (e) { console.error(e); }
  };

  const raiseHand = async () => {
    if (!classId) return;
    try {
      await apiFetch(`/api/classes/${classId}/raise-hand`, { method: 'POST' });
    } catch (e) { console.error(e); }
  };

  const clearHandRaises = async () => {
    if (!classId) return;
    try {
      await apiFetch(`/api/classes/${classId}/hand-raises`, { method: 'DELETE' });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeQuestion && activeQuestion.status === 'PENDING') {
      const createdAt = typeof activeQuestion.created_at === 'string' 
        ? new Date(activeQuestion.created_at).getTime()
        : activeQuestion.created_at.seconds * 1000;
        
      const expiryTime = createdAt + 20000; // 20 seconds
      
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
        setTimeLeft(diff);
        
        if (diff <= 0) {
          clearInterval(interval);
          handleTimeout();
        }
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [activeQuestion]);

  const handleTimeout = async () => {
    if (user.role === 'TEACHER' && activeQuestion?.status === 'PENDING') {
      try {
        await apiFetch(`/api/live-questions/${activeQuestion.id}/expire`, { method: 'POST' });
      } catch (e) { console.error("Auto-expire failed:", e); }
    }
  };

  useEffect(() => {
    fetchQuestions();
    if (!socket) return;

    if (classId) {
      socket.emit('join_class', classId);
    }

    const h1 = (q: any) => {
      if (classId && q.class_id && q.class_id.toString() !== classId.toString()) return;
      setQuestions(prev => [q, ...prev]);
      // Show for everyone in the class
      setActiveQuestion(q);
    };
    const h2 = (q: any) => {
      if (classId && q.class_id && q.class_id.toString() !== classId.toString()) return;
      setQuestions(prev => prev.map(item => item.id === q.id ? q : item));
      const currentActive = activeQuestionRef.current;
      if (currentActive?.id === q.id) {
        if (q.status === 'EXPIRED' || q.status === 'GRADED') {
          setActiveQuestion(null);
        } else {
          setActiveQuestion(q);
        }
      }
    };

    socket.on('new_live_question', h1);
    socket.on('live_question_update', h2);

    return () => {
      socket.off('new_live_question', h1);
      socket.off('live_question_update', h2);
    };
  }, [classId, socket, user.id]);

  const fetchQuestions = async () => {
    try {
      const url = classId ? `/api/live-questions?classId=${classId}` : '/api/live-questions';
      const data = await apiFetch(url);
      setQuestions(data);
      const active = data.find((q: any) => 
        (q.status === 'PENDING' || q.status === 'CONFIRMED' || q.status === 'ANSWERED')
      );
      if (active) setActiveQuestion(active);
      else setActiveQuestion(null);
    } catch (e) { console.error(e); }
  };

  const createQuestion = async (studentId?: number | string) => {
    if (!newQuestion) return;
    setLoading(true);
    try {
      await apiFetch('/api/live-questions', {
        method: 'POST',
        body: JSON.stringify({ content: newQuestion, classId, studentId })
      });
      setNewQuestion('');
      fetchQuestions();
      if (studentId) clearHandRaises();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const confirmPresence = async () => {
    try {
      await apiFetch(`/api/live-questions/${activeQuestion?.id}/confirm`, {
        method: 'POST'
      });
    } catch (e) { console.error(e); }
  };

  const submitAnswer = async () => {
    try {
      await apiFetch(`/api/live-questions/${activeQuestion?.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer })
      });
      setAnswer('');
    } catch (e) { console.error(e); }
  };

  const gradeAnswer = async () => {
    try {
      await apiFetch(`/api/live-questions/${activeQuestion?.id}/grade`, {
        method: 'POST',
        body: JSON.stringify({ score })
      });
      setActiveQuestion(null);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">🎯 Pyetje Live</h2>
          <p className="text-slate-500">Sistemi zgjedh automatikisht një student ose mund të zgjidhni ju nga ata që kërkojnë të përgjigjen</p>
        </div>
        {user.role === 'STUDENT' && classId && (
          <button 
            onClick={raiseHand}
            className="bg-amber-100 text-amber-700 px-6 py-3 rounded-2xl font-bold hover:bg-amber-200 transition-all flex items-center space-x-2 border border-amber-200"
          >
            <Send size={18} />
            <span>Ngre Dorën ✋</span>
          </button>
        )}
      </div>

      {user.role === 'TEACHER' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-2">Krijo Pyetje të Re</label>
            <div className="flex space-x-4">
              <input 
                type="text" 
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Shkruani pyetjen këtu..."
                className="flex-1 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button 
                onClick={() => createQuestion()}
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center space-x-2 shadow-lg shadow-blue-100"
              >
                <Play size={20} />
                <span>Rastësor</span>
              </button>
            </div>
          </div>

          {handRaises.length > 0 && (
            <div className="bg-amber-50/50 p-6 rounded-[2.5rem] border border-amber-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-amber-800 flex items-center space-x-2">
                  <span>✋ Studentët që duan të përgjigjen</span>
                  <span className="bg-amber-200 text-amber-800 text-[10px] px-2 py-0.5 rounded-full">{handRaises.length}</span>
                </h3>
                <button onClick={clearHandRaises} className="text-amber-600 text-xs hover:underline uppercase font-bold tracking-wider">Pastro Listën</button>
              </div>
              <div className="flex flex-wrap gap-4">
                {handRaises.map(hr => (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={hr.user_id}
                    onClick={() => createQuestion(hr.user_id)}
                    className="bg-white p-3 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all flex items-center space-x-3 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border-2 border-amber-100 group-hover:border-amber-400 transition-colors">
                      {hr.photo ? <img src={hr.photo} alt="" className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-slate-400" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1">{hr.name}</p>
                      <p className="text-[10px] text-amber-600 font-bold uppercase">Zgjidh Studentin</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeQuestion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <HelpCircle size={120} />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-3">
                <span className="bg-blue-500/20 text-blue-400 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Pyetje Aktive
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-400 text-xs">Studenti i zgjedhur: <span className="text-white font-bold">{activeQuestion.student_name}</span></span>
              </div>

              <h3 className="text-3xl font-bold leading-tight">{activeQuestion.content}</h3>

              {activeQuestion.status === 'EXPIRED' && (
                <div className="bg-red-500/20 text-red-200 p-6 rounded-2xl border border-red-500/30 flex items-center space-x-4">
                  <XCircle size={32} />
                  <div>
                    <h4 className="font-bold">Koha mbaroi!</h4>
                    <p className="text-sm opacity-80">Studenti nuk u konfirmua brenda 2 minutave.</p>
                  </div>
                </div>
              )}

              {user.id.toString() === activeQuestion.student_id.toString() && activeQuestion.status !== 'EXPIRED' ? (
                <div className="pt-6 space-y-4">
                  {activeQuestion.status === 'PENDING' && (
                    <div className="space-y-4">
                      {timeLeft !== null && (
                        <div className="flex items-center justify-center space-x-2 text-blue-400 font-mono text-xl">
                          <Clock size={24} />
                          <span>0:{timeLeft.toString().padStart(2, '0')}</span>
                        </div>
                      )}
                      <button 
                        onClick={confirmPresence}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20"
                      >
                        Konfirmo Prezencën
                      </button>
                    </div>
                  )}
                  {activeQuestion.status === 'CONFIRMED' && (
                    <div className="space-y-4">
                      <textarea 
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Shkruani përgjigjen tuaj..."
                        className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 h-32"
                      />
                      <button 
                        onClick={submitAnswer}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-2 shadow-xl shadow-green-900/20"
                      >
                        <Send size={20} />
                        <span>Dërgo Përgjigjen</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : activeQuestion.status === 'PENDING' && (
                <div className="pt-6 space-y-4 text-center">
                  <div className="inline-flex items-center space-x-2 text-amber-400 font-mono text-lg bg-amber-400/10 px-6 py-3 rounded-2xl border border-amber-400/20">
                    <Clock size={20} className="animate-spin-slow" />
                    <span>Duke pritur studentin... {timeLeft}s</span>
                  </div>
                </div>
              )}

              {user.role === 'TEACHER' && activeQuestion.status === 'ANSWERED' && (
                <div className="pt-6 bg-slate-800/50 p-6 rounded-3xl space-y-4">
                  <p className="text-sm font-bold text-slate-400 uppercase">Përgjigja e Studentit</p>
                  <p className="text-lg italic text-slate-200">"{activeQuestion.answer}"</p>
                  <div className="flex items-center space-x-4 pt-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Vlerësimi (1-100)</label>
                      <input 
                        type="number" 
                        value={score}
                        onChange={(e) => setScore(parseInt(e.target.value))}
                        className="w-full bg-slate-700 border border-slate-600 p-3 rounded-xl text-white outline-none"
                      />
                    </div>
                    <button 
                      onClick={gradeAnswer}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold h-[52px] mt-6 transition-all"
                    >
                      Vlerëso
                    </button>
                  </div>
                </div>
              )}

              {activeQuestion.status === 'PENDING' && user.role === 'TEACHER' && (
                <div className="flex items-center space-x-2 text-amber-400 text-sm animate-pulse">
                  <Clock size={16} />
                  <span>Duke pritur konfirmimin nga studenti...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {user.role === 'TEACHER' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-bold text-slate-900">Historia e Pyetjeve</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {questions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic">Nuk ka pyetje të mëparshme.</div>
            ) : (
              questions.map(q => (
                <div key={q.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      q.status === 'GRADED' ? 'bg-green-100 text-green-600' : 
                      q.status === 'EXPIRED' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {q.status === 'GRADED' ? <Award size={20} /> : q.status === 'EXPIRED' ? <XCircle size={20} /> : <HelpCircle size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{q.content}</p>
                      <p className="text-xs text-slate-500">{q.student_name} • {new Date(typeof q.created_at === 'string' ? q.created_at : (q.created_at as any).seconds * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {q.status === 'GRADED' && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">{q.score} pikë</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Vlerësuar</p>
                    </div>
                  )}
                  {q.status === 'EXPIRED' && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 uppercase">Nuk u përgjigj</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
