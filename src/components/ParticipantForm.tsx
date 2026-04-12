import { useState, useRef, useEffect } from 'react';
import { Participant, TransportMode } from '../types';
import TransportSelector from './TransportSelector';
import DepartureMapPicker from './DepartureMapPicker';
import { loadSavedParticipants, SavedParticipant } from '../services/storage';

interface Props {
  participant: Participant;
  onChange: (p: Participant) => void;
  onRemove: () => void;
}

export default function ParticipantForm({ participant, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const update = (fields: Partial<Participant>) => {
    onChange({ ...participant, ...fields });
  };

  const savedParticipants = loadSavedParticipants();

  const currentKey = participant.name && participant.departure
    ? `${participant.name}|${participant.departure}`
    : '';
  const isFromSaved = savedParticipants.some((s: SavedParticipant) => `${s.name}|${s.departure}` === currentKey);

  const handleSelectSaved = (saved: SavedParticipant) => {
    update({ name: saved.name, departure: saved.departure, departureCoord: saved.departureCoord });
    setDropdownOpen(false);
  };

  const handleSelectNew = () => {
    update({ name: '', departure: '', departureCoord: undefined });
    setDropdownOpen(false);
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left flex-1"
        >
          <span className="text-sm font-medium text-gray-800">
            {participant.name || '이름 없음'}
          </span>
          {participant.departure && (
            <span className="text-xs text-gray-400 truncate max-w-[120px]">
              ({participant.departure})
            </span>
          )}
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 text-sm px-2"
        >
          삭제
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2">
          {/* 이름 + 출발 예정 시간 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">이름</label>
              {savedParticipants.length > 0 ? (
                <div className="space-y-1.5">
                  {/* 커스텀 드롭다운 */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                      <span className={isFromSaved ? 'text-gray-800' : 'text-gray-400'}>
                        {isFromSaved ? participant.name : '저장된 참여자 선택'}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={handleSelectNew}
                          className="w-full text-left px-3 py-2.5 text-sm text-primary-500 hover:bg-primary-50 border-b border-gray-100 transition-colors"
                        >
                          + 직접 입력
                        </button>
                        <div className="max-h-[200px] overflow-y-auto">
                          {savedParticipants.map((s: SavedParticipant, i: number) => {
                            const key = `${s.name}|${s.departure}`;
                            const isActive = key === currentKey;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleSelectSaved(s)}
                                className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-b-0 transition-colors ${
                                  isActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isActive && (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary-500 shrink-0">
                                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  <div className="min-w-0">
                                    <span className="font-medium text-gray-800">{s.name}</span>
                                    <span className="text-xs text-gray-400 ml-1.5 truncate">({s.departure})</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 직접 입력 모드 */}
                  {!isFromSaved && (
                    <input
                      type="text"
                      value={participant.name}
                      onChange={e => update({ name: e.target.value })}
                      placeholder="참여자 이름"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={participant.name}
                  onChange={e => update({ name: e.target.value })}
                  placeholder="참여자 이름"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              )}
            </div>
            <div className="w-[130px]">
              <label className="block text-xs text-gray-500 mb-1">출발 예정 시간</label>
              <input
                type="time"
                value={participant.departureTime}
                onChange={e => update({ departureTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">출발지</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={participant.departure}
                onChange={e => update({ departure: e.target.value, departureCoord: undefined })}
                placeholder="출발지 주소 또는 장소명"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="px-3 py-2 bg-primary-50 text-primary-600 border border-primary-200 rounded-lg text-sm hover:bg-primary-100 transition-colors whitespace-nowrap"
              >
                지도
              </button>
            </div>
            {participant.departureCoord && (
              <p className="text-xs text-green-600 mt-1">
                좌표 설정됨 ({participant.departureCoord.lat.toFixed(4)}, {participant.departureCoord.lng.toFixed(4)})
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">이동 방식 (복수 선택 가능)</label>
            <TransportSelector
              selected={participant.transportModes}
              onChange={(modes: TransportMode[]) => update({ transportModes: modes })}
            />
          </div>
        </div>
      )}

      {showMap && (
        <DepartureMapPicker
          coord={participant.departureCoord}
          onSelect={(coord, address) => update({ departureCoord: coord, departure: address })}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
