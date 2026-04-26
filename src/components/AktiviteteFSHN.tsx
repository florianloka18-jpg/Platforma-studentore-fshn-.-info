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
    content: '',
    type: 'pyetje',
    isImportant: false
  });
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    setFetching(true);
    const q = query(
      collection(db, 'student_activities'), 
      orderBy('created_at', 'desc'),
      limit(50)
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
    if (!newActivity.content.trim()) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'student_activities'), {
        user_id: auth.currentUser?.uid,
        author: {
          name: `${user.name} ${user.surname || ''}`.trim(),
          role: user.role.toLowerCase()
        },
        content: newActivity.content.trim(),
        type: newActivity.type,
        is_important: user.role === 'TEACHER' || user.role === 'admin' ? newActivity.isImportant : false,
        created_at: serverTimestamp(),
        likes_count: 0
      });

      setShowAddForm(false);
      setNewActivity({ content: '', type: 'pyetje', isImportant: false });
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
            <h3 className="text-xl font-black text-white tracking-tight">Aktivitetet FSHN</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.1em]">Një hapësirë akademike e përbashkët për diskutime dhe njoftime</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent text-[10px] font-black uppercase text-slate-400 outline-none px-4 cursor-pointer"
          >
            <option value="all" className="bg-slate-900">Të gjitha</option>
            <option value="njoftim" className="bg-slate-900">Njoftime</option>
            <option value="detyrë" className="bg-slate-900">Detyra</option>
            <option value="material" className="bg-slate-900">Materiale</option>
            <option value="pyetje" className="bg-slate-900">Pyetje</option>
          </select>
          
          <div className="w-px h-8 bg-white/10 mx-1" />

          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
              showAddForm ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-indigo-600 text-white hover:bg-emerald-700'
            }`}
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? 'Anulo' : 'Posto'}
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
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lloji i Postimit</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'njoftim', label: 'NJOFTIM', color: 'bg-indigo-500' },
                        { id: 'detyrë', label: 'DETYRË', color: 'bg-rose-500' },
                        { id: 'material', label: 'MATERIAL', color: 'bg-emerald-500' },
                        { id: 'pyetje', label: 'PYETJE', color: 'bg-amber-500' }
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
                  {(user.role === 'TEACHER' || user.role === 'admin') && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opsione</label>
                      <button
                        type="button"
                        onClick={() => setNewActivity({...newActivity, isImportant: !newActivity.isImportant})}
                        className={`w-full py-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                          newActivity.isImportant ? 'bg-rose-50 text-rose-600 border-2 border-rose-100' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <AlertCircle size={16} /> Mark si i Rëndësishëm
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Përmbajtja</label>
                  <textarea 
                    required
                    maxLength={1000}
                    value={newActivity.content}
                    onChange={(e) => setNewActivity({...newActivity, content: e.target.value})}
                    rows={4}
                    placeholder="Shkruani mesazhin tuaj këtu..."
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-slate-300"
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-12 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-sm font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    POSTO TANI
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-6">
        <AnimatePresence mode="popLayout">
          {activities
            .filter(act => filter === 'all' || act.type === filter)
            .map((act) => (
              <ActivityCard 
                key={act.id} 
                act={act} 
                user={user} 
                handleDelete={handleDelete}
              />
            ))}
        </AnimatePresence>
        
        {activities.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200"
          >
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner mb-6">
              <Zap size={32} className="opacity-20 text-indigo-600" />
            </div>
            <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">
              Nuk ka aktivitete në FSHN akoma.
            </p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Bëhu i pari që poston!</p>
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
    const commentsQuery = collection(db, 'student_activities', act.id, 'comments');
    const commentsUnsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const sortedComments = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
          const timeA = a.created_at?.toDate?.()?.getTime() || 0;
          const timeB = b.created_at?.toDate?.()?.getTime() || 0;
          return timeA - timeB;
        });
      setComments(sortedComments);
    }, (err) => {
      console.error("Error listening to comments:", err);
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

      // Notification logic
      if (act.user_id !== auth.currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          user_id: act.user_id,
          title: 'Pelqim i ri',
          content: `${user.name} bëri like postimin tuaj.`,
          type: 'LIKE',
          is_read: false,
          created_at: serverTimestamp()
        });
      }
    }
  };

  // Standardized error handler for Firestore
  const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    return new Error(JSON.stringify(errInfo));
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !auth.currentUser) return;
    setCommentLoading(true);

    const path = `student_activities/${act.id}/comments`;
    try {
      const commentData = {
        user_id: auth.currentUser.uid,
        user_name: `${user.name} ${user.surname || ''}`.trim(),
        content: newComment.trim(),
        created_at: serverTimestamp()
      };
      
      await addDoc(collection(db, 'student_activities', act.id, 'comments'), commentData);

      // Notification logic
      if (act.user_id !== auth.currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          user_id: act.user_id,
          title: 'Koment i ri',
          content: `${user.name} komentoi në postimin tuaj.`,
          type: 'COMMENT',
          is_read: false,
          created_at: serverTimestamp()
        }).catch(err => console.warn("Notification failed, but comment was added:", err));
      }
      setNewComment('');
    } catch (err: any) {
      const formattedError = handleFirestoreError(err, 'create', path);
      console.error(formattedError);
      alert("Dështoi shtimi i komentit. Ju lutem kontrolloni të drejtat tuaja.");
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    const path = `student_activities/${act.id}/comments/${commentId}`;
    try {
      await deleteDoc(doc(db, 'student_activities', act.id, 'comments', commentId));
    } catch (err: any) {
      handleFirestoreError(err, 'delete', path);
      alert("Gabim gjatë fshirjes së komentit.");
    }
  };

  const hasLiked = auth.currentUser ? likes.includes(auth.currentUser.uid) : false;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className={`group bg-white rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden flex flex-col border-2 ${
        act.is_important ? 'border-rose-100 shadow-rose-100' : 'border-slate-100'
      }`}
    >
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2 ${
          act.type === 'njoftim' ? 'bg-indigo-50 text-indigo-600' : 
          act.type === 'detyrë' ? 'bg-rose-50 text-rose-600' : 
          act.type === 'material' ? 'bg-emerald-50 text-emerald-600' :
          'bg-amber-50 text-amber-600'
        }`}>
          {act.is_important && <AlertCircle size={10} className="text-rose-600" />}
          {act.type}
        </div>
        
        {(act.user_id === auth.currentUser?.uid || user.role === 'admin' || user.role === 'TEACHER') && (
          <button 
            onClick={() => handleDelete(act.id)}
            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="mb-4 relative z-10 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all">
            <UserIcon size={14} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-900 leading-none capitalize">{act.author?.name || act.user_name || 'Academic FSHN'}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{act.author?.role || 'Sistemi'}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 font-medium leading-relaxed mb-4 whitespace-pre-wrap">{act.content}</p>
      </div>
      
      <div className="flex items-center justify-between py-4 border-t border-slate-50 relative z-10">
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

        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="text-[9px] text-slate-400 font-bold">{act.created_at?.toDate?.() ? act.created_at.toDate().toLocaleDateString('sq-AL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sapo'}</p>
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
            <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-3 pt-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-slate-50 p-3 rounded-2xl relative group/comment">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">{comment.user_name}</span>
                    {(comment.user_id === auth.currentUser?.uid || user.role === 'admin' || user.role === 'TEACHER') && (
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

            <form onSubmit={handleAddComment} className="relative pb-2">
              <input 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Shkruaj një koment..."
                maxLength={500}
                className="w-full pl-4 pr-10 py-3 bg-slate-100 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
              />
              <button 
                type="submit"
                disabled={commentLoading || !newComment.trim()}
                className="absolute right-2 top-[calc(50%-4px)] -translate-y-1/2 p-1.5 text-indigo-600 disabled:opacity-30"
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
