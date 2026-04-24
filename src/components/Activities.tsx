import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, Plus, Link as LinkIcon, FileText, Vote, 
  BookOpen, Trash2, CheckCircle2, XCircle, Users, 
  ExternalLink, File, PieChart, Send, Clock, Calendar,
  Smile, Gift, Heart, Info, X, MessageSquare
} from 'lucide-react';
import { useAuth } from '../App';

type ActivityType = 'INFO' | 'POLL' | 'DONATION';

interface Comment {
  id: string | number;
  user_id: string | number;
  user_name: string;
  user_photo?: string;
  comment: string;
  created_at: string;
}

interface Activity {
  id: string | number;
  user_id: string | number;
  user_name: string;
  user_role: string;
  user_photo?: string;
  is_president?: boolean;
  title: string;
  description: string;
  type: ActivityType;
  link_url?: string;
  file_url?: string;
  poll_options?: string[];
  item_type?: string;
  status: string;
  created_at: string;
  votes?: Record<string, number>;
  commentCount?: number;
}

const POLL_DEFAULT_OPTIONS = ['Po', 'Jo', 'Do të jem prezent', 'Nuk do të jem prezent'];

export default function Activities() {
  const { user, apiFetch } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'POLLS' | 'DONATIONS'>('ALL');
  
  // Comments state
  const [activeComments, setActiveComments] = useState<Record<string | number, Comment[]>>({});
  const [showComments, setShowComments] = useState<Record<string | number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string | number, string>>({});

  // Create state
  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    type: 'INFO' as ActivityType,
    link_url: '',
    file_url: '',
    item_type: '',
    poll_options: [...POLL_DEFAULT_OPTIONS]
  });

  const [pollOptionInput, setPollOptionInput] = useState('');

  const fetchActivities = async () => {
    try {
      const data = await apiFetch('/api/activities');
      if (data) setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify(newActivity)
      });
      if (result) {
        setShowCreateModal(false);
        setNewActivity({
          title: '',
          description: '',
          type: 'INFO',
          link_url: '',
          file_url: '',
          item_type: '',
          poll_options: [...POLL_DEFAULT_OPTIONS]
        });
        setPollOptionInput('');
        fetchActivities();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComments = async (activityId: string | number) => {
    try {
      const data = await apiFetch(`/api/activities/${activityId}/comments`);
      if (data) {
        setActiveComments(prev => ({ ...prev, [activityId]: data }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleComments = (activityId: string | number) => {
    const isShowing = !showComments[activityId];
    setShowComments(prev => ({ ...prev, [activityId]: isShowing }));
    if (isShowing) {
      fetchComments(activityId);
    }
  };

  const handlePostComment = async (activityId: string | number) => {
    const commentText = commentInputs[activityId];
    if (!commentText?.trim()) return;

    try {
      await apiFetch(`/api/activities/${activityId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment: commentText })
      });
      setCommentInputs(prev => ({ ...prev, [activityId]: '' }));
      fetchComments(activityId);
    } catch (err) {
      console.error(err);
    }
  };

  const addPollOption = () => {
    if (!pollOptionInput.trim()) return;
    if (newActivity.poll_options.includes(pollOptionInput.trim())) return;
    
    setNewActivity(prev => ({
      ...prev,
      poll_options: [...prev.poll_options, pollOptionInput.trim()]
    }));
    setPollOptionInput('');
  };

  const removePollOption = (index: number) => {
    setNewActivity(prev => ({
      ...prev,
      poll_options: prev.poll_options.filter((_, i) => i !== index)
    }));
  };

  const handleVote = async (activityId: string | number, optionIndex: number) => {
    try {
      await apiFetch(`/api/activities/${activityId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex })
      });
      fetchActivities();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (activityId: string | number, action: string) => {
    try {
      await apiFetch(`/api/activities/${activityId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      fetchActivities();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredActivities = activities.filter(a => {
    if (activeTab === 'POLLS') return a.type === 'POLL';
    if (activeTab === 'DONATIONS') return a.type === 'DONATION';
    return true;
  });

  const getVoteData = (activity: Activity) => {
    if (!activity.votes || !activity.poll_options) return null;
    const stats = activity.poll_options.map((_, i) => ({
      label: activity.poll_options![i],
      count: Object.values(activity.votes!).filter(v => v === i).length,
      percentage: 0
    }));
    const total = Object.keys(activity.votes).length;
    if (total > 0) {
      stats.forEach(s => s.percentage = Math.round((s.count / total) * 100));
    }
    return { stats, total, userVote: activity.votes[user.id.toString()] };
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Megaphone className="text-blue-600" size={36} />
            Aktivitete & Ngjarje
          </h1>
          <p className="text-slate-500 font-medium mt-1">Lajmet e fundit, votime dhe nisma studentore në universitet</p>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 italic"
        >
          <Plus size={20} />
          Shpërndaj diçka
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
        {(['ALL', 'POLLS', 'DONATIONS'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${
              activeTab === tab 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'ALL' ? 'Të gjitha' : tab === 'POLLS' ? 'Votime' : 'Donacione'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-[2.5rem]" />
            ))}
          </div>
        ) : filteredActivities.length > 0 ? (
          filteredActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-slate-200 transition-all group"
            >
              <div className="p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                        {activity.user_photo ? (
                          <img src={activity.user_photo} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-black text-slate-400">
                            {activity.user_name[0]}
                          </div>
                        )}
                      </div>
                      {activity.is_president && (
                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 p-1 rounded-lg border-2 border-white shadow-sm">
                          <Gift size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{activity.user_name}</span>
                        {activity.is_president && <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">President</span>}
                        {activity.user_role === 'TEACHER' && <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Profesor</span>}
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                        <Clock size={12} />
                        {new Date(activity.created_at).toLocaleDateString('sq-AL', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-2xl ${
                    activity.type === 'POLL' ? 'bg-purple-50 text-purple-600' :
                    activity.type === 'DONATION' ? 'bg-orange-50 text-orange-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {activity.type === 'POLL' ? <Vote size={20} /> :
                     activity.type === 'DONATION' ? <Heart size={20} /> :
                     <Megaphone size={20} />}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-4 mb-8">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{activity.title}</h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                </div>

                {/* Specific Type UI */}
                {activity.type === 'POLL' && activity.poll_options && (
                  <div className="bg-slate-50 p-6 rounded-3xl space-y-3 mb-6">
                    {getVoteData(activity)?.stats.map((opt, i) => {
                      const isUserVote = getVoteData(activity)?.userVote === i;
                      return (
                        <button
                          key={i}
                          onClick={() => handleVote(activity.id, i)}
                          className={`w-full relative h-14 rounded-2xl border-2 transition-all overflow-hidden flex items-center justify-between px-6 group ${
                            isUserVote 
                              ? 'border-blue-600 bg-blue-50' 
                              : 'border-white bg-white hover:border-slate-200 shadow-sm'
                          }`}
                        >
                          {/* Progress bar */}
                          <div 
                            className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isUserVote ? 'bg-blue-600/10' : 'bg-slate-100'}`}
                            style={{ width: `${opt.percentage}%` }}
                          />
                          <span className={`relative font-black z-10 ${isUserVote ? 'text-blue-700' : 'text-slate-600'}`}>
                            {opt.label}
                          </span>
                          <div className="relative z-10 flex items-center gap-3">
                            <span className={`text-sm font-black ${isUserVote ? 'text-blue-600' : 'text-slate-400'}`}>
                              {opt.count} ({opt.percentage}%)
                            </span>
                            {isUserVote && <CheckCircle2 size={18} className="text-blue-600" />}
                          </div>
                        </button>
                      );
                    })}
                    <div className="flex justify-between items-center px-2 pt-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gjithsej: {getVoteData(activity)?.total} vota</span>
                       <div className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                          <Info size={12} />
                          Klikoni për të votuar
                       </div>
                    </div>
                  </div>
                )}

                {activity.type === 'DONATION' && (
                  <div className="bg-orange-50/50 border-2 border-dashed border-orange-100 p-6 rounded-3xl mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl">
                         {activity.item_type === 'BOOK' ? <BookOpen size={24} /> : <Gift size={24} />}
                      </div>
                      <div>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-widest">Donacion: {activity.item_type}</span>
                        <h4 className="text-lg font-black text-slate-900">
                          {activity.status === 'CLOSED' ? 'E dhuruar' : 'Në pritje të dhurimit'}
                        </h4>
                      </div>
                    </div>
                    {activity.user_id.toString() === user.id.toString() && activity.status === 'OPEN' && (
                      <button 
                        onClick={() => handleAction(activity.id, 'CLOSE_DONATION')}
                        className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all text-xs"
                      >
                         Marko si të dhuruar
                      </button>
                    )}
                    {activity.status === 'CLOSED' && (
                      <div className="flex items-center gap-2 text-orange-600 font-black italic">
                        <CheckCircle2 size={24} />
                        FALEMINDERIT!
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {(activity.link_url || activity.file_url) && (
                  <div className="flex flex-wrap gap-3 mb-6">
                    {activity.link_url && (
                      <a 
                        href={activity.link_url.startsWith('http') ? activity.link_url : `https://${activity.link_url}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-3 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all font-bold text-sm"
                      >
                        <ExternalLink size={16} />
                        Linku i Shpërndarë
                      </a>
                    )}
                    {activity.file_url && (
                      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 text-slate-600 rounded-2xl border border-slate-100 font-bold text-sm">
                        <File size={16} />
                        Skedari i Bashkangjitur
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-50 flex items-center gap-6">
                  <button 
                    onClick={() => toggleComments(activity.id)}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-all"
                  >
                    <MessageSquare size={18} />
                    {showComments[activity.id] ? 'Mbyll komentet' : 'Komentet'}
                  </button>
                </div>

                {/* Comments Section */}
                <AnimatePresence>
                  {showComments[activity.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 space-y-4">
                        <div className="flex gap-3">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-slate-400 overflow-hidden">
                              {user.profile_photo ? <img src={user.profile_photo} className="w-full h-full object-cover" /> : user.name[0]}
                           </div>
                           <div className="flex-1 relative">
                             <input 
                               type="text"
                               placeholder="Shkruaj një koment..."
                               value={commentInputs[activity.id] || ''}
                               onChange={(e) => setCommentInputs(prev => ({ ...prev, [activity.id]: e.target.value }))}
                               onKeyDown={(e) => e.key === 'Enter' && handlePostComment(activity.id)}
                               className="w-full p-3 pr-12 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                             />
                             <button 
                               onClick={() => handlePostComment(activity.id)}
                               className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                             >
                                <Send size={16} />
                             </button>
                           </div>
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                           {activeComments[activity.id]?.map((cmt) => (
                             <div key={cmt.id} className="flex gap-3">
                                <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-slate-400 text-xs overflow-hidden">
                                   {cmt.user_photo ? <img src={cmt.user_photo} className="w-full h-full object-cover" /> : cmt.user_name[0]}
                                </div>
                                <div className="flex-1 bg-slate-50 p-4 rounded-2xl rounded-tl-none">
                                   <div className="flex items-center justify-between mb-1">
                                      <span className="font-black text-slate-900 text-xs">{cmt.user_name}</span>
                                      <span className="text-[10px] text-slate-400">{new Date(cmt.created_at).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}</span>
                                   </div>
                                   <p className="text-slate-600 text-sm">{cmt.comment}</p>
                                </div>
                             </div>
                           ))}
                           {(!activeComments[activity.id] || activeComments[activity.id].length === 0) && (
                             <p className="text-center py-4 text-xs font-black text-slate-400 uppercase tracking-widest italic">Nuk ka asnjë koment ende</p>
                           )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <Megaphone size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Asnjë aktivitet deri tani</h3>
            <p className="text-slate-400">Bëhu i pari që ndan diçka me komunitetin universitar.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Krijo Aktivitet të Ri</h2>
                  <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lloji i Postimit</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['INFO', 'POLL', 'DONATION'] as ActivityType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewActivity({ ...newActivity, type: t })}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                            newActivity.type === t 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                              : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200'
                          }`}
                        >
                          {t === 'INFO' ? <Megaphone size={20} /> : t === 'POLL' ? <Vote size={20} /> : <Gift size={20} />}
                          <span className="text-[10px] font-black uppercase">{t === 'INFO' ? 'Info' : t === 'POLL' ? 'Votim' : 'Dhurim'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Titulli i aktivitetit"
                      required
                      value={newActivity.title}
                      onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                      className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <textarea
                      placeholder="Përshkrimi i hollësishëm..."
                      required
                      rows={4}
                      value={newActivity.description}
                      onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                      className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none"
                    />
                  </div>

                  {newActivity.type === 'POLL' && (
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Opsionet e Votimit</label>
                      <div className="flex flex-wrap gap-2">
                        {newActivity.poll_options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
                            {opt}
                            <button type="button" onClick={() => removePollOption(i)} className="text-slate-400 hover:text-red-500">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Shto opsion të ri..."
                          value={pollOptionInput}
                          onChange={(e) => setPollOptionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPollOption())}
                          className="flex-1 p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                        />
                        <button 
                          type="button"
                          onClick={addPollOption}
                          className="px-6 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded-2xl transition-all"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Link (opsionale)"
                        value={newActivity.link_url}
                        onChange={(e) => setNewActivity({ ...newActivity, link_url: e.target.value })}
                        className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      />
                    </div>
                    {newActivity.type === 'DONATION' && (
                      <select
                        required
                        value={newActivity.item_type}
                        onChange={(e) => setNewActivity({ ...newActivity, item_type: e.target.value })}
                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold appearance-none cursor-pointer"
                      >
                        <option value="">Lloji i Donacionit</option>
                        <option value="BOOK">Libër</option>
                        <option value="OTHER">Tjetër</option>
                      </select>
                    )}
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-lg transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    Publiko Tani
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
