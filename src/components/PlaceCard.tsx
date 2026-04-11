import { Place } from '../types';

interface Props {
  place: Place;
}

export default function PlaceCard({ place }: Props) {
  const categoryColors: Record<string, string> = {
    '카페': 'bg-amber-100 text-amber-700',
    '식당': 'bg-red-100 text-red-700',
    '공원': 'bg-green-100 text-green-700',
    '편의점': 'bg-blue-100 text-blue-700',
  };

  const colorClass = categoryColors[place.category] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center gap-2">
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
