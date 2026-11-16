import React, { useEffect } from 'react';
import { Check, X, AlertTriangle, AlertCircle, Info } from 'lucide-react';

/**
 * Toast Notification Component - SIPEPES v2.0
 * Menggantikan dialog pop-up bawaan browser.
 * Rapi, responsif, dan tidak ada elemen ikon yang terpotong.
 */
export default function Toast({
  message,
  type = 'success',
  onClose,
  duration = 4000
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const typeConfig = {
    success: {
      icon: Check,
      iconClass: 'bg-toska-400 text-ink',
      strokeWidth: 3
    },
    error: {
      icon: AlertTriangle,
      iconClass: 'bg-tingkat-berat text-white',
      strokeWidth: 2.4
    },
    warning: {
      icon: AlertCircle,
      iconClass: 'bg-ceria-400 text-ink',
      strokeWidth: 2.4
    },
    info: {
      icon: Info,
      iconClass: 'bg-musi-600 text-white',
      strokeWidth: 2.4
    }
  };

  const currentType = typeConfig[type] || typeConfig.success;
  const IconComponent = currentType.icon;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] sm:w-auto pointer-events-auto animate-fade-in">
      <div className="flex items-center gap-3.5 bg-ink text-white rounded-2xl px-5 py-3.5 shadow-2xl border border-white/10 text-xs sm:text-sm font-semibold select-none">
        <div className={`w-8 h-8 rounded-full ${currentType.iconClass} flex items-center justify-center shrink-0 shadow-xs`}>
          <IconComponent className="w-4 h-4" strokeWidth={currentType.strokeWidth} />
        </div>
        <span className="flex-1 leading-snug">{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer shrink-0 ml-1"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}


