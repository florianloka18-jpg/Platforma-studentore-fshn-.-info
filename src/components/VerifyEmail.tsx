import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../App';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Mungon token-i i verifikimit.');
      return;
    }

    const verify = async () => {
      try {
        await apiFetch(`/api/auth/verify-email-json?token=${token}`);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Gabim gjatë verifikimit.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl text-center"
      >
        {status === 'loading' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Duke verifikuar email-in...</h2>
            <p className="text-slate-500">Ju lutem prisni një moment ndërsa ne verifikojmë llogarinë tuaj.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle size={48} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Verifikimi u krye!</h2>
            <p className="text-slate-500 text-lg">Email-i juaj u verifikua me sukses. Tani keni akses të plotë në të gjitha funksionalitetet.</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
            >
              Vazhdo te Dashboard
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <XCircle size={48} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Gabim në verifikim</h2>
            <p className="text-red-500 font-medium">{message}</p>
            <p className="text-slate-500">Linku mund të ketë skaduar ose është i pavlefshëm.</p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-lg hover:bg-slate-200 transition-all"
            >
              Kthehu mbrapa
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
