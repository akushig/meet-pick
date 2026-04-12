import { Place } from '../types';

const RANK_BADGES: Record<number, { label: string; color: string }> = {
  1: { label: '1st', color: 'bg-yellow-400 text-yellow-900' },
  2: { label: '2nd', color: 'bg-gray-300 text-gray-700' },
  3: { label: '3rd', color: 'bg-amber-600 text-white' },
};

interface Props {
  place: Place;
  rank?: number;
  selected?: boolean;
  onClick?: () => void;
}

export default function PlaceCard({ place, rank, selected, onClick }: Props) {
  const categoryColors: Record<string, string> = {
    '카페': 'bg-amber-100 text-amber-700',
    '식당': 'bg-red-100 text-red-700',
    '공원': 'bg-green-100 text-green-700',
    '편의점': 'bg-blue-100 text-blue-700',
  };

  const colorClass = categoryColors[place.category] || 'bg-gray-100 text-gray-700';
  const badge = rank ? RANK_BADGES[rank] : undefined;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 p-4 space-y-2 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-slate-50 active:bg-slate-100' : ''
      } ${selected ? 'border-primary-500 bg-primary-50/30' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-2">
        {selected && (
          <span className="text-primary-500 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </span>
        )}
        {badge && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
        )}
        <h4 className="font-medium text-gray-800">{place.name}</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
          {place.category}
        </span>
      </div>
      <p className="text-xs text-gray-500">{place.address}</p>
      <p className="text-sm text-gray-600">{place.reason}</p>
    </div>
  );
}
