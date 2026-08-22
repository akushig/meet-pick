import { useId } from 'react';
import { loadSavedNames } from '../services/storage';

interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}

/**
 * 이름 입력 + 저장된 이름 드롭다운(통합).
 * HTML datalist 기반 — 입력 중 자동 완성, 우측 드롭다운 화살표로 전체 목록.
 */
export default function NameField({ value, onChange, placeholder = '참여자 이름' }: Props) {
  const listId = useId();
  const names = loadSavedNames();

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
      />
      <datalist id={listId}>
        {names.map(n => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}
