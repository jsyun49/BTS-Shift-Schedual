import { useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import type { ScheduleEntry, ShiftType } from '../types';

const WISH_OFF_NAME = '희망휴무';
const EDUCATION_NAME = '교육';
const SELF_SERVICE_NAMES = [WISH_OFF_NAME, EDUCATION_NAME];

interface ShiftModalProps {
  date: string;
  myEntry: ScheduleEntry | null;
  otherEntries: ScheduleEntry[];
  shiftTypes: ShiftType[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
  onRequestSwap: (entry: ScheduleEntry) => void;
}

interface BulkCreateResult {
  created: number;
  skipped: string[];
}

export default function ShiftModal({
  date,
  myEntry,
  otherEntries,
  shiftTypes,
  isAdmin,
  onClose,
  onSaved,
  onRequestSwap,
}: ShiftModalProps) {
  const { showToast } = useToast();
  const selfServiceTypes = shiftTypes.filter((st) => SELF_SERVICE_NAMES.includes(st.name));
  const myEntryIsSelfService = myEntry != null && SELF_SERVICE_NAMES.includes(myEntry.shift_type_name);
  // Workers can only manage their own 희망휴무/교육 entries; anything admin-assigned is locked (view + swap only).
  const isLocked = !isAdmin && myEntry != null && !myEntryIsSelfService;
  const canManage = !isLocked;

  const [shiftTypeId, setShiftTypeId] = useState<number | ''>(myEntry?.shift_type_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState(false);
  const [endDate, setEndDate] = useState(date);

  async function handleSave() {
    if (!shiftTypeId) return;
    setSaving(true);
    setError(null);
    try {
      if (myEntry) {
        await api.patch(`/schedules/${myEntry.id}`, { shiftTypeId });
        showToast('근무가 저장되었습니다.');
      } else if (periodMode && endDate !== date) {
        const { data } = await api.post<BulkCreateResult>('/schedules/bulk-create', {
          startDate: date,
          endDate,
          shiftTypeId,
        });
        showToast(
          data.skipped.length > 0
            ? `${data.created}일 등록 완료 (이미 근무가 있어 ${data.skipped.length}일 건너뜀)`
            : `${data.created}일 등록되었습니다.`
        );
      } else {
        await api.post('/schedules', { date, shiftTypeId });
        showToast('근무가 저장되었습니다.');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, '저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!myEntry) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/schedules/${myEntry.id}`);
      showToast('근무가 삭제되었습니다.');
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, '삭제에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold text-gray-900">{date} 근무</h2>

        {otherEntries.length > 0 && (
          <div className="mb-4 space-y-1 rounded-lg bg-gray-50 p-2.5">
            <p className="mb-1 text-xs font-medium text-gray-500">이 날 등록된 다른 근무자</p>
            {otherEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.user_color }} />
                {e.user_name} · <span translate="no" className="notranslate">{e.shift_type_name}</span>
              </div>
            ))}
          </div>
        )}

        {isLocked && myEntry && (
          <div className="mb-4 rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: myEntry.shift_type_color }} />
              내 근무: <span translate="no" className="notranslate">{myEntry.shift_type_name}</span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              관리자가 등록한 근무입니다. 변경이 필요하면 관리자에게 요청하거나 아래에서 근무 변경을 요청하세요.
            </p>
          </div>
        )}

        {canManage && isAdmin && (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">근무 유형</label>
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(Number(e.target.value))}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                선택해주세요
              </option>
              {shiftTypes.map((st) => (
                <option key={st.id} value={st.id} translate="no">
                  {st.name}
                </option>
              ))}
            </select>
          </>
        )}

        {canManage && !isAdmin && (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">근무 유형</label>
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(Number(e.target.value))}
              className="mb-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                선택해주세요
              </option>
              {selfServiceTypes.map((st) => (
                <option key={st.id} value={st.id} translate="no">
                  {st.name}
                </option>
              ))}
            </select>
            <p className="mb-4 text-[11px] text-gray-400">
              {myEntry
                ? '등록된 근무를 삭제하거나 아래에서 근무 변경을 요청할 수 있습니다.'
                : `${SELF_SERVICE_NAMES.join(', ')}만 직접 등록할 수 있습니다. (다른 근무 유형 등록/수정은 관리자만 할 수 있습니다.)`}
            </p>
          </>
        )}

        {canManage && !myEntry && (
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={periodMode}
                onChange={(e) => setPeriodMode(e.target.checked)}
              />
              기간을 선택해서 한번에 등록
            </label>
            {periodMode && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-gray-500">{date}</span>
                <span className="text-gray-400">~</span>
                <input
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            닫기
          </button>
          {canManage && myEntry && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex-1 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
          {canManage && (
            <button
              onClick={handleSave}
              disabled={saving || !shiftTypeId}
              className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {myEntry ? '수정' : '등록'}
            </button>
          )}
        </div>

        {myEntry && (
          <button
            onClick={() => onRequestSwap(myEntry)}
            className="mt-3 w-full rounded-lg bg-blue-50 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-100"
          >
            근무 변경 요청하기
          </button>
        )}
      </div>
    </div>
  );
}
