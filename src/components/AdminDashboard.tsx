import React, { useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  getDoc,
  getDocs,
  getDocsFromServer,
  writeBatch,
  setDoc,
  orderBy,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { 
  LayoutDashboard, 
  QrCode, 
  Settings as SettingsIcon, 
  LogOut, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Database,
  Trash2,
  RefreshCw,
  UserPlus,
  X,
  Bell,
  ClipboardList,
  MapPin,
  Map as MapIcon,
  Download
} from 'lucide-react';
import type { Coupon, Settings, CouponCounter, AdminUser, AdminInvitation, AuditLog } from '../types';
import { QRScanner } from './QRScanner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface Props {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: Props) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [currentUserAdmin, setCurrentUserAdmin] = useState<AdminUser | null>(null);

  const isCreator = auth.currentUser?.email === 'alhabsyiadit@gmail.com';
  const isSuperAdmin = (admin?: AdminUser | null) => admin?.role === 'super_admin' || isCreator;
  
  // Ambil API Key dari Secrets (VITE_GOOGLE_MAPS_PLATFORM_KEY)
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

  const superAdminAccess = isSuperAdmin(currentUserAdmin);

  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [counter, setCounter] = useState<CouponCounter | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'notifications' | 'expired' | 'admins' | 'logs' | 'settings'>('overview');
  const [showScanner, setShowScanner] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'super_admin' | 'operator'>('operator');

  // Map Selection State
  const [mapPos, setMapPos] = useState({ lat: -6.2000, lng: 106.8166 });

  // List & Expired Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expiredSearchTerm, setExpiredSearchTerm] = useState('');

  // Logs Filter State
  const [logFilterEmail, setLogFilterEmail] = useState('');
  const [logFilterDate, setLogFilterDate] = useState('');

  const logAction = async (action: string, details: string) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action,
        details,
        adminEmail: auth.currentUser?.email || 'unknown',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  };

  const sendNotification = async (couponId: string, message: string) => {
    try {
      await updateDoc(doc(db, 'coupons', couponId), {
        notification: message
      });
      const coupon = coupons.find(c => c.id === couponId);
      await logAction('NOTIFIKASI', `Kirim notif ke ${coupon?.name || couponId}: ${message}`);
      setStatusMsg({ type: 'success', text: 'Notifikasi Terkirim!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `coupons/${couponId}`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  /**
   * Robust helper to delete documents in batches of 400
   */
  const deleteInChunks = async (docs: any[], onProgress?: (msg: string) => void) => {
    if (docs.length === 0) return;
    
    const CHUNK_SIZE = 400;
    const total = docs.length;
    let processed = 0;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      processed += chunk.length;
      if (onProgress) onProgress(`Membersihkan: ${processed}/${total}...`);
    }
  };

  const getExpiryLabel = (expiresAt: any) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = expiresAt.toDate();
    const diff = expiry.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 0) return { label: 'EXPIRED', color: 'text-red-600' };
    if (minutes <= 5) return { label: `${minutes}m LGI`, color: 'text-orange-600' };
    return { label: `${minutes}m`, color: 'text-gray-400' };
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'admins', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCurrentUserAdmin(prev => {
          if (prev?.role === data.role && prev?.email === data.email) return prev;
          return { id: snapshot.id, ...data } as AdminUser;
        });
      }
    }, (error) => {
       console.error('Error listening to current admin:', error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Listen to coupons
    const couponsPath = 'coupons';
    const q = query(collection(db, couponsPath), orderBy('queueNumber', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, couponsPath);
    });

    // Listen to admins
    const adminsPath = 'admins';
    const unsubAdmins = onSnapshot(collection(db, adminsPath), (snap) => {
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, adminsPath);
    });

    // Listen to invitations
    const invitationsPath = 'invitations';
    const unsubInvitations = onSnapshot(collection(db, invitationsPath), (snap) => {
      setInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminInvitation)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, invitationsPath);
    });

    // Listen to settings
    const settingsPath = 'config/settings';
    const unsubSettings = onSnapshot(doc(db, settingsPath), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Settings;
        setSettings(data);
        if (data.mosqueLat && data.mosqueLng) {
          setMapPos({ lat: data.mosqueLat, lng: data.mosqueLng });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, settingsPath);
    });

    // Listen to counter
    const counterPath = 'counters/coupons';
    const unsubCounter = onSnapshot(doc(db, counterPath), (doc) => {
      if (doc.exists()) setCounter(doc.data() as CouponCounter);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, counterPath);
    });

    return () => {
      unsub();
      unsubAdmins();
      unsubInvitations();
      unsubSettings();
      unsubCounter();
    };
  }, []);

  useEffect(() => {
    // Listen to audit logs (Super Admin Only)
    if (!superAdminAccess) {
      setAuditLogs([]);
      return;
    }
    
    const logsPath = 'audit_logs';
    const logsQ = query(collection(db, logsPath), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(logsQ, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    }, (error) => {
      console.error('Audit logs error:', error);
    });

    return () => unsubLogs();
  }, [superAdminAccess]);

  const handleLogout = async () => {
    if (!confirm('Apakah Anda yakin ingin keluar dari Dashboard?')) return;
    try {
      await auth.signOut();
      onLogout();
    } catch (err) {
      console.error('Logout failed:', err);
      onLogout(); // Still fallback to view change
    }
  };

  const handleVerify = async (id: string) => {
    const couponPath = `coupons/${id}`;
    try {
      await updateDoc(doc(db, couponPath), {
        status: 'verified',
        verifiedAt: serverTimestamp()
      });
      const coupon = coupons.find(c => c.id === id);
      await logAction('VERIFIKASI', `Kupon #${coupon?.queueNumber} (${coupon?.name}) diverifikasi`);
      setStatusMsg({ type: 'success', text: 'ALHAMDULILLAH! KUPON BERHASIL DIVERIFIKASI' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, couponPath);
      setStatusMsg({ type: 'error', text: 'GAGAL VERIFIKASI. SILAKAN COBA LAGI.' });
    }
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleManualStatus = async (id: string, newStatus: 'verified' | 'expired') => {
    const couponPath = `coupons/${id}`;
    try {
      const coupon = coupons.find(c => c.id === id);
      await updateDoc(doc(db, couponPath), {
        status: newStatus,
        ...(newStatus === 'verified' ? { verifiedAt: serverTimestamp() } : {})
      });
      await logAction('UPDATE_STATUS', `Status kupon #${coupon?.queueNumber} (${coupon?.name}) diubah menjadi ${newStatus.toUpperCase()}`);
      setStatusMsg({ type: 'success', text: `Status Kupon Berhasil Diubah ke ${newStatus.toUpperCase()}` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, couponPath);
      setStatusMsg({ type: 'error', text: 'Gagal memperbarui status.' });
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleScan = async (decodedText: string) => {
    setShowScanner(false);
    
    try {
      const docRef = doc(db, 'coupons', decodedText);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Coupon;
        if (data.status === 'verified') {
          setStatusMsg({ type: 'success', text: 'KUPON INI SUDAH PERNAH DIVERIFIKASI SEBELUMNYA' });
          setTimeout(() => setStatusMsg(null), 4000);
          return;
        }
        await handleVerify(decodedText);
      } else {
        setStatusMsg({ type: 'error', text: 'KUPON TIDAK DITEMUKAN / QR TIDAK VALID' });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `coupons/${decodedText}`);
      setStatusMsg({ type: 'error', text: 'TERJADI KESALAHAN SAAT MENGECEK KUPON' });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const removeCoupon = async (id: string) => {
    if (!confirm('Hapus data kupon ini secara permanen?')) return;
    try {
      const coupon = coupons.find(c => c.id === id);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'coupons', id));
      if (coupon?.phone) {
        batch.delete(doc(db, 'registrations_by_phone', coupon.phone));
      }
      await batch.commit();
      await logAction('HAPUS_KUPON', `Kupon #${coupon?.queueNumber} (${coupon?.name}) dihapus`);
      setStatusMsg({ type: 'success', text: 'Kupon Berhasil Dihapus' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `coupons/${id}`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const updateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const settingsPath = 'config/settings';
    const formData = new FormData(e.currentTarget);
    const newSettings: Settings = {
      mosqueName: (formData.get('mosqueName') as string) || 'Masjid Baiturrahman',
      mosqueAddress: (formData.get('mosqueAddress') as string) || '',
      maxCoupons: parseInt(formData.get('maxCoupons') as string) || 500,
      expiryMinutes: parseInt(formData.get('expiryMinutes') as string) || 60,
      mosqueLat: mapPos.lat,
      mosqueLng: mapPos.lng,
    };
    if (superAdminAccess && formData.get('loginPassword')) {
      newSettings.loginPassword = formData.get('loginPassword') as string;
    } else if (superAdminAccess && settings?.loginPassword) {
      // Keep existing password if not provided in form but already exists
      newSettings.loginPassword = settings.loginPassword;
    }
    try {
      await setDoc(doc(db, settingsPath), newSettings);
      await logAction('PENGATURAN', 'Pengaturan lokasi & info masjid diperbarui');
      setStatusMsg({ type: 'success', text: 'Pengaturan Disimpan!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, settingsPath);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  /**
   * Hard reset for the entire system
   */
  const resetCounter = async () => {
    if (!superAdminAccess) return;
    if (!confirm('Reset nomor antrian kembali ke 0? (Tidak menghapus data kupon)')) return;
    try {
      await setDoc(doc(db, 'counters', 'coupons'), { count: 0 });
      setCounter({ count: 0 });
      await logAction('RESET_COUNTER', 'Nomor antrian direset ke 0');
      setStatusMsg({ type: 'success', text: 'Nomor Antrian Berhasil Direset!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'counters/coupons');
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const clearVerifiedCoupons = async () => {
    if (!superAdminAccess) return;
    if (!confirm('Hapus SEMUA kupon yang sudah VERIFIED? (Akan mengosongkan antrian dan menambah sisa kuota)')) return;
    
    const verifieds = coupons.filter(c => c.status === 'verified');
    if (verifieds.length === 0) {
      setStatusMsg({ type: 'error', text: 'Tidak ada kupon terverifikasi' });
      return;
    }

    try {
      setStatusMsg({ type: 'success', text: `Menghapus ${verifieds.length} kupon...` });
      
      const batch = writeBatch(db);
      verifieds.forEach(c => {
        batch.delete(doc(db, 'coupons', c.id));
        if (c.phone) {
          batch.delete(doc(db, 'registrations_by_phone', c.phone));
        }
      });
      await batch.commit();

      await logAction('HAPUS_VERIFIED', `Menghapus massal ${verifieds.length} kupon terverifikasi`);
      setStatusMsg({ type: 'success', text: 'Kupon Terverifikasi Berhasil Dibersihkan!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'coupons');
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const clearExpiredCoupons = async () => {
    if (!superAdminAccess) return;
    if (!confirm('Hapus SEMUA kupon yang sudah EXPIRED?')) return;
    
    const now = new Date();
    const expiredDocs = coupons.filter(c => 
      c.status === 'expired' || (c.status === 'pending' && isExpired(c.expiresAt))
    );
    
    if (expiredDocs.length === 0) {
      setStatusMsg({ type: 'error', text: 'Tidak ada kupon expired' });
      return;
    }

    try {
      setStatusMsg({ type: 'success', text: `Menghapus ${expiredDocs.length} kupon...` });
      
      const batch = writeBatch(db);
      expiredDocs.forEach(c => {
        batch.delete(doc(db, 'coupons', c.id));
        if (c.phone) {
          batch.delete(doc(db, 'registrations_by_phone', c.phone));
        }
      });
      await batch.commit();

      await logAction('HAPUS_EXPIRED', `Menghapus massal ${expiredDocs.length} kupon expired`);
      setStatusMsg({ type: 'success', text: 'Kupon Expired Berhasil Dibersihkan!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'coupons');
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const resetAll = async () => {
    if (!superAdminAccess) {
      setStatusMsg({ type: 'error', text: 'TIDAK ADA IZIN RESET' });
      return;
    }
    
    if (!confirm('HAPUS TOTAL SEMUA DATA? (Kupon, Antrian, Log, & Undangan akan kembali ke NOL). Lanjutkan?')) return;
    
    setStatusMsg({ type: 'success', text: 'MEMULAI RESET SISTEM...' });
    
    try {
      // 1. Force clear local states first for immediate UI response
      setCoupons([]);
      setAuditLogs([]);
      setInvitations([]);
      setCounter({ count: 0 });

      // 2. Clear Counter in Firestore
      await setDoc(doc(db, 'counters', 'coupons'), { count: 0 });
      
      // 3. Fetch all collections using FROM SERVER to ensure we get everything
      setStatusMsg({ type: 'success', text: 'MENGAMBIL DATA UNTUK DIHAPUS...' });
      const [couponsSnap, logsSnap, invitationsSnap, phonesSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'coupons')),
        getDocsFromServer(collection(db, 'audit_logs')),
        getDocsFromServer(collection(db, 'invitations')),
        getDocsFromServer(collection(db, 'registrations_by_phone'))
      ]);

      const allDocs = [
        ...couponsSnap.docs,
        ...logsSnap.docs,
        ...invitationsSnap.docs,
        ...phonesSnap.docs
      ];

      if (allDocs.length > 0) {
        // 4. Delete everything in chunks
        await deleteInChunks(allDocs, (msg) => setStatusMsg({ type: 'success', text: msg }));
      }
      
      // 5. Final force update to ensure local stats are zero
      setCoupons([]);
      
      // 6. Final log entry for audit (DO NOT clear logs again after this)
      await logAction('RESET_TOTAL', 'SISTEM TELAH DIRESET TOTAL KEMBALI KE NOL');
      
      setStatusMsg({ type: 'success', text: 'SISTEM BERHASIL DI-RESET TOTAL! SEMUA KEMBALI KE 0.' });
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (e) {
      console.error('Hard reset failed:', e);
      setStatusMsg({ type: 'error', text: 'GAGAL RESET SERVER: ' + (e instanceof Error ? e.message : 'Error Unknown') });
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      await addDoc(collection(db, 'invitations'), {
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        invitedBy: auth.currentUser?.email,
        createdAt: serverTimestamp()
      });
      await logAction('UNDANG_PANITIA', `Mengundang ${inviteEmail} sebagai ${inviteRole}`);
      
      setInviteEmail('');
      setInviteRole('operator');
      setStatusMsg({ type: 'success', text: 'Email Panitia Berhasil Ditambahkan!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'invitations');
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const removeAdmin = async (uid: string) => {
    if (!confirm('Hapus akses panitia ini?')) return;
    try {
      const admin = admins.find(a => a.id === uid);
      await deleteDoc(doc(db, 'admins', uid));
      await logAction('HAPUS_ADMIN', `Akses admin ${admin?.email} dicabut`);
      setStatusMsg({ type: 'success', text: 'Akses Dihapus' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${uid}`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const removeInvitation = async (id: string) => {
    if (!confirm('Hapus undangan ini?')) return;
    try {
      const invite = invitations.find(i => i.id === id);
      await deleteDoc(doc(db, 'invitations', id));
      await logAction('HAPUS_UNDANGAN', `Undangan untuk ${invite?.email} dibatalkan`);
      setStatusMsg({ type: 'success', text: 'Undangan Berhasil Dihapus' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invitations/${id}`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const clearLogs = async () => {
    if (!superAdminAccess) {
      setStatusMsg({ type: 'error', text: 'ANDA TIDAK MEMILIKI IZIN' });
      return;
    }
    if (!confirm('HAPUS SEMUA LOG AKTIVITAS? (Data tidak dapat dikembalikan)')) return;
    
    setStatusMsg({ type: 'success', text: 'MEMBERSIHKAN LOG... MOHON TUNGGU' });
    try {
      // Immediate UI update
      setAuditLogs([]);

      const logsSnap = await getDocsFromServer(collection(db, 'audit_logs'));
      if (logsSnap.empty) {
        setStatusMsg({ type: 'success', text: 'Log Sudah Kosong' });
        return;
      }
      
      await deleteInChunks(logsSnap.docs, (msg) => setStatusMsg({ type: 'success', text: msg }));
      
      await logAction('CLEAR_LOGS', 'Seluruh log aktivitas telah dihapus');
      setStatusMsg({ type: 'success', text: 'Log Aktivitas Berhasil Dibersihkan' });
    } catch (err) {
      console.error('Failed to clear logs:', err);
      setStatusMsg({ type: 'error', text: `Gagal membersihkan log: ${err instanceof Error ? err.message : 'Error unknown'}` });
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const updateAdminRole = async (targetId: string, newRole: 'super_admin' | 'operator') => {
    if (auth.currentUser?.uid === targetId) {
      alert("Anda tidak bisa mengubah peran Anda sendiri.");
      return;
    }
    
    const targetAdmin = admins.find(a => a.id === targetId);
    
    // Check if target is also alhabsyiadit (Creator)
    if (targetAdmin?.email === 'alhabsyiadit@gmail.com') {
      alert("HAK AKSES CREATOR MUTLAK DAN TIDAK DAPAT DIUBAH.");
      return;
    }

    // Only Creator can edit Super Admin roles
    if (!isCreator && targetAdmin?.role === 'super_admin') {
      alert("HANYA CREATOR YANG DAPAT MENGUBAH PERAN SUPER ADMIN.");
      return;
    }

    try {
      await updateDoc(doc(db, 'admins', targetId), { role: newRole });
      await logAction('UBAH_PERAN', `Peran ${targetAdmin?.email} diubah menjadi ${newRole}`);
      setStatusMsg({ type: 'success', text: `Berhasil mengubah peran ${targetAdmin?.email}` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admins/${targetId}`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const removeAuditLogItem = async (id: string) => {
    if (!confirm('Hapus log aktivitas ini?')) return;
    try {
      await deleteDoc(doc(db, 'audit_logs', id));
      // No logAction for deleting a log to avoid infinite loop
      setStatusMsg({ type: 'success', text: 'Log Berhasil Dihapus' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `audit_logs/${id}`);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const downloadReport = () => {
    const verifiedCoupons = coupons
      .filter(c => c.status === 'verified')
      .sort((a, b) => a.queueNumber - b.queueNumber);
    
    if (verifiedCoupons.length === 0) {
      setStatusMsg({ type: 'error', text: 'TIDAK ADA KUPON TERVERIFIKASI UNTUK DILAPORKAN' });
      setTimeout(() => setStatusMsg(null), 3000);
      return;
    }

    const today = format(new Date(), 'dd-MM-yyyy');
    const fileName = `laporan-kupon-terverifikasi-${today}.csv`;
    
    let csvContent = `LAPORAN HARIAN KUPON TERVERIFIKASI - ${today}\n`;
    csvContent += `Total Terverifikasi: ${verifiedCoupons.length}\n\n`;
    csvContent += `No Antrian,Nama,No HP,Alamat,Waktu Verifikasi\n`;
    
    verifiedCoupons.forEach(c => {
      const vTime = c.verifiedAt ? format(c.verifiedAt.toDate(), 'HH:mm:ss') : '-';
      // Escape commas in name and address
      const safeName = c.name.replace(/"/g, '""');
      const safePhone = (c.phone || '').replace(/"/g, '""');
      const safeAddress = c.address.replace(/"/g, '""');
      csvContent += `${c.queueNumber},"${safeName}","${safePhone}","${safeAddress}",${vTime}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logAction('DOWNLOAD_LAPORAN', `Download laporan harian: ${verifiedCoupons.length} kupon`);
    setStatusMsg({ type: 'success', text: 'LAPORAN BERHASIL DIUNDUH!' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const isExpired = (expiresAt: any) => {
    if (!expiresAt) return false;
    const now = new Date();
    const expiry = expiresAt.toDate();
    return expiry.getTime() < now.getTime();
  };

  const usedCoupons = coupons.filter(c => 
    c.status === 'verified' || (c.status === 'pending' && !isExpired(c.expiresAt))
  ).length;

  const stats = {
    total: coupons.length,
    verified: coupons.filter(c => c.status === 'verified').length,
    pending: coupons.filter(c => c.status === 'pending' && !isExpired(c.expiresAt)).length,
    expired: coupons.filter(c => c.status === 'expired' || (c.status === 'pending' && isExpired(c.expiresAt))).length,
    remaining: Math.max(0, (settings?.maxCoupons || 0) - usedCoupons)
  };

  const getPercentageColor = () => {
    if (!settings?.maxCoupons) return 'text-gray-800';
    const percentRemaining = (stats.remaining / settings.maxCoupons) * 100;
    
    if (percentRemaining > 60) return 'text-green-600';
    if (percentRemaining > 45) return 'text-yellow-600';
    if (percentRemaining > 20) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBorderColor = () => {
    if (!settings?.maxCoupons) return 'border-blue-500';
    const percentRemaining = (stats.remaining / settings.maxCoupons) * 100;
    
    if (percentRemaining > 60) return 'border-green-500';
    if (percentRemaining > 45) return 'border-yellow-500';
    if (percentRemaining > 20) return 'border-orange-500';
    return 'border-red-500';
  };

  const getTodayStats = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayCoupons = coupons.filter(c => c.createdAt && c.createdAt.toDate() >= startOfDay);
    return {
      new: todayCoupons.length,
      verified: todayCoupons.filter(c => c.status === 'verified').length,
      expired: todayCoupons.filter(c => c.status === 'expired' || (getExpiryLabel(c.expiresAt)?.label === 'EXPIRED' && c.status === 'pending')).length
    };
  };

  const todayStats = getTodayStats();

  return (
    <div className="space-y-6 pt-4">
      {/* Admin Header */}
      <div className="bg-[#2D5A27] dark:bg-[#1B3618] p-6 rounded-3xl text-white shadow-xl flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 opacity-50" />
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none uppercase">DASHBOARD {superAdminAccess ? 'SUPER ADMIN' : 'ADMIN'}</h1>
            <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">{settings?.mosqueName}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-white/10 p-3 rounded-2xl hover:bg-red-500 transition-all">
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl font-bold flex items-center justify-center gap-3 animate-bounce shadow-lg ${statusMsg.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
           {statusMsg.type === 'success' ? <CheckCircle /> : <AlertCircle />}
           {statusMsg.text}
        </div>
      )}

      {/* Main Scanner Trigger */}
      <button 
        onClick={() => {
          setShowScanner(true);
        }}
        className="w-full bg-[#4CAF50] dark:bg-[#2D5A27] p-8 rounded-[40px] shadow-[0_12px_0_#2D5A27] dark:shadow-[0_12px_0_#121212] active:translate-y-2 active:shadow-none transition-all flex flex-col items-center gap-2"
      >
        <QrCode className="w-16 h-16 text-white" />
        <span className="text-3xl font-black text-white tracking-widest uppercase">SCAN KUPON</span>
      </button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl shadow-md border-b-8 border-yellow-500 transition-colors duration-300">
           <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Perlu Scan (Pending)</p>
           <h4 className="text-4xl font-black text-yellow-600 dark:text-yellow-500">{stats.pending}</h4>
        </div>
        <div className={`bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl shadow-md border-b-8 ${getBorderColor()} transition-colors duration-300`}>
           <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Sisa Kuota (Available)</p>
           <h4 className={`text-4xl font-black ${getPercentageColor()}`}>{stats.remaining}</h4>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-[#1E1E1E] p-2 rounded-3xl shadow-sm gap-2 overflow-x-auto transition-colors duration-300 border border-transparent dark:border-white/5">
        {(['overview', 'list', 'notifications', 'expired', 'admins', 'logs', 'settings'] as const)
          .filter(tab => {
            if (!superAdminAccess) {
              return !['admins', 'settings', 'logs'].includes(tab);
            }
            return true;
          })
          .map(tab => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`min-w-[80px] flex-1 p-3 rounded-2xl font-black text-[10px] uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212]' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}
           >
             {tab === 'overview' && <Users className="w-4 h-4 mx-auto mb-1" />}
             {tab === 'list' && <RefreshCw className="w-4 h-4 mx-auto mb-1" />}
             {tab === 'notifications' && <Bell className="w-4 h-4 mx-auto mb-1" />}
             {tab === 'expired' && <Clock className="w-4 h-4 mx-auto mb-1" />}
             {tab === 'admins' && <UserPlus className="w-4 h-4 mx-auto mb-1" />}
             {tab === 'logs' && <ClipboardList className="w-4 h-4 mx-auto mb-1" />}
             {tab === 'settings' && <SettingsIcon className="w-4 h-4 mx-auto mb-1" />}
             <span className="block mt-1">
               {tab === 'admins' ? 'Panitia' : tab === 'notifications' ? 'Notif' : tab === 'expired' ? 'Expired' : tab}
             </span>
           </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-xl p-6 min-h-[400px] transition-colors duration-300 border border-transparent dark:border-white/5">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-black text-2xl text-[#2D5A27] dark:text-[#4ADE80] uppercase tracking-tighter">STATISTIK KUPON</h3>
              <div className="flex flex-wrap items-center gap-3">
                {superAdminAccess && (
                  <>
                    <button 
                      onClick={clearVerifiedCoupons}
                      className="bg-white dark:bg-[#1E1E1E] text-red-600 dark:text-red-400 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase border-2 border-red-100 dark:border-red-900/30 hover:bg-red-50 transition-all flex items-center gap-2"
                      title="Hapus Kupon Selesai"
                    >
                      <Trash2 className="w-4 h-4" />
                      BERSIHKAN VERIFIED
                    </button>
                    <button 
                      onClick={downloadReport}
                      className="bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      LAPORAN
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Charts Section */}
            {/* Today Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <p className="text-[10px] font-black text-blue-500 uppercase mb-1">Baru Hari Ini</p>
                <p className="text-3xl font-black dark:text-white">{todayStats.new}</p>
                <div className="mt-2 h-1 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(todayStats.new / Math.max(1, coupons.length)) * 100}%` }}></div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <p className="text-[10px] font-black text-green-500 uppercase mb-1">Terverifikasi</p>
                <p className="text-3xl font-black dark:text-white">{todayStats.verified}</p>
                <div className="mt-2 h-1 w-full bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${(todayStats.verified / Math.max(1, todayStats.new)) * 100}%` }}></div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <p className="text-[10px] font-black text-red-500 uppercase mb-1">Hangus</p>
                <p className="text-3xl font-black dark:text-white">{todayStats.expired}</p>
                <div className="mt-2 h-1 w-full bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden">
                   <div className="h-full bg-red-500" style={{ width: `${(todayStats.expired / Math.max(1, todayStats.new)) * 100}%` }}></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart */}
              <div className="h-[300px] w-full bg-gray-50 dark:bg-[#121212] p-4 rounded-3xl border border-gray-100 dark:border-white/5">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-4 text-center">Distribusi Status Kupon</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pending', count: stats.pending, color: '#FAB005' },
                    { name: 'Verified', count: stats.verified, color: '#40C057' },
                    { name: 'Expired', count: coupons.filter(c => getExpiryLabel(c.expiresAt)?.label === 'EXPIRED' && c.status === 'pending').length + coupons.filter(c => c.status === 'expired').length, color: '#FA5252' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#888' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#888' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }} 
                      contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                      { [stats.pending, stats.verified, 0].map((_, i) => (
                        <Cell key={i} fill={['#FAB005', '#40C057', '#FA5252'][i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="h-[300px] w-full bg-gray-50 dark:bg-[#121212] p-4 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col items-center">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-4">Persentase Status</p>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Antrian', value: stats.pending },
                        { name: 'Selesai', value: stats.verified },
                        { name: 'Hangus', value: coupons.filter(c => getExpiryLabel(c.expiresAt)?.label === 'EXPIRED' && c.status === 'pending').length + coupons.filter(c => c.status === 'expired').length }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#FAB005" />
                      <Cell fill="#40C057" />
                      <Cell fill="#FA5252" />
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#FAB005]"></div>
                    <span className="text-[8px] font-black text-gray-500">PENDING</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#40C057]"></div>
                    <span className="text-[8px] font-black text-gray-500">VERIFIED</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#FA5252]"></div>
                    <span className="text-[8px] font-black text-gray-500">EXPIRED</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Existing Info Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center p-4 bg-[#F5F5F0] dark:bg-[#121212] rounded-2xl transition-colors duration-300 group">
                 <div className="flex flex-col">
                   <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-[10px]">Total Terbit</span>
                   <span className="text-[8px] text-gray-400 uppercase italic">Kupon Saat Ini</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-black text-xl dark:text-white">{coupons.length}</span>
                   {superAdminAccess && coupons.length > 0 && (
                     <button 
                       type="button"
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearVerifiedCoupons(); }} 
                       className="p-6 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl opacity-100 transition-all cursor-pointer relative z-[9999] active:scale-75 shadow-xl flex items-center justify-center min-w-[64px] min-h-[64px]" 
                       title="Bersihkan Kupon Selesai (Verified)"
                     >
                       <Trash2 className="w-8 h-8 pointer-events-none" />
                     </button>
                   )}
                 </div>
              </div>
              <div className="flex justify-between items-center p-4 bg-[#F5F5F0] dark:bg-[#121212] rounded-2xl transition-colors duration-300 group">
                 <div className="flex flex-col">
                   <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-[10px]">Nomor Terakhir</span>
                   <span className="text-[8px] text-gray-400 uppercase italic">Sejarah Antrian</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="font-black text-xl text-blue-600 dark:text-blue-400">{counter?.count || 0}</span>
                   {superAdminAccess && (counter?.count || 0) > 0 && (
                     <button onClick={resetCounter} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" title="Reset Counter ke 0">
                       <RefreshCw className="w-4 h-4" />
                     </button>
                   )}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl uppercase dark:text-white">Audit Log (Aktivitas Admin)</h3>
              {auditLogs.length > 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); clearLogs(); }}
                  className="p-6 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-xl cursor-pointer z-[9999] flex items-center justify-center min-w-[64px] min-h-[64px] relative active:scale-75"
                  title="Bersihkan Log"
                >
                  <Trash2 className="w-8 h-8 pointer-events-none" />
                </button>
              )}
            </div>
            
            {/* Log Filters */}
            <div className="grid grid-cols-2 gap-3 pb-4 border-b dark:border-white/10">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-1 block transition-colors duration-300">Email Admin</label>
                <input 
                  type="text" 
                  value={logFilterEmail}
                  onChange={(e) => setLogFilterEmail(e.target.value)}
                  placeholder="Cari email..."
                  className="w-full bg-gray-50 dark:bg-[#121212] p-2 rounded-lg text-xs font-bold border border-gray-100 dark:border-white/10 dark:text-white transition-colors duration-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 mb-1 block transition-colors duration-300">Tanggal</label>
                <input 
                  type="date" 
                  value={logFilterDate}
                  onChange={(e) => setLogFilterDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#121212] p-2 rounded-lg text-xs font-bold border border-gray-100 dark:border-white/10 dark:text-white transition-colors duration-300"
                />
              </div>
            </div>

            <div className="space-y-3">
              {auditLogs
                .filter(log => {
                  const matchEmail = log.adminEmail.toLowerCase().includes(logFilterEmail.toLowerCase());
                  const logDate = log.timestamp ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : '';
                  const matchDate = logFilterDate ? logDate === logFilterDate : true;
                  return matchEmail && matchDate;
                })
                .map(log => (
                  <div key={log.id} className="p-3 bg-gray-50 dark:bg-[#121212] rounded-xl border border-gray-100 dark:border-white/10 flex flex-col gap-1 transition-colors duration-300">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="bg-gray-200 dark:bg-white/10 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">{log.action}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 dark:text-gray-600">
                          {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss dd/MM', { locale: localeId }) : '...'}
                        </span>
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            removeAuditLogItem(log.id); 
                          }}
                          className="p-6 bg-white dark:bg-[#1E1E1E] text-gray-400 hover:text-red-500 rounded-2xl transition-all cursor-pointer z-[9999] flex items-center justify-center relative min-w-[64px] min-h-[64px] shadow-xl active:scale-75"
                          title="Hapus Log"
                        >
                          <Trash2 className="w-8 h-8 pointer-events-none" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      {log.details.replace(/\(.*\)/, '(***)')}
                    </p>
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase">{log.adminEmail}</p>
                  </div>
                ))}
              {auditLogs.length === 0 && (
                <p className="text-center py-10 text-gray-400 dark:text-gray-500 font-bold uppercase italic">Belum ada log aktivitas.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'expired' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl uppercase dark:text-white">Kupon Kadaluarsa</h3>
              <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-black uppercase transition-colors duration-300">
                {coupons.filter(c => c.status === 'pending' && getExpiryLabel(c.expiresAt)?.label === 'EXPIRED').length} TOTAL
              </span>
            </div>

            <div className="relative">
              <input 
                type="text"
                placeholder="CARI NAMA / ALAMAT..."
                value={expiredSearchTerm}
                onChange={(e) => setExpiredSearchTerm(e.target.value)}
                className="w-full p-4 bg-gray-50 dark:bg-[#121212] border-2 border-gray-100 dark:border-white/5 rounded-2xl font-bold text-xs outline-none transition-all focus:border-red-500 dark:text-white"
              />
            </div>
            
            <div className="space-y-3">
              {coupons
                .filter(c => {
                  const isExpired = getExpiryLabel(c.expiresAt)?.label === 'EXPIRED' && c.status === 'pending';
                  const matchSearch = expiredSearchTerm === '' || 
                    c.name.toLowerCase().includes(expiredSearchTerm.toLowerCase()) || 
                    c.address.toLowerCase().includes(expiredSearchTerm.toLowerCase());
                  return isExpired && matchSearch;
                })
                .map(c => (
                  <div key={c.id} className="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 space-y-3 shadow-sm transition-colors duration-300">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-600 dark:bg-red-700 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-colors duration-300">
                          {c.queueNumber}
                        </div>
                        <div>
                          <p className={`font-black text-sm uppercase ${c.status === 'verified' ? 'text-green-600 font-black' : 'text-red-900 dark:text-red-300'}`}>
                            {c.status === 'pending' && !isExpired ? c.name : `KUPON ${c.status === 'verified' ? 'SELESAI' : 'HANGUS'}`}
                          </p>
                          <p className="text-[10px] font-bold text-red-600 dark:text-red-500 uppercase opacity-70">
                            {c.status === 'pending' && !isExpired ? `Expired: ${format(c.expiresAt.toDate(), 'HH:mm dd/MM', { locale: localeId })}` : 'DATA PENERIMA DISEMBUNYIKAN'}
                          </p>
                        </div>
                      </div>
                      {superAdminAccess && (
                        <button 
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await removeCoupon(c.id);
                          }}
                          className="p-6 bg-white dark:bg-[#1E1E1E] text-red-600 dark:text-red-400 rounded-2xl border-2 border-red-100 dark:border-white/10 hover:bg-red-600 dark:hover:bg-red-700 hover:text-white dark:hover:text-white transition-all shadow-2xl cursor-pointer min-w-[64px] min-h-[64px] flex items-center justify-center relative z-[9999] active:scale-75"
                          title="Hapus Permanen"
                        >
                          <Trash2 className="w-8 h-8 pointer-events-none" />
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1 mt-1 bg-white/50 dark:bg-white/5 p-2 rounded-xl transition-colors duration-300">
                      <MapPin className="w-3 h-3" />
                      {c.status === 'pending' && !isExpired ? c.address : '*** ALAMAT DIHAPUS ***'}
                    </div>
                  </div>
                ))}
              {coupons.filter(c => c.status === 'pending' && getExpiryLabel(c.expiresAt)?.label === 'EXPIRED').length === 0 && (
                <div className="text-center py-20 bg-gray-50 dark:bg-[#121212] rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/5 transition-colors duration-300">
                  <p className="text-gray-400 dark:text-gray-600 font-bold uppercase text-xs tracking-widest italic tracking-widest">Tidak ada kupon kadaluarsa</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-4">
             <div className="flex flex-col gap-4 bg-[#F5F5F0] dark:bg-[#121212] p-4 rounded-3xl transition-colors duration-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-xl uppercase dark:text-white">Daftar Antrian</h3>
                  {superAdminAccess && (
                    <button 
                      type="button"
                      onClick={async (e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        await resetAll(); 
                      }} 
                      className="p-6 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-xl cursor-pointer z-[9999] flex items-center justify-center min-w-[64px] min-h-[64px] relative active:scale-75" 
                      title="Reset Semua Data"
                    >
                      <Trash2 className="w-8 h-8 pointer-events-none" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input 
                    type="text"
                    placeholder="CARI NAMA / ALAMAT..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E1E1E] p-3 rounded-xl text-xs font-black border border-transparent focus:border-[#2D5A27] dark:focus:border-[#4ADE80] outline-none transition-all dark:text-white"
                  />
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E1E1E] p-3 rounded-xl text-xs font-black border border-transparent outline-none dark:text-white"
                  >
                    <option value="all">SEMUA STATUS</option>
                    <option value="pending">AKTIF (PENDING)</option>
                    <option value="verified">SELESAI (VERIFIED)</option>
                    <option value="expired">HANGUS (EXPIRED)</option>
                  </select>
                  <button 
                    onClick={() => window.print()} 
                    className="md:col-span-2 w-full bg-[#202020] text-white p-3 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center justify-center gap-2 print:hidden"
                  >
                    <Download className="w-4 h-4" /> CETAK / EXPORT PDF LAPORAN
                </button>
                </div>
             </div>

             <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
                {coupons
                  .filter(c => {
                    const expiry = getExpiryLabel(c.expiresAt);
                    const isActuallyExpired = expiry?.label === 'EXPIRED' && c.status === 'pending';
                    
                    const matchesStatus = statusFilter === 'all' || 
                      (statusFilter === 'pending' && c.status === 'pending' && !isActuallyExpired) ||
                      (statusFilter === 'verified' && c.status === 'verified') ||
                      (statusFilter === 'expired' && (c.status === 'expired' || isActuallyExpired));

                    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.queueNumber.toString().includes(searchTerm);

                    return matchesStatus && matchesSearch;
                  })
                  .map(c => {
                    const expiry = getExpiryLabel(c.expiresAt);
                    const isNearingExpiry = expiry?.label !== 'EXPIRED' && c.status === 'pending' && expiry && parseInt(expiry.label) <= 5;
                    const isActuallyExpired = expiry?.label === 'EXPIRED' && c.status === 'pending';

                    return (
                      <div key={c.id} className={`flex items-center gap-4 p-4 rounded-2xl border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isNearingExpiry ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                        <div className={`w-12 h-12 ${c.status === 'verified' ? 'bg-green-600' : isActuallyExpired ? 'bg-red-600' : isNearingExpiry ? 'bg-yellow-500' : 'bg-[#2D5A27] dark:bg-[#4ADE80]'} text-white dark:text-[#121212] flex items-center justify-center rounded-xl font-black text-xl flex-shrink-0 transition-colors duration-300 shadow-sm`}>
                          {c.queueNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-black uppercase transition-colors duration-300 truncate ${c.status === 'verified' ? 'text-green-600' : isActuallyExpired ? 'text-red-600' : isNearingExpiry ? 'text-yellow-600' : 'text-[#2D5A27] dark:text-[#4ADE80]'}`}>
                            {c.status === 'pending' && !isActuallyExpired ? c.name : `KUPON ${c.status === 'verified' ? 'SELESAI' : 'HANGUS'}`}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-gray-400 dark:text-gray-600" />
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase truncate">
                              {c.status === 'pending' && !isActuallyExpired ? c.address : '*** DATA DIHAPUS ***'}
                            </p>
                          </div>
                          {c.status === 'pending' && !isActuallyExpired && (
                            <p className={`text-[9px] font-black uppercase mt-1 ${isNearingExpiry ? 'text-yellow-600 animate-pulse' : 'text-gray-400'}`}>
                              {isNearingExpiry ? '⚠️ SEGERA BERAKHIR: ' : 'EXPIRES: '}{expiry?.label}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 relative">
                          <div className="flex gap-1">
                            {superAdminAccess && (
                              <button 
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  await removeCoupon(c.id);
                                }}
                                className="bg-red-50 text-red-600 p-6 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-xl flex items-center justify-center cursor-pointer min-w-[64px] min-h-[64px] relative z-[9999] active:scale-75"
                                title="Hapus Permanen"
                              >
                                <Trash2 className="w-8 h-8 pointer-events-none" />
                              </button>
                            )}
                            {c.status === 'pending' && !isActuallyExpired ? (
                              <>
                                <button 
                                  onClick={() => handleVerify(c.id)}
                                  className="bg-green-600 text-white px-2 py-2 rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-green-700 transition-all flex items-center justify-center"
                                  title="Set Verified"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleManualStatus(c.id, 'expired')}
                                  className="bg-orange-600 text-white px-2 py-2 rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-orange-700 transition-all flex items-center justify-center"
                                  title="Set Expired"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                {c.status === 'verified' ? (
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-[8px] font-black uppercase">VERIFIED</span>
                                ) : (
                                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[8px] font-black uppercase">EXPIRED</span>
                                )}
                                {superAdminAccess && (
                                  <button 
                                    onClick={async () => {
                                      if(!confirm(`Reset status ${c.name} ke Pending?`)) return;
                                      try {
                                        await updateDoc(doc(db, 'coupons', c.id), { status: 'pending', verifiedAt: null });
                                        await logAction('RESET_KUPON', `Kupon #${c.queueNumber} (${c.name}) dikembalikan ke Pending`);
                                        setStatusMsg({ type: 'success', text: 'Status Kupon Berhasil di-Reset' });
                                      } catch(err) {
                                        handleFirestoreError(err, OperationType.UPDATE, `coupons/${c.id}`);
                                      }
                                      setTimeout(() => setStatusMsg(null), 3000);
                                    }}
                                    className="p-1 text-gray-400 dark:text-gray-600 hover:text-orange-500 transition-colors"
                                    title="Reset ke Pending"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {coupons.length === 0 && <p className="text-center p-10 text-gray-400 dark:text-gray-500 italic">Belum ada data...</p>}
             </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-8">
            {/* Broadcast Section */}
            {superAdminAccess && (
              <div className="bg-[#2D5A27] dark:bg-[#1B3618] text-white p-6 rounded-3xl shadow-xl space-y-4 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-full">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-lg uppercase tracking-tight">Kirim Notifikasi Massal</h3>
                </div>
                <p className="text-[10px] font-bold text-white/70 uppercase">Kirim pesan ke SEMUA warga yang sedang mengantri (Pending)</p>
                <button 
                  onClick={() => {
                    const msg = prompt("Tulis pesan untuk SEMUA antrian pending:");
                    if (msg) {
                      const pending = coupons.filter(c => c.status === 'pending');
                      if (pending.length === 0) return alert("Tidak ada antrian pending.");
                      pending.forEach(c => sendNotification(c.id, msg));
                    }
                  }}
                  className="w-full bg-white dark:bg-[#4ADE80] text-[#2D5A27] dark:text-[#121212] p-4 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all"
                >
                  KIRIM KE {coupons.filter(c => c.status === 'pending').length} ORANG
                </button>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b dark:border-white/10 pb-2 transition-colors duration-300">
                <h3 className="font-black text-xl uppercase dark:text-white">Kupon Aktif</h3>
                <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] px-2 py-1 rounded-full font-black uppercase transition-colors duration-300">
                  {coupons.filter(c => c.status === 'pending' && getExpiryLabel(c.expiresAt)?.label !== 'EXPIRED').length} ANTRIAN
                </span>
              </div>
              
              <div className="space-y-3">
                {coupons.filter(c => c.status === 'pending' && getExpiryLabel(c.expiresAt)?.label !== 'EXPIRED').map(c => {
                   const expiry = getExpiryLabel(c.expiresAt);
                   return (
                     <div key={c.id} className="p-4 bg-white dark:bg-[#121212] rounded-2xl flex items-center justify-between gap-4 border border-gray-100 dark:border-white/10 shadow-sm transition-colors duration-300">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] rounded-lg flex items-center justify-center font-black transition-colors duration-300">
                            {c.queueNumber}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm uppercase truncate dark:text-white">
                              {c.status === 'pending' ? c.name : 'KUPON SELESAI'}
                            </p>
                            {c.phone && c.status === 'pending' && (
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black italic">📞 {c.phone}</p>
                            )}
                            <p className={`text-[10px] font-black uppercase transition-colors duration-300 ${expiry?.color}`}>
                              {c.status === 'pending' ? `Expires: ${expiry?.label}` : 'DATA DISEMBUNYIKAN'}
                            </p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => {
                             const msg = prompt(`Kirim pesan untuk ${c.name}:`);
                             if (msg) sendNotification(c.id, msg);
                           }}
                           className="bg-gray-100 dark:bg-[#1E1E1E] text-gray-600 dark:text-gray-400 p-3 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all transition-colors duration-300"
                         >
                           <Bell className="w-4 h-4" />
                         </button>
                         {superAdminAccess && (
                           <button 
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              await removeCoupon(c.id);
                            }}
                            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-2xl cursor-pointer min-w-[64px] min-h-[64px] flex items-center justify-center relative z-[9999] active:scale-75"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-7 h-7 pointer-events-none" />
                          </button>
                         )}
                       </div>
                     </div>
                   );
                })}
              </div>

              {/* Expired Section */}
              <div className="pt-6 space-y-6">
                <div className="flex items-center justify-between border-b dark:border-white/10 pb-2 transition-colors duration-300">
                  <h3 className="font-black text-xl uppercase text-red-600 dark:text-red-400">Kupon Kadaluarsa</h3>
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] px-2 py-1 rounded-full font-black uppercase transition-colors duration-300">
                    {coupons.filter(c => c.status === 'pending' && getExpiryLabel(c.expiresAt)?.label === 'EXPIRED').length} TOTAL
                  </span>
                </div>
                
                <div className="space-y-3">
                  {coupons.filter(c => c.status === 'pending' && getExpiryLabel(c.expiresAt)?.label === 'EXPIRED').map(c => (
                     <div key={c.id} className="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-2xl flex items-center justify-between gap-4 border border-red-100 dark:border-red-900/30 transition-colors duration-300">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-600 dark:bg-red-700 text-white rounded-lg flex items-center justify-center font-black transition-colors duration-300">
                            {c.queueNumber}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm uppercase truncate text-red-900 dark:text-red-300">KUPON HANGUS</p>
                            <p className="text-[10px] font-black uppercase text-red-600 dark:text-red-400">DATA DISEMBUNYIKAN</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={() => sendNotification(c.id, "MAAF: Kupon Anda sudah kadaluarsa. Silakan hubungi panitia untuk bantuan.")}
                           className="bg-gray-100 dark:bg-white/5 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-all shadow-sm"
                         >
                           <Bell className="w-4 h-4" />
                         </button>
                         {superAdminAccess && (
                           <button 
                             type="button"
                             onClick={async (e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               await removeCoupon(c.id);
                             }}
                             className="bg-white dark:bg-[#1E1E1E] text-red-600 dark:text-red-400 p-6 rounded-2xl border-2 border-red-200 dark:border-white/10 hover:bg-red-600 hover:text-white transition-all cursor-pointer min-w-[64px] min-h-[64px] flex items-center justify-center relative z-[9999] active:scale-75"
                             title="Hapus Permanen"
                           >
                             <Trash2 className="w-8 h-8 pointer-events-none" />
                           </button>
                         )}
                       </div>
                     </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl uppercase dark:text-white">Kelola Panitia (Admin)</h3>
            </div>
            
            <form onSubmit={handleAddAdmin} className="space-y-4 bg-gray-50 dark:bg-[#121212] p-4 rounded-2xl transition-colors duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Tambah Email Panitia</label>
                <input 
                  type="email" 
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="panitia@gmail.com"
                  className="w-full p-4 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm dark:text-white transition-colors duration-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Peran (Role)</label>
                <div className="flex gap-2">
                  {(['operator', 'super_admin'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`flex-1 p-3 rounded-xl font-black text-[10px] uppercase tracking-tighter transition-all ${inviteRole === r ? 'bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212]' : 'bg-white dark:bg-[#1E1E1E] text-gray-400 dark:text-gray-600 border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'}`}
                    >
                      {r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <button className="w-full bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] p-4 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">
                UNDANG PANITIA
              </button>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 font-medium italic text-center">Panitia baru harus login dengan Email Google ini untuk mendapatkan akses.</p>
            </form>

            <div className="space-y-4">
              <h4 className="font-bold text-xs uppercase text-gray-500 dark:text-gray-400 border-b dark:border-white/10 pb-2">Panitia Aktif ({admins.length})</h4>
              <div className="space-y-2">
                {admins.map(admin => (
                  <div key={admin.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#121212] rounded-xl transition-colors duration-300">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate dark:text-white">{admin.email}</p>
                      <div className="flex flex-col gap-1 mt-1">
                        {superAdminAccess && admin.email !== auth.currentUser?.email && admin.email !== 'alhabsyiadit@gmail.com' ? (
                          <div className="space-y-1 mt-2">
                             <div className="flex items-center gap-2">
                               <div className="h-[1px] flex-1 bg-gray-100 dark:bg-white/5"></div>
                               <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">EDIT ROLE</p>
                               <div className="h-[1px] flex-1 bg-gray-100 dark:bg-white/5"></div>
                             </div>
                            <div className="flex bg-gray-200 dark:bg-white/10 p-0.5 rounded-lg w-full">
                              {(['operator', 'super_admin'] as const).map(role => (
                                <button
                                  key={role}
                                  onClick={() => updateAdminRole(admin.id, role)}
                                  className={`flex-1 text-[8px] py-1.5 rounded-md font-black uppercase transition-all flex items-center justify-center gap-1.5 ${admin.role === role ? (role === 'super_admin' ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-300' : 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300') : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
                                >
                                  {role === 'super_admin' ? '🐐 ' : '☑️ '}
                                  {role === 'super_admin' ? 'SUPER ADMIN' : 'PANITIA'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className={`mt-1 text-[9px] px-3 py-1 rounded-full font-black uppercase flex items-center gap-1.5 w-fit shadow-sm ${admin.email === 'alhabsyiadit@gmail.com' ? 'bg-green-100 text-green-700 border border-green-200' : admin.role === 'super_admin' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/30'}`}>
                            {admin.email === 'alhabsyiadit@gmail.com' ? '✅ CREATOR' : admin.role === 'super_admin' ? '🐐 SUPER ADMIN' : '☑️ PANITIA'}
                          </div>
                        )}
                        {admin.email === auth.currentUser?.email && <span className="text-[8px] bg-gray-100 dark:bg-white/10 text-gray-500 px-2 py-0.5 rounded-full font-black uppercase w-fit mt-1">ANDA</span>}
                      </div>
                    </div>
                    {admin.email !== auth.currentUser?.email && admin.email !== 'alhabsyiadit@gmail.com' && (
                      <button 
                        type="button"
                        onClick={async (e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          await removeAdmin(admin.id); 
                        }} 
                        className="bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-700 p-6 rounded-2xl transition-all shadow-xl cursor-pointer z-[9999] min-w-[64px] min-h-[64px] relative active:scale-75"
                        title="Hapus Akses"
                      >
                        <Trash2 className="w-8 h-8 pointer-events-none" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {invitations.length > 0 && (
                <>
                  <h4 className="font-bold text-xs uppercase text-gray-500 dark:text-gray-400 border-b dark:border-white/10 pb-2 mt-6">Menunggu Login ({invitations.length})</h4>
                  <div className="space-y-2">
                    {invitations.map(invite => (
                      <div key={invite.id} className="flex justify-between items-center p-3 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                        <div>
                          <p className="font-medium text-sm text-gray-400 dark:text-gray-600 italic truncate">{invite.email}</p>
                          <span className="text-[8px] font-black text-gray-300 dark:text-gray-700 uppercase italic">Calon {invite.role === 'super_admin' ? 'SUPER ADMIN' : 'PANITIA'}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeInvitation(invite.id); }} 
                          className="bg-red-50 dark:bg-white/5 text-gray-400 hover:text-red-500 p-6 rounded-2xl transition-all shadow-xl cursor-pointer z-[9999] min-w-[64px] min-h-[64px] flex items-center justify-center active:scale-75"
                        >
                          <Trash2 className="w-8 h-8 pointer-events-none" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <form onSubmit={updateSettings} className="space-y-6">
              <h3 className="font-black text-xl uppercase mb-4 dark:text-white flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> PENGATURAN MASJID
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Nama Masjid</label>
                  <input name="mosqueName" defaultValue={settings?.mosqueName} className="w-full p-4 bg-gray-50 dark:bg-[#121212] rounded-xl font-bold dark:text-white border border-transparent focus:border-[#2D5A27]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Alamat Masjid</label>
                  <input name="mosqueAddress" defaultValue={settings?.mosqueAddress} className="w-full p-4 bg-gray-50 dark:bg-[#121212] rounded-xl font-bold dark:text-white border border-transparent focus:border-[#2D5A27]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Target Maks Kupon (Kuota Total)</label>
                  <input type="number" name="maxCoupons" defaultValue={settings?.maxCoupons} className="w-full p-4 bg-gray-50 dark:bg-[#121212] rounded-xl font-bold dark:text-white border border-transparent focus:border-[#2D5A27]" />
                  <p className="text-[8px] text-gray-400 italic">Hanya kupon PENDING & VERIFIED yang memakan kuota ini. Kupon expired akan membebaskan kuota.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Masa Berlaku (Menit)</label>
                  <input type="number" name="expiryMinutes" defaultValue={settings?.expiryMinutes} className="w-full p-4 bg-gray-50 dark:bg-[#121212] rounded-xl font-bold dark:text-white border border-transparent focus:border-[#2D5A27]" />
                </div>
              </div>

              {/* MAP SELECTOR */}
              <div className="space-y-4 pt-4 border-t dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[14px] font-black text-[#2D5A27] dark:text-[#4ADE80] uppercase flex items-center gap-2">
                      <MapPin className="w-5 h-5" /> LOKASI MASJID DI PETA
                    </label>
                    <p className="text-[10px] text-gray-400 uppercase italic">Klik pada peta untuk menyesuaikan lokasi tepat masjid</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-[#121212] p-2 rounded-xl text-[10px] font-mono text-gray-500">
                    {mapPos.lat.toFixed(6)}, {mapPos.lng.toFixed(6)}
                  </div>
                </div>
                
                <div className="h-[400px] w-full rounded-3xl overflow-hidden border-4 border-[#2D5A27]/20 dark:border-white/10 shadow-2xl relative">
                  {GOOGLE_MAPS_API_KEY ? (
                    <APIProvider 
                      apiKey={GOOGLE_MAPS_API_KEY}
                      onLoad={() => console.log('Google Maps API Loaded')}
                      onError={(err) => {
                        console.error('Google Maps Load Error:', err);
                        setStatusMsg({ type: 'error', text: 'Google Maps Gagal Dimuat: Periksa Aktivasi API' });
                      }}
                    >
                      <Map
                        defaultCenter={mapPos}
                        defaultZoom={17}
                        mapId="MAIN_MAP_ID"
                        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                        onClick={(e) => {
                          if (e.detail.latLng) {
                            setMapPos({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
                          }
                        }}
                        className="w-full h-full"
                      >
                        <Marker 
                          position={mapPos} 
                          draggable={true} 
                          onDragEnd={(e) => {
                            if (e.latLng) {
                              setMapPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                            }
                          }}
                        />
                      </Map>
                    </APIProvider>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#121212] p-8 text-center space-y-4">
                      <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                        <AlertCircle className="w-12 h-12 text-red-500" />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 dark:text-white uppercase tracking-tight">API GOOGLE MAPS BERMASALAH (LIMIT/BELUM AKTIF)</p>
                        <p className="text-[10px] text-gray-500 uppercase mt-2 font-bold leading-relaxed px-4">
                          1. Pastikan "Maps JavaScript API" sudah di-ENABLE di Cloud Console<br/>
                          2. Cek apakah Billing sudah terhubung (Wajib untuk Maps v3)<br/>
                          3. Cek Quota limit di dashboard Google Cloud<br/>
                          (Error: ApiNotActivatedMapError / QuotaExceededError)
                        </p>
                        <div className="flex gap-2 justify-center mt-4">
                          <a 
                            href="https://console.cloud.google.com/google/maps-apis/api-list" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[10px] bg-red-600 text-white px-4 py-2 rounded-xl font-black uppercase hover:bg-red-700 transition-all shadow-lg"
                          >
                            AKTIVASI / CEK QUOTA
                          </a>
                          <button
                            type="button"
                            onClick={() => setStatusMsg({ type: 'info', text: 'Anda masih bisa menyimpan koordinat manual di atas tanpa bantuan peta.' })}
                            className="text-[10px] bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl font-black uppercase hover:bg-gray-300 transition-all"
                          >
                            ABAIKAN
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {superAdminAccess && (
                <div className="space-y-2 pt-4 border-t dark:border-white/5">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">PASSWORD AKSES PANEL ADMIN</label>
                  <input type="text" name="loginPassword" placeholder="Biarkan kosong jika tidak ingin ganti" className="w-full p-4 bg-gray-50 dark:bg-[#121212] rounded-xl font-bold dark:text-white border border-transparent focus:border-red-500" />
                  <p className="text-[8px] text-gray-400 italic">Password ini digunakan saat awal masuk panel admin.</p>
                </div>
              )}

              <button className="w-full bg-[#2D5A27] dark:bg-[#4ADE80] text-white dark:text-[#121212] p-5 rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 transition-all">SIMPAN SEMUA PENGATURAN</button>
            </form>

            {superAdminAccess && (
              <div className="mt-12 pt-8 border-t-2 border-dashed border-red-100 dark:border-red-900/30 space-y-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <h4 className="font-black text-sm uppercase tracking-wider">ZONA BAHAYA (HAK SUPER ADMIN)</h4>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-red-800 dark:text-red-300 uppercase">1. Bersihkan Data</p>
                       <button 
                         type="button"
                         onClick={clearVerifiedCoupons}
                         className="w-full bg-white dark:bg-[#1E1E1E] text-red-600 p-3 rounded-xl font-bold uppercase text-[9px] border border-red-100 shadow-sm transition-all flex items-center justify-center gap-2"
                       >
                         Hapus Kupon Verified
                       </button>
                       <button 
                         type="button"
                         onClick={clearExpiredCoupons}
                         className="w-full bg-white dark:bg-[#1E1E1E] text-orange-600 p-3 rounded-xl font-bold uppercase text-[9px] border border-orange-100 shadow-sm transition-all flex items-center justify-center gap-2"
                       >
                         Hapus Kupon Expired
                       </button>
                    </div>

                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-red-800 dark:text-red-300 uppercase">2. Reset Antrian</p>
                       <button 
                         type="button"
                         onClick={resetCounter}
                         className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 p-3 rounded-xl font-bold uppercase text-[9px] border border-blue-100 shadow-sm transition-all flex items-center justify-center gap-2"
                       >
                         <RefreshCw className="w-3 h-3" /> Reset Nomor ke 0
                       </button>
                    </div>
                  </div>

                  <div className="h-[1px] bg-red-100 dark:bg-red-900/30"></div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-red-800 dark:text-red-300 uppercase leading-tight">
                      3. RESET TOTAL (HAPUS SEMUA & KEMBALI KE 0)
                    </p>
                    <p className="text-[8px] text-gray-500 italic">Menghapus SELURUH data kupon & log dari database secara permanen.</p>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); resetAll(); }}
                      className="w-full bg-red-600 dark:bg-red-700 text-white p-6 rounded-[2rem] font-black uppercase text-sm shadow-2xl active:scale-90 transition-all flex items-center justify-center gap-3 cursor-pointer relative z-[9999] hover:bg-red-500"
                    >
                      <Trash2 className="w-8 h-8 pointer-events-none" />
                      RESET TOTAL SISTEM
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
