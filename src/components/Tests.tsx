import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, Users, Clock, CheckCircle, AlertCircle, 
  Play, Pause, Send, Eye, BarChart2, ChevronRight, 
  Trash2, Save, Check, X, ArrowLeft, Timer, Download
} from 'lucide-react';
import MotionLogo from './MotionLogo';
import { Test, Question, TestAttempt, TestAnswer } from '../types';
import { io, Socket } from 'socket.io-client';
import { PROGRAMS, YEARS, GROUPS } from '../constants';

import { jsPDF } from 'jspdf';
import { useAuth } from '../App';

export default function Tests() {
  const { user, apiFetch, socket } = useAuth();
  // ... existing state ...

  const generatePDF = (result: any) => {
    const doc = new jsPDF();
    const appLogo = "https://i.ibb.co/wFL95wCK/fshnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn.png"; // Direct school logo link
    
    // Header background
    doc.setFillColor(15, 23, 42); // slate-900 (darker)
    doc.rect(0, 0, 210, 45, 'F');
    
    // Add Logo
    try {
      // Adding logo with specific coordinates and size
      doc.addImage(appLogo, 'PNG', 15, 7, 30, 30);
    } catch (e) {
      console.error("PDF Logo load failed:", e);
    }

    // School Info
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("FAKULTETI I SHKENCAVE TË NATYRËS", 50, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("DIGITAL STUDENT PLATFORM - REZULTATET E TESTIT ZYRTAR", 50, 28);
    doc.text("DEPARTAMENTI I INFORMATIKËS", 50, 34);

    // Main Content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("DETAJET E STUDENTIT DHE TESTIT", 20, 60);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Studenti: ${result.student_name || user.name} ${user.surname || ''}`, 20, 72);
    doc.text(`Testi: ${result.title || selectedTest?.title}`, 20, 80);
    doc.text(`Data e Testit: ${result.test_date ? new Date(result.test_date).toLocaleDateString('sq-AL') : new Date().toLocaleDateString('sq-AL')}`, 20, 88);
    doc.text(`Pedagogu: ${result.teacher_name || 'Prof. FSHN'}`, 20, 96);
    
    // Separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(20, 105, 190, 105);
    
    // Results section
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Përmbledhja e Vlerësimit", 20, 120);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Pikët e Arritura:`, 20, 132);
    doc.setFont("helvetica", "bold");
    doc.text(`${result.total_score} / ${result.total_points}`, 60, 132);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Përqindja:`, 20, 140);
    doc.setFont("helvetica", "bold");
    doc.text(`${((result.total_score / result.total_points) * 100).toFixed(1)}%`, 60, 140);

    // Grade destaque
    if (result.grade) {
      doc.setFillColor(239, 246, 255); // blue-50
      doc.roundedRect(15, 150, 180, 25, 3, 3, 'F');
      
      doc.setTextColor(37, 99, 235); // blue-600
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(`NOTA PËRFUNDIMTARE: ${result.grade}`, 105, 167, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
    
    if (result.feedback) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Shënim nga Pedagogu:", 20, 190);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(result.feedback, 20, 200, { maxWidth: 170 });
    }

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFont("helvetica", "normal");
    doc.text("Gjeneruar automatikisht nga Digital Student Platform - FSHN", 105, 285, { align: 'center' });
    doc.text(`ID e Verifikimit: ${result.id}-${Date.now()}`, 105, 290, { align: 'center' });
    
    doc.save(`Rezultati_${result.title || 'Test'}.pdf`);
  };
  const [tests, setTests] = useState<Test[]>([]);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'TAKE' | 'MONITOR' | 'GRADE' | 'RESULTS' | 'ADD_QUESTIONS' | 'REVIEW'>('LIST');
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<TestAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [gradingData, setGradingData] = useState<{ attempt: TestAttempt, answers: TestAnswer[] } | null>(null);
  const [studentResults, setStudentResults] = useState<TestAttempt[]>([]);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchTests();
    if (user.role === 'STUDENT') fetchStudentResults();
  }, []);

  useEffect(() => {
    const targetId = searchParams.get('id');
    const attemptId = searchParams.get('attemptId');
    
    if (targetId && tests.length > 0) {
      const test = tests.find(t => t.id.toString() === targetId);
      if (test) {
        setSelectedTest(test);
        if (user.role === 'STUDENT') {
          const finishedAttempt = studentResults.find(r => r.test_id.toString() === targetId);
          if (finishedAttempt) {
            setView('RESULTS');
          } else if (test.status === 'ACTIVE') {
            handleJoinTest(test);
          }
        } else {
          // If attemptId is present, go straight to grading but still load monitor data in background
          if (attemptId) {
            fetchGradingDetails(parseInt(attemptId));
          } else {
            setView('MONITOR');
          }
          fetchMonitoring();
          fetchQuestions(test.id);
        }
      }
    }
  }, [searchParams, tests, studentResults]);

  const fetchAnalytics = async () => {
    if (!selectedTest) return;
    const data = await apiFetch(`/api/tests/${selectedTest.id}/analytics`);
    setAnalytics(data);
  };

  const fetchStudentResults = async () => {
    try {
      const data = await apiFetch('/api/student/results');
      if (Array.isArray(data)) {
        setStudentResults(data);
      } else {
        setStudentResults([]);
      }
    } catch (e) {
      console.error("Failed to fetch student results:", e);
      setStudentResults([]);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const h1 = (data: any) => {
      if (selectedTest?.id === data.testId) fetchMonitoring();
    };
    const h2 = (data: any) => {
      if (selectedTest?.id === data.testId) fetchMonitoring();
    };
    const h3 = () => {
      fetchTests();
    };

    socket.on('student_joined_test', h1);
    socket.on('student_submitted_test', h2);
    socket.on('test_distributed', h3);
    socket.on('test_updated', h3);
    socket.on('test_deleted', h3);

    return () => {
      socket.off('student_joined_test', h1);
      socket.off('student_submitted_test', h2);
      socket.off('test_distributed', h3);
      socket.off('test_updated', h3);
      socket.off('test_deleted', h3);
    };
  }, [socket, selectedTest]);

  const fetchTests = async () => {
    try {
      const data = await apiFetch('/api/tests');
      if (Array.isArray(data)) {
        setTests(data);
      } else {
        console.error("API error or invalid data format:", data);
        setTests([]);
      }
    } catch (error) {
      console.error("Failed to fetch tests:", error);
      setTests([]);
    }
  };

  const fetchQuestions = async (testId: number) => {
    try {
      const data = await apiFetch(`/api/tests/${testId}/questions`);
      if (Array.isArray(data)) {
        setQuestions(data);
      } else {
        setQuestions([]);
      }
    } catch (e) {
      console.error("Failed to fetch questions:", e);
      setQuestions([]);
    }
  };

  const fetchMonitoring = async () => {
    if (!selectedTest) return;
    try {
      const data = await apiFetch(`/api/tests/${selectedTest.id}/monitoring`);
      if (Array.isArray(data)) {
        setMonitoringData(data);
      } else {
        setMonitoringData([]);
      }
    } catch (e) {
      console.error("Failed to fetch monitoring data:", e);
      setMonitoringData([]);
    }
  };

  const handleCreateTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const testData = {
      title: formData.get('title'),
      description: formData.get('description'),
      duration: parseInt(formData.get('duration') as string),
      totalPoints: parseInt(formData.get('totalPoints') as string),
      testDate: formData.get('testDate'),
      program: formData.get('program'),
      year: formData.get('year'),
      group_name: formData.get('group_name')
    };

    await apiFetch('/api/tests', {
      method: 'POST',
      body: JSON.stringify(testData)
    });
    fetchTests();
    setView('LIST');
  };

  const handleAddQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTest) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const qData = {
      content: formData.get('content'),
      type: formData.get('type'),
      points: parseInt(formData.get('points') as string),
      correct_answer: formData.get('correct_answer'),
      options: formData.get('type') === 'MCQ' ? (formData.get('options') as string).split(',').map(o => o.trim()) : null
    };

    await apiFetch(`/api/tests/${selectedTest.id}/questions`, {
      method: 'POST',
      body: JSON.stringify(qData)
    });
    fetchQuestions(selectedTest.id);
    form.reset();
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!selectedTest) return;
    if (!confirm("A jeni i sigurt që dëshironi të fshini këtë pyetje?")) return;
    
    await apiFetch(`/api/questions/${qId}`, {
      method: 'DELETE'
    });
    fetchQuestions(selectedTest.id);
  };

  const handleUpdateStatus = async (testId: number, status: string) => {
    try {
      await apiFetch(`/api/tests/${testId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      fetchTests();
      if (status === 'ACTIVE') {
        alert('Testi u shpërnda me sukses! Studentët tani mund ta shohin atë.');
      } else if (status === 'PUBLISHED') {
        alert('Rezultatet u publikuan me sukses!');
      }
    } catch (e) {
      alert('Gabim gjatë përditësimit të statusit.');
    }
  };

  const handleJoinTest = async (test: Test) => {
    try {
      const attempt = await apiFetch(`/api/tests/${test.id}/join`, {
        method: 'POST'
      });
      setCurrentAttempt(attempt);
      setSelectedTest(test);

      if (attempt.status === 'SUBMITTED' || attempt.status === 'GRADED') {
        fetchStudentResults();
        setView('LIST');
        return;
      }

      await fetchQuestions(test.id);
      
      // Calculate remaining time
      const startTime = new Date(attempt.start_time).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const remainingSeconds = (test.duration * 60) - elapsedSeconds;
      
      if (remainingSeconds <= 0) {
        handleSubmitTest(attempt.id);
      } else {
        setTimeLeft(remainingSeconds);
        setView('TAKE');
      }
    } catch (e) {
      console.error("Failed to join test:", e);
      alert("Gabim gjatë hyrjes në test.");
    }
  };

  const handleSubmitTest = async (overrideAttemptId?: any) => {
    const attemptId = overrideAttemptId || currentAttempt?.id;
    if (!attemptId) return;
    
    // Save final answers
    try {
      await apiFetch(`/api/attempts/${attemptId}/save`, {
        method: 'POST',
        body: JSON.stringify({ 
          answers: Object.entries(answers).map(([qid, text]) => ({ 
            questionId: parseInt(qid), 
            answerText: text 
          })) 
        })
      });

      // Submit
      await apiFetch(`/api/attempts/${attemptId}/submit`, {
        method: 'POST'
      });
      setView('LIST');
      fetchStudentResults();
      alert('Testi u dorëzua me sukses!');
    } catch (e) {
       console.error("Submit failed:", e);
       alert("Gabim gjatë dorëzimit.");
    }
  };

  const fetchGradingDetails = async (attemptId: number, isReview = false) => {
    const data = await apiFetch(`/api/attempts/${attemptId}/details`);
    setGradingData(data);
    setView(isReview ? 'REVIEW' : 'GRADE');
  };

  const handleGradeAttempt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gradingData) return;
    const formData = new FormData(e.currentTarget);
    const grades = gradingData.answers.map(ans => ({
      answerId: ans.id,
      points: parseInt(formData.get(`points_${ans.id}`) as string),
      isCorrect: formData.get(`correct_${ans.id}`) === 'on'
    }));

    await apiFetch(`/api/attempts/${gradingData.attempt.id}/grade`, {
      method: 'POST',
      body: JSON.stringify({ 
        grades, 
        feedback: formData.get('feedback'),
        finalGrade: parseInt(formData.get('finalGrade') as string)
      })
    });
    fetchMonitoring();
    setView('MONITOR');
  };

  // Timer logic
  useEffect(() => {
    if (view === 'TAKE' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (view === 'TAKE' && timeLeft === 0) {
      handleSubmitTest();
    }
  }, [view, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Moduli i Testimit</h2>
          <p className="text-slate-500">Menaxhoni dhe zhvilloni provimet në kohë reale</p>
        </div>
        {user.role === 'TEACHER' && view === 'LIST' && (
          <button 
            onClick={() => setView('CREATE')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center space-x-2 shadow-lg shadow-blue-100"
          >
            <Plus size={20} />
            <span>Krijo Test të Ri</span>
          </button>
        )}
        {view !== 'LIST' && view !== 'TAKE' && (
          <button 
            onClick={() => setView('LIST')}
            className="text-slate-500 hover:text-slate-900 flex items-center space-x-2 font-medium"
          >
            <ArrowLeft size={20} />
            <span>Kthehu te Lista</span>
          </button>
        )}
      </div>

      {user.role === 'STUDENT' && (!user.program || !user.year || !user.group_name) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-amber-600 mt-1" />
          <div>
            <h3 className="text-amber-800 font-bold">Profil i Paplotësuar</h3>
            <p className="text-amber-700">
              Ju lutem plotësoni profilin tuaj (Programi, Viti, Grupi) në sektorin e preferencave që të mund të shihni testet që ju përkasin.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {view === 'LIST' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {Array.isArray(tests) && tests.map(test => (
              <div key={test.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    test.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 
                    test.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {test.status}
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 text-xs">
                    <Clock size={14} />
                    <span>{test.duration} min</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{test.title}</h3>
                <p className="text-sm text-slate-500 mb-6 flex-1">{test.description}</p>
                
                <div className="space-y-3 pt-4 border-t border-slate-50">
                  {user.role === 'TEACHER' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { 
                          setSelectedTest(test); 
                          fetchQuestions(test.id); 
                          setView('MONITOR'); 
                          fetchMonitoring(); 
                          fetchAnalytics();
                        }}
                        className="bg-slate-900 text-white p-2 rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center justify-center space-x-1"
                      >
                        <Eye size={14} />
                        <span>Monitoro</span>
                      </button>
                      <button 
                        onClick={() => { 
                          setSelectedTest(test); 
                          fetchQuestions(test.id); 
                          setView('ADD_QUESTIONS'); 
                        }}
                        className="bg-blue-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center space-x-1"
                      >
                        <Plus size={14} />
                        <span>Shto Pyetje</span>
                      </button>
                      {test.status === 'DRAFT' ? (
                        <button 
                          onClick={() => handleUpdateStatus(test.id, 'ACTIVE')}
                          className="bg-blue-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center space-x-1"
                        >
                          <Play size={14} />
                          <span>Shpërndaj</span>
                        </button>
                      ) : test.status === 'ACTIVE' ? (
                        <button 
                          onClick={() => handleUpdateStatus(test.id, 'COMPLETED')}
                          className="bg-orange-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-orange-700 flex items-center justify-center space-x-1"
                        >
                          <Pause size={14} />
                          <span>Mbyll</span>
                        </button>
                      ) : test.status === 'COMPLETED' ? (
                        <button 
                          onClick={() => handleUpdateStatus(test.id, 'PUBLISHED')}
                          className="bg-green-600 text-white p-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center space-x-1"
                        >
                          <CheckCircle size={14} />
                          <span>Publiko</span>
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button 
                      disabled={test.status !== 'ACTIVE'}
                      onClick={() => handleJoinTest(test)}
                      className={`w-full p-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                        test.status === 'ACTIVE' 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Play size={18} />
                      <span>Prano Testin</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {user.role === 'STUDENT' && studentResults.length > 0 && (
              <div className="col-span-full mt-12">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Rezultatet e Publikuara</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {studentResults.map(res => (
                    <div key={res.id} className={`bg-white p-6 rounded-2xl shadow-sm border ${res.status === 'SUBMITTED' ? 'border-amber-100 bg-amber-50/20' : 'border-green-100 bg-green-50/30'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${res.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                          {res.status === 'SUBMITTED' ? 'Në Pritje' : 'I Publikuar'}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-900">
                            {res.status === 'SUBMITTED' ? '-' : res.total_score}
                            <span className="text-sm text-slate-400">/{res.total_points}</span>
                          </div>
                          {res.grade && <div className="text-sm font-bold text-blue-600">Nota: {res.grade}</div>}
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1">{res.title}</h4>
                      <p className="text-xs text-slate-500 mb-4">Dorëzuar më: {res.end_time ? new Date(res.end_time).toLocaleDateString() : 'Kohët e fundit'}</p>
                      <div className="flex flex-col gap-2">
                        {res.status === 'SUBMITTED' ? (
                          <div className="flex items-center space-x-2 text-amber-600 bg-amber-100/50 p-3 rounded-xl justify-center font-bold text-sm">
                            <Clock size={18} />
                            <span>Vlerësimi në proces...</span>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => fetchGradingDetails(res.id, true)}
                              className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center space-x-2"
                            >
                              <Eye size={18} />
                              <span>Përgjigjet e Mia</span>
                            </button>
                            <button 
                              onClick={() => generatePDF(res)}
                              className="w-full border border-blue-600 text-blue-600 p-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center space-x-2"
                            >
                              <Download size={18} />
                              <span>Shkarko PDF</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === 'ADD_QUESTIONS' && selectedTest && (
          <motion.div 
            key="add-questions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Shto Pyetje: {selectedTest.title}</h3>
                  <p className="text-slate-500">Mund të shtoni deri në 100 pyetje për këtë test.</p>
                </div>
                <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold">
                  {questions.length} / 100 Pyetje
                </div>
              </div>

              <form onSubmit={handleAddQuestion} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pyetja</label>
                    <textarea 
                      name="content" 
                      required 
                      className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                      placeholder="Shkruani përmbajtjen e pyetjes..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Lloji i Pyetjes</label>
                      <select 
                        name="type" 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="MCQ">Me Alternativa (Studenti zgjedh)</option>
                        <option value="OPEN">Me Shkrim (Studenti shkruan përgjigjen)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Pikët (1-10)</label>
                      <input 
                        name="points" 
                        type="number" 
                        min="1" 
                        max="10" 
                        required 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Pikët për këtë pyetje"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Opsionet (Vetëm për MCQ, ndarë me presje)</label>
                    <input 
                      name="options" 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="p.sh: Python, Java, C++, Ruby"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Përgjigja e Saktë</label>
                    <input 
                      name="correct_answer" 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Shkruani përgjigjen e saktë për referencë"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={questions.length >= 100}
                  className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {questions.length >= 100 ? 'Keni arritur limitin prej 100 pyetjesh' : 'Shto Pyetjen në Test'}
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Pyetjet e Shtuara</h3>
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">Pyetja {idx + 1}</span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded uppercase">{q.type}</span>
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">{q.points} Pikë</span>
                      </div>
                      <p className="text-slate-700 font-medium">{q.content}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className="text-center text-slate-500 italic py-8">Ende nuk ka pyetje për këtë test.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {view === 'CREATE' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-2xl mx-auto"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-6">Krijo Test të Ri</h3>
            <form onSubmit={handleCreateTest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titulli</label>
                  <input name="title" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Përshkrimi</label>
                  <textarea name="description" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-24" />
                </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dega</label>
                    <select name="program" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Viti</label>
                    <select name="year" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grupi</label>
                    <select name="group_name" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input name="testDate" type="datetime-local" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kohëzgjatja (Minuta)</label>
                  <input name="duration" type="number" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pikët Totale</label>
                  <input name="totalPoints" type="number" required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all mt-4">
                Ruaj si Draft
              </button>
            </form>
          </motion.div>
        )}

        {view === 'MONITOR' && selectedTest && (
          <motion.div 
            key="monitor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Pjesëmarrës</p>
                <p className="text-2xl font-bold text-slate-900">{monitoringData.length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Dorëzuar</p>
                <p className="text-2xl font-bold text-green-600">{monitoringData.filter(p => p.status === 'SUBMITTED' || p.status === 'GRADED').length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Mesatarja</p>
                <p className="text-2xl font-bold text-blue-600">{analytics?.averageScore?.toFixed(1) || '-'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Kalueshmëria</p>
                <p className="text-2xl font-bold text-orange-600">{analytics?.passRate?.toFixed(0) || '-'}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Monitoring List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Monitorimi Live: {selectedTest.title}</h3>
                  <div className="space-y-4">
                    {monitoringData.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center space-x-4">
                          <MotionLogo size="sm" />
                          <div>
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-500">Filluar: {new Date(p.start_time).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'SUBMITTED' ? 'bg-green-100 text-green-600' : 
                            p.status === 'STARTED' ? 'bg-blue-100 text-blue-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {p.status}
                          </div>
                          {p.status === 'SUBMITTED' && (
                            <button 
                              onClick={() => fetchGradingDetails(p.attempt_id)}
                              className="text-blue-600 font-bold text-sm hover:underline"
                            >
                              Vlerëso
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {monitoringData.length === 0 && (
                      <p className="text-center text-slate-500 py-8 italic">Ende nuk ka nxënës pjesëmarrës.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Question Management */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Shto Pyetje</h3>
                  <form onSubmit={handleAddQuestion} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pyetja</label>
                      <textarea name="content" required className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lloji</label>
                        <select name="type" className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none">
                          <option value="MCQ">Alternativa</option>
                          <option value="OPEN">Hapur</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pikët</label>
                        <input name="points" type="number" required className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Opsionet (për MCQ, ndarë me presje)</label>
                      <input name="options" className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none" placeholder="A, B, C, D" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Përgjigja e Saktë</label>
                      <input name="correct_answer" className="w-full p-2 rounded-lg border border-slate-200 text-sm outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm">
                      Shto Pyetjen
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Pyetjet e Shtuara ({questions.length})</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {questions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-blue-600">{q.points} Pikë</span>
                          <span className="text-slate-400 uppercase">{q.type}</span>
                        </div>
                        <p className="text-slate-700 line-clamp-2">{q.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'TAKE' && selectedTest && (
          <motion.div 
            key="take"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            {/* Sticky Timer */}
            <div className="sticky top-4 z-30 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-blue-100 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Timer size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koha e Mbetur</p>
                  <p className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                    {formatTime(timeLeft)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { if(confirm('Jeni të sigurt që dëshironi të dorëzoni testin?')) handleSubmitTest(); }}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Përfundo Testin
              </button>
            </div>

            <div className="space-y-8 pb-20">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                      Pyetja {idx + 1} • {q.points} Pikë
                    </span>
                  </div>
                  <h4 className="text-xl font-medium text-slate-900 mb-8 leading-relaxed">{q.content}</h4>
                  
                  {q.type === 'MCQ' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(() => {
                        let opts = [];
                        try {
                          opts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || []);
                        } catch (e) {
                          opts = [];
                        }
                        return Array.isArray(opts) ? opts.map((opt: string, oIdx: number) => (
                          <button
                            key={oIdx}
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center space-x-4 ${
                              answers[q.id] === opt 
                              ? 'border-blue-600 bg-blue-50 text-blue-700' 
                              : 'border-slate-100 hover:border-slate-200 text-slate-600'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                              answers[q.id] === opt ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <span className="font-medium">{opt}</span>
                          </button>
                        )) : null;
                      })()}
                    </div>
                  ) : (
                    <textarea 
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-blue-600 outline-none h-40 text-slate-700 leading-relaxed transition-all"
                      placeholder="Shkruani përgjigjen tuaj këtu..."
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {(view === 'GRADE' || view === 'REVIEW') && gradingData && (
          <motion.div 
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {view === 'GRADE' ? `Vlerësimi: ${gradingData.attempt.student_name}` : `Rishikimi: ${gradingData.attempt.test_title}`}
                  </h3>
                  <p className="text-slate-500">{view === 'GRADE' ? gradingData.attempt.test_title : `Kjo është përmbledhja e përgjigjeve tuaja dhe vlerësimi nga profesori.`}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statusi</p>
                  <p className="font-bold text-blue-600 uppercase">{gradingData.attempt.status}</p>
                </div>
              </div>

              <form onSubmit={handleGradeAttempt} className="space-y-12">
                {gradingData.answers.map((ans, idx) => (
                  <div key={ans.id} className="space-y-4 pb-8 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Pyetja {idx + 1} ({ans.max_points} Pikë)</span>
                      {ans.question_type === 'MCQ' && (
                        <span className={`text-xs font-bold px-2 py-1 rounded ${ans.answer_text === ans.correct_answer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {ans.answer_text === ans.correct_answer ? 'Saktë' : 'Gabim'}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-slate-900">{ans.question_text}</p>
                    <div className={`p-4 rounded-xl border ${ans.answer_text === ans.correct_answer ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Përgjigja juaj</p>
                      <p className="text-slate-700">{ans.answer_text || <span className="italic text-red-400">Nuk ka përgjigje</span>}</p>
                    </div>
                    {(ans.correct_answer && (view === 'REVIEW' || view === 'GRADE')) && (
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-600 uppercase mb-2">Përgjigja e Saktë</p>
                        <p className="text-blue-700">{ans.correct_answer}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-6 pt-2">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-bold text-slate-700">Pikët:</label>
                        {view === 'GRADE' ? (
                          <input 
                            type="number" 
                            name={`points_${ans.id}`}
                            defaultValue={ans.points_awarded ?? (ans.answer_text === ans.correct_answer ? ans.max_points : 0)}
                            max={ans.max_points}
                            className="w-20 p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="font-bold text-blue-600">{ans.points_awarded ?? 0} / {ans.max_points}</span>
                        )}
                      </div>
                      {view === 'GRADE' && (
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="checkbox" name={`correct_${ans.id}`} defaultChecked={!!ans.is_correct || ans.answer_text === ans.correct_answer} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="text-sm font-medium text-slate-700">E Saktë</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}

                <div className="space-y-6 pt-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        {view === 'GRADE' ? 'Nota Përfundimtare (4-10)' : 'Nota juaj'}
                      </label>
                      {view === 'GRADE' ? (
                        <select 
                          name="finalGrade" 
                          required 
                          defaultValue={gradingData.attempt.grade || 4}
                          className="w-full p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                        >
                          {[4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      ) : (
                        <div className="text-4xl font-bold text-blue-600">{gradingData.attempt.grade || 'N/A'}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Feedback</label>
                      {view === 'GRADE' ? (
                        <textarea 
                          name="feedback" 
                          defaultValue={gradingData.attempt.feedback}
                          className="w-full p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 h-24" 
                          placeholder="Shkruani komentet tuaja këtu..." 
                        />
                      ) : (
                        <p className="text-slate-600 italic">{gradingData.attempt.feedback || 'Nuk ka koment nga profesori.'}</p>
                      )}
                    </div>
                  </div>
                  {view === 'GRADE' ? (
                    <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-lg">
                      Përfundo Vlerësimin & Publiko Rezultatin
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setView('LIST')}
                      className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-all text-lg"
                    >
                      Mbyll Shënimin
                    </button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
