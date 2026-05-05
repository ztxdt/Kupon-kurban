import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, MapPin, Calendar, X, Map } from 'lucide-react';
import type { Coupon, Settings } from '../types';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface Props {
  couponId: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function CouponDisplay({ couponId }: Props) {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNearMosque, setIsNearMosque] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const unsubCoupon = onSnapshot(doc(db, 'coupons', couponId), (doc) => {
      if (doc.exists()) {
        setCoupon({ id: doc.id, ...doc.data() } as Coupon);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `coupons/${couponId}`);
    });

    const unsubSettings = onSnapshot(doc(db, 'config', 'settings'), (doc) => {
      if (doc.exists()) setSettings(doc.data() as Settings);
    });

    return () => {
      unsubCoupon();
      unsubSettings();
    };
  }, [couponId]);

  // Geofencing Auto-Verification Logic
  useEffect(() => {
    const status = coupon?.status;
    const lat = settings?.mosqueLat;
    const lng = settings?.mosqueLng;
    const expiresAtMs = coupon?.expiresAt?.toMillis?.() || 0;

    if (status !== 'pending' || !lat || !lng || !expiresAtMs) return;

    const checkLocation = () => {
      if (!navigator.geolocation) {
        setGeoError('Perangkat tidak mendukung lokasi');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            lat,
            lng
          );

          const isNear = distance <= 50; // 50 meters
          setIsNearMosque(isNear);

          // Auto verify if near mosque AND nearing expiry (within 30 mins)
          if (isNear) {
            const now = new Date();
            const diffMins = (expiresAtMs - now.getTime()) / 60000;

            if (diffMins > 0 && diffMins <= 30) {
              try {
                await updateDoc(doc(db, 'coupons', couponId), {
                  status: 'verified',
                  verifiedAt: serverTimestamp(),
                  notification: '✅ VERIFIKASI OTOMATIS: Anda telah berada di lokasi!'
                });
              } catch (err) {
                console.error('Auto-verify failed:', err);
              }
            }
          }
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          setGeoError('Gagal mendeteksi lokasi. Pastikan GPS aktif.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };

    const interval = setInterval(checkLocation, 10000); // Check every 10s
    checkLocation();

    return () => clearInterval(interval);
  }, [coupon?.status, settings?.mosqueLat, settings?.mosqueLng, coupon?.expiresAt, couponId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-8 border-[#2D5A27] dark:border-[#4ADE80] border-t-transparent rounded-full animate-spin transition-colors duration-300"></div>
        <p className="mt-4 font-bold text-[#2D5A27] dark:text-[#4ADE80] animate-pulse transition-colors duration-300 uppercase">MEMUAT KUPON ANDA...</p>
      </div>
    );
  }

  if (!coupon) {
    return <div className="text-center p-10 dark:text-white">Kupon tidak ditemukan.</div>;
  }

  const isPending = coupon.status === 'pending';
  const isVerified = coupon.status === 'verified';
  const isExpired = coupon.status === 'expired';

  const dismissNotification = async () => {
    try {
      await updateDoc(doc(db, 'coupons', couponId), {
        notification: null
      });
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  return (
    <div id="coupon-display" className="space-y-6 pt-10 pb-20 relative">
      {/* Geofencing Status (Floating Indicator) */}
      {isPending && (
        <div className={`fixed bottom-24 right-4 z-50 flex items-center gap-2 p-3 rounded-2xl border-2 shadow-2xl transition-all duration-500 scale-90 ${isNearMosque ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-900 shadow-none border-gray-300 text-gray-500'}`}>
          {isNearMosque ? <CheckCircle2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          <span className="text-[10px] font-black uppercase tracking-tighter">
            {isNearMosque ? 'TERDETEKSI DI LOKASI' : 'GPS AKTIF: LUAR LOKASI'}
          </span>
        </div>
      )}

      {/* Simulation of Push Notification */}
      <AnimatePresence>
        {coupon.notification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[100] bg-red-600 text-white p-6 rounded-[30px] shadow-2xl border-4 border-white flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-full shrink-0">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="font-black text-lg uppercase tracking-tight leading-tight">
                {coupon.notification}
              </p>
            </div>
            <button 
              onClick={dismissNotification}
              className="bg-white/20 p-2 rounded-full hover:bg-white/40 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-[40px] shadow-2xl overflow-hidden border-4 border-[#2D5A27] dark:border-[#4ADE80] transition-colors duration-300">
        {/* Status Banner */}
        <div className={`p-6 text-center transition-colors duration-300 ${isVerified ? 'bg-[#4CAF50] dark:bg-[#2D5A27]' : isExpired ? 'bg-red-500 dark:bg-red-900' : 'bg-[#EAB308] dark:bg-yellow-700'}`}>
          <div className="flex flex-col items-center gap-2">
            {isVerified && <CheckCircle2 className="w-12 h-12 text-white" />}
            {isPending && <Clock className="w-12 h-12 text-white animate-pulse" />}
            {isExpired && <AlertCircle className="w-12 h-12 text-white" />}
            <h2 className="text-3xl font-black text-white tracking-widest uppercase">
              {isVerified ? 'SUKSES' : isPending ? 'PENDING' : 'KADALUARSA'}
            </h2>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Queue Number */}
          <div className="text-center">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors duration-300">Nomor Antrian</p>
            <h3 className="text-[120px] font-black text-[#2D5A27] dark:text-[#4ADE80] leading-none mb-4 font-display italic transition-colors duration-300">
              {coupon.queueNumber}
            </h3>
          </div>

          {/* QR Code Container */}
          <div className="bg-[#F5F5F0] dark:bg-[#121212] p-8 rounded-3xl flex flex-col items-center justify-center border-4 border-dashed border-[#2D5A27]/20 dark:border-[#4ADE80]/20 transition-colors duration-300">
            <div className="bg-white p-4 rounded-xl shadow-inner mb-4">
              <QRCodeSVG 
                value={coupon.id} 
                size={220}
                fgColor={isExpired ? '#666' : '#2D5A27'}
                level="H"
              />
            </div>
            <p className="text-center font-bold text-[#2D5A27] dark:text-[#4ADE80] text-lg px-4 leading-snug transition-colors duration-300">
               {isVerified 
                 ? "SIAP DIGUNAKAN! Tunjukkan QR ini kepada petugas." 
                 : isPending 
                 ? "MOHON MINTA PANITIA UNTUK SCAN QR CODE ANDA"
                 : "MAAF, KUPON INI SUDAH TIDAK BERLAKU"}
            </p>
            {isPending && (
              <p className="text-center font-black text-red-600 dark:text-red-400 animate-bounce mt-4 uppercase text-sm tracking-tighter">
                {isNearMosque ? "ANDA SUDAH DI LOKASI! VERIFIKASI AKAN BERJALAN OTOMATIS SAAT MENDEKATI WAKTU TUKAR" : "MOHON TUNGGU NOMOR ANTRIAN DI SEBUT DAN SABAR"}
              </p>
            )}
          </div>

          {/* Citizen Details */}
          <div className="grid grid-cols-2 gap-4 border-t-2 border-[#F5F5F0] dark:border-[#121212] pt-6 transition-colors duration-300">
            <div className="bg-[#F5F5F0] dark:bg-[#121212] p-4 rounded-2xl transition-colors duration-300">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Nama</p>
              <p className="font-extrabold text-[#2D5A27] dark:text-[#4ADE80] text-lg leading-tight uppercase">{coupon.name}</p>
            </div>
            <div className="bg-[#F5F5F0] dark:bg-[#121212] p-4 rounded-2xl transition-colors duration-300">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Tanggal</p>
              <p className="font-black text-[#2D5A27] dark:text-[#4ADE80]">
                {coupon.createdAt ? format(coupon.createdAt.toDate(), 'dd/MM/yyyy', { locale: localeId }) : '...'}
              </p>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl space-y-4 border-l-8 border-[#2D5A27] dark:border-[#4ADE80] transition-colors duration-300">
             <p className="font-bold text-[#2D5A27] dark:text-[#4ADE80] italic text-xl leading-relaxed">
               {isVerified 
                 ? "Alhamdulillah! Anda mendapatkan kupon kurban. Pengambilan daging dilakukan setelah pemotongan selesai."
                 : "Silakan simpan halaman ini dan tunjukkan kepada panitia di lokasi Masjid."}
             </p>
             
             {isPending && coupon.expiresAt && (
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500 font-bold bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800/50 transition-colors duration-300">
                  <Clock className="w-5 h-5" />
                  <p className="text-sm">
                    Berlaku sampai: {format(coupon.expiresAt.toDate(), 'HH:mm', { locale: localeId })} WIB
                  </p>
                </div>
             )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-md transition-colors duration-300 border border-gray-100 dark:border-white/5">
           <MapPin className="w-6 h-6 text-[#2D5A27] dark:text-[#4ADE80]" />
           <p className="font-bold text-sm tracking-tight leading-tight">
             {isNearMosque ? "Sistem mendeteksi Anda sudah di lokasi masjid." : "Pastikan GPS aktif & berada di sekitar lokasi untuk verifikasi panitia."}
           </p>
        </div>
        {geoError && (
          <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-tighter">{geoError}</p>
        )}
        <button 
          onClick={() => window.print()} 
          className="w-full bg-white dark:bg-[#1E1E1E] border-4 border-[#2D5A27] dark:border-[#4ADE80] text-[#2D5A27] dark:text-[#4ADE80] font-black rounded-3xl p-5 text-xl tracking-widest hover:bg-[#F5F5F0] dark:hover:bg-[#121212] transition-all"
        >
          CETAK KUPON (OPSIONAL)
        </button>
      </div>
    </div>
  );
}
