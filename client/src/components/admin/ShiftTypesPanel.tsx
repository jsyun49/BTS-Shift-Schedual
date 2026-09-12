import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { ShiftType } from '../../types';
import ColorPickerDot from './ColorPickerDot';

function AddShiftTypeForm({ onCreated }: { onCreated: () => void }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState('#10b981');
  const [isOff, setIsOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await api.post('/shift-types', {
        name,
        startTime: startTime || null,
        endTime: endTime || null,
        color,
        isOff,
      });
      showToast('근무 유형이 추가되었습니다.');
      setName('');
      setStartTime('');
      setEndTime('');
      setColor('#10b981');
      setIsOff(false);
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(getApiErrorMessage(err, '추가에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
      >
        + 근무 유형 추가
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          placeholder="이름 (예: Office)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-1"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-14 cursor-pointer rounded border border-gray-300"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={isOff} onChange={(e) => setIsOff(e.target.checked)} />
        휴무 유형입니다 (근무 인원 집계에서 제외)
      </label>
      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-gray-300 py-2 text-sm">
          취소
        </button>
        <button
          onClick={handleCreate}
          disabled={saving || !name}
          className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}

export default function ShiftTypesPanel() {
  const { showToast } = useToast();
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<ShiftType[]>('/shift-types', { params: { all: '1' } });
    setShiftTypes(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(st: ShiftType) {
    try {
      await api.patch(`/shift-types/${st.id}`, { isActive: !st.is_active });
      showToast('근무 유형 상태가 변경되었습니다.');
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  async function changeColor(st: ShiftType, color: string) {
    try {
      await api.patch(`/shift-types/${st.id}`, { color });
      showToast(`${st.name} 색상이 변경되었습니다.`);
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  return (
    <div className="space-y-4">
      <AddShiftTypeForm onCreated={load} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shiftTypes.map((st) => (
          <div key={st.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ColorPickerDot value={st.color} onSave={(color) => changeColor(st, color)} />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  <span translate="no" className="notranslate">{st.name}</span>{' '}
                  {st.is_off ? <span className="text-xs text-gray-400">(휴무)</span> : null}
                </p>
                {st.start_time && (
                  <p className="text-xs text-gray-500">
                    {st.start_time} ~ {st.end_time}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => toggleActive(st)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                st.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {st.is_active ? '사용중' : '비활성'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
