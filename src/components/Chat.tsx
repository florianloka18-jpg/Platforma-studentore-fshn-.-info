import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Hash, Search, MoreVertical, MessageSquare, Paperclip, File, Image as ImageIcon, X, CheckCircle, Play, Users } from 'lucide-react';
import MotionLogo from './MotionLogo';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';
import { useAuth } from '../App';

export default function Chat({ overrideClassId }: { overrideClassId?: string }) {
  const { user, apiFetch, socket } = useAuth();
  const [searchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const storedClassId = user.role === 'TEACHER' ? localStorage.getItem('teacher_selected_class_id') : null;
  const [internalClassId, setInternalClassId] = useState<string | null>(overrideClassId || classIdFromUrl || storedClassId);
  const classId = internalClassId;

  const [memberSearch, setMemberSearch] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [chatType, setChatType] = useState<'CLASS' | 'SCHOOL' | 'PRIVATE' | 'TEACHER'>(overrideClassId ? 'CLASS' : 'CLASS');
  const [receiverId, setReceiverId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [classMembers, setClassMembers] = useState<any[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const BANNED_WORDS = ['budalla', 'idiot', 'pis', 'rrugaç', 'shëmtuar']; // Simplified list

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId) {
      const rId = parseInt(userId);
      setChatType('PRIVATE');
      setReceiverId(rId);
      fetchUserInfo(rId);
    }
  }, [searchParams]);

  const fetchUserInfo = async (id: number) => {
    try {
      const data = await apiFetch(`/api/users/${id}`);
      setSelectedUser(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchClassMembers();
    if (user.role === 'TEACHER' && !overrideClassId) {
      fetchTeacherClasses();
    }
    
    if (!socket) return;

    const s = socket;
    if (classId) {
      s.emit('join_class', classId);
    }

    const h1 = (msg: any) => {
      setMessages(prev => {
        // Remove optimistic version if it exists via clientSideId or content match
        const filtered = prev.filter(m => 
          !(m as any).isOptimistic || 
          (msg.clientSideId && (m as any).clientSideId === msg.clientSideId) ||
          (m.sender_id === msg.sender_id && m.content === msg.content)
        );

        // Deduplicate: Don't add if message already exists with same ID or content/timestamp
        if (filtered.some(m => 
          (m.id && m.id === msg.id) || 
          (msg.clientSideId && (m as any).clientSideId === msg.clientSideId) ||
          (m.timestamp === msg.timestamp && m.sender_id === msg.sender_id && m.content === msg.content)
        )) {
          return filtered;
        }

        if (msg.chatType === chatType) {
          if (chatType === 'PRIVATE') {
            if ((msg.sender_id === user.id && msg.receiver_id === receiverId) ||
                (msg.sender_id === receiverId && msg.receiver_id === user.id)) {
              return [...prev, msg];
            }
          } else if (chatType === 'CLASS') {
             if (classId && msg.class_id && msg.class_id.toString() !== classId.toString()) {
               return prev;
             }
             return [...prev, msg];
          } else {
            return [...prev, msg];
          }
        }
        return prev;
      });
    };

    const h2 = (onlineUsers: any[]) => {
      const onlineIds = new Set(onlineUsers.map(u => u.id));
      setClassMembers(prev => prev.map(m => ({
        ...m,
        isOnline: onlineIds.has(m.id)
      })));
    };

    s.on('new_message', h1);
    s.on('user_status', h2);

    return () => {
      s.off('new_message', h1);
      s.off('user_status', h2);
    };
  }, [user?.id, socket, classId, chatType, receiverId]);

  const fetchClassMembers = async () => {
    try {
      const url = classId ? `/api/classes/${classId}/students` : '/api/class/members';
      const data = await apiFetch(url);
      setClassMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setClassMembers([]);
    }
  };

  const fetchTeacherClasses = async () => {
    try {
      const data = await apiFetch('/api/classes');
      setTeacherClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const selectClass = (id: string | number) => {
    const cid = id.toString();
    setInternalClassId(cid);
    setChatType('CLASS');
    localStorage.setItem('teacher_selected_class_id', cid);
    setShowSidebar(false);
  };

  const fetchMessages = async () => {
    try {
      let url = chatType === 'PRIVATE' 
        ? `/api/chat/messages?type=PRIVATE&receiverId=${receiverId}`
        : `/api/chat/messages?type=${chatType}`;
      
      if (chatType === 'CLASS' && classId) {
        url += `&classId=${classId}`;
      }
      
      const data = await apiFetch(url);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error(e);
      setMessages([]);
    }
  };

  const filterProfanity = (text: string) => {
    let filtered = text;
    BANNED_WORDS.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '***');
    });
    return filtered;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || !socket) return;

    setIsUploading(true);
    let fileUrl = '';
    let fileName = '';
    let fileType = '';

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await apiFetch('/api/chat/upload', {
          method: 'POST',
          body: formData
        });
        fileUrl = uploadRes.url;
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }

      const filteredContent = filterProfanity(input);

      const optimisticMsg: any = {
        id: 'opt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        clientSideId: 'opt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        sender_id: user.id,
        receiver_id: chatType === 'PRIVATE' ? receiverId : null,
        class_id: chatType === 'CLASS' ? classId : null,
        sender_name: `${user.name} ${user.surname || ''}`.trim(),
        sender_photo: user.profile_photo,
        sender_role: user.role,
        content: filteredContent,
        chat_type: chatType,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        timestamp: new Date().toISOString(),
        isOptimistic: true
      };

      // Faster local update
      setMessages(prev => [...prev, optimisticMsg]);
      setInput('');
      setSelectedFile(null);
      setTimeout(scrollToBottom, 50);

      socket.emit('send_message', {
        ...optimisticMsg,
        senderId: user.id,
        receiverId: optimisticMsg.receiver_id,
        classId: optimisticMsg.class_id,
        senderName: optimisticMsg.sender_name,
        senderPhoto: optimisticMsg.sender_photo,
        chatType: optimisticMsg.chat_type,
        fileUrl: optimisticMsg.file_url,
        fileName: optimisticMsg.file_name,
        fileType: optimisticMsg.file_type,
        clientSideId: optimisticMsg.clientSideId
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Gabim gjatë dërgimit të mesazhit.");
    } finally {
      setIsUploading(false);
    }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString('sq-AL', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="h-[calc(100vh-13rem)] md:h-[calc(100vh-12rem)] flex bg-[#f0f2f5] rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSidebar(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <div className={`
        absolute md:relative inset-y-0 left-0 w-80 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <MotionLogo size="md" src={user.profile_photo} />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{user.name}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aktiv</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
              <MessageSquare size={20} />
            </button>
            <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Kërko shokët e klasës..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 border border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-2 space-y-1">
            {user.role === 'STUDENT' ? (
              <button 
                onClick={() => { setChatType('CLASS'); setShowSidebar(false); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${chatType === 'CLASS' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Hash size={24} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 truncate">
                      {overrideClassId ? 'Chat i Klasës (Live)' : `Klasa ${user.program}`}
                    </span>
                    <span className="text-[10px] text-slate-400">Tani</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {overrideClassId ? 'Komunikimi në këtë sesion' : 'Chat-i i klasës suaj'}
                  </p>
                </div>
              </button>
            ) : (
              // Teacher Workspace Selection in Chat
              !overrideClassId && (
                <button 
                  onClick={() => { setChatType('TEACHER'); setShowSidebar(false); }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${chatType === 'TEACHER' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0">
                    <Users size={24} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 truncate">Teacher Chat</span>
                      <span className="text-[10px] text-slate-400">Tani</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">Biseda mes pedagogëve</p>
                  </div>
                </button>
              )
            )}
            
            {(user.role === 'TEACHER' && overrideClassId) && (
               <button 
                 onClick={() => { setChatType('CLASS'); setShowSidebar(false); }}
                 className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${chatType === 'CLASS' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
               >
                 <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                   <Hash size={24} />
                 </div>
                 <div className="flex-1 text-left min-w-0">
                   <div className="flex justify-between items-center">
                     <span className="font-bold text-slate-900 truncate">Chat i Klasës</span>
                     <span className="text-[10px] text-slate-400">Tani</span>
                   </div>
                   <p className="text-xs text-slate-500 truncate">Komunikimi në këtë grup</p>
                 </div>
               </button>
            )}

            {!overrideClassId && (
              <button 
                onClick={() => { setChatType('SCHOOL'); setShowSidebar(false); }}
                className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${chatType === 'SCHOOL' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Hash size={24} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900 truncate">FSHN Chat</span>
                    <span className="text-[10px] text-slate-400">Tani</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Chat-i i shkollës</p>
                </div>
              </button>
            )}
          </div>

          {(user.role === 'STUDENT' || overrideClassId) && (
            <div className="mt-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 px-5 font-mono">Studentët e Klasës</h4>
              <div className="space-y-0.5">
                {classMembers
                  .filter(m => `${m.name} ${m.surname}`.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((member) => (
                    <div 
                      key={member.id} 
                      onClick={() => {
                        if (member.id === user.id) return;
                        setChatType('PRIVATE');
                        setReceiverId(member.id);
                        setSelectedUser(member);
                        setShowSidebar(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-5 py-3 transition-colors cursor-pointer ${receiverId === member.id && chatType === 'PRIVATE' ? 'bg-blue-50 border-r-4 border-blue-600' : 'hover:bg-slate-50'}`}
                    >
                    <div className="relative flex-shrink-0">
                      <MotionLogo size="md" src={member.profile_photo} />
                      {member.isOnline && (
                        <div className="absolute right-0 bottom-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-slate-100 pb-3">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-slate-900 truncate">{member.name} {member.surname}</p>
                        {member.isOnline && <span className="text-[10px] text-green-500 font-bold">Online</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate uppercase tracking-tighter font-medium">
                        {member.role === 'TEACHER' ? 'Pedagog' : member.is_admin ? 'President' : 'Student'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#e5ddd5] w-full min-w-0 relative">
        {/* WhatsApp Style Background Pattern */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]"></div>

        <div className="p-3 md:px-4 bg-[#f0f2f5] border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3 min-w-0">
            {chatType === 'PRIVATE' && (
              <button 
                onClick={() => setChatType('CLASS')}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex items-center gap-1 group"
                title="Kthehu te Klasa"
              >
                <Users size={20} className="group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline text-xs font-bold">Klasa</span>
              </button>
            )}
            <button 
              onClick={() => setShowSidebar(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
            >
              <MoreVertical size={20} className="rotate-90" />
            </button>
            <div className="relative">
              <MotionLogo size="md" src={chatType === 'PRIVATE' ? selectedUser?.profile_photo : undefined} />
              {chatType !== 'PRIVATE' && (
                <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center text-white">
                  <Hash size={20} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate text-sm md:text-base">
                {chatType === 'CLASS' ? (
                  user.role === 'STUDENT' ? `Klasa ${user.program}` : 
                  (teacherClasses.find(c => c.id.toString() === classId?.toString())?.name || 'Chat-i i Klasës')
                ) : 
                chatType === 'SCHOOL' ? 'FSHN School Chat' : 
                chatType === 'TEACHER' ? 'Teacher Chat Hub' :
                selectedUser ? `${selectedUser.name} ${selectedUser.surname}` : 'Bisedë Private'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {chatType === 'PRIVATE' && selectedUser?.isOnline ? 'Aktiv tani' : 'Kliko për info'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
              <Search size={20} />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:px-12 md:py-6 space-y-4 custom-scrollbar relative z-0">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-60">
              <div className="p-6 bg-white rounded-full shadow-sm border border-slate-100">
                <MessageSquare size={40} />
              </div>
              <p className="text-sm font-medium bg-white/80 px-4 py-2 rounded-full shadow-sm">Mesazhet janë të enkriptuara</p>
            </div>
          )}
          
          {Object.entries(messageGroups).map(([date, groupMsgs]) => (
            <div key={date} className="space-y-4">
              <div className="flex justify-center my-4">
                <span className="bg-[#d1d7db] text-[#54656f] text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase shadow-sm">
                  {date}
                </span>
              </div>
              
              {groupMsgs.map((msg, i) => {
                const isMe = msg.sender_id === user.id;
                const showTail = i === 0 || groupMsgs[i-1].sender_id !== msg.sender_id;
                
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className={`relative max-w-[85%] sm:max-w-[65%] p-2 rounded-xl shadow-sm ${
                      isMe 
                        ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none'
                    } ${(msg as any).isOptimistic ? 'opacity-70' : ''}`}>
                      {/* Tail effect */}
                      {showTail && (
                        <div className={`absolute top-0 w-2 h-2 ${isMe ? '-right-1.5 bg-[#dcf8c6]' : '-left-1.5 bg-white'}`} 
                             style={{ clipPath: isMe ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(100% 0, 100% 100%, 0 0)' }}>
                        </div>
                      )}

                      <div className="px-1 p-1">
                        {!isMe && chatType !== 'PRIVATE' && (
                          <div className="flex items-center gap-1.5 mb-1 opacity-80">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                              {msg.sender_name}
                            </span>
                          </div>
                        )}
                        
                        {msg.content && (
                          (() => {
                            const isLiveLink = msg.content.includes('/screen-share?join=true');
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            
                            if (isLiveLink) {
                              const match = msg.content.match(urlRegex);
                              const fullUrl = match ? match[0] : '';
                              const relativeUrl = fullUrl.replace(window.location.origin, '');
                              
                              return (
                                <div className="flex flex-col gap-2">
                                  <p className="text-[13.5px] leading-relaxed break-words whitespace-pre-wrap">{msg.content.split('https://')[0]}</p>
                                  <Link 
                                    to={relativeUrl}
                                    className="flex items-center justify-center gap-2 py-2 px-4 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-md group"
                                  >
                                    <Play size={18} className="group-hover:scale-110 transition-transform" />
                                    <span>BASHKOHU LIVE TANI</span>
                                  </Link>
                                </div>
                              );
                            }

                            const parts = msg.content.split(urlRegex);
                            return (
                              <p className="text-[13.5px] leading-relaxed break-words whitespace-pre-wrap text-[#111b21]">
                                {parts.map((part, index) => 
                                  urlRegex.test(part) ? (
                                    <a 
                                      key={index} 
                                      href={part} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline break-all"
                                    >
                                      {part}
                                    </a>
                                  ) : (
                                    part
                                  )
                                )}
                              </p>
                            );
                          })()
                        )}
                        
                        {msg.file_url && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-black/5 bg-black/5">
                            {msg.file_type?.startsWith('image/') ? (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={msg.file_url} 
                                  alt="Uploaded" 
                                  className="max-w-full rounded-lg max-h-80 object-cover mx-auto"
                                  referrerPolicy="no-referrer"
                                />
                              </a>
                            ) : (
                              <a 
                                href={msg.file_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3"
                              >
                                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                                  <File size={20} className="text-slate-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold truncate text-slate-800">{msg.file_name || 'Skedar'}</p>
                                  <p className="text-[10px] text-slate-500 uppercase font-black">Shkarko</p>
                                </div>
                              </a>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between gap-4 mt-2 border-t border-black/5 pt-1.5 px-0.5">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter leading-none mb-0.5">
                                {msg.sender_name}
                              </span>
                              <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-[0.1em] w-fit leading-none ${
                                msg.sender_role === 'TEACHER' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {msg.sender_role === 'TEACHER' ? 'Pedagog' : 'Student'}
                              </span>
                            </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              <div className="flex text-blue-400 scale-[0.8] origin-right">
                                <CheckCircle size={12} className="-mr-1.5" />
                                <CheckCircle size={12} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {!isUploading && (
          <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 relative z-10">
            <AnimatePresence>
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-3 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      {selectedFile.type.startsWith('image/') ? <ImageIcon size={18} /> : <File size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
              >
                <Paperclip size={22} />
              </button>
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Shkruani një mesazh..."
                  className="w-full p-3 bg-white rounded-xl text-sm outline-none border-none shadow-sm placeholder:text-slate-400"
                />
              </div>
              <button 
                disabled={(!input.trim() && !selectedFile) || isUploading}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shadow-sm ${
                  (!input.trim() && !selectedFile) ? 'bg-slate-400' : 'bg-[#00a884] hover:bg-[#008f72]'
                } text-white`}
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
