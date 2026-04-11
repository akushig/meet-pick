import { useState } from 'react';
import { Participant, TransportMode } from '../types';
import TransportSelector from './TransportSelector';

interface Props {
  participant: Participant;
  onChange: (p: Participant) => void;
  onRemove: () => void;
}

export default function ParticipantForm({ participant, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true);

  const update = (fields: Partial<Participant>) => {
    onChange({ ...participant, ...fields });
  };

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
          <div>
            <label className="block text-xs text-gray-500 mb-1">이름</label>
            <input
              type="text"
              value={participant.name}
              onChange={e => update({ name: e.target.value })}
              placeholder="참여자 이름"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">출발지</label>
            <input
              type="text"
              value={participant.departure}
              onChange={e => update({ departure: e.target.value })}
              placeholder="출발지 주소 또는 장소명"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">출발 예정 시간</label>
            <input
              type="time"
              value={participant.departureTime}
              onChange={e => update({ departureTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
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
    </div>
  );
}
