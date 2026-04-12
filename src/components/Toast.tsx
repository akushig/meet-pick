import { useEffect, useState } from 'react';

interface Props {
  message: string;
  visible: boolean;
  onDone: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDone, duration = 1800 }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onDone, 300); // fade out 후 콜백
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDone]);

  if (!visible && !show) return null;

  return (
    <div className="fixed inset-x-0 top-6 z-[9999] flex justify-center pointer-events-none">
      <div
        className={`px-5 py-3 rounded-xl shadow-lg bg-gray-800 text-white text-sm font-medium transition-all duration-300 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        {message}
      </div>
    </div>
  );
}
