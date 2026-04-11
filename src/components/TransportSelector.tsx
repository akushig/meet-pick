import { TransportMode } from '../types';

const MODES: { value: TransportMode; label: string; icon: string }[] = [
  { value: 'car', label: '자차', icon: '🚗' },
  { value: 'subway', label: '지하철', icon: '🚇' },
  { value: 'bus', label: '버스', icon: '🚌' },
  { value: 'walk', label: '도보', icon: '🚶' },
];

interface Props {
  selected: TransportMode[];
  onChange: (modes: TransportMode[]) => void;
}

export default function TransportSelector({ selected, onChange }: Props) {
  const toggle = (mode: TransportMode) => {
    if (selected.includes(mode)) {
      onChange(selected.filter(m => m !== mode));
    } else {
      onChange([...selected, mode]);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {MODES.map(m => (
        <button
          key={m.value}
          type="button"
          onClick={() => toggle(m.value)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            selected.includes(m.value)
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-primary-300'
          }`}
        >
          {m.icon} {m.label}
        </button>
      ))}
    </div>
  );
}
