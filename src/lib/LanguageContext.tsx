import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'id' | 'en';

export const translations = {
  id: {
    // Nav / Menu
    menuAccess: 'Akses Menu',
    loginAdmin: 'Login sebagai Admin',
    registerAgain: 'Daftar Lagi',
    homePage: 'Halaman Utama',
    changeLanguage: 'Ganti Bahasa',
    english: 'Inggris (English)',
    indonesian: 'Indonesia',
    brandingFooter: 'Digital Kupon Kurban © 2026 • Kebersamaan dalam Berbagi',
    offline: 'Offline',
    
    // Registration Form
    couponTitle: 'Kupon Kurban',
    defaultMosqueName: 'Masjid Baiturrahman',
    defaultMosqueAddress: 'Alamat belum diatur',
    offlineMode: 'Mode Offline / Hubungi Panitia',
    outOfStockMsg: 'MOHON MAAF KUPON TELAH HABIS APABILA ADA KESALAHAN HUBUNGI PANITIA SETEMPAT dan segera konfirmasi',
    labelName: 'NAMA LENGKAP',
    placeholderName: 'TULIS NAMA ANDA...',
    labelPhone: 'NOMOR HP / WHATSAPP',
    placeholderPhone: '08XXXXXXXXXX',
    labelAddress: 'ALAMAT RUMAH',
    placeholderAddress: 'Tulis alamat rumah anda...',
    errorFillFields: 'Mohon isi Nama, No. HP, dan Alamat Anda',
    errorPhoneMin: 'Nomor HP tidak valid (Minimal 10 digit)',
    errorDupPhone: 'NOMOR HP INI SUDAH TERDAFTAR! SATU HP HANYA UNTUK SATU KUPON.',
    errorActiveCoupon: 'ANDA SUDAH MEMILIKI KUPON AKTIF. HARAP SELESAIKAN ANTRIAN ANDA.',
    processing: 'MEMPROSES...',
    getQueueNumber: 'AMBIL NOMOR ANTRIAN',
    limitReachedMsg: 'MAAF, KUPON BARU SAJA HABIS! HUBUNGI PANITIA.',
    permissionDeniedMsg: 'AKSES DITOLAK. MOHON HUBUNGI PANITIA.',
    msgGenericWargaError: 'Gagal mengambil kupon. Silakan coba lagi.',
    autoClosingReg: 'Sistem Otomatis Menutup Pendaftaran',
    maxCouponLabel: 'Maksimal Kupon',

    // Coupon Display
    loadingCoupon: 'MEMUAT KUPON ANDA...',
    couponNotFound: 'Kupon tidak ditemukan.',
    gpsActiveLocation: 'TERDETEKSI DI LOKASI',
    gpsActiveOutside: 'GPS AKTIF: LUAR LOKASI',
    gpsNoSupport: 'Perangkat tidak mendukung lokasi',
    gpsFailed: 'Gagal mendeteksi lokasi. Pastikan GPS aktif.',
    statusSuccess: 'SUKSES',
    statusPending: 'PENDING',
    statusExpired: 'KADALUARSA',
    queueNumberLabel: 'Nomor Antrian',
    qrSuccessDesc: 'SIAP DIGUNAKAN! Tunjukkan QR ini kepada petugas.',
    qrPendingDesc: 'MOHON MINTA PANITIA UNTUK SCAN QR CODE ANDA',
    qrExpiredDesc: 'MAAF, KUPON INI SUDAH TIDAK BERLAKU',
    gpsNearMessage: 'ANDA SUDAH DI LOKASI! VERIFIKASI AKAN BERJALAN OTOMATIS SAAT MENDEKATI WAKTU TUKAR',
    gpsFarMessage: 'MOHON TUNGGU NOMOR ANTRIAN DI SEBUT DAN SABAR',
    civicName: 'Nama',
    civicDate: 'Tanggal',
    alhamdulillahDesc: 'Alhamdulillah! Anda mendapatkan kupon kurban. Pengambilan daging dilakukan setelah pemotongan selesai.',
    savePageDesc: 'Silakan simpan halaman ini dan tunjukkan kepada panitia di lokasi Masjid.',
    validUntil: 'Berlaku sampai',
    wib: 'WIB',
    directionsToMosque: 'Petunjuk Jalan Ke Masjid',
    gpsNearSystemMsg: 'Sistem mendeteksi Anda sudah di lokasi masjid.',
    gpsFarSystemMsg: 'Pastikan GPS aktif & berada di sekitar lokasi untuk verifikasi panitia.',
    printCoupon: 'CETAK KUPON (OPSIONAL)',
  },
  en: {
    // Nav / Menu
    menuAccess: 'Menu Access',
    loginAdmin: 'Login as Admin',
    registerAgain: 'Register Again',
    homePage: 'Home Page',
    changeLanguage: 'Change Language',
    english: 'English',
    indonesian: 'Indonesian (Bahasa)',
    brandingFooter: 'Digital Qurban Coupon © 2026 • Togetherness in Sharing',
    offline: 'Offline',
    
    // Registration Form
    couponTitle: 'Qurban Coupon',
    defaultMosqueName: 'Baiturrahman Mosque',
    defaultMosqueAddress: 'Address not configured',
    offlineMode: 'Offline Mode / Contact Committee',
    outOfStockMsg: 'SORRY, COUPONS ARE OUT OF STOCK. IF THERE IS AN ERROR, PLEASE CONTACT THE LOCAL COMMITTEE IMMEDIATELY',
    labelName: 'FULL NAME',
    placeholderName: 'WRITE YOUR NAME...',
    labelPhone: 'PHONE NUMBER / WHATSAPP',
    placeholderPhone: '08XXXXXXXXXX',
    labelAddress: 'HOME ADDRESS',
    placeholderAddress: 'Write your home address...',
    errorFillFields: 'Please fill in your Name, Phone Number, and Address',
    errorPhoneMin: 'Invalid Phone Number (Minimum 10 digits)',
    errorDupPhone: 'THIS PHONE NUMBER IS ALREADY REGISTERED! ONE PHONE FOR ONE COUPON ONLY.',
    errorActiveCoupon: 'YOU ALREADY HAVE AN ACTIVE COUPON. PLEASE PROCESS YOUR QUEUE.',
    processing: 'PROCESSING...',
    getQueueNumber: 'GET QUEUE NUMBER',
    limitReachedMsg: 'SORRY, COUPONS HAVE JUST SOLD OUT! CONTACT COMMITTEE.',
    permissionDeniedMsg: 'ACCESS DENIED. PLEASE CONTACT COMMITTEE.',
    msgGenericWargaError: 'Failed to request coupon. Please try again.',
    autoClosingReg: 'System Automatically Closes Registration',
    maxCouponLabel: 'Max Coupons',

    // Coupon Display
    loadingCoupon: 'LOADING YOUR COUPON...',
    couponNotFound: 'Coupon not found.',
    gpsActiveLocation: 'DETECTED AT LOCATION',
    gpsActiveOutside: 'GPS ACTIVE: OUTSIDE LOCATION',
    gpsNoSupport: 'Device does not support location services',
    gpsFailed: 'Failed to detect location. Make sure GPS is enabled.',
    statusSuccess: 'SUCCESS',
    statusPending: 'PENDING',
    statusExpired: 'EXPIRED',
    queueNumberLabel: 'Queue Number',
    qrSuccessDesc: 'READY TO USE! Show this QR code to the committee.',
    qrPendingDesc: 'PLEASE ASK THE COMMITTEE TO SCAN YOUR QR CODE',
    qrExpiredDesc: 'SORRY, THIS COUPON IS NO LONGER VALID',
    gpsNearMessage: 'YOU ARE ALREADY AT THE LOCATION! VERIFICATION WILL RUN AUTOMATICALLY NEAR PICKUP TIME',
    gpsFarMessage: 'PLEASE WAIT FOR YOUR QUEUE NUMBER TO BE CALLED AND BE PATIENT',
    civicName: 'Name',
    civicDate: 'Date',
    alhamdulillahDesc: 'Alhamdulillah! You got a qurban coupon. Meat collection will be done after processing is complete.',
    savePageDesc: 'Please save this page and show it to the committee at the Mosque location.',
    validUntil: 'Valid until',
    wib: 'WIB',
    directionsToMosque: 'Get Directions to Mosque',
    gpsNearSystemMsg: 'System detects you are already at the mosque location.',
    gpsFarSystemMsg: 'Make sure your GPS is enabled & you are near the location for committee verification.',
    printCoupon: 'PRINT COUPON (OPTIONAL)',
  }
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.id;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' || saved === 'id') ? saved as Language : 'id';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
