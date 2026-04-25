import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, MonitorOff, Users, Play, Square, Send,
  Video, VideoOff, ScreenShare as ScreenShareIcon,
  Smartphone, Camera, Wifi, WifiOff, AlertCircle,
  Check, Hash, Mic, MicOff, Settings, X, Maximize,
  Minimize, MoreVertical, Hand, MessageCircle
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../App';
import { AktiviteteFSHN } from './AktiviteteFSHN';

export default function ScreenShare({ overrideClassId }: { overrideClassId?: string | number }) {
  const { user, token, apiFetch, socket } = useAuth();
  const [searchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const classIdFromProp = overrideClassId?.toString();
  const storedClassId = user.role === 'TEACHER' ? localStorage.getItem('teacher_selected_class_id') : null;
  
  const [isSharing, setIsSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modeRef = useRef<'SCREEN' | 'CAMERA'>('SCREEN');
  const [mode, setMode] = useState<'SCREEN' | 'CAMERA'>('SCREEN');
  const [classId, setClassId] = useState<string | null>(classIdFromProp || classIdFromUrl || storedClassId);
  const [isLive, setIsLive] = useState(false);
  const [inMeeting, setInMeeting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Pa lidhur');
  const [error, setError] = useState<string | null>(null);
  const [currentClass, setCurrentClass] = useState<any>(null);
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(0);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Meeting logic
  useEffect(() => {
    if (!socket) return;
    
    if (classId) {
      socket.emit('join_class', classId);
      if (user.role === 'STUDENT') {
        socket.emit('check_stream', { classId });
      }
    }

    // Fetch class details
    apiFetch('/api/classes/my')
      .then(classes => {
        if (classes && classes.length > 0) {
          setMyClasses(classes);
          if (!classId) {
            const firstId = classes[0].id.toString();
            setClassId(firstId);
            setCurrentClass(classes[0]);
            socket.emit('join_class', firstId);
          } else {
            const cls = classes.find((c: any) => c.id.toString() === classId.toString());
            if (cls) setCurrentClass(cls);
          }
        }
      });

    // Student Listeners
    const h1 = (data: any) => {
      if (user.role === 'STUDENT') {
        setIsLive(true);
        setBroadcasterId(data.teacherId);
        // Automatically request stream
        socket.emit('request_stream', { to: data.teacherId });
      }
    };

    const h2 = () => {
      if (user.role === 'STUDENT') {
        setIsLive(false);
        setInMeeting(false);
        setBroadcasterId(null);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        cleanupPeers();
      }
    };

    // WebRTC Signaling
    const h3 = async (data: any) => {
      if (user.role === 'STUDENT') {
        console.log("Receiving WebRTC Offer");
        const pc = createPeerConnection(data.from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { to: data.from, answer });
        setInMeeting(true);
      }
    };

    const h4 = async (data: any) => {
      const pc = peerConnections.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const h5 = async (data: any) => {
      const pc = peerConnections.current.get(data.from);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("ICE Candidate error:", e);
        }
      }
    };

    const h6 = async (data: any) => {
      if (user.role === 'TEACHER' && streamRef.current) {
        const pc = createPeerConnection(data.from);
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', { to: data.from, offer });
        setParticipantsCount(prev => prev + 1);
      }
    };

    const h7 = (data: any) => {
      if (user.role === 'TEACHER' && streamRef.current) {
        socket.emit('stream_active_reply', { to: data.requesterId, type: modeRef.current });
      }
    };

    socket.on('stream_available', h1);
    socket.on('stream_ended', h2);
    socket.on('webrtc_offer', h3);
    socket.on('webrtc_answer', h4);
    socket.on('webrtc_ice_candidate', h5);
    socket.on('student_requested_stream', h6);
    socket.on('is_stream_active', h7);

    return () => {
      cleanupPeers();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      socket.off('stream_available', h1);
      socket.off('stream_ended', h2);
      socket.off('webrtc_offer', h3);
      socket.off('webrtc_answer', h4);
      socket.off('webrtc_ice_candidate', h5);
      socket.off('student_requested_stream', h6);
      socket.off('is_stream_active', h7);
    };
  }, [classId, socket]);

  const cleanupPeers = () => {
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    setParticipantsCount(0);
  };

  const createPeerConnection = (targetId: string) => {
    if (peerConnections.current.has(targetId)) {
      peerConnections.current.get(targetId)?.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', { to: targetId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      setConnectionStatus(pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        peerConnections.current.delete(targetId);
        if (user.role === 'TEACHER') {
          setParticipantsCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        if (event.streams && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else {
          if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = new MediaStream([event.track]);
          } else {
            (remoteVideoRef.current.srcObject as MediaStream).addTrack(event.track);
          }
        }
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    peerConnections.current.set(targetId, pc);
    return pc;
  };

  const startSharing = async (shareMode: 'SCREEN' | 'CAMERA') => {
    if (!classId) {
      setError("Ju lutem zgjidhni një klasë.");
      return;
    }

    try {
      let captureStream;
      if (shareMode === 'SCREEN') {
        captureStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });
      } else {
        captureStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode }, 
          audio: true 
        });
      }

      setStream(captureStream);
      streamRef.current = captureStream;
      setMode(shareMode);
      modeRef.current = shareMode;
      setIsSharing(true);
      setInMeeting(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = captureStream;
      }

      if (socket) {
        socket.emit('stream_started', { type: shareMode, classId });
      }

      captureStream.getTracks().forEach(track => {
        track.onended = () => stopSharing();
      });

    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.message?.includes('permissions policy')) {
        setError("Nuk mund të ndajë ekranin në Preview. Klikoni 'Open in new tab' lart djathtas.");
      } else {
        setError("Dështoi qasja: " + err.message);
      }
    }
  };

  const stopSharing = () => {
    setIsSharing(false);
    setInMeeting(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    cleanupPeers();
    if (socket && classId) {
      socket.emit('stream_stopped', { classId });
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleClassSelect = (cid: string) => {
    setClassId(cid);
    const cls = myClasses.find(c => c.id.toString() === cid);
    if (cls) {
      setCurrentClass(cls);
      if (user.role === 'TEACHER') localStorage.setItem('teacher_selected_class_id', cid);
    }
    if (socket) {
      socket.emit('join_class', cid);
      if (user.role === 'STUDENT') {
        socket.emit('check_stream', { classId: cid });
      }
    }
  };

  const toggleFullscreen = () => {
    if (!viewportRef.current) return;
    if (!document.fullscreenElement) {
      viewportRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6">
      <AktiviteteFSHN user={user} />
      <div className="min-h-[80vh] flex flex-col bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
      {/* Google Meet Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-slate-950/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
            <Video size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold tracking-tight">
              {currentClass ? currentClass.name : "Meeting Leksioni"}
            </h3>
            <div className="flex items-center gap-2">
              {(isSharing || isLive) && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
              <span className="text-[10px] uppercase font-black text-slate-300 tracking-wider">
                {isSharing || isLive ? "LIVE STREAM" : "GATI PËR FILLIM"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {(isSharing || isLive) && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-full flex items-center gap-2 text-white text-xs font-bold">
              <Users size={14} className="text-blue-400" />
              <span>{participantsCount} participantë</span>
            </div>
          )}
          <button onClick={toggleFullscreen} className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full text-white hover:bg-slate-800 transition-all">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      {/* Main Stream Area */}
      <div className="flex-grow flex items-center justify-center relative p-4 md:p-8" ref={viewportRef}>
        <div className="w-full max-w-5xl aspect-video rounded-[3rem] overflow-hidden bg-slate-950 shadow-inner relative group border-4 border-slate-800">
          <video 
            ref={user.role === 'TEACHER' ? localVideoRef : remoteVideoRef}
            autoPlay 
            playsInline 
            muted={user.role === 'TEACHER'} 
            className={`w-full h-full ${mode === 'CAMERA' ? 'object-cover scale-x-[-1]' : 'object-contain'}`}
          />
          
          {(isVideoOff && user.role === 'TEACHER') && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-6">
              <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 border-4 border-slate-700 shadow-2xl">
                 {user.profile_photo ? (
                   <img src={user.profile_photo} className="w-full h-full rounded-full object-cover" />
                 ) : (
                   <span className="text-4xl font-bold">{user.name[0]}</span>
                 )}
              </div>
              <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Video është ndaluar</p>
            </div>
          )}

          {!inMeeting && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center text-white">
              <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mb-8 animate-pulse">
                <MonitorOff size={48} className="text-blue-500" />
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase italic">
                {user.role === 'TEACHER' ? 'Fillo Trasmetim' : (isLive ? 'Mësuesi është LIVE' : 'Prisni profesorin')}
              </h2>
              <p className="text-slate-400 max-w-sm mx-auto mb-10 font-medium">
                {user.role === 'TEACHER' 
                  ? 'Zgjidhni burimin e transmetimit për të filluar ndarjen e mjedisit tuaj.' 
                  : (isLive ? 'Klikoni butonin e gjelbër për t\'u bashkuar në leksion.' : 'Ju do të njoftoheni automatikisht kur profesori të fillojë transmetimin.')}
              </p>
              
              <div className="flex flex-wrap justify-center gap-4">
                {user.role === 'TEACHER' ? (
                  <>
                    <button onClick={() => startSharing('SCREEN')} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-blue-900/40 flex items-center gap-3">
                      <Monitor size={24} /> Screen Share
                    </button>
                    <button onClick={() => startSharing('CAMERA')} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-lg transition-all border border-slate-700 flex items-center gap-3">
                      <Camera size={24} /> Camera Feed
                    </button>
                  </>
                ) : (
                  isLive && (
                    <button onClick={() => socket.emit('request_stream', { to: broadcasterId })} className="px-10 py-5 bg-green-600 hover:bg-green-700 text-white rounded-3xl font-black text-xl transition-all shadow-xl shadow-green-900/40 flex items-center gap-3 animate-bounce">
                      <Play size={28} /> Bashkohu Live
                    </button>
                  )
                )}
              </div>

              {error && (
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Google Meet Bottom Controls */}
      <div className="bg-slate-950 p-6 border-t border-slate-800/30 flex flex-col md:flex-row items-center justify-between gap-6 z-30">
        <div className="flex items-center gap-4 w-full md:w-1/3">
           {user.role === 'TEACHER' && !inMeeting && (
             <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 w-full overflow-hidden">
                <span className="text-slate-500 text-[10px] font-black uppercase">Klasa:</span>
                <select value={classId || ''} onChange={(e) => handleClassSelect(e.target.value)} className="bg-transparent text-white font-bold text-xs outline-none grow cursor-pointer">
                  {myClasses.map(cls => (
                    <option key={cls.id} value={cls.id} className="bg-slate-900">{cls.name}</option>
                  ))}
                </select>
             </div>
           )}
           {inMeeting && (
             <div className="hidden md:flex flex-col">
                <span className="text-blue-500 text-[10px] font-black tracking-widest uppercase">Connection Status</span>
                <span className="text-white text-xs font-bold uppercase">{connectionStatus}</span>
             </div>
           )}
        </div>

        <div className="flex items-center gap-4">
          {inMeeting && user.role === 'TEACHER' && (
            <>
              <button onClick={toggleMute} className={`p-5 rounded-full transition-all ${isMuted ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button onClick={toggleVideo} className={`p-5 rounded-full transition-all ${isVideoOff ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            </>
          )}

          {inMeeting ? (
            <button onClick={user.role === 'TEACHER' ? stopSharing : () => setInMeeting(false)} className="px-10 py-5 bg-red-600 hover:bg-red-700 text-white rounded-[2rem] font-black text-sm flex items-center gap-3 shadow-2xl transition-transform active:scale-95 leading-none">
              <X size={20} />
              <span>{user.role === 'TEACHER' ? 'MBYLL' : 'LARGOHU'}</span>
            </button>
          ) : (
            <div className="text-slate-600 text-[10px] font-black tracking-[0.2em] uppercase">Ready to join</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 w-full md:w-1/3">
           {inMeeting && (
             <>
               <button className="p-4 bg-slate-900 text-slate-400 rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-lg">
                 <Hand size={20} />
               </button>
               <button className="p-4 bg-slate-900 text-slate-400 rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-lg">
                 <MessageCircle size={20} />
               </button>
               <button className="p-4 bg-slate-900 text-slate-400 rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-lg">
                 <MoreVertical size={20} />
               </button>
             </>
           )}
        </div>
      </div>

      {/* Floating Presentation Banner */}
      <AnimatePresence>
        {isSharing && user.role === 'TEACHER' && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-6 z-40 border border-blue-400/40 backdrop-blur-xl"
          >
             <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <ScreenShareIcon size={24} />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-black opacity-70 uppercase tracking-widest">You are presenting</span>
                <span className="text-lg font-black tracking-tight leading-none">Your entire screen</span>
             </div>
             <button onClick={stopSharing} className="ml-4 px-6 py-3 bg-white text-blue-600 rounded-2xl font-black text-xs hover:bg-blue-50 transition-colors shadow-lg uppercase tracking-tight">
                Stop Sharing
             </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
