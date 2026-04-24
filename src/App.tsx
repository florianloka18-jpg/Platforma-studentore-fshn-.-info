import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  MessageSquare, 
  Settings, 
  LogOut, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Award,
  BookOpen,
  HelpCircle,
  Calendar as CalendarIcon,
  Info,
  Menu,
  Monitor,
  Play,
  X,
  Mail,
  Bell,
  Eye,
  EyeOff,
  Search,
  Plus,
  ChevronRight,
  Download,
  Video,
  Mic,
  MicOff,
  VideoOff,
  ScreenShare as ScreenShareIcon,
  StickyNote,
  Trash2,
  Edit3,
  Save,
  Pin,
  PinOff,
  UserCheck,
  LayoutGrid,
  Megaphone
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { User, Role, PersonalNote } from './types';
import { COLORS, PROGRAMS, YEARS, GROUPS } from './constants';
import Attendance from './components/Attendance';
import Tests from './components/Tests';
import Chat from './components/Chat';
import Activities from './components/Activities';

const handleNotificationNavigation = (n: any, navigate: any, setShowNotifications?: (v: boolean) => void) => {
  if (setShowNotifications) setShowNotifications(false);
  const targetType = n.target_type || n.type;
  const targetId = n.target_id;
  if (!targetType) return;
  
  if (targetType === 'TEST' || targetType === 'TEST_SUBMISSION') {
    if (targetId) navigate('/tests?id=' + targetId);
    else navigate('/tests');
  } else if (targetType === 'ASSIGNMENT' || targetType === 'ASSIGNMENT_SUBMISSION') {
    if (targetId) navigate('/assignments?id=' + targetId);
    else navigate('/assignments');
  } else if (targetType === 'GRADE') {
    const title = (n.title || '').toLowerCase();
    if (title.includes('test') || title.includes('provim')) {
      if (targetId) navigate('/tests?id=' + targetId);
      else navigate('/tests');
    } else {
      if (targetId) navigate('/assignments?id=' + targetId);
      else navigate('/assignments');
    }
  } else if (targetType === 'CLASS_JOIN' || targetType === 'STUDENT_JOINED_CLASS') {
    if (targetId) navigate('/classroom/' + targetId);
    else navigate('/classroom');
  } else if (targetType === 'MESSAGE') {
    navigate('/chat');
  }
};
import Analytics from './components/Analytics';
import Assignments from './components/Assignments';
import LiveQuestions from './components/LiveQuestions';
import ScreenShare from './components/ScreenShare';
import Calendar from './components/Calendar';
import Library from './components/Library';
import Classroom from './components/Classroom';
import ClassroomWorkspace from './components/ClassroomWorkspace';
import VerifyEmail from './components/VerifyEmail';

