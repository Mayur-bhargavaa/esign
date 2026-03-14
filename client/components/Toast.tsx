import { useEffect, useState } from 'react';
import { Check, X, Info } from 'lucide-react';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss: () => void;
  duration?: number;
};

export default function Toast({ message, type = 'info', onDismiss, duration = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : ''}`}>
      <span className="toast-icon">
        {type === 'success' && <Check size={18} strokeWidth={3} />}
        {type === 'error' && <X size={18} strokeWidth={3} />}
        {type === 'info' && <Info size={18} strokeWidth={3} />}
      </span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={() => { setIsVisible(false); setTimeout(onDismiss, 300); }}>
        <X size={16} strokeWidth={3} />
      </button>
    </div>
  );
}
