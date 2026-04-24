import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, Video, MessageSquare, Users, HelpCircle, 
  CheckCircle, Clock, ArrowLeft, ScreenShare as ScreenShareIcon,
  Camera, Square, AlertCircle, Send, User, Award, Play,
  TrendingDown, TrendingUp, Info, ChevronRight, MoreVertical
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../App';
import MotionLogo from './MotionLogo';

// Sub-components for each tab
import Chat from './Chat';
import Attendance from './Attendance';
import LiveQuestions from './LiveQuestions';
import ScreenShare from './ScreenShare';
import ClassDatabase from './ClassDatabase';
import Library from './Library';
import Analytics from './Analytics';
import { Database, BookOpen, BarChart2 } from 'lucide-react';

type WorkspaceTab = 'STREAM' | 'CHAT' | 'PRESENCE' | 'STUDENTS' | 'QUESTIONS' | 'DATABASE' | 'LIBRARY' | 'ANALYTICS';

export default function ClassroomWorkspace() {
  const { user, apiFetch, socket } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const classId = searchParams.get('classId');
  
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('STREAM');
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isEndingLecture, setIsEndingLecture] = useState(false);

  useEffect(() => {
    if (!classId) {
      navigate('/dashboard');
      return;
    }

    fetchClassData();
    fetchStudents();

    if (!socket) return;

    socket.emit('join_class', classId);

    const h = (data: any) => {
      if (data.classId.toString() === classId.toString()) {
        setClassData((prev: any) => ({ ...prev, pinned_note: data.note }));
      }
    };

    socket.on('class_note_update', h);

    return () => {
      socket.off('class_note_update', h);
    };
  }, [classId, socket]);

  const fetchClassData = async () => {
    try {
      const data = await apiFetch(`/api/classes/${classId}`);
      setClassData(data);
      setNoteText(data.pinned_note || '');
    } catch (e) {
      console.error(e);
    }
  };

  const saveNote = async () => {
    try {
      await apiFetch(`/api/classes/${classId}/note`, {
        method: 'POST',
        body: JSON.stringify({ note: noteText })
      });
      setIsEditingNote(false);
    } catch (e) {
      console.error(e);
    }
  };

  const endLecture = async () => {
    try {
      setIsEndingLecture(true);
      await apiFetch(`/api/classes/${classId}/end-lecture`, { method: 'POST' });
      setIsEndingLecture(false);
    } catch (e) {
      console.error(e);
      setIsEndingLecture(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await apiFetch(`/api/classes/${classId}/students`);
      setStudents(data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  if (!classId) return null;

  const tabs: { id: WorkspaceTab; label: string; icon: any }[] = [
    { id: 'STREAM', label: 'Transmetim Live', icon: Monitor },
    { id: 'CHAT', label: 'Chat i Klasës', icon: MessageSquare },
    { id: 'PRESENCE', label: 'Prezenca', icon: CheckCircle },
    { id: 'STUDENTS', label: 'Studentët & Progresi', icon: Users },
    { id: 'QUESTIONS', label: 'Pyetje Live', icon: HelpCircle },
    { id: 'DATABASE', label: 'Databaza', icon: Database },
    { id: 'LIBRARY', label: 'Libraria', icon: BookOpen },
    ...(user.role === 'TEACHER' ? [{ id: 'ANALYTICS' as WorkspaceTab, label: 'Analitika', icon: BarChart2 }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Workspace Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all border border-transparent hover:border-slate-100"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="h-10 w-[1px] bg-slate-100 mx-2" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 truncate">
                <span className="truncate">{classData ? classData.name : 'Duke ngarkuar...'}</span>
                {classData && <span className="flex-shrink-0 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Aktiv</span>}
              </h1>
              <p className="text-xs text-slate-500 font-medium truncate">
                {classData ? `${classData.department} • ${classData.year}` : 'Paneli i Menaxhimit'}
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
             <button 
               onClick={() => setShowMobileMenu(true)}
               className="lg:hidden p-2.5 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100"
             >
                <div className="grid grid-cols-2 gap-0.5 w-5 h-5 place-items-center">
                  <div className="w-1.5 h-1.5 bg-current rounded-full" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full" />
                </div>
             </button>
             <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900">{user.name}</span>
                <span className="text-[10px] font-bold text-blue-600 uppercase">{user.role === 'TEACHER' ? 'Mësues' : 'Student'}</span>
             </div>
             <MotionLogo size="md" src={user.profile_photo} />
          </div>
        </div>

        {/* Mobile Sidebar Navigation */}
        <AnimatePresence>
          {showMobileMenu && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileMenu(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 w-[280px] bg-white z-[101] shadow-2xl lg:hidden flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Opsionet e Klasës</h3>
                  <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <ArrowLeft className="rotate-180" size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <div className="p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <MotionLogo size="md" src={user.profile_photo} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">{user.role === 'TEACHER' ? 'Mësues' : 'Student'}</p>
                      </div>
                    </div>
                  </div>
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${
                        activeTab === tab.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <tab.icon size={20} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
                <div className="p-6 border-t border-slate-100">
                   <button 
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-4 text-slate-500 font-bold text-sm bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                   >
                     Dil nga Klasa
                   </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Workspace Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-8 relative">
        {/* Pinned Note Section */}
        <div className="mb-6">
           <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 relative overflow-hidden group">
              <div className="relative z-10 flex items-start gap-4">
                 <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                    <Info size={24} />
                 </div>
                 <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                       <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest">Shënim i Pinned</h4>
                       {user.role === 'TEACHER' && !isEditingNote && (
                         <button 
                          onClick={() => setIsEditingNote(true)}
                          className="text-xs font-bold text-amber-700 hover:underline"
                         >
                           Ndrysho
                         </button>
                       )}
                    </div>
                    {isEditingNote ? (
                      <div className="space-y-3 mt-2">
                        <textarea 
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="w-full bg-white border border-amber-200 p-4 rounded-2xl text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px]"
                          placeholder="Shkruani një shënim për studentët..."
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={saveNote}
                            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                          >
                            Ruaj Shënimin
                          </button>
                          <button 
                            onClick={() => setIsEditingNote(false)}
                            className="bg-white text-slate-500 px-4 py-2 rounded-xl text-xs font-bold border border-amber-200"
                          >
                            Anulo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-700 font-medium italic">
                        {classData?.pinned_note || "Nuk ka asnjë shënim të rëndësishëm për momentin."}
                      </p>
                    )}
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full -mr-16 -mt-16 blur-2xl"></div>
           </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'STREAM' && <ScreenShare overrideClassId={classId} />}
            {activeTab === 'CHAT' && <div className="max-w-6xl mx-auto h-full"><Chat overrideClassId={classId} /></div>}
            {activeTab === 'PRESENCE' && <Attendance overrideClassId={classId} />}
            {activeTab === 'QUESTIONS' && <LiveQuestions overrideClassId={classId} />}
            {activeTab === 'DATABASE' && <ClassDatabase classId={classId} className={classData?.name || ''} />}
            {activeTab === 'LIBRARY' && <Library overrideClassId={classId} />}
            {activeTab === 'ANALYTICS' && (
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[600px]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <BarChart2 className="text-blue-600" /> Analitika e Klasës: {classData?.name}
                  </h3>
                </div>
                {/* We need to pass the classId to Analytics. 
                   Since Analytics uses searchParams, we can't easily pass props 
                   unless we modify it or the URL. 
                   However, we can force a location state or query param update if needed,
                   but for a SPA, we can just render it. 
                   Actually, let's update Analytics.tsx to also accept classId as a prop if we want.
                */}
                <Analytics />
              </div>
            )}
            {activeTab === 'STUDENTS' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Studentë</p>
                      <h4 className="text-3xl font-black text-slate-900">{students.length}</h4>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mesatarja e Klasës</p>
                      <h4 className="text-3xl font-black text-blue-600">
                        {students.length > 0 ? (students.reduce((acc, curr) => acc + curr.progress, 0) / students.length).toFixed(1) : 0}%
                      </h4>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Aktiviteti Ditore</p>
                      <h4 className="text-3xl font-black text-emerald-600">Lartë</h4>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pyetje të Hapura</p>
                      <h4 className="text-3xl font-black text-amber-600">2</h4>
                   </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Lista e Studentëve & Progresi</h3>
                    <div className="flex gap-2">
                       <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical size={20} /></button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Studenti</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Email</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Aktivitete</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Progresi</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Veprime</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <MotionLogo size="sm" src={student.profile_photo} />
                                <div>
                                  <p className="font-bold text-slate-900 flex items-center gap-1.5 cursor-help" title={student.is_confirmed ? "Student i konfirmuar" : "Pa konfirmuar"}>
                                    {student.name} {student.surname}
                                    {student.is_confirmed && (
                                      <CheckCircle size={14} className="text-green-500 fill-green-50" />
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Student</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-600 text-sm">{student.email}</td>
                            <td className="px-6 py-4">
                               <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                                  {student.activityCount} detyra/teste
                               </span>
                            </td>
                            <td className="px-6 py-4 min-w-[200px]">
                               <div className="flex items-center gap-3">
                                  <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                     <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${student.progress}%` }}
                                      className={`h-full ${student.progress > 80 ? 'bg-emerald-500' : student.progress > 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                     />
                                  </div>
                                  <span className="text-sm font-bold text-slate-700">{student.progress}%</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                               <button 
                                onClick={() => navigate(`/chat?userId=${student.id}`)}
                                className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                               >
                                  <MessageSquare size={18} />
                               </button>
                               <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                                  <ChevronRight size={18} />
                               </button>
                            </td>
                          </tr>
                        ))}
                        {students.length === 0 && !loading && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              Nuk u gjet asnjë student i konfirmuar në këtë klasë.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
