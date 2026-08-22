import { useState } from 'react';
import { Participant, TransportMode } from '../types';
import TransportSelector from './TransportSelector';
import NameField from './NameField';
import AddressField from './AddressField';

interface Props {
  participant: Participant;
  meetingEndTime?: string;
  onChange: (p: Participant) => void;
  onRemove: () => void;
}

function addHours(hhmm: string, hours: number): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  const adj = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(adj / 60)).padStart(2, '0')}:${String(adj % 60).padStart(2, '0')}`;
}

export default function ParticipantForm({ participant, meetingEndTime, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true);

  const update = (fields: Partial<Participant>) => {
    onChange({ ...participant, ...fields });
  };

  const hasArrival =
    participant.arrival !== undefined ||
    participant.arrivalCoord !== undefined ||
    participant.arrivalTime !== undefined ||
    participant.arrivalTransportModes !== undefined;

  const handleAddArrival = () => {
    update({
      arrival: '',
      arrivalTime: meetingEndTime ? addHours(meetingEndTime, 1) : '',
      arrivalTimeEdited: false,
      arrivalTransportModes: participant.transportModes.length > 0 ? [...participant.transportModes] : ['subway'],
    });
  };

  const handleRemoveArrival = () => {
    update({
      arrival: undefined,
      arrivalCoord: undefined,
      arrivalTime: undefined,
      arrivalTimeEdited: undefined,
      arrivalTransportModes: undefined,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <span className="text-sm font-medium text-gray-800">
            {participant.name || '이름 없음'}
          </span>
          {participant.departure && (
            <span className="text-xs text-gray-400 truncate">
              ({participant.departure})
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{expanded ? '▲' : '▼'}</span>
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
        <div className="space-y-3 pt-1">
          {/* Row 1: 이름 */}
          <NameField
            value={participant.name}
            onChange={name => update({ name })}
          />

          {/* Row 2: 출발지 + 출발시간 */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <AddressField
                address={participant.departure}
                coord={participant.departureCoord}
                label="출발지"
                placeholder="출발지 주소 또는 장소명"
                onChange={(addr, coord) => update({ departure: addr, departureCoord: coord })}
              />
            </div>
            <div className="w-[100px] shrink-0">
              <input
                type="time"
                value={participant.departureTime}
                onChange={e => update({ departureTime: e.target.value })}
                aria-label="출발 예정 시간"
                className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>

          {/* Row 3: 이동방식 (compact) */}
          <TransportSelector
            compact
            selected={participant.transportModes}
            onChange={(modes: TransportMode[]) => update({ transportModes: modes })}
          />

          {/* Row 4: 도착지 추가 / 도착지 섹션 */}
          {hasArrival ? (
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">도착지 (모임 후 이동)</span>
                <button
                  type="button"
                  onClick={handleRemoveArrival}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  제거
                </button>
              </div>

              {/* Row 5: 도착지 + 도착시간 */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <AddressField
                    address={participant.arrival || ''}
                    coord={participant.arrivalCoord}
                    label="도착지"
                    placeholder="도착지 주소 또는 장소명"
                    onChange={(addr, coord) => update({ arrival: addr, arrivalCoord: coord })}
                  />
                </div>
                <div className="w-[100px] shrink-0">
                  <input
                    type="time"
                    value={participant.arrivalTime || ''}
                    onChange={e => update({ arrivalTime: e.target.value, arrivalTimeEdited: true })}
                    aria-label="도착 예정 시간"
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              {/* Row 6: 도착 이동방식 (compact) */}
              <TransportSelector
                compact
                selected={participant.arrivalTransportModes || []}
                onChange={(modes: TransportMode[]) => update({ arrivalTransportModes: modes })}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddArrival}
              className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
            >
              + 도착지 정보 추가 (선택)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
