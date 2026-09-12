import { useState } from 'react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { ScheduleEntry, ShiftType, WorkerSummary } from '../../types';

interface AdminScheduleModalProps {
  date: string;
  entries: ScheduleEntry[];
  workers: WorkerSummary[];
  shiftTypes: ShiftType[];
  onClose: () => void;
  onSaved: () => void;
}

interface BulkCreateResult {
  created: number;
  skipped: string[];
}

function EntryRow({
  entry,
  shiftTypes,
  onSaved,
}: {
  entry: ScheduleEntry;
  shiftTypes: ShiftType[];
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [shiftTypeId, setShiftTypeId] = useState(entry.shift_type_id);
  const [date, setDate] = useState(entry.date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setShiftTypeId(entry.shift_type_id);
    setDate(entry.date);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/schedules/${entry.id}`, { shiftTypeId, date });
      showToast(date !== entry.date ? `근무가 ${date}로 이동되었습니다.` : '근무가 수정되었습니다.');
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, '수정에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/schedules/${entry.id}`);
      showToast('근무가 삭제되었습니다.');
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, '삭제에 실패했습니다.'));
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.user_color }} />
          {entry.user_name}
        </div>
        {!editing && (
          <div className="flex items-center gap-3">
            <button onClick={startEdit} className="text-xs font-medium text-blue-600 hover:underline">
              수정
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={shiftTypeId}
            onChange={(e) => setShiftTypeId(Number(e.target.value))}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {shiftTypes.map((st) => (
              <option key={st.id} value={st.id} translate="no">
                {st.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            title="날짜 이동"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            저장
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          <span translate="no" className="notranslate">{entry.shift_type_name}</span> · {entry.date}
        </p>
      )}

      {error && <div className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">{error}</div>}
    </div>
  );
}

export default function AdminScheduleModal({
  date,
  entries,
  workers,
  shiftTypes,
  onClose,
  onSaved,
}: AdminScheduleModalProps) {
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState<number | ''>('');
  const [newShiftTypeId, setNewShiftTypeId] = useState<number | ''>('');
  const [adding, setAdding] = useState(false);
  const [periodMode, setPeriodMode] = useState(false);
  const [endDate, setEndDate] = useState(date);

  const assignedUserIds = new Set(entries.map((e) => e.user_id));
  const availableWorkers = periodMode
    ? workers.filter((w) => w.role === 'worker')
    : workers.filter((w) => w.role === 'worker' && !assignedUserIds.has(w.id));

  async function handleAdd() {
    if (!newUserId || !newShiftTypeId) return;
    setAdding(true);
    setError(null);
    try {
      if (periodMode && endDate !== date) {
        const { data } = await api.post<BulkCreateResult>('/schedules/bulk-create', {
          startDate: date,
          endDate,
          shiftTypeId: newShiftTypeId,
          userId: newUserId,
        });
        showToast(
          data.skipped.length > 0
            ? `${data.created}일 등록 완료 (이미 근무가 있어 ${data.skipped.length}일 건너뜀)`
            : `${data.created}일 등록되었습니다.`
        );
      } else {
        await api.post('/schedules', { date, userId: newUserId, shiftTypeId: newShiftTypeId });
        showToast('근무가 등록되었습니다.');
      }
      setNewUserId('');
      setNewShiftTypeId('');
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, '등록에 실패했습니다.'));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold text-gray-900">{date} 전체 근무 관리</h2>

        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} shiftTypes={shiftTypes} onSaved={onSaved} />
          ))}
          {entries.length === 0 && (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
              이 날 등록된 근무가 없습니다.
            </p>
          )}
        </div>

        {availableWorkers.length > 0 && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-500">근무 추가</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">근무자 선택</option>
                {availableWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select
                value={newShiftTypeId}
                onChange={(e) => setNewShiftTypeId(e.target.value ? Number(e.target.value) : '')}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">근무 유형</option>
                {shiftTypes.map((st) => (
                  <option key={st.id} value={st.id} translate="no">
                    {st.name}
                  </option>
                ))}
              </select>

              <label className="flex w-full items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={periodMode} onChange={(e) => setPeriodMode(e.target.checked)} />
                기간을 선택해서 한번에 등록
              </label>
              {periodMode && (
                <div className="flex w-full items-center gap-2 text-sm">
                  <span className="text-gray-500">{date}</span>
                  <span className="text-gray-400">~</span>
                  <input
                    type="date"
                    value={endDate}
                    min={date}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={adding || !newUserId || !newShiftTypeId}
                className="w-full rounded-lg bg-blue-600 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        )}

        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
