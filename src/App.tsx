/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RegistrationForm } from './components/RegistrationForm';
import { CouponDisplay } from './components/CouponDisplay';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { Settings, LogIn, LayoutDashboard, Menu, X as CloseIcon, WifiOff, Languages } from 'lucide-react';
import { ThemeProvider } from './lib/ThemeContext';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';
import { ThemeToggle } from './components/ThemeToggle';
import { db } from './firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

type View = 'registration' | 'coupon' | 'admin_login' | 'admin_dashboard';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('registration');
  const [userCouponId, setUserCouponId] = useState<string | null>(localStorage.getItem('my_coupon_id'));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    // Critical Constraint: Test connection on boot
    const testConnection = async () => {
      try {
        // Try to fetch a mock doc from server to ensure connectivity
        await getDocFromServer(doc(db, 'config', 'connection_test'));
        setIsOffline(false);
      } catch (error: any) {
        if (error?.message?.includes('offline') || error?.code === 'unavailable') {
          setIsOffline(true);
        }
        console.warn('Firestore connectivity test:', error.message);
      }
    };
    testConnection();

    // Browser online/offline listeners
    const handleOnline = () => {
      setIsOffline(false);
      testConnection();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (userCouponId && currentView === 'registration') {
      setCurrentView('coupon');
    }
  }, [userCouponId]);

  const handleRegistrationSuccess = (id: string) => {
    localStorage.setItem('my_coupon_id', id);
    setUserCouponId(id);
    setCurrentView('coupon');
  };

  const handleReset = () => {
    localStorage.removeItem('my_coupon_id');
    setUserCouponId(null);
    setCurrentView('registration');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] dark:bg-[#121212] overflow-x-hidden font-sans transition-colors duration-300">
      <nav className="fixed top-0 right-0 p-4 z-50 flex items-center gap-3">
        {isOffline && (
          <div className="bg-red-600 text-white px-3 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse border border-white/20">
            <WifiOff className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t.offline}</span>
          </div>
        )}
        <ThemeToggle />
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-white/50 dark:bg-white/10 backdrop-blur-sm p-2 rounded-full hover:bg-white dark:hover:bg-white/20 transition-colors shadow-sm"
            title="Menu"
          >
            {isMenuOpen ? (
              <CloseIcon className="w-6 h-6 text-[#2D5A27] dark:text-[#4ADE80]" />
            ) : (
              <Menu className="w-6 h-6 text-[#2D5A27] dark:text-[#4ADE80]" />
            )}
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute right-0 mt-3 w-60 bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/5 p-2 overflow-hidden"
              >
                <div className="p-3 border-b dark:border-white/5 mb-2 flex items-center gap-2 text-gray-400 dark:text-gray-500">
                  <Languages className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{t.menuAccess}</p>
                </div>
                
                {currentView !== 'admin_dashboard' && currentView !== 'admin_login' && (
                  <button 
                    onClick={() => {
                      setCurrentView('admin_login');
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                  >
                    <Settings className="w-5 h-5 text-[#2D5A27] dark:text-[#4ADE80]" />
                    <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{t.loginAdmin}</span>
                  </button>
                )}

                {currentView === 'coupon' && (
                  <button 
                    onClick={() => {
                      handleReset();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                  >
                    <LogIn className="w-5 h-5 text-[#2D5A27] dark:text-[#4ADE80]" />
                    <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{t.registerAgain}</span>
                  </button>
                )}

                {(currentView === 'admin_dashboard' || currentView === 'admin_login') && (
                  <button 
                    onClick={() => {
                      setCurrentView('registration');
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-colors text-left"
                  >
                    <LayoutDashboard className="w-5 h-5 text-[#2D5A27] dark:text-[#4ADE80]" />
                    <span className="font-bold text-sm text-gray-700 dark:text-gray-200">{t.homePage}</span>
                  </button>
                )}

                {/* Ganti Bahasa / Language Switcher */}
                <div className="border-t dark:border-white/5 mt-2 pt-2">
                  <div className="px-3 py-1.5">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t.changeLanguage}</p>
                  </div>
                  <div className="flex flex-col gap-1 px-1">
                    <button 
                      onClick={() => setLanguage('id')}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left font-bold text-xs ${language === 'id' ? 'bg-[#2D5A27]/15 text-[#2D5A27] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80]' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base shrink-0">🇮🇩</span>
                        {t.indonesian}
                      </span>
                      {language === 'id' && <span className="w-2 h-2 rounded-full bg-[#2D5A27] dark:bg-[#4ADE80]"></span>}
                    </button>
                    <button 
                      onClick={() => setLanguage('en')}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left font-bold text-xs ${language === 'en' ? 'bg-[#2D5A27]/15 text-[#2D5A27] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80]' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base shrink-0">🇬🇧</span>
                        {t.english}
                      </span>
                      {language === 'en' && <span className="w-2 h-2 rounded-full bg-[#2D5A27] dark:bg-[#4ADE80]"></span>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      <main className="max-w-xl mx-auto min-h-screen pt-4 pb-24 px-4">
        <AnimatePresence mode="wait">
          {currentView === 'registration' && (
            <motion.div
              key="registration"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <RegistrationForm onSuccess={handleRegistrationSuccess} />
            </motion.div>
          )}

          {currentView === 'coupon' && userCouponId && (
            <motion.div
              key="coupon"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <CouponDisplay couponId={userCouponId} />
            </motion.div>
          )}

          {currentView === 'admin_login' && (
            <motion.div
              key="admin_login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AdminLogin 
                onLoginSuccess={() => setCurrentView('admin_dashboard')} 
                onBack={() => setCurrentView(userCouponId ? 'coupon' : 'registration')}
              />
            </motion.div>
          )}

          {currentView === 'admin_dashboard' && (
            <motion.div
              key="admin_dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AdminDashboard onLogout={() => setCurrentView('registration')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-[#2D5A27] dark:bg-[#1B3618] text-white/70 text-center text-[10px] tracking-widest uppercase transition-colors duration-300">
        {t.brandingFooter}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
