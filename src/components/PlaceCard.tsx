import { Place } from '../types';

const RANK_BADGES: Record<number, { label: string; color: string }> = {
  1: { label: '1st', color: 'bg-yellow-400 text-yellow-900' },
  2: { label: '2nd', color: 'bg-gray-300 text-gray-700' },
  3: { label: '3rd', color: 'bg-amber-600 text-white' },
};

const MODE_ICONS: Record<string, string> = {
  '자차': '🚗',
  '지하철': '🚇',
  '버스': '🚌',
  '자전거': '🚲',
  '도보': '🚶',
};

interface Props {
  place: Place;
  rank?: number;
  selected?: boolean;
  onToggleSelect?: () => void;
  onViewMap?: () => void;
  onCopyLink?: () => void;
  onShare?: () => void;
}

export default function PlaceCard({
  place,
  rank,
  selected,
  onToggleSelect,
  onViewMap,
  onCopyLink,
  onShare,
}: Props) {
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
      className={`bg-white rounded-xl border-2 p-4 space-y-2 transition-colors ${
        selected ? 'border-primary-500 bg-primary-50/30' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={!!selected}
          aria-label={selected ? '선택 해제' : '모임 장소로 선택'}
          className={`shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 transition-colors flex items-center justify-center ${
            selected
              ? 'bg-primary-500 border-primary-500'
              : 'bg-white border-gray-300 hover:border-primary-400'
          }`}
        >
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
          {badge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
          )}
          <h4 className="font-medium text-gray-800 break-keep">{place.name}</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
            {place.category}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {onViewMap && (
            <button
              type="button"
              onClick={onViewMap}
              aria-label="지도에서 보기"
              title="지도에서 보기"
              className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </button>
          )}

          {onCopyLink && (
            <button
              type="button"
              onClick={onCopyLink}
              aria-label="링크 복사"
              title="링크 복사"
              className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </button>
          )}

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label="다른 앱으로 공유"
              title="다른 앱으로 공유"
              className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">{place.address}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{place.reason}</p>

      {place.travelTimes && place.travelTimes.length > 0 && (
        <div className="pt-2 border-t border-gray-100 space-y-1.5">
          {place.travelTimes.map((t, idx) => (
            <div key={idx} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
              <span className="font-medium text-gray-700 shrink-0">
                {t.origin}
                {t.names.length > 0 && (
                  <span className="text-gray-500 font-normal"> ({t.names.join(', ')})</span>
                )}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-gray-600">
                {t.modes.map((m, j) => (
                  <span key={j} className="inline-flex items-baseline gap-1">
                    <span>{MODE_ICONS[m.mode] || ''}</span>
                    <span>{m.mode}</span>
                    <span className="text-gray-500">{m.minutes}분</span>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
