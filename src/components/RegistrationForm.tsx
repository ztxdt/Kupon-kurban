import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, serverTimestamp, doc, getDoc, runTransaction, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Settings, Beef, AlertCircle } from 'lucide-react';
import type { Settings as SettingsType } from '../types';
import { useLanguage } from '../lib/LanguageContext';

interface Props {
  onSuccess: (id: string) => void;
}

// Mosque Logo Component for clean rendering
const MosqueLogo = () => (
  <div className="flex flex-col items-center justify-center space-y-2 mb-4 select-none">
    <div className="relative group">
      {/* Outer spinning radiant ring */}
      <div 
        className="absolute -inset-2 bg-gradient-to-r from-[#D4AF37] via-[#2D5A27] to-[#4ADE80] rounded-full opacity-30 group-hover:opacity-60 blur-md transition duration-1000 group-hover:duration-200 animate-spin" 
        style={{ animationDuration: '12s' }} 
      />
      
      {/* Golden border wrapper */}
      <div className="relative bg-[#1B3618] dark:bg-[#0C1F0A] p-2.5 rounded-full border-4 border-[#D4AF37] shadow-xl transform group-hover:scale-105 transition-transform duration-300">
        <svg viewBox="0 0 240 240" className="w-28 h-28 md:w-32 md:h-32">
          {/* Main background */}
          <circle cx="120" cy="120" r="110" fill="#1B3618" />
          
          {/* Islamic Star of David/Geometric overlay */}
          <g opacity="0.12">
            <polygon points="120,20 220,120 120,220 20,120" fill="none" stroke="#D4AF37" strokeWidth="2" />
            <polygon points="120,20 220,120 120,220 20,120" fill="none" stroke="#D4AF37" strokeWidth="2" transform="rotate(45 120 120)" />
          </g>

          {/* Golden Crescent Moon */}
          <path d="M135,45 C175,45 200,75 200,115 C200,145 180,170 155,180 C175,165 185,140 185,115 C185,85 165,58 135,45 Z" fill="#D4AF37" />

          {/* Glowing stars */}
          <polygon points="175,65 177,71 183,72 178,77 180,83 175,80 170,83 172,77 167,72 173,71" fill="#FFFFFF" />
          <polygon points="145,50 146,53 150,54 147,56 148,60 145,58 142,60 143,56 140,54 144,53" fill="#D4AF37" />

          {/* Mosque Dome and Minaret Silhouette */}
          <path d="M60,170 L60,135 C60,120 75,110 85,110 C95,110 110,120 110,135 L110,170 Z" fill="#0C1F0A" stroke="#D4AF37" strokeWidth="2" />
          <path d="M85,110 L85,95 L92,100 L85,105" fill="#D4AF37" />
          {/* Minaret */}
          <rect x="40" y="100" width="12" height="70" rx="3" fill="#0C1F0A" stroke="#D4AF37" strokeWidth="1.5" />
          <path d="M40,100 L46,85 L52,100 Z" fill="#D4AF37" />

          {/* Majestic Ram/Sheep Head Outlines in Gold */}
          <path d="M102,152 C94,146 90,134 94,122 C97,110 111,104 122,104 C133,104 147,110 150,122 C154,134 150,146 142,152 L146,170" fill="none" stroke="#D4AF37" strokeWidth="3.5" strokeLinecap="round" />
          {/* Horns */}
          <path d="M109,120 C100,110 92,118 95,130 C97,135 102,133 103,126" fill="none" stroke="#D4AF37" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M135,120 C144,110 152,118 149,130 C147,135 142,133 141,126" fill="none" stroke="#D4AF37" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Eyes of the Sheep for cuteness */}
          <circle cx="114" cy="134" r="3" fill="#D4AF37" />
          <circle cx="130" cy="134" r="3" fill="#D4AF37" />

          {/* Text inside Logo: "KUPON" & "KURBAN" */}
          <text x="120" y="195" fill="#FFFFFF" fontSize="13" fontWeight="900" letterSpacing="3.5" textAnchor="middle" fontFamily="Inter, sans-serif">KUPON ANTRIAN</text>
          <text x="120" y="214" fill="#D4AF37" fontSize="11" fontWeight="900" letterSpacing="4.5" textAnchor="middle" fontFamily="Inter, sans-serif">KURBAN DIGITAL</text>
        </svg>
      </div>
    </div>
    <span className="text-[10px] bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-black px-3.5 py-1 rounded-full uppercase tracking-wider mt-3 shadow-sm select-none">
      ✨ LOGO RESMI MASJID ✨
    </span>
  </div>
);

