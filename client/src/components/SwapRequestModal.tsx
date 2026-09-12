import { useMemo, useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import type { ScheduleEntry, ShiftType } from '../types';

interface SwapRequestModalProps {
  myEntry: ScheduleEntry;
  shiftTypes: ShiftType[];
  currentUserId: number;
  monthSchedules: ScheduleEntry[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function SwapRequestModal({
  myEntry,
  shiftTypes,
  currentUserId,
  monthSchedules,
  onClose,
  onSubmitted,
}: SwapRequestModalProps) {
  const { showToast } = useToast();
  // Change requests only ever affect the requester's own schedule — the "worker" list
  // is restricted to (and pre-selected as) just the current user.
  const [targetId] = useState<number>(currentUserId);
  const [requestedShiftTypeId, setRequestedShiftTypeId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidateEntries = useMemo(
    () => monthSchedules.filter((s) => s.date === myEntry.date && s.user_id === currentUserId),
    [myEntry.date, monthSchedules, currentUserId]
  );

  const targetEntry = useMemo(
    () => candidateEntries.find((e) => e.user_id === targetId) ?? null,
    [candidateEntries, targetId]
  );

  async function handleSubmit() {
    if (!requestedShiftTypeId || !targetEntry) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/swaps', {
        scheduleId: targetEntry.id,
        requestedShiftTypeId,
      });
      showToast('근무 변경 요청을 보냈습니다.');
      onSubmitted();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, '요청 전송에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-bold text-gray-900">근무 변경 요청</h2>
        <p className="mb-4 text-xs text-gray-500">본인의 근무만 변경 요청할 수 있습니다.</p>

        <label className="mb-1 block text-sm font-medium text-gray-700">변경할 근무자</label>
        <select
          value={targetId}
          disabled
          className="mb-4 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
        >
          {candidateEntries.map((e) => (
            <option key={e.user_id} value={e.user_id}>
              {e.user_name} (본인)
            </option>
          ))}
        </select>

        {targetEntry && (
          <>
            <p className="mb-1 text-xs text-gray-500">
              현재 근무: <span translate="no" className="notranslate">{targetEntry.shift_type_name}</span>
            </p>
            <label className="mb-1 block text-sm font-medium text-gray-700">변경할 근무 유형</label>
            <select
              value={requestedShiftTypeId}
              onChange={(e) => setRequestedShiftTypeId(e.target.value ? Number(e.target.value) : '')}
              className="mb-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                선택해주세요
              </option>
              {shiftTypes
                .filter((st) => st.id !== targetEntry.shift_type_id)
                .map((st) => (
                  <option key={st.id} value={st.id} translate="no">
                    {st.name}
                  </option>
                ))}
            </select>
            <p className="mb-4 text-[11px] text-gray-400">본인의 근무 변경 요청은 관리자가 승인해야 반영됩니다.</p>
          </>
        )}

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !targetId || !requestedShiftTypeId}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            요청 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
