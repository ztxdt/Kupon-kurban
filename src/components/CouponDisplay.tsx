import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, MapPin, Calendar, X, Map } from 'lucide-react';
import type { Coupon, Settings } from '../types';
import { format } from 'date-fns';
import { id as localeId, enUS as localeEn } from 'date-fns/locale';
import { useLanguage } from '../lib/LanguageContext';

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
  const { language, t } = useLanguage();
  const [floats, setFloats] = useState<{ id: number; text: string; x: number }[]>([]);

  const handleAnimalClick = () => {
    if (!coupon) return;
    const animalIndex = (coupon.queueNumber - 1) % 3;
    let voiceList: string[] = [];
    if (animalIndex === 0) {
      voiceList = language === 'id' 
        ? [
            "Moooo! 🐂", 
            "Sapi ini gembira bersamamu! 🐮", 
            "Moo! Aku siap membawa berkah kurban!", 
            "Jangan lupa berdoa & senyum hari ini! 😊", 
            "Chew chew... rumputnya manis sekali! 🌿",
            "Mooo! Antreanmu akan berkah untuk semua!"
          ]
        : [
            "Moooo! 🐂", 
            "This cow loves you! 🐮", 
            "Moo! Ready for the qurban blessings!", 
            "Pray & smile today! 😊", 
            "Chew chew... yummy sweet grass! 🌿",
            "Moo! Blessings are coming!"
          ];
    } else if (animalIndex === 1) {
      voiceList = language === 'id'
        ? [
            "Mbeee! 🐑", 
            "Domba ini bersih & tebal bulunya! 🐑", 
            "Mbeee! Siap membawamu ke gerbang pahala!", 
            "Semangat ya menunggu antreannya! ❤️", 
            "Mbeee! Senang menyapamu kawan kurban!",
            "Semoga ibadah kurban kita diterima Allah SWT! 🤲"
          ]
        : [
            "Mbeee! 🐑", 
            "Squeaky clean & thick wool! 🐑", 
            "Mbeee! Ready to bring reward!", 
            "Keep smiling while waiting! ❤️", 
            "Mbeee! Glad to meet you qurban friend!",
            "May our qurban be accepted and blessed! 🤲"
          ];
    } else {
      voiceList = language === 'id'
        ? [
            "Huumph! 🐫", 
            "Gurr! Unta padang pasir kurban istimewa! 🌵", 
            "Gagah dan perkasa siap untuk kurban!", 
            "Humph! Terima kasih sudah tulus berkupon!", 
            "Semoga sehat selalu sekeluarga! 🌟",
            "Hari kurban penuh rida & kebahagiaan!"
          ]
        : [
            "Huumph! 🐫", 
            "Gurr! Grand desert camel for qurban! 🌵", 
            "Sturdy and proud to carry blessings!", 
            "Humph! Thank you for choosing qurban!", 
            "Blessing & good health to your family! 🌟",
            "A day of pure joy & sacrifice!"
          ];
    }
    const randText = voiceList[Math.floor(Math.random() * voiceList.length)];
    const newId = Date.now() + Math.random();
    const randomOffset = Math.floor(Math.random() * 60) - 30; // x-offset for variety
    setFloats(prev => [...prev, { id: newId, text: randText, x: randomOffset }]);
    setTimeout(() => {
      setFloats(prev => prev.filter(f => f.id !== newId));
    }, 1500);
  };

  const renderCowSVG = () => (
    <svg viewBox="0 0 200 200" className="w-28 h-28 select-none pointer-events-none">
      {/* Cow Face Outline */}
      <rect x="50" y="60" width="100" height="90" rx="40" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="4" />
      {/* Spots on head */}
      <path d="M50,85 Q75,95 85,73 L72,60 L50,75 Z" fill="#374151" />
      <path d="M150,115 Q125,123 118,105 L132,90 L150,102 Z" fill="#374151" />
      {/* Floppy Ears */}
      <path d="M18,90 C15,70 35,70 50,80 C35,85 22,95 18,90 Z" fill="#374151" />
      <path d="M182,90 C185,70 165,70 150,80 C165,85 178,95 182,90 Z" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
      <path d="M182,90 C185,70 165,70 150,80" fill="#FCA5A5" opacity="0.4" />
      {/* Horns */}
      <path d="M53,62 C48,45 66,35 70,58" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M147,62 C152,45 134,35 130,58" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
      {/* Snout with pink nose */}
      <rect x="65" y="110" width="70" height="42" rx="20" fill="#FBCFE8" stroke="#F472B6" strokeWidth="2" />
      <circle cx="88" cy="125" r="4.5" fill="#374151" />
      <circle cx="112" cy="125" r="4.5" fill="#374151" />
      {/* Smiling mouth */}
      <path d="M90,136 Q100,143 110,136" fill="none" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
      {/* Big cute eyes */}
      <circle cx="80" cy="90" r="7.5" fill="#111827" />
      <circle cx="78" cy="88" r="2.5" fill="#FFFFFF" />
      <circle cx="120" cy="90" r="7.5" fill="#111827" />
      <circle cx="118" cy="88" r="2.5" fill="#FFFFFF" />
      {/* Cheeks blush */}
      <circle cx="68" cy="98" r="4" fill="#FCA5A5" opacity="0.8" />
      <circle cx="132" cy="98" r="4" fill="#FCA5A5" opacity="0.8" />
      {/* Clover grass in mouth */}
      <path d="M62,130 Q51,114 38,124" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="119" r="4" fill="#10B981" />
      <circle cx="34" cy="127" r="4" fill="#10B981" />
    </svg>
  );

  const renderGoatSVG = () => (
    <svg viewBox="0 0 200 200" className="w-28 h-28 select-none pointer-events-none">
      {/* Goat curly horns */}
      <path d="M55,60 Q38,36 32,58" fill="none" stroke="#78350F" strokeWidth="7" strokeLinecap="round" />
      <path d="M145,60 Q162,36 168,58" fill="none" stroke="#78350F" strokeWidth="7" strokeLinecap="round" />
      {/* Cloud fluffy wool background */}
      <path d="M45,85 C35,80 35,115 45,115 C35,125 50,145 65,135 C75,145 125,145 135,135 C150,145 165,125 155,115 C165,115 165,80 155,85 C165,65 135,55 125,65 C115,50 85,50 75,65 C65,55 35,65 45,85 Z" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="3" />
      {/* Cozy Goat Head */}
      <rect x="65" y="70" width="70" height="70" rx="35" fill="#FFFBEB" stroke="#FEF3C7" strokeWidth="2" />
      {/* Nose Snout */}
      <path d="M94,118 L106,118 Q100,126 94,118" fill="#FCA5A5" />
      <path d="M100,118 L100,126 Q100,131 94,131 M100,126 Q100,131 106,131" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
      {/* Smiling happy curved eyes */}
      <path d="M74,96 Q82,90 90,96" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
      <path d="M110,96 Q118,90 126,96" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
      {/* Floppy ears */}
      <path d="M42,95 Q28,103 40,112" fill="#FFFBEB" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
      <path d="M158,95 Q172,103 160,112" fill="#FFFBEB" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
      {/* Blush */}
      <circle cx="73" cy="106" r="4.5" fill="#FCA5A5" opacity="0.8" />
      <circle cx="127" cy="106" r="4.5" fill="#FCA5A5" opacity="0.8" />
    </svg>
  );

  const renderCamelSVG = () => (
    <svg viewBox="0 0 200 200" className="w-28 h-28 select-none pointer-events-none">
      {/* Camel Hump */}
      <path d="M40,140 C40,90 85,90 90,140" fill="#D97706" />
      {/* Neck */}
      <path d="M130,150 C130,100 142,88 135,72" fill="none" stroke="#F59E0B" strokeWidth="32" strokeLinecap="round" />
      <path d="M130,150 C130,100 142,88 135,72" fill="none" stroke="#B45309" strokeWidth="32" strokeLinecap="round" opacity="0.15" />
      {/* Head */}
      <rect x="75" y="45" width="70" height="42" rx="20" fill="#F59E0B" stroke="#D97706" strokeWidth="2" />
      {/* Big Snout */}
      <rect x="62" y="49" width="48" height="32" rx="15" fill="#D97706" />
      <circle cx="74" cy="59" r="3" fill="#78350F" />
      {/* Small Cute Ears */}
      <path d="M128,42 Q136,25 134,44" fill="#F59E0B" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
      <path d="M128,42 Q136,25 134,44" fill="#FCA5A5" opacity="0.4" />
      {/* Big eyes with gorgeous long eyelashes */}
      <circle cx="108" cy="54" r="5" fill="#111827" />
      <line x1="108" y1="49" x2="114" y2="44" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
      <line x1="104" y1="50" x2="108" y2="43" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
      <line x1="112" y1="52" x2="118" y2="48" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
      {/* Humorous smile */}
      <path d="M72,71 Q85,77 98,71" fill="none" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
      {/* Blush */}
      <circle cx="112" cy="63" r="3.5" fill="#FCA5A5" opacity="0.8" />
    </svg>
  );

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
        setGeoError(t.gpsNoSupport);
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
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          setGeoError(t.gpsFailed);
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
        <p className="mt-4 font-bold text-[#2D5A27] dark:text-[#4ADE80] animate-pulse transition-colors duration-300 uppercase">{t.loadingCoupon}</p>
      </div>
    );
  }

  if (!coupon) {
    return <div className="text-center p-10 dark:text-white">{t.couponNotFound}</div>;
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
            {isNearMosque ? t.gpsActiveLocation : t.gpsActiveOutside}
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
              {isVerified ? t.statusSuccess : isPending ? t.statusPending : t.statusExpired}
            </h2>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Queue Number */}
          <div className="text-center">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors duration-300">{t.queueNumberLabel}</p>
            <h3 className="text-[120px] font-black text-[#2D5A27] dark:text-[#4ADE80] leading-none mb-4 font-display italic transition-colors duration-300">
              {coupon.queueNumber}
            </h3>
          </div>

          {/* Sacrificial Animal Mascot for Pending Status */}
          {isPending && (() => {
            const animalIdx = (coupon.queueNumber - 1) % 3;
            const animalBgClass = animalIdx === 0
              ? 'bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
              : animalIdx === 1
              ? 'bg-amber-50 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300'
              : 'bg-orange-50 dark:bg-orange-950/15 border-orange-200 dark:border-orange-900/40 text-orange-850 dark:text-orange-300';
            
            const animalTitle = animalIdx === 0
              ? (language === 'id' ? 'Sapi Kurban Sehat' : 'Healthy Qurban Cow')
              : animalIdx === 1
              ? (language === 'id' ? 'Domba Kurban Prima' : 'Prime Qurban Sheep')
              : (language === 'id' ? 'Unta Kurban Gagah' : 'Strong Qurban Camel');

            const tapPrompt = language === 'id'
              ? 'Ketuk hewan untuk interaksi! 🔊'
              : 'Tap animal for interaction! 🔊';

            const activeCompanionLabel = language === 'id'
              ? 'Maskot Kurban Antreanmu:'
              : 'Your Queue Qurban Mascot:';

            return (
              <div className="flex flex-col items-center justify-center space-y-3">
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block text-center select-none">
                  {activeCompanionLabel}
                </span>

                <div className="relative w-full max-w-xs">
                  {/* Floating speech bubbles */}
                  <div className="absolute inset-x-0 bottom-[85%] flex justify-center pointer-events-none z-10">
                    <AnimatePresence>
                      {floats.map((float) => (
                        <motion.div
                          key={float.id}
                          initial={{ opacity: 0, y: 15, scale: 0.8 }}
                          animate={{ opacity: 1, y: -45, scale: 1 }}
                          exit={{ opacity: 0, y: -70, scale: 0.8 }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          style={{ left: `calc(50% + ${float.x}px)` }}
                          className="absolute transform -translate-x-1/2 bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] py-2 px-4 rounded-[1.2rem] shadow-xl text-xs font-black uppercase text-center whitespace-nowrap tracking-tight border border-white/10"
                        >
                          {float.text}
                          {/* Triangle indicator of speech bubble */}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-[#2D5A27] dark:border-t-[#4ADE80] w-0 h-0"></div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Animal visual container */}
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.9, rotate: [0, -12, 12, -8, 8, 0] }}
                    onClick={handleAnimalClick}
                    className={`cursor-pointer border-2 rounded-[2rem] p-6 flex flex-col items-center justify-center transform transition-colors duration-300 shadow-md ${animalBgClass} select-none`}
                  >
                    <div className="relative">
                      {animalIdx === 0 && renderCowSVG()}
                      {animalIdx === 1 && renderGoatSVG()}
                      {animalIdx === 2 && renderCamelSVG()}

                      {/* Ripple pulse ring animation under the animal */}
                      <span className="absolute -inset-1 rounded-full bg-white/15 dark:bg-black/10 animate-ping -z-10 opacity-70"></span>
                    </div>

                    <h4 className="font-extrabold text-sm uppercase tracking-wider mt-4 select-none">
                      {animalTitle}
                    </h4>
                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1.5 animate-pulse select-none">
                      {tapPrompt}
                    </p>
                  </motion.div>
                </div>
              </div>
            );
          })()}

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
                 ? t.qrSuccessDesc 
                 : isPending 
                 ? t.qrPendingDesc
                 : t.qrExpiredDesc}
            </p>
            {isPending && (
              <p className="text-center font-black text-red-600 dark:text-red-400 animate-bounce mt-4 uppercase text-sm tracking-tighter">
                {isNearMosque ? t.gpsNearMessage : t.gpsFarMessage}
              </p>
            )}
          </div>

          {/* Citizen Details */}
          <div className="grid grid-cols-2 gap-4 border-t-2 border-[#F5F5F0] dark:border-[#121212] pt-6 transition-colors duration-300">
            <div className="bg-[#F5F5F0] dark:bg-[#121212] p-4 rounded-2xl transition-colors duration-300">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t.civicName}</p>
              <p className="font-extrabold text-[#2D5A27] dark:text-[#4ADE80] text-lg leading-tight uppercase">{coupon.name}</p>
            </div>
            <div className="bg-[#F5F5F0] dark:bg-[#121212] p-4 rounded-2xl transition-colors duration-300">
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t.civicDate}</p>
              <p className="font-black text-[#2D5A27] dark:text-[#4ADE80]">
                {coupon.createdAt ? format(coupon.createdAt.toDate(), 'dd/MM/yyyy', { locale: language === 'id' ? localeId : localeEn }) : '...'}
              </p>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl space-y-4 border-l-8 border-[#2D5A27] dark:border-[#4ADE80] transition-colors duration-300">
             <p className="font-bold text-[#2D5A27] dark:text-[#4ADE80] italic text-xl leading-relaxed">
               {isVerified 
                 ? t.alhamdulillahDesc
                 : t.savePageDesc}
             </p>
             
              {isPending && coupon.expiresAt && (
                 <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500 font-bold bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800/50 transition-colors duration-300">
                   <Clock className="w-5 h-5" />
                   <p className="text-sm">
                     {t.validUntil}: {format(coupon.expiresAt.toDate(), 'HH:mm', { locale: language === 'id' ? localeId : localeEn })} {t.wib}
                   </p>
                 </div>
              )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {settings?.mosqueLat && settings?.mosqueLng && (
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${settings.mosqueLat},${settings.mosqueLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] p-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all uppercase tracking-tight"
          >
            <Map className="w-6 h-6" />
            {t.directionsToMosque}
          </a>
        )}
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-md transition-colors duration-300 border border-gray-100 dark:border-white/5">
           <MapPin className="w-6 h-6 text-[#2D5A27] dark:text-[#4ADE80]" />
           <p className="font-bold text-sm tracking-tight leading-tight">
             {isNearMosque ? t.gpsNearSystemMsg : t.gpsFarSystemMsg}
           </p>
        </div>
        {geoError && (
          <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-tighter">{geoError}</p>
        )}
        <button 
          onClick={() => window.print()} 
          className="w-full bg-white dark:bg-[#1E1E1E] border-4 border-[#2D5A27] dark:border-[#4ADE80] text-[#2D5A27] dark:text-[#4ADE80] font-black rounded-3xl p-5 text-xl tracking-widest hover:bg-[#F5F5F0] dark:hover:bg-[#121212] transition-all"
        >
          {t.printCoupon}
        </button>
      </div>
    </div>
  );
}
