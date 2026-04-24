import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Calendar, ChevronLeft, ChevronRight, 
  Search, Download, FileText, CheckCircle, 
  Clock, TrendingUp, Filter, History
} from 'lucide-react';
import { useAuth } from '../App';
import MotionLogo from './MotionLogo';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DatabaseEntry {
  id: string;
  name: string;
  surname: string;
  grades: { title: string; grade: number; date: string }[];
  presence: number;
}

export default function ClassDatabase({ classId, className }: { classId: string, className: string }) {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<DatabaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showHistory, setShowHistory] = useState(false);

  const generatePDF = (isFull: boolean = false) => {
    const doc = new jsPDF() as any;
    const dateStr = isFull ? "HISTORIKU I PLOTË" : `${months[selectedMonth - 1]} ${selectedYear}`;
    
    // Fetch data if full is requested but we only have month
    const executeExport = async () => {
      let exportData = data;
      if (isFull) {
        try {
          exportData = await apiFetch(`/api/classes/${classId}/database`);
        } catch (e) {
          console.error("Full export fetch failed:", e);
        }
      }

      // Header background
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 40, 'F');
      
      // Logo (Instituti)
      try {
        const logoUrl = "https://i.ibb.co/wFL95wCK/fshnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.png";
        doc.addImage(logoUrl, 'PNG', 165, 5, 30, 30, undefined, 'FAST');
      } catch(e) {
        console.warn("Logo load failed, skipping from PDF");
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("DATABAZA E KLASËS", 15, 20);
      doc.setFontSize(10);
      doc.text(`Klasa: ${className}`, 15, 28);
      doc.text(`Periudha: ${dateStr}`, 15, 33);

      // Table
      autoTable(doc, {
        startY: 50,
        head: [['Nr', 'Studenti', 'Vlerësimet (Totale)', 'Pjesëmarrja', 'Mesatarja']],
        body: exportData.map((st, idx) => [
          idx + 1,
          `${st.name} ${st.surname}`,
          st.grades.length > 0 ? st.grades.map(g => g.grade).join(', ') : 'Asnjë',
          st.presence,
          st.grades.length > 0 ? (st.grades.reduce((acc, curr) => acc + curr.grade, 0) / st.grades.length).toFixed(1) : 'N/A'
        ]),
        headStyles: { fillColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
        styles: { fontSize: 8 }
      });

      const fileName = `Database_Full_${className.replace(/\s+/g, '_')}_${isFull ? 'ALL' : dateStr.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
    };

    executeExport();
  };

  useEffect(() => {
    fetchDatabase();
  }, [classId, selectedMonth, selectedYear]);

  const fetchDatabase = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/classes/${classId}/database?month=${selectedMonth}&year=${selectedYear}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 
    'Korrik', 'Gusht', 'Shtatori', 'Tetor', 'Nëntor', 'Dhjetor'
  ];

  const filteredData = data.filter(st => 
    `${st.name} ${st.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalStudents: data.length,
    avgPresence: data.length > 0 ? (data.reduce((acc, curr) => acc + curr.presence, 0) / data.length).toFixed(1) : 0,
    avgGrade: (() => {
      const allGrades = data.flatMap(st => st.grades.map(g => g.grade));
      return allGrades.length > 0 ? (allGrades.reduce((acc, curr) => acc + curr, 0) / allGrades.length).toFixed(1) : 'N/A';
    })()
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <History className="text-blue-600" size={28} />
            Databaza e Klasës: {className}
          </h2>
          <p className="text-slate-500 font-medium">Raporti i detajuar për muajin {months[selectedMonth - 1]} {selectedYear}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Kërko studentë..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 w-64 text-sm"
            />
          </div>
          
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              showHistory ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar size={18} />
            <span>Historia</span>
          </button>
        </div>
      </div>

      {/* History Selection Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {months.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonth(idx + 1);
                    setShowHistory(false);
                  }}
                  className={`p-3 rounded-xl text-xs font-bold transition-all ${
                    selectedMonth === idx + 1 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {m}
                </button>
              ))}
              <div className="col-span-full border-t border-slate-50 pt-4 mt-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Zgjidh vitin</p>
                <div className="flex gap-2">
                   {[2024, 2025, 2026].map(y => (
                     <button 
                       key={y}
                       onClick={() => setSelectedYear(y)}
                       className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                         selectedYear === y ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                       }`}
                     >
                       {y}
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Totali i Studentëve</p>
            <h4 className="text-2xl font-black text-slate-900">{stats.totalStudents}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mesatarja e Prezencës</p>
            <h4 className="text-2xl font-black text-emerald-600">{stats.avgPresence} seanca p/sh</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mesatarja e Notave</p>
            <h4 className="text-2xl font-black text-amber-600">{stats.avgGrade}</h4>
          </div>
        </div>
      </div>

      {/* Database Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Pasqyra e Vlerësimit & Prezencës</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => generatePDF(true)}
              className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <FileText size={14} />
              Eksporto Databazën e Plotë
            </button>
            <button 
              onClick={() => generatePDF(false)}
              className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-all cursor-pointer"
            >
              <Download size={14} />
              Eksporto PDF (Muajin)
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nr.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Studenti</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vlerësimet (4-10)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pjesëmarrja</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mesatarja Muajore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4 h-16 bg-slate-50/30"></td>
                  </tr>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((st, idx) => {
                  const avg = st.grades.length > 0 
                    ? (st.grades.reduce((acc, curr) => acc + curr.grade, 0) / st.grades.length).toFixed(1)
                    : 'N/A';
                  
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <MotionLogo size="sm" />
                          <div>
                            <p className="font-bold text-slate-900">{st.name} {st.surname}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {st.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {st.grades.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Asnjë vlerësim</span>
                          ) : (
                            st.grades.map((g, i) => (
                              <div 
                                key={i}
                                className={`group/grade relative px-3 py-1 rounded-lg border flex flex-col items-center min-w-[40px]
                                  ${g.grade >= 9 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                    g.grade >= 6 ? 'bg-blue-50 border-blue-100 text-blue-700' : 
                                    'bg-red-50 border-red-100 text-red-700'}`}
                              >
                                <span className="text-xs font-black">{g.grade}</span>
                                <span className="text-[8px] font-bold uppercase opacity-60 line-clamp-1">{g.title}</span>
                                
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white rounded text-[8px] font-bold opacity-0 group-hover/grade:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                  {new Date(g.date).toLocaleDateString()}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold">
                            {st.presence}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Seanca</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className={`text-lg font-black ${typeof avg === 'string' && avg !== 'N/A' && parseFloat(avg) < 5 ? 'text-red-500' : 'text-slate-900'}`}>
                           {avg}
                         </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    Nuk u gjetën të dhëna për këtë muaj.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