export function RegistrationForm({ onSuccess }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [counter, setCounter] = useState<{ count: number } | null>(null);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    // Listen to settings for real-time updates (mosque name, max coupons, etc)
    const settingsPath = 'config/settings';
    const unsubSettings = onSnapshot(doc(db, settingsPath), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SettingsType);
      } else {
        // Default values if document does not exist yet
        setSettings({
          mosqueName: t.defaultMosqueName,
          mosqueAddress: t.defaultMosqueAddress,
          maxCoupons: 500,
          expiryMinutes: 60
        });
      }
    }, (error) => {
      console.warn('Settings listener failed:', error);
      // Fallback or initial default
      setSettings(prev => prev || {
        mosqueName: t.defaultMosqueName,
        mosqueAddress: t.offlineMode,
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
      setError(t.errorFillFields);
      return;
    }
    
    // Basic phone validation
    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (phoneClean.length < 10) {
      setError(t.errorPhoneMin);
      return;
    }
    setError('');
    
    // Check if user already has a coupon in localStorage (simple guard)
    const existingId = localStorage.getItem('my_coupon_id');
    if (existingId) {
      setError(t.errorActiveCoupon);
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
      console.error('Registration Error:', err);
      let userMsg = t.msgGenericWargaError;
      if (err.message === 'LIMIT_REACHED') {
        userMsg = t.limitReachedMsg;
      } else if (err.message === 'DUPLICATE_PHONE') {
        userMsg = t.errorDupPhone;
      } else if (err.code === 'permission-denied') {
        userMsg = t.permissionDeniedMsg;
      }
      
      setError(userMsg);
      // Still call handleFirestoreError for system logging/diagnostics
      try {
        handleFirestoreError(err, OperationType.WRITE, counterPath);
      } catch (finalErr) {
        // Fallback to avoid crashing the event handler if handleFirestoreError re-throws
        console.error('Final Error Info:', finalErr);
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
          <MosqueLogo />
        </div>
        <h1 id="app-title" className="text-5xl font-black text-[#2D5A27] dark:text-[#4ADE80] tracking-tighter pt-4 font-display uppercase italic transition-colors duration-300">
          {t.couponTitle}
        </h1>
        <p id="mosque-name" className="text-lg font-bold text-[#2D5A27]/70 dark:text-[#4ADE80]/70 uppercase tracking-widest transition-colors duration-300">
          {settings?.mosqueName || t.defaultMosqueName}
        </p>
        {isOutOfStock && (
          <div className="bg-red-600 text-white p-6 rounded-[30px] shadow-2xl mt-6 animate-pulse rotate-1">
            <p className="font-black text-2xl uppercase tracking-tighter leading-none">
              {t.outOfStockMsg}
            </p>
          </div>
        )}
      </div>

      {!isOutOfStock ? (
        <form id="warga-form" onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] shadow-2xl border-4 border-[#2D5A27] dark:border-[#4ADE80] transition-colors duration-300">
          <div className="space-y-2">
            <label id="label-nama" htmlFor="nama" className="text-xl font-bold text-[#2D5A27] dark:text-[#4ADE80] block transition-colors duration-300">
              {t.labelName}
            </label>
            <input
              id="input-nama"
              autoFocus
              type="text"
              placeholder={t.placeholderName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F5F5F0] dark:bg-[#121212] border-4 border-[#2D5A27]/20 dark:border-[#4ADE80]/20 rounded-2xl p-6 text-2xl font-black focus:border-[#2D5A27] dark:focus:border-[#4ADE80] focus:ring-0 outline-none transition-all placeholder:text-[#2D5A27]/30 dark:placeholder:text-[#4ADE80]/30 uppercase text-[#2D5A27] dark:text-[#4ADE80]"
            />
          </div>

          <div className="space-y-2">
            <label id="label-hp" htmlFor="hp" className="text-xl font-bold text-[#2D5A27] dark:text-[#4ADE80] block transition-colors duration-300">
              {t.labelPhone}
            </label>
            <input
              id="input-hp"
              type="tel"
              placeholder={t.placeholderPhone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#F5F5F0] dark:bg-[#121212] border-4 border-[#2D5A27]/20 dark:border-[#4ADE80]/20 rounded-2xl p-6 text-2xl font-black focus:border-[#2D5A27] dark:focus:border-[#4ADE80] focus:ring-0 outline-none transition-all placeholder:text-[#2D5A27]/30 dark:placeholder:text-[#4ADE80]/30 text-[#2D5A27] dark:text-[#4ADE80]"
            />
          </div>

          <div className="space-y-2">
            <label id="label-alamat" htmlFor="alamat" className="text-xl font-bold text-[#2D5A27] dark:text-[#4ADE80] block transition-colors duration-300">
              {t.labelAddress}
            </label>
            <textarea
              id="input-alamat"
              placeholder={t.placeholderAddress}
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
            {loading ? t.processing : t.getQueueNumber}
          </button>
        </form>
      ) : (
        <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[40px] shadow-2xl border-4 border-red-600 flex flex-col items-center gap-6 text-center animate-pulse transition-colors duration-300">
            <AlertCircle className="w-24 h-24 text-red-600" />
            <h2 className="text-4xl font-black text-red-600 uppercase tracking-tighter leading-none">
              {t.outOfStockMsg}
            </h2>
            <p className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm">
              {t.autoClosingReg}
            </p>
        </div>
      )}

      <div className="bg-[#2D5A27] dark:bg-[#1B3618] text-white p-6 rounded-3xl flex items-center gap-4 shadow-xl transition-colors duration-300">
        <div className="bg-white/20 p-3 rounded-full">
          <Settings className="w-8 h-8" />
        </div>
        <div>
          <p className="font-bold text-lg uppercase leading-tight">{t.maxCouponLabel}: {settings?.maxCoupons || '...'}</p>
          <p className="text-white/70 text-sm">{settings?.mosqueAddress || '...'}</p>
        </div>
      </div>
    </div>
  );
}
