import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, TrendingDown, Award, Users, BookOpen, CheckCircle, 
  Activity, Calendar, ArrowUpRight, ArrowDownRight, 
  FileDown, Clock, AlertCircle, History, Download, Zap,
  BarChart2, PieChart as PieChartIcon, LogOut, ChevronRight,
  User as UserIcon, Settings, Search, Bell, Menu, X, Plus, Trash2, Edit2
} from 'lucide-react';
import { 
  onSnapshot, 
  doc, 
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { 
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area
} from 'recharts';
import { db, auth } from '../firebase';
import { User } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AcademicTest {
  name: string;
  score: number;
  max: number;
  date: string;
}

interface AcademicAssignment {
  title: string;
  score: number;
  deadline: string;
  submitted: boolean;
}

interface AttendanceRecord {
  date: string;
  status: 'Present' | 'Absent' | 'Late';
}

interface AcademicPerformance {
  user_id: string;
  tests: AcademicTest[];
  assignments: AcademicAssignment[];
  attendance: AttendanceRecord[];
  updated_at?: any;
}

interface AcademicLog {
  id: string;
  user_id: string;
  type: 'TEST' | 'ASSIGNMENT' | 'ATTENDANCE';
  message: string;
  created_at: any;
}

export const AcademicDatabase = ({ user }: { user: User }) => {
  const [performance, setPerformance] = useState<AcademicPerformance | null>(null);
  const [logs, setLogs] = useState<AcademicLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  
  // Real-time listeners
  useEffect(() => {
    if (!auth.currentUser) return;

    // Performance Listener
    const perfUnsubscribe = onSnapshot(doc(db, 'academic_performance', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        setPerformance(snapshot.data() as AcademicPerformance);
      } else {
        setPerformance(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Performance listener error:", err);
      setLoading(false);
    });

    // Activity Log Listener
    const logsQuery = query(
      collection(db, 'academic_logs'),
      where('user_id', '==', auth.currentUser.uid),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    
    const logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicLog));
      setLogs(logsData);
    }, (err) => {
      console.warn("Logs listener error (check if index exists):", err);
    });

    return () => {
      perfUnsubscribe();
      logsUnsubscribe();
    };
  }, []);

  // Calculated Metrics
  const metrics = useMemo(() => {
    if (!performance) return { gpa: 0, attendance: 0, totalPoints: 0, completedTasks: 0, performanceScore: 0 };

    const tests = performance.tests || [];
    const assignments = performance.assignments || [];
    const attendance = performance.attendance || [];

    // Average Grade (Normalized 1-10 scale for typical university feel, but let's do 0-100 first then divide)
    const testAvg = tests.length > 0 ? (tests.reduce((acc, t) => acc + (t.score / t.max) * 100, 0) / tests.length) : 0;
    const assignmentAvg = assignments.length > 0 ? (assignments.reduce((acc, a) => acc + a.score, 0) / assignments.length) : 0;
    
    // Weighted Performance Score: Tests (40%), Assignments (40%), Attendance (20%)
    const presentCount = attendance.filter(a => a.status === 'Present').length;
    const lateCount = attendance.filter(a => a.status === 'Late').length;
    const attendancePercentage = attendance.length > 0 ? (((presentCount + lateCount * 0.5) / attendance.length) * 100) : 0;

    const performanceScore = (testAvg * 0.4) + (assignmentAvg * 0.4) + (attendancePercentage * 0.2);
    
    // GPA (Scale 1-10)
    const gpa = (performanceScore / 10).toFixed(1);

    const totalPoints = tests.reduce((acc, t) => acc + t.score, 0) + assignments.reduce((acc, a) => acc + a.score, 0);
    const completedTasks = assignments.filter(a => a.submitted).length;

    return {
      gpa,
      attendance: attendancePercentage.toFixed(1),
      totalPoints,
      completedTasks,
      performanceScore: performanceScore.toFixed(0)
    };
  }, [performance]);

  const performanceCategory = useMemo(() => {
    const score = parseInt(metrics.performanceScore);
    if (score > 80) return { label: 'Shkëlqyeshëm', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (score > 60) return { label: 'Mbi Mesataren', color: 'text-indigo-500', bg: 'bg-indigo-500/10' };
    return { label: 'Nën Mesataren', color: 'text-rose-500', bg: 'bg-rose-500/10' };
  }, [metrics]);

  const timelineData = useMemo(() => {
    if (!performance) return [];
    const points = [
      ...(performance.tests || []).map(t => ({ date: t.date, score: (t.score / t.max) * 100 })),
      ...(performance.assignments || []).map(a => ({ date: a.deadline, score: a.score }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return points;
  }, [performance]);

  // Export Logic
  const exportData = (format: 'pdf' | 'csv') => {
    if (!performance) return;

    if (format === 'csv') {
      let csv = "Kategoria,Emri/Subjekti,Data/Afati,Vlerësimi\n";
      performance.tests.forEach(t => csv += `Test,${t.name},${t.date},${t.score}/${t.max}\n`);
      performance.assignments.forEach(a => csv += `Detyre,${a.title},${a.deadline},${a.score}/100\n`);
      performance.attendance.forEach(at => csv += `Prezence,${at.date},N/A,${at.status}\n`);

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Academic_Export_${user.name}.csv`;
      a.click();
    } else {
      const doc = new jsPDF() as any;
      doc.setFontSize(20);
      doc.text("Dashboard Akademik FSHN", 14, 22);
      doc.setFontSize(11);
      doc.text(`Studenti: ${user.name} ${user.surname || ''}`, 14, 30);
      doc.text(`Data e Eksportit: ${new Date().toLocaleDateString()}`, 14, 36);

      // Summary Stats
      doc.text(`Mesatarja: ${metrics.gpa}`, 14, 46);
      doc.text(`Pjesëmarrja: ${metrics.attendance}%`, 14, 52);

      const tableData = [
        ...performance.tests.map(t => ["Test", t.name, t.date, `${t.score}/${t.max}`]),
        ...performance.assignments.map(a => ["Detyre", a.title, a.deadline, `${a.score}/100`]),
        ...performance.attendance.map(at => ["Prezence", "Status", at.date, at.status])
      ];

      doc.autoTable({
        startY: 60,
        head: [['Kategoria', 'Pershkrimi', 'Data', 'Vleresimi']],
        body: tableData,
      });

      doc.save(`Academic_History_${user.name}.pdf`);
    }
  };

  // Simulation Logic (For Demo/Teachers)
  const [simForm, setSimForm] = useState({ type: 'TEST', name: '', score: 85, max: 100, date: new Date().toISOString().split('T')[0] });
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateUpdate = async () => {
    if (!auth.currentUser) return;
    setIsSimulating(true);
    try {
      const currentPerf = performance || { user_id: auth.currentUser.uid, tests: [], assignments: [], attendance: [] };
      let newPerf = { ...currentPerf };
      let logMsg = "";

      if (simForm.type === 'TEST') {
        newPerf.tests = [...(newPerf.tests || []), { name: simForm.name || 'Test i Ri', score: simForm.score, max: simForm.max, date: simForm.date }];
        logMsg = `Test i ri u shtua: ${simForm.name || 'Test'}`;
      } else if (simForm.type === 'ASSIGNMENT') {
        newPerf.assignments = [...(newPerf.assignments || []), { title: simForm.name || 'Detyrë e Re', score: simForm.score, deadline: simForm.date, submitted: true }];
        logMsg = `Detyra u vlerësua: ${simForm.name || 'Detyrë'}`;
      } else {
        newPerf.attendance = [...(newPerf.attendance || []), { date: simForm.date, status: 'Present' }];
        logMsg = `Pjesëmarrja u përditësua për datën ${simForm.date}`;
      }

      await setDoc(doc(db, 'academic_performance', auth.currentUser.uid), {
        ...newPerf,
        updated_at: serverTimestamp()
      });

      await addDoc(collection(db, 'academic_logs'), {
        user_id: auth.currentUser.uid,
        type: simForm.type,
        message: logMsg,
        created_at: serverTimestamp()
      });

      setSimForm({ ...simForm, name: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Zap size={32} className="text-indigo-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-10 pb-24">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Dashboard Akademik FSHN</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Sistemi i Monitorimit në Kohë Reale</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => exportData('csv')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={14} /> Eksporto PDF/CSV
          </button>
          
          {(user.role === 'TEACHER' || user.role === 'admin') && (
            <button 
              onClick={() => setIsManaging(!isManaging)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${
                isManaging ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white hover:bg-opacity-90'
              }`}
            >
              {isManaging ? <X size={14} /> : <Settings size={14} />}
              {isManaging ? 'Mbyll Panel' : 'Panel Punë'}
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Mesatarja', value: metrics.gpa, icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50', unit: '/10' },
          { label: 'Pjesëmarrja', value: `${metrics.attendance}%`, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', unit: '' },
          { label: 'Pikët Totale', value: metrics.totalPoints, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', unit: ' pikë' },
          { label: 'Gjurmët', value: metrics.completedTasks, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50', unit: ' detyra' }
        ].map((m, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl transition-all"
          >
            <div className={`w-12 h-12 ${m.bg} ${m.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              <m.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
            <div className="flex items-baseline gap-1">
              <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{m.value}</h4>
              <span className="text-xs font-bold text-slate-300 uppercase">{m.unit}</span>
            </div>
            {m.value === "0.0" || m.value === "0" || m.value === "0%" ? (
              <p className="text-[8px] text-slate-300 font-bold uppercase mt-2 italic">Nuk ka të dhëna akoma</p>
            ) : null}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Summary & Category */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Përmbledhja e Performancës</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Analiza Globale e Studentit</p>
            </div>
            <div className={`px-5 py-2.5 ${performanceCategory.bg} ${performanceCategory.color} rounded-2xl text-[10px] font-black uppercase tracking-widest`}>
              {performanceCategory.label}
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                  labelStyle={{ display: 'none' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorPerf)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 flex justify-end">
            <button className="flex items-center gap-2 group text-indigo-600 font-black text-[10px] uppercase tracking-widest">
              Shiko Detajet <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Activity Log (Live Feed) */}
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black uppercase tracking-tight">Logu i Performancës</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">LIVE</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar-dark">
            <AnimatePresence mode="popLayout">
              {logs.length > 0 ? logs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex gap-4 items-start"
                >
                  <div className={`mt-1 p-2 rounded-xl text-[10px] ${
                    log.type === 'TEST' ? 'bg-amber-500/20 text-amber-500' : 
                    log.type === 'ASSIGNMENT' ? 'bg-purple-500/20 text-purple-500' :
                    'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    {log.type === 'TEST' ? <Award size={14} /> : log.type === 'ASSIGNMENT' ? <BookOpen size={14} /> : <Calendar size={14} />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-300 leading-relaxed">{log.message}</p>
                    <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase">
                      {log.created_at?.toDate?.() ? log.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Tani'}
                    </p>
                  </div>
                </motion.div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                  <Activity size={32} className="text-slate-700 mb-4" />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Nuk ka aktivitete të publikuara akoma.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Database Section */}
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Database-i Im Akademik</h3>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Historia e plotë e performancës suaj në universitet</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Presence History */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Calendar size={20} className="text-emerald-500" />
              <h4 className="text-sm font-black text-slate-900 uppercase">Historia e Prezencës</h4>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {(performance?.attendance || []).length > 0 ? performance?.attendance.map((at, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="font-black text-slate-900 text-xs">{at.date}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Regjistruar nga Sistemi</p>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                    at.status === 'Present' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {at.status === 'Present' ? 'Prezent' : 'Mungesë'}
                  </div>
                </div>
              )) : <p className="text-center text-slate-400 italic text-[10px] font-bold uppercase py-6">Nuk ka të dhëna prezence.</p>}
            </div>
          </div>

          {/* Test Performance */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm lg:col-span-1">
             <div className="flex items-center gap-3 mb-6">
                <Award size={20} className="text-amber-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase">Rezultatet e Testeve</h4>
             </div>
             <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {(performance?.tests || []).length > 0 ? performance?.tests.map((t, i) => (
                  <div key={i} className="group p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 hover:bg-amber-100/50 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-slate-900 text-[11px] uppercase tracking-tight">{t.name}</p>
                        <p className="text-[8px] text-slate-500 font-bold mt-1">{t.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900 leading-none">{t.score}</p>
                        <p className="text-[8px] text-slate-400 font-bold">/ {t.max}</p>
                      </div>
                    </div>
                  </div>
                )) : <p className="text-center text-slate-400 italic text-[10px] font-bold uppercase py-6">Nuk ka teste të vlerësuara akoma.</p>}
             </div>
          </div>

          {/* Assignments History */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <BookOpen size={20} className="text-purple-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase">Vlerësimet e Detyrave</h4>
             </div>
             <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {(performance?.assignments || []).length > 0 ? performance?.assignments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-purple-50/30 rounded-2xl border border-purple-100/50">
                    <div>
                      <p className="font-black text-slate-900 text-[11px] uppercase truncate max-w-[120px]">{a.title}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">Detyrë Kursi</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-purple-600 leading-none">{a.score}</p>
                    </div>
                  </div>
                )) : <p className="text-center text-slate-400 italic text-[10px] font-bold uppercase py-6">Nuk ka detyra të vlerësuara akoma.</p>}
             </div>
          </div>
        </div>
      </div>

      {/* Admin / Teacher Simulation Panel */}
      <AnimatePresence>
        {isManaging && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-50 p-6"
          >
            <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-[3rem] shadow-2xl p-8 border border-white/10 backdrop-blur-xl bg-opacity-95">
              <div className="flex items-center justify-between mb-8">
                <div>
                   <h4 className="text-xl font-black uppercase italic tracking-tighter">Panel i Menaxhimit Akademik</h4>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Shto të dhëna për studentin në kohë reale</p>
                </div>
                <button onClick={() => setIsManaging(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-slate-500">Lloji i Të Dhënës</label>
                  <select 
                    value={simForm.type}
                    onChange={(e) => setSimForm({...simForm, type: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="TEST" className="bg-slate-900">Push Test Rezultat</option>
                    <option value="ASSIGNMENT" className="bg-slate-900">Vlerëso Detyrë</option>
                    <option value="ATTENDANCE" className="bg-slate-900">Regjistro Prezencë</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-slate-500">Pershkrimi / Emri</label>
                  <input 
                    type="text"
                    placeholder="Psh: Provim Shah..."
                    value={simForm.name}
                    onChange={(e) => setSimForm({...simForm, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-slate-500">Pikët / Data</label>
                  <div className="flex gap-3">
                    <input 
                      type="number"
                      value={simForm.score}
                      onChange={(e) => setSimForm({...simForm, score: parseInt(e.target.value)})}
                      className="w-20 bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-bold"
                    />
                    <input 
                      type="date"
                      value={simForm.date}
                      onChange={(e) => setSimForm({...simForm, date: e.target.value})}
                      className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button 
                  onClick={simulateUpdate}
                  disabled={isSimulating}
                  className="px-12 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-sm font-black shadow-2xl shadow-indigo-100 hover:bg-opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {isSimulating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Zap size={16} /></motion.div> : <Zap size={16} />}
                  PËRDITËSO DASHBOARD-IN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
