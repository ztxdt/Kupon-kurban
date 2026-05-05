import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, limit, query, where, deleteDoc } from 'firebase/firestore';
import { LogIn, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Settings } from '../types';

interface Props {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export function AdminLogin({ onLoginSuccess, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const docPath = 'config/settings';
      try {
        const sDoc = await getDoc(doc(db, docPath));
        if (sDoc.exists()) {
          setSettings(sDoc.data() as Settings);
        }
      } catch (err: any) {
        console.warn('Settings fetch failed (likely offline):', err.message);
      }
    };
    fetchSettings();
  }, []);

  const handleLogin = async () => {
    if (settings?.loginPassword && password !== settings.loginPassword) {
      setError('KATA SANDI AKSES MASJID SALAH!');
      return;
    }

    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const adminPath = `admins/${user.uid}`;
      try {
        const adminDoc = await getDoc(doc(db, adminPath));
        
        if (adminDoc.exists()) {
          const data = adminDoc.data();
          if (user.email === 'alhabsyiadit@gmail.com' && data.role !== 'super_admin') {
            await setDoc(doc(db, adminPath), { ...data, role: 'super_admin' }, { merge: true });
          }
        } else {
          const adminsSnap = await getDocs(query(collection(db, 'admins'), limit(1)));
          if (adminsSnap.empty || user.email === 'alhabsyiadit@gmail.com') {
            await setDoc(doc(db, adminPath), {
              email: user.email,
              role: 'super_admin',
              createdAt: new Date()
            });
          } else {
            const inviteQ = query(collection(db, 'invitations'), where('email', '==', user.email));
            const inviteSnap = await getDocs(inviteQ);
            
            if (!inviteSnap.empty) {
              const inviteData = inviteSnap.docs[0].data();
              await setDoc(doc(db, adminPath), {
                email: user.email,
                role: inviteData.role || 'operator',
                createdAt: new Date()
              });
              const deletePromises = inviteSnap.docs.map(d => deleteDoc(d.ref));
              await Promise.all(deletePromises);
            } else {
              throw new Error('Email Anda tidak terdaftar sebagai panitia.');
            }
          }
        }
      } catch (err: any) {
        if (err.message?.includes('tidak terdaftar')) throw err;
        handleFirestoreError(err, OperationType.GET, adminPath);
        return;
      }

      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal login sebagai admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-20 space-y-8 max-w-sm mx-auto">
      <div className="text-center space-y-4">
        <div className="bg-[#2D5A27] dark:bg-[#1B3618] w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-xl transition-colors duration-300">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-black text-[#2D5A27] dark:text-[#4ADE80] transition-colors duration-300 uppercase">PANEL PANITIA</h1>
        <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest transition-colors duration-300">Akses terbatas untuk petugas</p>
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[32px] shadow-2xl border-4 border-[#2D5A27] dark:border-[#4ADE80] space-y-6 transition-colors duration-300">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-3 h-3" />
            Kata Sandi Akses (Master)
          </label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full p-4 bg-gray-50 dark:bg-[#121212] border-2 border-gray-100 dark:border-white/5 rounded-2xl font-black text-center tracking-[1em] focus:border-[#2D5A27] dark:focus:border-[#4ADE80] outline-none transition-all dark:text-white"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || (!!settings?.loginPassword && !password)}
          className="w-full bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] p-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-lg"
        >
          <LogIn className="w-6 h-6" />
          {loading ? 'MENGECEK...' : 'MASUK DENGAN GOOGLE'}
        </button>

        {error && (
          <p className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold text-center border border-red-200 dark:border-red-800 transition-colors duration-300">
            {error}
          </p>
        )}

        <button 
          onClick={onBack}
          className="w-full text-gray-400 dark:text-gray-500 font-bold flex items-center justify-center gap-2 hover:text-[#2D5A27] dark:hover:text-[#4ADE80] transition-colors uppercase text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          KEMBALI KE PENDAFTARAN
        </button>
      </div>

      <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest leading-relaxed transition-colors duration-300 font-bold">
        Gunakan kata sandi akses dan login dengan email panitia yang telah didaftarkan.
      </p>
    </div>
  );
}
