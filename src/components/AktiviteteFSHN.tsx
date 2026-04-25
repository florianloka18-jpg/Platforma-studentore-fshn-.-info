import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Plus, X, Trash2, Calendar as CalendarIcon, Heart, BarChart3, User as UserIcon, Archive, AlertCircle, Loader2,
  MessageSquare, ExternalLink, Send
} from 'lucide-react';
import { 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  setDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User } from '../types';

export const AktiviteteFSHN = ({ user }: { user: User }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewArchive, setViewArchive] = useState(false);
  const [newActivity, setNewActivity] = useState({
    title: '',
    content: '',
    type: 'EVENT',
    duration: 'DAY',
    link: ''
  });

  useEffect(() => {
    setFetching(true);
    const q = query(
      collection(db, 'student_activities'), 
      orderBy('created_at', 'desc'),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(docs);
      setFetching(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching activities:", err);
      setError("Dështoi ngarkimi i aktiviteteve. Ju lutem kontrolloni lidhjen.");
      setFetching(false);
    });

    return () => unsubscribe();
  }, []);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const todayActivities = activities.filter(act => {
    const createdAt = act.created_at instanceof Timestamp ? act.created_at.toDate() : new Date(act.created_at || Date.now());
    const expiresAt = act.expires_at instanceof Timestamp ? act.expires_at.toDate() : new Date(act.expires_at || Date.now());
    // Active if created today AND hasn't expired yet
    return isToday(createdAt) && expiresAt > new Date();
  });

  const archivedActivities = activities.filter(act => {
    const createdAt = act.created_at instanceof Timestamp ? act.created_at.toDate() : new Date(act.created_at || Date.now());
    const expiresAt = act.expires_at instanceof Timestamp ? act.expires_at.toDate() : new Date(act.expires_at || Date.now());
    // Archived if NOT created today OR has already expired
    return !isToday(createdAt) || expiresAt <= new Date();
  });

  const currentDisplay = viewArchive ? archivedActivities : todayActivities;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.title.trim() || !newActivity.content.trim()) return;
    setLoading(true);

    try {
      const now = new Date();
      const expiresAt = new Date();
      
      switch (newActivity.duration) {
        case 'HOUR': expiresAt.setHours(now.getHours() + 1); break;
        case 'DAY': expiresAt.setDate(now.getDate() + 1); break;
        case 'WEEK': expiresAt.setDate(now.getDate() + 7); break;
        case 'MONTH': expiresAt.setMonth(now.getMonth() + 1); break;
      }

      await addDoc(collection(db, 'student_activities'), {
        user_id: auth.currentUser?.uid,
        user_name: `${user.name} ${user.surname}`,
        title: newActivity.title.trim(),
        content: newActivity.content.trim(),
        type: newActivity.type,
        duration: newActivity.duration,
        link: newActivity.link.trim() || null,
        created_at: serverTimestamp(),
        expires_at: expiresAt
      });

      setShowAddForm(false);
      setNewActivity({ title: '', content: '', type: 'EVENT', duration: 'DAY', link: '' });
    } catch (err) {
      console.error("Error adding activity:", err);
      alert("Gabim gjatë publikimit. Provoni përsëri.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("A jeni të sigurt që dëshironi të fshini këtë postim?")) return;
    try {
      await deleteDoc(doc(db, 'student_activities', id));
    } catch (err) {
      console.error("Error deleting activity:", err);
      alert("Gabim gjatë fshirjes.");
    }
  };

  if (fetching && activities.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-xl">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="ml-3 text-white font-bold tracking-widest uppercase text-xs">Po ngarkohen njoftimet...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 mb-10 overflow-hidden">
      {error && (
        <div className="bg-rose-500/20 border border-rose-500/50 text-rose-200 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Zap size={24} fill="currentColor" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Aktivitete FSHN</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Platforma Sociale Studentore</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setViewArchive(false)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              !viewArchive ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sot {todayActivities.length > 0 && `(${todayActivities.length})`}
          </button>
          <button 
            onClick={() => setViewArchive(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewArchive ? 'bg-slate-700 text-white shadow-xl' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive size={14} />
            Arkiva
          </button>
          
          <div className="w-px h-8 bg-white/10 mx-1" />

          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
              showAddForm ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? 'Anulo' : 'Publiko'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 mb-6">
              <form onSubmit={handleAdd} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titulli i Aktivitetit</label>
                    <input 
                      required
                      maxLength={60}
                      value={newActivity.title}
                      onChange={(e) => setNewActivity({...newActivity, title: e.target.value})}
                      placeholder="Psh: Turneu i Shahut, Grumbullim Ndihmash..."
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategoria</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'EVENT', label: 'NGJARJE', color: 'bg-orange-500' },
                        { id: 'DONATION', label: 'DONACION', color: 'bg-rose-500' },
                        { id: 'POLL', label: 'SONDAZH', color: 'bg-blue-500' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setNewActivity({...newActivity, type: t.id})}
                          className={`py-3 rounded-2xl text-[10px] font-black tracking-tighter transition-all relative overflow-hidden ${
                            newActivity.type === t.id 
                            ? 'bg-slate-900 text-white shadow-xl scale-[0.98]' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {newActivity.type === t.id && (
                            <motion.div 
                              layoutId="active-cat"
                              className={`absolute bottom-0 left-0 right-0 h-1 ${t.color}`}
                            />
                          )}
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Përshkrimi i Hollësishëm</label>
                  <textarea 
                    required
                    maxLength={500}
                    value={newActivity.content}
                    onChange={(e) => setNewActivity({...newActivity, content: e.target.value})}
                    rows={4}
                    placeholder="Shkruani detajet këtu (data, ora, vendndodhja)..."
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-slate-300"
                  />
                  <p className="text-[10px] text-right text-slate-400 font-bold">{newActivity.content.length}/500</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link i Jashtëm (Opsionale)</label>
                  <input 
                    type="url"
                    value={newActivity.link}
                    onChange={(e) => setNewActivity({...newActivity, link: e.target.value})}
                    placeholder="https://example.com/me-shume-info"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
                   <div className="flex items-center gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kohëzgjatja</label>
                        <select 
                          value={newActivity.duration}
                          onChange={(e) => setNewActivity({...newActivity, duration: e.target.value})}
                          className="w-full md:w-32 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 transition-all cursor-pointer"
                        >
                          <option value="HOUR">1 Orë</option>
                          <option value="DAY">1 Ditë</option>
                          <option value="WEEK">1 Javë</option>
                          <option value="MONTH">1 Muaj</option>
                        </select>
                      </div>
                      <div className="hidden md:block w-px h-12 bg-slate-100" />
                      <div className="flex items-center gap-3">
                         <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <UserIcon size={20} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Publikuesi</p>
                            <p className="text-sm font-bold text-slate-900 mt-1">{user.name} {user.surname}</p>
                         </div>
                      </div>
                   </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-sm font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        DUKE PUBLIKUAR...
                      </div>
                    ) : 'PUBLIKO NJOFTIMIN'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
        <AnimatePresence mode="popLayout">
          {currentDisplay.map((act) => (
            <ActivityCard 
              key={act.id} 
              act={act} 
              user={user} 
              handleDelete={handleDelete}
              viewArchive={viewArchive} 
            />
          ))}
        </AnimatePresence>
        
        {currentDisplay.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200"
          >
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner mb-6">
              <Zap size={32} className="opacity-20 text-indigo-600" />
            </div>
            <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">
              {viewArchive ? 'Arkiva është e zbrazët' : 'Nuk ka aktivitete për sot'}
            </p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Krijo një njoftim të ri për të nisur rrjedhën</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const ActivityCard = ({ act, user, handleDelete, viewArchive }: any) => {
  const [likes, setLikes] = useState<string[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    // Listen for likes
    const likesUnsubscribe = onSnapshot(collection(db, 'student_activities', act.id, 'likes'), (snapshot) => {
      setLikes(snapshot.docs.map(doc => doc.id));
    });

    // Listen for comments
    const commentsQuery = query(collection(db, 'student_activities', act.id, 'comments'), orderBy('created_at', 'asc'));
    const commentsUnsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      likesUnsubscribe();
      commentsUnsubscribe();
    };
  }, [act.id]);

  const toggleLike = async () => {
    if (!auth.currentUser) return;
    const likeRef = doc(db, 'student_activities', act.id, 'likes', auth.currentUser.uid);
    
    if (likes.includes(auth.currentUser.uid)) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, {
        user_id: auth.currentUser.uid,
        created_at: serverTimestamp()
      });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !auth.currentUser) return;
    setCommentLoading(true);

    try {
      await addDoc(collection(db, 'student_activities', act.id, 'comments'), {
        user_id: auth.currentUser.uid,
        user_name: `${user.name} ${user.surname}`,
        content: newComment.trim(),
        created_at: serverTimestamp()
      });
      setNewComment('');
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'student_activities', act.id, 'comments', commentId));
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  const hasLiked = auth.currentUser ? likes.includes(auth.currentUser.uid) : false;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className={`group bg-white rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden flex flex-col border border-slate-100 ${viewArchive ? 'opacity-80 grayscale-[0.3]' : ''}`}
    >
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase ${
          act.type === 'EVENT' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
          act.type === 'DONATION' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 
          'bg-blue-50 text-blue-600 border border-blue-100'
        }`}>
          {act.type}
        </div>
        
        {act.user_id === auth.currentUser?.uid && (
          <button 
            onClick={() => handleDelete(act.id)}
            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="mb-4 relative z-10 flex-1">
        <h4 className="text-sm font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors uppercase leading-tight line-clamp-2">{act.title}</h4>
        <p className="text-[11px] text-slate-500 font-medium line-clamp-3 leading-relaxed mb-4">{act.content}</p>
        
        {act.link && (
          <a 
            href={act.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all mb-4"
          >
            <ExternalLink size={12} />
            Më shumë informacion
          </a>
        )}
      </div>
      
      <div className="flex items-center justify-between py-4 border-y border-slate-50 relative z-10 mb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLike}
            className={`flex items-center gap-1.5 transition-all ${
              hasLiked ? 'text-rose-500 font-bold' : 'text-slate-400 hover:text-rose-500'
            }`}
          >
            <Heart size={18} fill={hasLiked ? "currentColor" : "none"} />
            <span className="text-[11px] font-black">{likes.length}</span>
          </button>
          
          <button 
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 transition-all ${
              showComments ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
            }`}
          >
            <MessageSquare size={18} />
            <span className="text-[11px] font-black">{comments.length}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-900 truncate max-w-[80px]">{act.user_name}</p>
            <p className="text-[9px] text-slate-400 font-bold">{act.created_at?.toDate?.() ? act.created_at.toDate().toLocaleDateString('sq-AL', { day: '2-digit', month: 'short' }) : 'Sapo'}</p>
          </div>
          <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
            <UserIcon size={14} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-4"
          >
            <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-slate-50 p-3 rounded-2xl relative group/comment">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">{comment.user_name}</span>
                    {comment.user_id === auth.currentUser?.uid && (
                      <button 
                        onClick={() => deleteComment(comment.id)}
                        className="opacity-0 group-hover/comment:opacity-100 text-rose-500 hover:text-rose-600 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{comment.content}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-[10px] text-slate-400 text-center py-4 font-bold uppercase tracking-widest">Nuk ka komente ende</p>
              )}
            </div>

            <form onSubmit={handleAddComment} className="relative">
              <input 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Shkruaj një koment..."
                className="w-full pl-4 pr-10 py-3 bg-slate-100 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
              />
              <button 
                type="submit"
                disabled={commentLoading || !newComment.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-600 disabled:opacity-30"
              >
                {commentLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative elements */}
      <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity ${
         act.type === 'EVENT' ? 'bg-orange-500' : 
         act.type === 'DONATION' ? 'bg-rose-500' : 
         'bg-blue-500'
      }`} />
    </motion.div>
  );
};
