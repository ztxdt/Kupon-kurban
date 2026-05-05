import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startScanner = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }

      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      const config = { 
        fps: 15, 
        qrbox: { width: 280, height: 280 } 
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // Routine errors - can be ignored
        }
      );
      setIsLoading(false);
    } catch (err: any) {
      console.error("Gagal memulai kamera:", err);
      setIsLoading(false);
      if (err?.toString().includes("NotAllowedError") || err?.toString().includes("Permission denied")) {
        setErrorMsg("IZIN KAMERA DITOLAK. MOHON IZINKAN AKSES KAMERA DI PENGATURAN BROWSER.");
      } else {
        setErrorMsg("GAGAL MENGAKSES KAMERA. PASTIKAN KAMERA BELAKANG TERSEDIA.");
      }
    }
  };

  useEffect(() => {
    // Delay slightly to ensure DOM is ready
    const timer = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#121212] z-[100] flex flex-col font-sans">
      <div className="p-6 flex justify-between items-center bg-[#1B3618] text-white">
        <div>
          <h2 className="font-black text-xl tracking-tight uppercase italic">PEMINDAI KUPON</h2>
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Akses Kamera Utama</p>
        </div>
        <button 
          onClick={onClose} 
          className="bg-white/10 p-3 rounded-2xl text-white hover:bg-white/20 transition-all border border-white/10"
        >
          <X className="w-8 h-8" />
        </button>
      </div>
      
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#121212] text-white">
            <div className="w-16 h-16 border-4 border-[#4ADE80] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-black text-xs uppercase tracking-widest animate-pulse">Menghubungi Kamera...</p>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#121212] p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-white font-black text-sm uppercase leading-relaxed mb-6 italic">{errorMsg}</p>
            <button 
              onClick={startScanner}
              className="bg-[#4ADE80] text-[#1B3618] px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              COBA LAGI
            </button>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-4">
          <div className="w-[280px] h-[280px] border-2 border-[#4ADE80]/30 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]">
            <div className="absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-[#4ADE80] rounded-tl-2xl"></div>
            <div className="absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-[#4ADE80] rounded-tr-2xl"></div>
            <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-[#4ADE80] rounded-bl-2xl"></div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-[#4ADE80] rounded-br-2xl"></div>
            
            <div className="absolute w-full h-[2px] bg-[#4ADE80] top-0 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_15px_#4ADE80] opacity-50"></div>
          </div>
        </div>

        <div id="qr-reader" className="w-full max-w-md rounded-3xl overflow-hidden bg-black aspect-square shadow-2xl"></div>
      </div>

      <div className="p-10 text-center bg-[#1B3618] text-white space-y-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Camera className="w-4 h-4 text-[#4ADE80]" />
          <p className="font-black text-sm uppercase tracking-wider italic">ARAHKAN KE QR CODE</p>
        </div>
        <p className="text-[10px] text-white/50 font-bold uppercase leading-tight max-w-[250px] mx-auto">
          Posisikan barcode di dalam kotak hijau.<br/>Sistem akan memverifikasi secara otomatis.
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0.1; }
          50% { top: 100%; opacity: 0.8; }
        }
        #qr-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