const LiveQuestionModal = ({ question, onConfirm }: { question: any, onConfirm: () => void }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
      >
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <HelpCircle size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Pyetje e Re Live!</h2>
            <p className="text-slate-500">Mësuesi ju ka zgjedhur për t'u përgjigjur kësaj pyetjeje:</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <p className="text-xl font-bold text-slate-800 leading-tight italic">"{question.content}"</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onConfirm}
              className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              Prano & Përgjigju
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

import { auth, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { useLocation, useSearchParams } from 'react-router-dom';

// --- Contexts ---
const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  socket: Socket | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Components ---

import MotionLogo from './components/MotionLogo';

const Sidebar = ({ role }: { role: Role }) => {
  const { logout } = useAuth();
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ...(role === 'STUDENT' ? [{ icon: Users, label: 'Klasa', path: '/classroom' }] : []),
    { icon: CheckCircle, label: 'Pjesëmarrja', path: '/attendance' },
    { icon: CalendarIcon, label: 'Kalendari', path: '/calendar' },
    { icon: BookOpen, label: 'Libraria', path: '/library' },
    { icon: FileText, label: 'Teste', path: '/tests' },
    { icon: BookOpen, label: 'Detyra', path: '/assignments' },
    { icon: HelpCircle, label: 'Pyetje Live', path: '/live-questions' },
    { icon: Megaphone, label: 'Aktivitete', path: '/activities' },
    { icon: Monitor, label: 'Screen Share', path: '/screen-share' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: TrendingUp, label: 'Analitika', path: '/analytics' },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col z-40">
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <MotionLogo size="sm" type="logo" />
        <div>
          <h1 className="text-sm font-bold tracking-tight text-blue-400 uppercase leading-tight">Fakulteti i Shkencave të Natyrës</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Platforma Studentore</p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={logout}
          className="flex items-center space-x-3 p-3 w-full rounded-lg hover:bg-red-900/20 text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span>Dil</span>
        </button>
      </div>
    </div>
  );
};

const Header = ({ onMenuToggle }: { onMenuToggle?: () => void }) => {
  const { user, logout, token, socket, refreshUser, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [showVerifiedMessage, setShowVerifiedMessage] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const handleNotificationClick = (n: any) => handleNotificationNavigation(n, navigate, setShowNotifications);

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch('/api/notifications');
      setNotifications(data);
    } catch (e) {
      if (e instanceof Error && e.message.includes('Keni bërë shumë kërkesa')) {
        // Silent fail for rate limit during background polling
        return;
      }
      console.error(e);
    }
  };

  useEffect(() => {
    if (user && socket) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 90000); // Poll every 90s instead of 30s
      
      socket.emit('join', { id: user.id });
      socket.on('new_notification', () => {
        fetchNotifications();
      });

      return () => {
        clearInterval(interval);
        socket.off('new_notification');
      };
    }
  }, [user, socket, apiFetch]);

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      fetchNotifications();
    } catch (e) { console.error(e); }
  };


  return (
    <>
      <AnimatePresence>
        {showVerifiedMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-white/20 backdrop-blur-md"
          >
            <CheckCircle size={20} />
            <span className="font-bold">Email i verifikuar me sukses!</span>
            <button onClick={() => setShowVerifiedMessage(false)} className="ml-4 hover:opacity-70">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onMenuToggle}
            className="md:hidden p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
          >
            <LayoutGrid size={20} />
          </button>
          <h2 className="text-sm md:text-lg font-semibold text-slate-800">Mirëseerdhe, {user?.name}</h2>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) markAllAsRead();
              }}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative"
            >
              <Bell size={20} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-900">Njoftimet</h3>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                      {notifications.length} Totale
                    </span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      (() => {
                        let unreadCounter = notifications.filter(n => !n.is_read).length;
                        return notifications.map((n, i) => {
                          const isUnread = !n.is_read;
                          const currentUnreadIndex = isUnread ? unreadCounter-- : null;
                          return (
                            <div 
                              key={i} 
                              onClick={() => handleNotificationClick(n)}
                              className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer relative ${isUnread ? 'bg-blue-50/10' : ''}`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className={`p-2 rounded-lg relative ${
                                  n.type === 'GRADE' ? 'bg-green-100 text-green-600' : 
                                  n.type === 'TEST' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {n.type === 'GRADE' ? <Award size={16} /> : <Bell size={16} />}
                                  {isUnread && currentUnreadIndex !== null && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-sm animate-pulse">
                                      {currentUnreadIndex}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-slate-900">{n.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{n.content}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {n.created_at?.seconds ? new Date(n.created_at.seconds * 1000).toLocaleString() : 'Sapo'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm italic">Nuk ka njoftime të reja</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center space-x-3 border-l border-slate-100 pl-4">
            <Link to="/profile" className="flex items-center space-x-3 group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-end space-x-1">
                  <span>{user?.name} {user?.surname}</span>
                  {user?.is_confirmed && (
                    <span className="text-blue-500" title={user.role === 'STUDENT' ? 'Student i Konfirmuar' : 'Mësues i Konfirmuar'}>
                      <CheckCircle size={14} fill="currentColor" className="text-white" />
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  {user?.role === 'STUDENT' ? `Student | Klasa ${user.program}` : 'Mësues'}
                </p>
              </div>
              <div className="relative">
                <MotionLogo size="md" src={user?.profile_photo} />
                {user?.is_confirmed && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white">
                    <CheckCircle size={10} />
                  </div>
                )}
              </div>
            </Link>
            <button 
              onClick={logout}
              className="flex items-center space-x-1 md:space-x-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs md:text-sm font-medium"
            >
              <LogOut size={16} />
              <span>Dil</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

// --- Pages ---

const LoginPage = () => {
  const { login, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResendVerification = async () => {
    setResending(true);
    setResendMessage('');
    try {
      const data = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResendMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResendMessage('');
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const data = await apiFetch('/api/auth/firebase', {
        method: 'POST',
        body: JSON.stringify({ 
          email: user.email, 
          name: user.displayName,
          uid: user.uid
        }),
      });
      
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      if (err.message.includes('404')) {
        const user = auth.currentUser;
        navigate('/register', { state: { email: user?.email, name: user?.displayName } });
      } else {
        console.error("Google login error:", err);
        setError('Gabim gjatë hyrjes me Google: ' + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-slate-900/60 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900/50 rounded-3xl p-8 relative z-10 border border-white/10 shadow-2xl"
      >
        <div className="flex justify-center mb-8">
          <MotionLogo size="lg" type="logo" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-tight">Fakulteti i Shkencave të Natyrës</h1>
        <p className="text-center text-slate-300 font-medium mb-8">Platforma Studentore</p>
        
        {error && (
          <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30">
            {error}
            {error.toLowerCase().includes('verifikoni email-in') && (
              <button 
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="block mt-2 text-blue-400 font-bold hover:text-blue-300 underline underline-offset-4"
              >
                {resending ? 'Duke dërguar...' : 'Ridërgo Email-in e Verifikimit'}
              </button>
            )}
          </div>
        )}
        
        {resendMessage && (
          <div className="bg-green-500/20 text-green-200 p-3 rounded-lg mb-6 text-sm border border-green-500/30">
            {resendMessage}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="emri@fshn.edu.al"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Fjalëkalimi</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Duke hyrë...' : 'Hyr'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/forgot-password" size="sm" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            Keni harruar fjalëkalimin?
          </Link>
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-transparent text-slate-400">Ose vazhdoni me</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center space-x-3 p-3 border border-white/20 rounded-lg font-medium hover:bg-white/5 transition-colors text-white"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span>Hyni me Google</span>
        </button>

        <p className="mt-6 text-center text-sm text-slate-400">
          Nuk keni llogari? <Link to="/register" className="text-blue-400 font-medium hover:text-blue-300">Regjistrohuni</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ForgotPasswordPage = () => {
  const { apiFetch } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-slate-900/50 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900/50 rounded-2xl p-8 relative z-10 border border-white/10 shadow-2xl"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-2">Harruat Fjalëkalimin?</h1>
        <p className="text-center text-slate-300 mb-8">Shkruani email-in tuaj për të marrë linkun e rivendosjes</p>
        
        {message && <div className="bg-green-500/20 text-green-200 p-3 rounded-lg mb-6 text-sm border border-green-500/30">{message}</div>}
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="emri@fshn.edu.al"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Duke dërguar...' : 'Dërgo Linkun'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          U kujtuat? <Link to="/login" className="text-blue-400 font-medium hover:text-blue-300">Kthehu te hyrja</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ResetPasswordPage = () => {
  const { apiFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('Fjalëkalimet nuk përputhen');
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-slate-900/50 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900/50 rounded-2xl p-8 relative z-10 border border-white/10 shadow-2xl"
      >
        <h1 className="text-2xl font-bold text-center text-white mb-2">Rivendos Fjalëkalimin</h1>
        <p className="text-center text-slate-300 mb-8">Shkruani fjalëkalimin tuaj të ri</p>
        
        {message && <div className="bg-green-500/20 text-green-200 p-3 rounded-lg mb-6 text-sm border border-green-500/30">{message} (Duke ju ridrejtuar...)</div>}
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Fjalëkalimi i Ri</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Konfirmo Fjalëkalimin</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Duke ruajtur...' : 'Ruaj Fjalëkalimin'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const RegisterPage = () => {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: location.state?.name || '',
    surname: '',
    email: location.state?.email || '',
    password: '',
    role: 'STUDENT' as Role,
    program: 'BIOLOGJI',
    year: 'VITI 1 BACHELORE',
    group_name: 'A',
    study_type: 'BACHELOR',
    phone: '',
    is_president: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasAdmin, setHasAdmin] = useState(false);

  useEffect(() => {
    if (formData.role === 'STUDENT') {
      checkAdminStatus();
    }
  }, [formData.program, formData.year, formData.study_type, formData.group_name, formData.role]);

  const checkAdminStatus = async () => {
    try {
      const params = new URLSearchParams({
        program: formData.program,
        year: formData.year,
        study_type: formData.study_type,
        group_name: formData.group_name
      });
      const data = await apiFetch(`/api/auth/check-class-admin?${params}`);
      setHasAdmin(data.hasAdmin);
      if (data.hasAdmin) {
        setFormData(prev => ({ ...prev, is_president: false }));
      }
    } catch (e) {
      console.error("Error checking admin status:", e);
    }
  };

  const programs = PROGRAMS;
  const years = YEARS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setSuccess(data.message || 'Regjistrimi u krye me sukses! Ju lutem kontrolloni email-in tuaj për të verifikuar llogarinë.');
      // Scroll to top to see message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-slate-900/60 z-10"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900/50 rounded-3xl p-8 relative z-10 border border-green-500/30 shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mx-auto mb-6 border border-green-500/30">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Regjistrimi u krye!</h2>
          <p className="text-slate-300 mb-8 leading-relaxed">
            {success}
          </p>
          <Link 
            to="/login" 
            className="block w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
          >
            Shko te Hyrja
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=2070" 
          alt="Background"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="absolute inset-0 bg-slate-900/60 z-10"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900/50 rounded-3xl p-8 relative z-10 border border-white/10 shadow-2xl"
      >
        <div className="flex justify-center mb-8">
          <MotionLogo size="lg" type="logo" />
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-tight">Regjistrimi</h1>
        <p className="text-center text-slate-300 font-medium mb-8">Fakulteti i Shkencave të Natyrës</p>
        
        {location.state?.email && (
          <div className="bg-blue-500/20 text-blue-200 p-3 rounded-lg mb-6 text-sm border border-blue-500/30">
            Ju jeni lidhur me Google ({location.state.email}).
          </div>
        )}
        
        {error && <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/30">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Emri</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Mbiemri</label>
              <input 
                type="text" 
                value={formData.surname}
                onChange={(e) => setFormData({...formData, surname: e.target.value})}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500 ${location.state?.email ? 'opacity-50 cursor-not-allowed' : ''}`}
              required
              readOnly={!!location.state?.email}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Fjalëkalimi</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white placeholder:text-slate-500"
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Roli</label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
              className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
            >
              <option value="STUDENT" className="bg-slate-900">Student</option>
              <option value="TEACHER" className="bg-slate-900">Mësues</option>
            </select>
          </div>
          {formData.role === 'STUDENT' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Dega</label>
                <select 
                  value={formData.program}
                  onChange={(e) => setFormData({...formData, program: e.target.value})}
                  className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                >
                  {programs.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Viti</label>
                  <select 
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                    className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                  >
                    {years.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Grupi</label>
                  <select 
                    value={formData.group_name}
                    onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                    className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                  >
                    {["A", "B", "C"].map(g => <option key={g} value={g} className="bg-slate-900">{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Lloji i Studimit</label>
                <select 
                  value={formData.study_type}
                  onChange={(e) => setFormData({...formData, study_type: e.target.value})}
                  className="w-full p-3 rounded-lg border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none bg-white/5 text-white"
                >
                  <option value="BACHELOR" className="bg-slate-900">Bachelor</option>
                  <option value="MASTER" className="bg-slate-900">Master</option>
                </select>
              </div>
              {!hasAdmin && (
                <div className="flex items-center space-x-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <input 
                    type="checkbox" 
                    id="is_president"
                    checked={formData.is_president}
                    onChange={(e) => setFormData({...formData, is_president: e.target.checked})}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-white/20 rounded bg-white/5"
                  />
                  <label htmlFor="is_president" className="text-sm font-bold text-blue-400 cursor-pointer">
                    President i Klasës (Admin)
                  </label>
                </div>
              )}
            </>
          )}
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            Regjistrohu
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Keni llogari? <Link to="/login" className="text-blue-400 font-bold hover:text-blue-300">Hyni këtu</Link>
        </p>
      </motion.div>
    </div>
  );
};

const ProfilePage = () => {
  const { user, token, refreshUser, apiFetch } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    surname: user?.surname || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    group_name: user?.group_name || 'A',
    study_type: user?.study_type || 'BACHELOR',
    program: user?.program || PROGRAMS[0],
    year: user?.year || YEARS[0]
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      await refreshUser();
      setMessage('Profili u përditësua me sukses!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      console.error(e);
      setMessage(e.message || 'Gabim gjatë përditësimit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 mb-12">
          <div className="relative group cursor-pointer" onClick={() => document.getElementById('photo-upload')?.click()}>
            <MotionLogo size="xl" src={user?.profile_photo} />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Plus className="text-white" size={32} />
            </div>
            <input 
              id="photo-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const formData = new FormData();
                formData.append('photo', file);
                
                setLoading(true);
                try {
                  await apiFetch('/api/user/profile-photo', {
                    method: 'POST',
                    body: formData
                  });
                  await refreshUser();
                  setMessage('Fotoja u përditësua!');
                  setTimeout(() => setMessage(''), 3000);
                } catch (err: any) {
                  console.error(err);
                  setMessage(err.message || 'Gabim gjatë ngarkimit');
                } finally {
                  setLoading(false);
                }
              }}
            />
            {user?.is_confirmed && (
              <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-full border-4 border-white shadow-lg">
                <Award size={24} />
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-3 mb-2">
              <h2 className="text-3xl font-bold text-slate-900">{user?.name} {user?.surname}</h2>
              <div className="flex flex-wrap gap-2">
                {user?.is_confirmed && (
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                    <CheckCircle size={12} />
                    <span>{user.role === 'STUDENT' ? 'Student i Konfirmuar' : 'Mësues i Konfirmuar'}</span>
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-500 mb-6">{user?.email}</p>
            
            {!user?.is_confirmed && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3 text-amber-700">
                  <Clock size={20} />
                  <span className="text-sm font-medium">Llogaria juaj është në pritje të miratimit nga administratori.</span>
                </div>
              </div>
            )}
            
            {message && <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-100">{message}</div>}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Përditëso Profilin</h3>
        
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Emri</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mbiemri</label>
                <input 
                  type="text" 
                  value={formData.surname}
                  onChange={(e) => setFormData({...formData, surname: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email (Nuk mund të ndryshohet)</label>
              <div className="flex space-x-2">
                <input 
                  type="email" 
                  value={user?.email}
                  disabled
                  className="flex-1 p-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Telefon</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="+355..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bio</label>
              <textarea 
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                placeholder="Tregoni diçka për veten..."
              />
            </div>

            {user?.role === 'STUDENT' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Programi</label>
                  <select 
                    value={formData.program}
                    onChange={(e) => setFormData({...formData, program: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Viti</label>
                  <select 
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Grupi</label>
                  <select 
                    value={formData.group_name}
                    onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Lloji i Studimit</label>
                  <select 
                    value={formData.study_type}
                    onChange={(e) => setFormData({...formData, study_type: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="BACHELOR">Bachelor</option>
                    <option value="MASTER">Master</option>
                  </select>
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {loading ? 'Duke ruajtur...' : 'Ruaj Ndryshimet'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const PendingApproval = () => {
  const { logout, user, apiFetch, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSelfConfirm = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/admin/self-confirm', { method: 'POST' });
      await refreshUser();
    } catch (e) {
      console.error(e);
      alert('Gabim gjatë konfirmimit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={40} className="text-blue-600 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Duke pritur për miratim</h2>
        <p className="text-slate-500 mb-8">
          Kërkesa juaj për t'u bashkuar me klasën është dërguar. Ju lutem prisni që administratori i klasës t'ju pranojë.
        </p>
        
        <div className="space-y-3">
          {user?.is_class_admin && (
            <button 
              onClick={handleSelfConfirm}
              disabled={loading}
              className="w-full p-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {loading ? 'Duke u konfirmuar...' : 'Konfirmo Llogarinë Time'}
            </button>
          )}
          <button 
            onClick={logout}
            className="w-full p-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
          >
            Dil dhe provo më vonë
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectedView = () => {
  const { token, refreshUser, logout, apiFetch } = useAuth();
  const [formData, setFormData] = useState({
    program: PROGRAMS[0],
    year: YEARS[0],
    group_name: GROUPS[0],
    study_type: 'BACHELOR'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/student/change-classroom', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      await refreshUser();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <X size={40} className="text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Kërkesa u refuzua</h2>
        <p className="text-slate-500 mb-8 text-center">
          Ju nuk jeni pranuar në këtë klasë. Ju lutem zgjidhni një klasë tjetër ose kontaktoni administratorin.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dega</label>
            <select 
              value={formData.program}
              onChange={(e) => setFormData({...formData, program: e.target.value})}
              className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Viti</label>
              <select 
                value={formData.year}
                onChange={(e) => setFormData({...formData, year: e.target.value})}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Grupi</label>
              <select 
                value={formData.group_name}
                onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                className="w-full p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {loading ? 'Duke dërguar...' : 'Dërgo Kërkesë të Re'}
          </button>
          
          <button 
            type="button"
            onClick={logout}
            className="w-full p-4 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
          >
            Dil
          </button>
        </form>
      </div>
    </div>
  );
};

const Progress3D = ({ value, label, color, delay = 0 }: { value: number, label: string, color: string, delay?: number, key?: any }) => {
  const height = Math.max(10, value);
  return (
    <div className="flex flex-col items-center group">
      <div className="relative w-16 h-64 flex items-end justify-center perspective-1000">
        <motion.div 
          initial={{ height: 0, rotateY: 45 }}
          animate={{ height: `${height}%`, rotateY: [40, 50, 40] }}
          transition={{ 
            height: { duration: 1.5, ease: "easeOut", delay },
            rotateY: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
          className={`relative w-10 transform-style-3d shadow-2xl`}
        >
          {/* Front Face */}
          <div className={`absolute inset-0 ${color} border-r border-black/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] z-20`}></div>
          
          {/* Top Face */}
          <div className={`absolute -top-4 left-0 w-10 h-4 ${color} brightness-150 origin-bottom transform -rotate-x-90 z-30 shadow-md`}></div>
          
          {/* Right Face */}
          <div className={`absolute top-0 -right-4 w-4 h-full ${color} brightness-75 origin-left transform rotate-y-90 z-10 shadow-lg`}></div>
          
          {/* Glowing Effect */}
          <div className={`absolute -inset-1 ${color} blur-xl opacity-20 group-hover:opacity-40 transition-opacity`}></div>

          {/* Floating Value */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-40 shadow-xl border border-white/20">
            {value.toFixed(1)}%
          </div>
        </motion.div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className={`h-1.5 w-8 rounded-full mx-auto ${color.replace('bg-', 'bg-').replace('500', '200')}`}></div>
      </div>
    </div>
  );
};

const PersonalNotesSection = ({ notes, onUpdate, apiFetch }: { notes: PersonalNote[], onUpdate: () => void, apiFetch: any }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', color: '#fef3c7', is_pinned: false });

  const colors = [
    { bg: 'bg-amber-50', border: 'border-amber-100', hex: '#fef3c7' },
    { bg: 'bg-blue-50', border: 'border-blue-100', hex: '#dbeafe' },
    { bg: 'bg-green-50', border: 'border-green-100', hex: '#dcfce7' },
    { bg: 'bg-purple-50', border: 'border-purple-100', hex: '#f3e8ff' },
    { bg: 'bg-pink-50', border: 'border-pink-100', hex: '#fce7f3' },
  ];

  const handleAdd = async () => {
    if (!newNote.content.trim()) return;
    try {
      await apiFetch('/api/personal-notes', {
        method: 'POST',
        body: JSON.stringify(newNote)
      });
      setIsAdding(false);
      setNewNote({ title: '', content: '', color: '#fef3c7', is_pinned: false });
      onUpdate();
    } catch (e) { console.error(e); }
  };

  const handleTogglePin = async (note: PersonalNote) => {
    try {
      await apiFetch(`/api/personal-notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...note, is_pinned: !note.is_pinned })
      });
      onUpdate();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await apiFetch(`/api/personal-notes/${id}`, { method: 'DELETE' });
      onUpdate();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800 flex items-center">
          <StickyNote className="mr-2 text-amber-500" /> Shënimet e Mia
        </h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 text-sm"
        >
          <Plus size={18} />
          <span>Shto Shënim</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 rounded-3xl border-2 border-dashed border-blue-200 shadow-sm space-y-4"
            >
              <input 
                type="text"
                placeholder="Titulli (Opsionale)"
                value={newNote.title}
                onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                className="w-full text-lg font-bold outline-none placeholder:text-slate-300 bg-transparent"
              />
              <textarea 
                placeholder="Shkruani shënimin tuaj këtu..."
                value={newNote.content}
                onChange={(e) => setNewNote({...newNote, content: e.target.value})}
                className="w-full min-h-[120px] outline-none text-slate-600 placeholder:text-slate-300 resize-none bg-transparent"
              />
              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  {colors.map(c => (
                    <button 
                      key={c.hex}
                      onClick={() => setNewNote({...newNote, color: c.hex})}
                      className={`w-6 h-6 rounded-full border-2 ${newNote.color === c.hex ? 'border-blue-500 scale-110' : 'border-transparent'} ${c.bg}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-slate-500 font-bold text-sm hover:text-slate-700"
                  >
                    Anulo
                  </button>
                  <button 
                    onClick={handleAdd}
                    disabled={!newNote.content.trim()}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm disabled:opacity-50"
                  >
                    Ruaj
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {notes.map((note) => (
          <motion.div 
            key={note.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl border shadow-sm relative group hover:shadow-md transition-all flex flex-col ${
              colors.find(c => c.hex === note.color)?.bg || 'bg-white'
            } ${colors.find(c => c.hex === note.color)?.border || 'border-slate-100'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-900 line-clamp-1">{note.title || 'Shënim'}</h4>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleTogglePin(note)}
                  className={`p-1.5 rounded-lg hover:bg-white/50 transition-colors ${note.is_pinned ? 'text-amber-600' : 'text-slate-400'}`}
                >
                  {note.is_pinned ? <Pin size={16} fill="currentColor" /> : <PinOff size={16} />}
                </button>
                <button 
                  onClick={() => handleDelete(note.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed mb-4 whitespace-pre-wrap flex-1">
              {note.content}
            </p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date(note.updated_at).toLocaleDateString()}
              </span>
              {note.is_pinned && (
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter bg-amber-100 px-2 py-0.5 rounded-full">
                   I fiksuar
                </span>
              )}
            </div>
          </motion.div>
        ))}

        {!isAdding && notes.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
            <StickyNote size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium text-sm">Nuk keni asnjë shënim personal akoma.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, token, socket, apiFetch, refreshUser } = useAuth();
  const navigate = useNavigate();
  const handleNotificationClick = (n: any) => handleNotificationNavigation(n, navigate);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [currentLecture, setCurrentLecture] = useState<any>(null);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [activeNotes, setActiveNotes] = useState<any[]>([]);
  const [dailyPresence, setDailyPresence] = useState<any[]>([]);
  const [studentHistory, setStudentHistory] = useState<any>(null);
  const [personalNotes, setPersonalNotes] = useState<PersonalNote[]>([]);
  const [dailySchedules, setDailySchedules] = useState<any[]>([]);

  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showEndClass, setShowEndClass] = useState(false);
  const [loading, setLoading] = useState(true);

  const getTimeInPending = useCallback((date: any) => {
    if (!date) return 'E panjohur';
    let d: Date;
    
    if (typeof date === 'object' && (date._seconds !== undefined || date.seconds !== undefined)) {
      // It's a Firestore Timestamp or object representation
      const seconds = date._seconds || date.seconds;
      d = new Date(seconds * 1000);
    } else if (typeof date === 'string') {
      // Handle SQLite space format: "2026-04-24 10:11:09" -> "2026-04-24T10:11:09"
      d = new Date(date.includes(' ') && !date.includes('T') ? date.replace(' ', 'T') : date);
    } else {
      d = new Date(date);
    }

    if (isNaN(d.getTime())) return 'E panjohur';
    const diff = Math.floor((new Date().getTime() - d.getTime()) / 60000); // mins
    if (diff < 1) return 'Sapo u dërgua';
    if (diff < 60) return `Në pritje për ${diff} min`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `Në pritje për ${hours} orë`;
    return `Në pritje për ${Math.floor(hours / 24)} ditë`;
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoint = user?.role === 'TEACHER' ? '/api/dashboard/teacher' : '/api/dashboard/student';
      const data = await apiFetch(endpoint);
      
      if (user?.role === 'TEACHER') {
        setStats(data.stats);
        setCurrentLecture(data.currentLecture);
        setDailySchedules(data.dailySchedule);
        setPendingSubmissions(data.pendingSubmissions);
        setPendingStudents(data.pendingStudents);
        setAllClasses(data.allClasses);
      } else {
        setStats(data.stats);
        setCurrentLecture(data.currentLecture);
        setUpcomingTasks(data.upcomingTasks);
        setActiveSession(data.activeSession);
      }
      
      if (data.notifications) {
        setRecentActivity(data.notifications.map((n: any) => {
          let icon = BookOpen;
          if (n.type === 'TEST' || n.type === 'TEST_SUBMISSION') icon = Award;
          if (n.type === 'ASSIGNMENT_SUBMISSION' || n.type === 'GRADE') icon = FileText;
          if (n.type === 'CLASS_JOIN' || n.type === 'STUDENT_JOINED_CLASS') icon = Users;
          
          return {
            title: n.title,
            content: n.content,
            time: getTimeInPending(n.created_at),
            icon,
            type: n.type,
            target_id: n.target_id,
            target_type: n.target_type
          };
        }));
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, user?.role, getTimeInPending]);

  const fetchActiveSession = useCallback(async () => {
    try {
      const data = await apiFetch('/api/study/active');
      setActiveSession(data);
    } catch (e) { console.error(e); }
  }, [apiFetch]);

  const fetchPersonalNotes = useCallback(async () => {
    try {
      const data = await apiFetch('/api/personal-notes');
      setPersonalNotes(data);
    } catch (e) { console.error(e); }
  }, [apiFetch]);

  const fetchActiveNotes = useCallback(async () => {
    try {
      const data = await apiFetch('/api/classes/notes/active');
      setActiveNotes(data);
    } catch (e) { console.error(e); }
  }, [apiFetch]);

  const fetchDailyPresence = useCallback(async () => {
    try {
      const data = await apiFetch('/api/student/daily-presence');
      setDailyPresence(data);
    } catch (e) { console.error(e); }
  }, [apiFetch]);

  const fetchStudentHistory = useCallback(async () => {
    try {
      const data = await apiFetch('/api/student/history');
      setStudentHistory(data);
    } catch (e) { console.error(e); }
  }, [apiFetch]);

  const handleLectureStatus = useCallback(async (status: string) => {
    if (!currentLecture?.id) return;
    try {
      await apiFetch('/api/teacher/lecture-status', {
        method: 'POST',
        body: JSON.stringify({ scheduleId: currentLecture.id, status })
      });
      fetchDashboardData();
    } catch (e) { console.error(e); }
  }, [apiFetch, currentLecture?.id, fetchDashboardData]);

  const handleApprove = useCallback(async (memberId: number, status: string) => {
    try {
      await apiFetch('/api/admin/approve-member', {
        method: 'POST',
        body: JSON.stringify({ memberId, status })
      });
      fetchDashboardData();
    } catch (e) { console.error(e); }
  }, [apiFetch, fetchDashboardData]);

  useEffect(() => {
    if (user?.role === 'STUDENT' && socket) {
      socket.emit('join', { id: user.id, name: user.name, role: user.role });
      
      socket.on('study_session_start', (data: any) => {
        fetchActiveSession();
      });

      socket.on('study_session_end', (data: any) => {
        setActiveSession(null);
        setShowEndClass(true);
        setTimeout(() => setShowEndClass(false), 3000);
      });

      socket.on('lecture_status_update', (data: any) => {
        // Update current lecture if it matches the user's class or the teacher is the user
        if (user.role === 'TEACHER') {
          if (data.teacher_id === user.id) {
            setCurrentLecture(data);
          }
        } else {
          // Students only get updates for their class room
          setCurrentLecture(data);
        }
      });

      return () => {
        socket.off('study_session_start');
        socket.off('study_session_end');
        socket.off('lecture_status_update');
      };
    }
  }, [user?.id, socket]);

  useEffect(() => {
    if (!user?.id || !socket) return;

    socket.emit('join', { id: user.id, name: user.name, role: user.role });

    const loadData = async () => {
      fetchDashboardData();
      if (user.role === 'STUDENT') {
        fetchActiveNotes();
        fetchPersonalNotes();
        fetchDailyPresence();
        fetchStudentHistory();
      }
    };

    loadData();

    const interval = setInterval(fetchDashboardData, 60000);
    
    if (user.role === 'TEACHER') {
      const hDash = () => fetchDashboardData();

      socket.on('submission_updated', hDash);
      socket.on('student_joined_class', hDash);
      socket.on('score_updated', hDash);
      socket.on('presence_verified', hDash);
      socket.on('lecture_status_update', hDash);
      socket.on('presence_confirmed', hDash);
      socket.on('member_status_updated', hDash);
      socket.on('test_distributed', hDash);
      socket.on('test_updated', hDash);
      socket.on('test_deleted', hDash);
      socket.on('assignment_updated', hDash);
      socket.on('assignment_deleted', hDash);
      socket.on('new_assignment', hDash);
      socket.on('new_live_question', hDash);
      socket.on('live_question_update', hDash);
      
      return () => {
        clearInterval(interval);
        socket.off('submission_updated', hDash);
        socket.off('student_joined_class', hDash);
        socket.off('score_updated', hDash);
        socket.off('presence_verified', hDash);
        socket.off('lecture_status_update', hDash);
        socket.off('presence_confirmed', hDash);
        socket.off('member_status_updated', hDash);
        socket.off('test_distributed', hDash);
        socket.off('test_updated', hDash);
        socket.off('test_deleted', hDash);
        socket.off('assignment_updated', hDash);
        socket.off('assignment_deleted', hDash);
        socket.off('new_assignment', hDash);
        socket.off('new_live_question', hDash);
        socket.off('live_question_update', hDash);
      };
    } else if (user.role === 'STUDENT') {
      const hMember = () => {
        refreshUser();
        fetchDashboardData();
      };
      const hScore = () => {
        fetchDashboardData();
        fetchStudentHistory();
      };
      const hDash = () => fetchDashboardData();

      socket.on('member_status_updated', hMember);
      socket.on('score_updated', hScore);
      socket.on('submission_updated', hDash);
      socket.on('new_assignment', hDash);
      socket.on('assignment_updated', hDash);
      socket.on('assignment_deleted', hDash);
      socket.on('test_distributed', hDash);
      socket.on('test_updated', hDash);
      socket.on('test_deleted', hDash);
      socket.on('presence_updated', hDash);
      socket.on('lecture_status_update', hDash);
      
      return () => {
        clearInterval(interval);
        socket.off('member_status_updated', hMember);
        socket.off('score_updated', hScore);
        socket.off('submission_updated', hDash);
        socket.off('new_assignment', hDash);
        socket.off('assignment_updated', hDash);
        socket.off('assignment_deleted', hDash);
        socket.off('test_distributed', hDash);
        socket.off('test_updated', hDash);
        socket.off('test_deleted', hDash);
        socket.off('presence_updated', hDash);
        socket.off('lecture_status_update', hDash);
      };
    }
  }, [user?.id, user?.role, socket, fetchDashboardData, fetchActiveNotes, fetchPersonalNotes, fetchDailyPresence, fetchStudentHistory, refreshUser]);

  const dashboardStats = user?.role === 'TEACHER' ? [
    { label: 'Mesatarja e Klasës', value: stats?.averageScore ? stats.averageScore.toFixed(1) : '0', icon: Award, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Live' },
    { label: 'Studentë Aktivë', value: stats?.activeTestsCount || '0', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Real-time' },
    { label: 'Progresi i Përgjithshëm', value: stats?.classProgress?.length > 0 ? (stats.classProgress[stats.classProgress.length - 1].avg_perf * 100).toFixed(0) + '%' : '88%', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '+2% Sot' },
    { label: 'Klasat e Mia', value: allClasses.length || '0', icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'Aktive' },
  ] : [
    { label: 'Mesatarja', value: stats?.logs?.length > 0 ? (stats.logs.reduce((acc: any, curr: any) => acc + (curr.max_score > 0 ? (curr.score/curr.max_score) : 0), 0) / stats.logs.length * 10).toFixed(1) : '0', icon: Award, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Live' },
    { label: 'Pjesëmarrja', value: stats?.attendance?.find((a: any) => a.status === 'PRESENT')?.count || '0', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Konfirmuar' },
    { label: 'Pikët Totale', value: stats?.logs?.reduce((acc: any, curr: any) => acc + curr.score, 0).toFixed(0) || '0', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '+12% këtë javë' },
    { label: 'Aktivitete', value: stats?.logs?.length || '0', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'Sot' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full shadow-lg"
        />
        <p className="text-slate-500 font-bold animate-pulse">Po ngarkohen të dhënat...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <div className="fixed top-20 right-8 z-[60] pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-blue-100 flex items-center gap-3"
        >
          <div className="relative">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute inset-0"></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full relative"></div>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Sinkronizimi</p>
            <p className="text-xs font-bold text-slate-900 leading-none mt-1">Live - Çdo Sekondë</p>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showEndClass && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-xl"
          >
            <div className="text-center">
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="inline-block bg-red-600 text-white px-12 py-6 rounded-[2rem] shadow-2xl shadow-red-200"
              >
                <h2 className="text-6xl font-black uppercase tracking-tighter">Mësimi mbaroi</h2>
              </motion.div>
            </div>
          </motion.div>
        )}

        {user?.role === 'STUDENT' && activeSession && activeSession.status === 'ACTIVE' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed bottom-8 right-8 z-[60] flex items-center gap-3 bg-emerald-500 text-white pl-2 pr-6 py-2 rounded-full shadow-lg shadow-emerald-200 border-4 border-white"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              <MotionLogo size="sm" src={activeSession.teacher_photo} />
            </div>
            <div>
               <p className="text-[10px] font-bold uppercase opacity-80 leading-none">Pedagogu Aktiv</p>
               <p className="font-black text-sm">{activeSession.teacherName || activeSession.teacher_name}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse ml-2" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* School Schedule Info */}
      {user?.role === 'STUDENT' && (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-fit">
          <Clock size={14} className="text-blue-500" />
          <span>Orari Mësimor: 08:00 - 18:00 (Ciklet 50min)</span>
        </div>
      )}

      {/* User Info Banner */}
      <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <MotionLogo size="lg" type="logo" />
            <div>
              <h2 className="text-3xl font-bold mb-2">Përshëndetje, {user?.name}!</h2>
              <p className="text-blue-100 opacity-90">
                {user?.role === 'STUDENT' 
                  ? `${user?.program} • ${user?.year} • ${user?.group_name}` 
                  : 'Paneli i Menaxhimit të Mësuesit'}
              </p>
            </div>
          </div>
          {user?.role === 'STUDENT' && (
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Statusi</p>
                <p className="font-bold">Aktiv</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Grupi</p>
                <p className="font-bold">{user?.group_name || '-'}</p>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
      </div>

      {/* Active Pinned Notes for Students */}
      {user?.role === 'STUDENT' && activeNotes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Info size={24} className="text-blue-500" />
                Njoftime të Rëndësishme
             </h3>
             <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 uppercase tracking-wider">Shënim nga Pedagogu</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeNotes.map((note: any) => (
              <motion.div 
                key={note.class_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden group"
              >
                <div className="relative z-10 flex items-start gap-4">
                   <MotionLogo size="sm" src={note.teacher_photo} />
                   <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{note.teacher_name}</p>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{note.class_name}</p>
                        </div>
                        <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg border border-blue-100">
                           <Clock size={14} />
                        </div>
                      </div>
                      <p className="text-slate-700 font-medium italic mb-2 leading-relaxed">
                        "{note.pinned_note}"
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                        <CalendarIcon size={10} />
                        Postuar: {new Date(note.note_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                   </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-100/50 transition-colors"></div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Presence until 5 PM */}
      {user?.role === 'STUDENT' && dailyPresence.length > 0 && (
         <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={24} className="text-green-500" />
                Prezenca e Sotme
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dailyPresence.map((p, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                            <UserCheck size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">{p.subject}</p>
                            <p className="text-xs text-slate-500">{p.teacher_name}</p>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">{p.program}</p>
                        </div>
                    </div>
                ))}
            </div>
         </div>
      )}

      {/* Teacher Lecture Options */}
      {user?.role === 'TEACHER' && currentLecture && (
        <div className="mb-8 bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-1">Leksioni Aktual</p>
              <h3 className="text-2xl font-bold">{currentLecture.subject} - {currentLecture.class_name}</h3>
              <p className="text-blue-100">{currentLecture.start_time} - {currentLecture.end_time}</p>
              {currentLecture.status && (
                <div className="mt-2 inline-block px-3 py-1 bg-white/20 rounded-lg text-xs font-bold">
                  Statusi: {currentLecture.status === 'OPEN' ? 'Hapur' : currentLecture.status === 'SOON' ? 'Vjen Së Shpejti' : 'Nuk vjen sot'}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => handleLectureStatus('OPEN')}
                className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-all"
              >
                1. Hap Klasën
              </button>
              <button 
                onClick={() => handleLectureStatus('SOON')}
                className="px-6 py-3 bg-blue-500 text-white border border-blue-400 rounded-2xl font-bold hover:bg-blue-400 transition-all"
              >
                2. Vij Së Shpejti
              </button>
              <button 
                onClick={() => handleLectureStatus('NOT_COMING')}
                className="px-6 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
              >
                3. Nuk Vij Sot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Daily Schedule */}
      {user?.role === 'TEACHER' && dailySchedules.length > 0 && (
        <div className="space-y-6 mb-10">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center">
              <CalendarIcon className="mr-2 text-blue-600" /> Orari Im i Sotëm
            </h3>
            <span className="text-slate-500 text-sm font-medium">{dailySchedules.length} Leksione sot</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dailySchedules.map((item, idx) => {
              const isCurrent = currentLecture && (
                (item.source === 'LEK' && item.id === currentLecture.id) ||
                (item.source === 'CAL' && item.id === currentLecture.id)
              );
              
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -5 }}
                  className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden group ${
                    isCurrent ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-100' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${isCurrent ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                      <Clock size={20} />
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-black uppercase bg-white text-blue-600 px-2 py-1 rounded-full animate-pulse shadow-sm">LIVE TANI</span>
                    )}
                  </div>
                  <h4 className={`font-black text-lg mb-1 ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{item.subject}</h4>
                  <p className={`text-xs mb-4 font-bold border-b pb-2 ${isCurrent ? 'text-blue-100 border-white/20' : 'text-slate-500 border-slate-50'}`}>
                    {item.class_name || 'Klasë e Panjohur'}
                  </p>
                  <div className={`flex items-center space-x-2 text-sm font-bold ${isCurrent ? 'text-white' : 'text-slate-600'}`}>
                    <span>{item.start_time} - {item.end_time}</span>
                  </div>
                  {!isCurrent && (
                    <div className="mt-4 flex items-center space-x-1 text-[10px] font-black uppercase text-slate-300">
                      <CalendarIcon size={10} />
                      <span>Sipas Kalendarit</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Classroom Selection for Teachers */}
      {user?.role === 'TEACHER' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center">
              <Monitor className="mr-2 text-blue-600" /> 
              Gjithë Klasat e Mia
            </h3>
            <span className="text-slate-500 text-sm font-medium">
              {allClasses.length} Klasa
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {allClasses.map((cls, idx) => {
              const displayCls = {
                id: cls.id,
                name: cls.name,
                department: cls.department || cls.program || 'Fakulteti i Shkencave',
                year: cls.year || 'Gjithë Viteve',
                is_scheduled_now: currentLecture && (cls.id === currentLecture.id || cls.id === currentLecture.class_id)
              };

              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -5 }}
                  className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-between hover:shadow-md transition-all group ${
                    displayCls.is_scheduled_now ? 'border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-50' : 'bg-white border-slate-100'
                  }`}
                >
                  <div>
                    <div className={`w-10 h-10 ${displayCls.is_scheduled_now ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'} rounded-xl flex items-center justify-center mb-4 transition-colors`}>
                      <Users size={20} />
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{displayCls.name}</h4>
                    <p className="text-xs text-slate-500 mb-4">{displayCls.department} • {displayCls.year}</p>
                  </div>
                  <Link
                    to={`/classroom/hub?classId=${displayCls.id}`}
                    className={`w-full py-2 rounded-xl text-sm font-bold transition-all text-center flex items-center justify-center space-x-2 ${
                      displayCls.is_scheduled_now 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-slate-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                    }`}
                  >
                    <Play size={14} />
                    <span>Hap Klasën</span>
                  </Link>
                </motion.div>
              );
            })}
            {loadingClasses && allClasses.length === 0 && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-slate-100 animate-pulse h-40 rounded-2xl"></div>
            ))}
          </div>
        </div>
      )}

      {/* Student Tasks Overview */}
      {user?.role === 'STUDENT' && upcomingTasks.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center">
              <CheckCircle className="mr-2 text-blue-600" /> Detyrat e Mia Aktuale
            </h3>
            <Link to="/assignments" className="text-blue-600 text-sm font-bold hover:underline">Shiko Të Gjitha</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingTasks.map((task, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-xl ${task.taskType === 'TEST' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {task.taskType === 'TEST' ? <Award size={20} /> : <BookOpen size={20} />}
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      {task.taskType === 'TEST' ? 'Test' : 'Detyra'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1 line-clamp-1">{task.title}</h4>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 italic">"{task.description}"</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center text-xs text-slate-400 space-x-2">
                    <Clock size={14} />
                    <span>Afati: {task.deadline || task.test_date}</span>
                  </div>
                  <Link
                    to={task.taskType === 'TEST' ? `/tests?id=${task.id}` : `/assignments?id=${task.id}`}
                    className={`w-full py-3 rounded-2xl text-sm font-bold transition-all text-center block ${
                      task.taskType === 'TEST' 
                      ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-100' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
                    }`}
                  >
                    Hap {task.taskType === 'TEST' ? 'Testin' : 'Detyrën'}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Personal Notes Section for Students */}
      {user?.role === 'STUDENT' && (
        <PersonalNotesSection 
          notes={personalNotes} 
          onUpdate={fetchPersonalNotes} 
          apiFetch={apiFetch} 
        />
      )}

      {currentLecture && (
        <div className={`mb-8 rounded-3xl p-8 text-white shadow-xl ${
          currentLecture.status === 'OPEN' ? 'bg-emerald-500 shadow-emerald-100' :
          currentLecture.status === 'SOON' ? 'bg-amber-500 shadow-amber-100' :
          currentLecture.status === 'NOT_COMING' ? 'bg-red-500 shadow-red-100' :
          'bg-slate-800 shadow-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-bold uppercase tracking-wider mb-1">Statusi i Mësimit</p>
              <h3 className="text-2xl font-bold">{currentLecture.subject}</h3>
              <p className="text-white/80">Mësuesi: {currentLecture.teacher_name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">
                {currentLecture.status === 'OPEN' ? 'LIVE' :
                 currentLecture.status === 'SOON' ? 'SË SHPEJTI' :
                 currentLecture.status === 'NOT_COMING' ? 'ANULUAR' : 'PRITJE'}
              </p>
              <p className="text-sm opacity-80">{currentLecture.start_time} - {currentLecture.end_time}</p>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'TEACHER' && pendingSubmissions.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-blue-900 flex items-center">
              <FileText className="mr-2 text-blue-600" /> Dorëzime për Vlerësim (Detyra & Teste)
            </h3>
            <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
              {pendingSubmissions.length} dorëzime
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingSubmissions.map(sub => (
              <div key={`${sub.type}-${sub.id}`} className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-between group hover:border-blue-400 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${sub.type === 'TEST' ? 'bg-purple-100 text-purple-600 group-hover:bg-purple-600' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600'} rounded-xl flex items-center justify-center group-hover:text-white transition-colors`}>
                        {sub.type === 'TEST' ? <Award size={20} /> : <Users size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{sub.student_name}</p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {getTimeInPending(sub.submitted_at)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${sub.type === 'TEST' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {sub.type === 'TEST' ? 'Test' : 'Detyrë'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{sub.title}</h4>
                  {sub.is_late && <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded leading-none inline-block">Me Vonesë</span>}
                </div>
                <Link
                  to={sub.type === 'TEST' ? `/tests?id=${sub.target_id}&attemptId=${sub.id}` : `/assignments?id=${sub.target_id}`}
                  className={`w-full mt-4 py-2.5 ${sub.type === 'TEST' ? 'bg-purple-900 hover:bg-purple-800' : 'bg-slate-900 hover:bg-slate-800'} text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center space-x-2`}
                >
                  <Eye size={14} />
                  <span>Vlerëso {sub.type === 'TEST' ? 'Testin' : 'Homework'}</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingStudents.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-amber-900 flex items-center">
              <Users className="mr-2" /> Studentë në Pritje të Konfirmimit
            </h3>
            <span className="bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
              {pendingStudents.length} kërkesa
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingStudents.map(student => (
              <div key={student.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex flex-col justify-between">
                <div className="flex items-center space-x-4 mb-4">
                  <MotionLogo size="sm" src={student.profile_photo} />
                  <div>
                    <p className="font-bold text-slate-900">{student.name} {student.surname}</p>
                    <p className="text-xs text-slate-500">{student.email}</p>
                    <p className="text-xs font-medium text-amber-700 bg-amber-100 inline-block px-2 py-1 rounded mt-1">
                      {student.class_name}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApprove(student.id, 'CONFIRMED')}
                    className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-all"
                  >
                    Prano
                  </button>
                  <button 
                    onClick={() => handleApprove(student.id, 'REFUSED')}
                    className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-xs font-bold hover:bg-red-200 transition-all"
                  >
                    Refuzo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative group overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon size={26} />
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                  stat.trend === 'Live' || stat.trend === 'Real-time' ? 'bg-emerald-50 text-emerald-500 animate-pulse' : 'bg-slate-100 text-slate-500'
                }`}>
                  {stat.trend || 'Aktiv'}
                </span>
              </div>
            </div>
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.15em] mb-1">{stat.label}</h3>
            <p className="text-3xl font-black text-slate-900 tabular-nums">{stat.value}</p>
            <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full w-12 ${stat.color.replace('text-', 'bg-')}`}></div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-blue-50 transition-colors"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Përmbledhje e Performancës 3D</h3>
                <p className="text-slate-500 text-sm mt-1 font-medium">Analitika vizuale e progresit akademik</p>
              </div>
              <Link to="/analytics" className="px-5 py-2 bg-slate-50 text-blue-600 rounded-2xl text-sm font-bold border border-slate-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                Shiko Analitikën e Plotë
              </Link>
            </div>
            
            <div className="flex justify-around items-end h-80 pb-6">
              {(() => {
                let data = [];
                if (user?.role === 'TEACHER' && stats?.classProgress && stats.classProgress.length > 0) {
                  // Show last 4 months of class progress
                  data = stats.classProgress.slice(-4).map((p: any) => ({
                    name: p.month?.includes('-') ? p.month.split('-')[1] : (p.month || 'Jan'), 
                    value: (p.avg_perf || 0) * 100,
                    color: 'bg-blue-500'
                  }));
                } else if (user?.role === 'STUDENT' && stats?.logs) {
                  const studentLogs = stats.logs || [];
                  data = [
                    { name: 'Teste', value: (studentLogs.filter((l: any) => l.type === 'TEST').reduce((acc: number, curr: any) => acc + (curr.max_score > 0 ? (curr.score/curr.max_score) : 0), 0) / (studentLogs.filter((l: any) => l.type === 'TEST').length || 1)) * 100, color: 'bg-indigo-500' },
                    { name: 'Detyra', value: (studentLogs.filter((l: any) => l.type === 'ASSIGNMENT').reduce((acc: number, curr: any) => acc + (curr.max_score > 0 ? (curr.score/curr.max_score) : 0), 0) / (studentLogs.filter((l: any) => l.type === 'ASSIGNMENT').length || 1)) * 100, color: 'bg-emerald-500' },
                    { name: 'Pjesëmarrja', value: Math.min(100, ((stats?.attendance?.find((a: any) => a.status === 'PRESENT')?.count || 0) / 15) * 100), color: 'bg-sky-500' },
                    { name: 'Total', value: studentLogs.length > 0 ? (studentLogs.reduce((acc: any, curr: any) => acc + (curr.max_score > 0 ? (curr.score/curr.max_score) : 0), 0) / studentLogs.length * 100) : 0, color: 'bg-rose-500' }
                  ];
                }
                return data.map((d: any, i: number) => (
                  <Progress3D key={i} value={d.value} label={d.name} color={d.color} delay={i * 0.2} />
                ));
              })()}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 justify-center">
               <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shkëlqyeshëm ({'>'}80%)</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mbi Mesataren ({'>'}60%)</span>
               </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-8">Aktiviteti i Fundit</h3>
          <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {recentActivity.map((act, i) => (
              <motion.button 
                key={i} 
                onClick={() => handleNotificationClick(act)}
                whileHover={{ x: 4 }}
                className="w-full flex items-center space-x-4 group text-left"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                  <act.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{act.title}</p>
                  <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mb-1">{act.content}</p>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{act.time}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-blue-600" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Student Database / History Section */}
      {user?.role === 'STUDENT' && studentHistory && (
         <div className="space-y-10 pt-10 border-t border-slate-200">
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-bold text-slate-900">Database-i Im Akademik</h3>
                <p className="text-slate-500">Historia e plotë e performancës suaj në universitet</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Presence History */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <CheckCircle size={20} className="text-green-500" />
                        Historia e Prezencave
                    </h4>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {studentHistory.presence.map((h: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <p className="font-bold text-slate-900 text-sm">{h.subject}</p>
                                    <p className="text-xs text-slate-500">{h.t_name} {h.t_surname}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[10px] font-bold uppercase ${h.is_verified ? 'text-green-600' : 'text-blue-600'}`}>
                                        {h.is_verified ? 'I Konfirmuar' : 'Në Pritje'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold">{new Date(h.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Grade History (Tests & Homework) */}
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Award size={20} className="text-orange-500" />
                            Rezultatet e Testeve
                        </h4>
                        <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {studentHistory.testResults.map((t: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-orange-50/30 rounded-2xl border border-orange-100/50">
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{t.title}</p>
                                        <p className="text-xs text-slate-500">Pikët: {t.total_score}/{t.max_score}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center font-bold text-orange-600">
                                            {t.grade}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {studentHistory.testResults.length === 0 && <p className="text-center text-slate-400 italic text-sm">Nuk ka teste të vlerësuara akoma.</p>}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <FileText size={20} className="text-purple-500" />
                            Vlerësimet e Detyrave
                        </h4>
                        <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {studentHistory.homeworkResults.map((h: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-purple-50/30 rounded-2xl border border-purple-100/50">
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{h.title}</p>
                                        <p className="text-xs text-slate-500">Pikët: {h.points}/{h.max_points}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center font-bold text-purple-600">
                                            {h.grade}
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {studentHistory.homeworkResults.length === 0 && <p className="text-center text-slate-400 italic text-sm">Nuk ka detyra të vlerësuara akoma.</p>}
                        </div>
                    </div>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, token, socket, apiFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ title: string, message: string, type: 'ASSIGNMENT' | 'TEST', target_id?: any, target_type?: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
    }
  }, [token, user, navigate]);

  const handleNotificationClick = (n: any) => handleNotificationNavigation(n, navigate);
  
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  
  useEffect(() => {
    // Close menu on navigation
    setIsMobileMenuOpen(false);
  }, [window.location.pathname]);

  useEffect(() => {
    if (!socket) return;
    
    const h1 = async (data: any) => {
      if (user?.role === 'STUDENT' && data.classId) {
        try {
          const myClasses = await apiFetch('/api/classes/my');
          if (myClasses.some((c: any) => c.id === data.classId)) {
            navigate('/attendance');
          }
        } catch (e) { console.error(e); }
      }
    };

    const h2 = (data: any) => {
      if (user?.role === 'STUDENT' && 
          user.program === data.program && 
          user.year === data.year && 
          user.group_name === data.group_name) {
        setToast({
          title: 'Detyrë e Re!',
          message: `${data.teacherName} publikoi: ${data.title}`,
          type: 'ASSIGNMENT',
          target_id: data.assignmentId,
          target_type: 'ASSIGNMENT'
        });
        setTimeout(() => setToast(null), 8000);
      }
    };

    const h3 = (data: any) => {
      if (user?.role === 'STUDENT') {
        setToast({
          title: 'Test i Ri!',
          message: data.title || 'Mësuesi shpërndau një test të ri.',
          type: 'TEST',
          target_id: data.testId,
          target_type: 'TEST'
        });
        setTimeout(() => setToast(null), 8000);
      }
    };

    const hSubmission = (data: any) => {
      if (user?.role === 'TEACHER' && data?.type === 'NEW_SUBMISSION') {
        setToast({
          title: 'Dorëzim i Ri!',
          message: data?.studentName 
            ? `${data.studentName} dorëzoi: ${data.assignmentTitle}` 
            : 'Një student sapo dorëzoi një detyrë.',
          type: 'ASSIGNMENT',
          target_id: data.targetId || data.assignmentId,
          target_type: data.targetType || 'ASSIGNMENT'
        });
        setTimeout(() => setToast(null), 8000);
      } else if (user?.role === 'STUDENT' && data?.type === 'GRADE_RECEIVED') {
        setToast({
          title: 'Vlerësim i Ri!',
          message: `Detyra "${data.assignmentTitle}" u vlerësua me: ${data.grade}`,
          type: 'ASSIGNMENT',
          target_id: data.targetId,
          target_type: data.targetType || 'ASSIGNMENT'
        });
        setTimeout(() => setToast(null), 8000);
      }
    };

    socket.on('study_session_start', h1);
    socket.on('new_assignment', h2);
    socket.on('test_distributed', h3);
    socket.on('submission_updated', hSubmission);

    return () => { 
      socket.off('study_session_start', h1);
      socket.off('new_assignment', h2);
      socket.off('test_distributed', h3);
      socket.off('submission_updated', hSubmission);
    };
  }, [socket, user?.id, user?.role, apiFetch, navigate]);

  if (!user || !token) return null;

  // Approval logic
  if (user.role === 'STUDENT' && !user.is_class_admin) {
    if ((user as any).class_status === 'PENDING') return <PendingApproval />;
    if ((user as any).class_status === 'REFUSED') return <RejectedView />;
    if (!user.is_confirmed) return <PendingApproval />;
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ...(user.role === 'STUDENT' ? [{ icon: Users, label: 'Klasa', path: '/classroom' }] : []),
    { icon: CheckCircle, label: 'Pjesëmarrja', path: '/attendance' },
    { icon: CalendarIcon, label: 'Kalendari', path: '/calendar' },
    { icon: BookOpen, label: 'Libraria', path: '/library' },
    { icon: FileText, label: 'Teste', path: '/tests' },
    { icon: BookOpen, label: 'Detyra', path: '/assignments' },
    { icon: HelpCircle, label: 'Pyetje Live', path: '/live-questions' },
    { icon: Megaphone, label: 'Aktivitete', path: '/activities' },
    { icon: Monitor, label: 'Screen Share', path: '/screen-share' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: TrendingUp, label: 'Analitika', path: '/analytics' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] w-full max-w-md px-4"
          >
            <div 
              onClick={() => {
                handleNotificationClick({ 
                  target_id: toast.target_id, 
                  target_type: toast.target_type,
                  type: toast.type,
                  title: toast.title
                });
                setToast(null);
              }}
              className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-300 transition-all active:scale-[0.98]"
            >
              <div className={`p-3 rounded-xl ${toast.type === 'TEST' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                {toast.type === 'TEST' ? <Award size={24} /> : <BookOpen size={24} />}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900">{toast.title}</h4>
                <p className="text-sm text-slate-500">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToast(null)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <div className="hidden md:block">
        <Sidebar role={user.role} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64">
        <Header onMenuToggle={toggleMobileMenu} />
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </main>
        <footer className="p-4 md:p-8 border-t border-slate-200 bg-white">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">© 2026 Fakulteti i Shkencave të Natyrës. Të gjitha të drejtat e rezervuara.</p>
            <a 
              href="https://kartaestudentit.al/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-blue-600 font-bold hover:underline"
            >
              <Award size={18} />
              <span>Karta e Studentit</span>
            </a>
          </div>
        </footer>
      </div>

      {/* Mobile Menu Slide-over */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleMobileMenu}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 bg-slate-900 text-white shadow-2xl z-[70] md:hidden overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-bold tracking-tight text-blue-400 uppercase leading-tight">Fakulteti i Shkencave të Natyrës</h1>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Platforma Studentore</p>
                </div>
                <button 
                  onClick={toggleMobileMenu} 
                  className="p-2 hover:bg-slate-800 text-slate-400 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={toggleMobileMenu}
                    className="flex items-center space-x-4 p-4 rounded-2xl hover:bg-slate-800 text-slate-300 hover:text-white transition-all group"
                  >
                    <div className="p-2 bg-slate-800/50 rounded-xl group-hover:bg-slate-700 transition-all">
                      <item.icon size={20} />
                    </div>
                    <span className="font-bold text-sm tracking-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-auto p-6 bg-slate-950/50 border-t border-slate-800">
                 <div className="flex items-center space-x-3 mb-6">
                    <MotionLogo size="md" src={user.profile_photo} />
                    <div>
                       <p className="font-bold text-white text-sm">{user.name}</p>
                       <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{user.role}</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => {
                     toggleMobileMenu();
                     logout();
                   }}
                   className="w-full py-4 bg-slate-800 text-red-400 border border-slate-700 rounded-3xl font-bold flex items-center justify-center space-x-2 shadow-sm hover:bg-red-900/20 hover:text-red-300 transition-all"
                 >
                    <LogOut size={20} />
                    <span>Dil Shpejt</span>
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- App Component ---

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeLiveQuestion, _setActiveLiveQuestion] = useState<any>(null);
  const [lectureEndedMessage, setLectureEndedMessage] = useState<string | null>(null);
  const activeLiveQuestionRef = useRef<any>(null);
  const setActiveLiveQuestion = (q: any) => {
    activeLiveQuestionRef.current = q;
    _setActiveLiveQuestion(q);
  };

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    console.log(`[apiFetch] Calling: ${url}`);
    const isFormData = options.body instanceof FormData;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401 && !url.includes('/api/auth/login')) {
      console.warn("Unauthorized request, logging out...");
      logout();
      throw new Error("Seanca juaj ka skaduar. Ju lutem hyni përsëri.");
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await res.json();
      if (!res.ok) {
        const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || `Gabim i serverit: ${res.status}`);
        throw new Error(errorMessage);
      }
      return data;
    } else {
      const text = await res.text();
      console.error(`Non-JSON response from ${url}:`, text);
      if (text.includes("<!DOCTYPE html>")) {
        throw new Error(`Serveri u përgjigj me HTML (ndoshta 404). URL: ${url}, Status: ${res.status}`);
      }
      // If it's a 429, the text is usually "Rate exceeded"
      if (res.status === 429) {
        throw new Error("Keni bërë shumë kërkesa. Ju lutem prisni pak.");
      }
      throw new Error(`Serveri u përgjigj me format të gabuar (${res.status}).`);
    }
  }, [token, logout]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const userData = await apiFetch('/api/user/me');
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  }, [token, apiFetch]);

  const authValue = useMemo(() => ({ 
    user, token, socket, login, logout, refreshUser, apiFetch 
  }), [user, token, socket, login, logout, refreshUser, apiFetch]);

  useEffect(() => {
    if (!token) return;
    refreshUser();
  }, [token, refreshUser]);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }
    
    const newSocket = io();
    setSocket(newSocket);
    
    newSocket.emit('join', { id: user.id, name: user.name, role: user.role });

    if (user.role === 'STUDENT') {
      newSocket.on('new_live_question', (q) => {
        if (q.student_id === user.id) {
          setActiveLiveQuestion(q);
        }
      });
      newSocket.on('live_question_update', (q) => {
        if (activeLiveQuestionRef.current?.id === q.id) {
          if (q.status === 'EXPIRED' || q.status === 'GRADED') {
            setActiveLiveQuestion(null);
          }
        }
      });
      newSocket.on('lecture_ended', (data) => {
        setLectureEndedMessage(data.message);
      });
    }
    
    return () => { 
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user?.id, user?.role]);

  return (
    <AuthContext.Provider value={authValue}>
      <AnimatePresence>
        {lectureEndedMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex items-center justify-center p-6 text-center"
          >
            <div className="max-w-md space-y-6">
               <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                  <CheckCircle size={40} />
               </div>
               <h2 className="text-3xl font-black text-slate-900">{lectureEndedMessage}</h2>
               <p className="text-slate-500 font-medium">Leksioni përfundoi me sukses. Mund të ktheheni në dashboard.</p>
               <button 
                onClick={() => {
                  setLectureEndedMessage(null);
                  window.location.href = '/';
                }}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
               >
                 Kthehu në Dashboard
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {activeLiveQuestion && (
        <LiveQuestionModal 
          question={activeLiveQuestion} 
          onConfirm={() => {
            setActiveLiveQuestion(null);
            navigate('/live-questions');
          }} 
        />
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/attendance" element={<Layout><Attendance /></Layout>} />
        <Route path="/calendar" element={<Layout><Calendar /></Layout>} />
        <Route path="/tests" element={<Layout><Tests /></Layout>} />
        <Route path="/assignments" element={<Layout><Assignments /></Layout>} />
        <Route path="/live-questions" element={<Layout><LiveQuestions /></Layout>} />
        <Route path="/activities" element={<Layout><Activities /></Layout>} />
        <Route path="/screen-share" element={<Layout><ScreenShare /></Layout>} />
        <Route path="/chat" element={<Layout><Chat /></Layout>} />
        <Route path="/classroom" element={<Layout><Classroom /></Layout>} />
        <Route path="/classroom/hub" element={<ClassroomWorkspace />} />
        <Route path="/library" element={<Layout><Library /></Layout>} />
        <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
        <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthContext.Provider>
  );
}
