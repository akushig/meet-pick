import { useId, useState } from 'react';
import { loadSavedAddresses } from '../services/storage';
import DepartureMapPicker from './DepartureMapPicker';

interface Props {
  address: string;
  coord?: { lat: number; lng: number };
  label?: string;
  placeholder?: string;
  onChange: (address: string, coord?: { lat: number; lng: number }) => void;
}

/**
 * 주소 입력 + 저장 주소 드롭다운(datalist) + 카카오지도 picker(통합).
 * - 텍스트 직접 입력 또는 datalist에서 저장된 주소 선택 (선택 시 좌표 자동 부착)
 * - 입력란 우측 지도 아이콘 클릭 시 지도 picker 열림 (네이티브 datalist 화살표는 숨김)
 */
export default function AddressField({
  address,
  coord,
  label = '주소',
  placeholder = '주소 또는 장소명',
  onChange,
}: Props) {
  const [showMap, setShowMap] = useState(false);
  const listId = useId();
  const saved = loadSavedAddresses();

  const handleInputChange = (val: string) => {
    const match = saved.find(s => s.address === val);
    onChange(val, match?.coord);
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type="text"
          value={address}
          onChange={e => handleInputChange(e.target.value)}
          placeholder={placeholder}
          list={listId}
          autoComplete="off"
          className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 [&::-webkit-calendar-picker-indicator]:hidden"
        />
        <button
          type="button"
          onClick={() => setShowMap(true)}
          aria-label={`${label} 지도에서 선택`}
          title={`${label} 지도에서 선택`}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-md transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
        </button>
      </div>

      <datalist id={listId}>
        {saved.map(s => (
          <option key={s.address} value={s.address} />
        ))}
      </datalist>

      {coord && (
        <p className="text-[11px] text-green-600">
          좌표 설정됨 ({coord.lat.toFixed(4)}, {coord.lng.toFixed(4)})
        </p>
      )}

      {showMap && (
        <DepartureMapPicker
          coord={coord}
          label={label}
          onSelect={(c, addr) => onChange(addr, c)}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
