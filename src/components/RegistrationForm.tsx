import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, serverTimestamp, doc, getDoc, runTransaction, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Settings, Beef, AlertCircle } from 'lucide-react';
import type { Settings as SettingsType } from '../types';

interface Props {
  onSuccess: (id: string) => void;
}

export function RegistrationForm({ onSuccess }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [counter, setCounter] = useState<{ count: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Listen to settings for real-time updates (mosque name, max coupons, etc)
    const settingsPath = 'config/settings';
    const unsubSettings = onSnapshot(doc(db, settingsPath), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SettingsType);
      } else {
        // Default values if document does not exist yet
        setSettings({
          mosqueName: "Masjid Baiturrahman",
          mosqueAddress: "Alamat belum diatur",
          maxCoupons: 500,
          expiryMinutes: 60
        });
      }
    }, (error) => {
      console.warn('Settings listener failed:', error);
      // Fallback or initial default
      setSettings(prev => prev || {
        mosqueName: "Masjid Baiturrahman",
        mosqueAddress: "Mode Offline / Hubungi Panitia",
        maxCoupons: 500,
        expiryMinutes: 60
      });
    });

    // Listen to counter for real-time queue number preview if needed
    const counterPath = 'counters/coupons';
    const unsubCounter = onSnapshot(doc(db, counterPath), (snapshot) => {
      if (snapshot.exists()) {
        setCounter(snapshot.data() as { count: number });
      } else {
        // If document is deleted or doesn't exist, reset local counter state to 0
        setCounter({ count: 0 });
      }
    });

    return () => {
      unsubSettings();
      unsubCounter();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !phone) {
      setError('Mohon isi Nama, No. HP, dan Alamat Anda');
      return;
    }
    
    // Basic phone validation
    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (phoneClean.length < 10) {
      setError('Nomor HP tidak valid (Minimal 10 digit)');
      return;
    }
    setError('');
    
    // Check if user already has a coupon in localStorage (simple guard)
    const existingId = localStorage.getItem('my_coupon_id');
    if (existingId) {
      setError('ANDA SUDAH MEMILIKI KUPON AKTIF. HARAP SELESAIKAN ANTRIAN ANDA.');
      return;
    }

    setLoading(true);
    const settingsPath = 'config/settings';
    const counterPath = 'counters/coupons';
    try {
      const counterRef = doc(db, counterPath);
      const settingsRef = doc(db, settingsPath);

      const phoneRef = doc(db, 'registrations_by_phone', phoneClean);

      const couponId = await runTransaction(db, async (transaction) => {
        const settingsDoc = await transaction.get(settingsRef);
        const counterDoc = await transaction.get(counterRef);
        const phoneDoc = await transaction.get(phoneRef);

        // CHECK IF PHONE ALREADY REGISTERED
        if (phoneDoc.exists()) {
          // If the doc exists, it means they are currently registered or were recently.
          // In this simple system, we just block it.
          throw new Error('DUPLICATE_PHONE');
        }
        
        const currentMax = settingsDoc.exists() ? settingsDoc.data().maxCoupons : 500;
        let currentCount = 0;
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().count;
        }

        // STRIKT LIMIT CHECK INSIDE TRANSACTION
        if (currentCount >= currentMax) {
          throw new Error('LIMIT_REACHED');
        }

        const newCount = currentCount + 1;
        transaction.set(counterRef, { count: newCount }, { merge: true });

        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + (settingsDoc.exists() ? settingsDoc.data().expiryMinutes : 60));

        const newCouponRef = doc(collection(db, 'coupons'));
        
        // Register the phone
        transaction.set(phoneRef, { 
          couponId: newCouponRef.id, 
          queueNumber: newCount,
          createdAt: serverTimestamp() 
        });

        transaction.set(newCouponRef, {
          queueNumber: newCount,
          name,
          phone: phoneClean,
          address,
          status: 'pending',
          createdAt: serverTimestamp(),
          expiresAt: expiryDate,
        });
        return newCouponRef.id;
      });

      onSuccess(couponId);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'LIMIT_REACHED') {
        setError('MAAF, KUPON BARU SAJA HABIS! HUBUNGI PANITIA.');
      } else if (err.message === 'DUPLICATE_PHONE') {
        setError('NOMOR HP INI SUDAH TERDAFTAR! SATU HP HANYA UNTUK SATU KUPON.');
      } else {
        handleFirestoreError(err, OperationType.WRITE, counterPath);
        setError('Gagal mengambil kupon. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isOutOfStock = settings && counter && counter.count >= settings.maxCoupons;

  return (
    <div id="registration-form-container" className="flex flex-col gap-6 pt-10">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="bg-[#2D5A27] dark:bg-[#4ADE80] p-4 rounded-3xl shadow-lg rotate-3 animate-pulse transition-colors duration-300">
             <Beef className="w-12 h-12 text-white dark:text-[#121212]" />
          </div>
        </div>
        <h1 id="app-title" className="text-5xl font-black text-[#2D5A27] dark:text-[#4ADE80] tracking-tighter pt-4 font-display uppercase italic transition-colors duration-300">
          Kupon Kurban
        </h1>
        <p id="mosque-name" className="text-lg font-bold text-[#2D5A27]/70 dark:text-[#4ADE80]/70 uppercase tracking-widest transition-colors duration-300">
          {settings?.mosqueName || "Masjid Baiturrahman"}
        </p>
        {isOutOfStock && (
          <div className="bg-red-600 text-white p-6 rounded-[30px] shadow-2xl mt-6 animate-pulse rotate-1">
            <p className="font-black text-2xl uppercase tracking-tighter leading-none">
              MOHON MAAF KUPON TELAH HABIS APABILA ADA KESALAHAN HUBUNGI PANITIA SETEMPAT dan segera konfirmasi
            </p>
          </div>
        )}
      </div>

      {!isOutOfStock ? (
        <form id="warga-form" onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] shadow-2xl border-4 border-[#2D5A27] dark:border-[#4ADE80] transition-colors duration-300">
          <div className="space-y-2">
            <label id="label-nama" htmlFor="nama" className="text-xl font-bold text-[#2D5A27] dark:text-[#4ADE80] block transition-colors duration-300">
              NAMA LENGKAP
            </label>
            <input
              id="input-nama"
              autoFocus
              type="text"
              placeholder="TULIS NAMA ANDA..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F5F5F0] dark:bg-[#121212] border-4 border-[#2D5A27]/20 dark:border-[#4ADE80]/20 rounded-2xl p-6 text-2xl font-black focus:border-[#2D5A27] dark:focus:border-[#4ADE80] focus:ring-0 outline-none transition-all placeholder:text-[#2D5A27]/30 dark:placeholder:text-[#4ADE80]/30 uppercase text-[#2D5A27] dark:text-[#4ADE80]"
            />
          </div>

          <div className="space-y-2">
            <label id="label-hp" htmlFor="hp" className="text-xl font-bold text-[#2D5A27] dark:text-[#4ADE80] block transition-colors duration-300">
              NOMOR HP / WHATSAPP
            </label>
            <input
              id="input-hp"
              type="tel"
              placeholder="08XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#F5F5F0] dark:bg-[#121212] border-4 border-[#2D5A27]/20 dark:border-[#4ADE80]/20 rounded-2xl p-6 text-2xl font-black focus:border-[#2D5A27] dark:focus:border-[#4ADE80] focus:ring-0 outline-none transition-all placeholder:text-[#2D5A27]/30 dark:placeholder:text-[#4ADE80]/30 text-[#2D5A27] dark:text-[#4ADE80]"
            />
          </div>

          <div className="space-y-2">
            <label id="label-alamat" htmlFor="alamat" className="text-xl font-bold text-[#2D5A27] dark:text-[#4ADE80] block transition-colors duration-300">
              ALAMAT RUMAH
            </label>
            <textarea
              id="input-alamat"
              placeholder="Tulis alamat rumah anda..."
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#F5F5F0] dark:bg-[#121212] border-4 border-[#2D5A27]/20 dark:border-[#4ADE80]/20 rounded-2xl p-5 text-2xl font-bold focus:border-[#2D5A27] dark:focus:border-[#4ADE80] focus:ring-0 outline-none transition-all resize-none text-[#2D5A27] dark:text-[#4ADE80] placeholder:text-[#2D5A27]/30 dark:placeholder:text-[#4ADE80]/30"
            />
          </div>

          {error && (
            <p id="error-msg" className="text-red-600 dark:text-red-400 font-bold text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border-2 border-red-200 dark:border-red-800/50">
              {error}
            </p>
          )}

          <button
            id="submit-btn"
            disabled={loading}
            type="submit"
            className="w-full bg-[#4CAF50] dark:bg-[#2D5A27] hover:bg-[#43A047] dark:hover:bg-[#1B3618] active:scale-95 disabled:opacity-50 text-white rounded-3xl p-6 text-2xl font-black shadow-[0_8px_0_#2D5A27] dark:shadow-[0_8px_0_#121212] transition-all"
          >
            {loading ? 'MEMPROSES...' : 'AMBIL NOMOR ANTRIAN'}
          </button>
        </form>
      ) : (
        <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] shadow-2xl border-4 border-red-600 flex flex-col items-center gap-6 text-center animate-pulse transition-colors duration-300">
            <AlertCircle className="w-24 h-24 text-red-600" />
            <h2 className="text-4xl font-black text-red-600 uppercase tracking-tighter leading-none">
              MOHON MAAF KUPON TELAH HABIS APABILA ADA KESALAHAN HUBUNGI PANITIA SETEMPAT dan segera konfirmasi
            </h2>
            <p className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm">
              Sistem Otomatis Menutup Pendaftaran
            </p>
        </div>
      )}

      <div className="bg-[#2D5A27] dark:bg-[#1B3618] text-white p-6 rounded-3xl flex items-center gap-4 shadow-xl transition-colors duration-300">
        <div className="bg-white/20 p-3 rounded-full">
          <Settings className="w-8 h-8" />
        </div>
        <div>
          <p className="font-bold text-lg uppercase leading-tight">Maksimal Kupon: {settings?.maxCoupons || '...'}</p>
          <p className="text-white/70 text-sm">{settings?.mosqueAddress || '...'}</p>
        </div>
      </div>
    </div>
  );
}
