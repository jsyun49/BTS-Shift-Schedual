import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Calendar from '../Calendar';
import AdminScheduleModal from './AdminScheduleModal';
import type { MonthSchedulesResponse, ScheduleEntry, ShiftType, WorkerSummary } from '../../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function AllSchedulesPanel() {
  const { showToast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [monthData, setMonthData] = useState<MonthSchedulesResponse>({
    schedules: [],
    understaffedDates: [],
    minStaffPerDay: 0,
  });
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const [workerFilter, setWorkerFilter] = useState<Set<number>>(new Set());

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [bulkShiftTypeId, setBulkShiftTypeId] = useState<number | ''>('');
  const [bulkApplying, setBulkApplying] = useState(false);

  const monthStr = `${year}-${pad(month)}`;

  const loadMonth = useCallback(async () => {
    try {
      const { data } = await api.get<MonthSchedulesResponse>('/schedules', { params: { month: monthStr } });
      setMonthData(data);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }, [monthStr, showToast]);

  useEffect(() => {
    api.get('/users').then((r) => setWorkers(r.data));
    api.get('/shift-types', { params: { all: '1' } }).then((r) => setShiftTypes(r.data));
  }, []);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    setMonth(m);
    setYear(y);
  }

  function toggleWorkerFilter(workerId: number) {
    setWorkerFilter((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  }

  const visibleSchedules = useMemo(
    () => (workerFilter.size === 0 ? monthData.schedules : monthData.schedules.filter((s) => workerFilter.has(s.user_id))),
    [workerFilter, monthData.schedules]
  );

  function toggleEntrySelect(entry: ScheduleEntry) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }

  function toggleBulkMode() {
    setBulkMode((prev) => !prev);
    setSelectedEntryIds(new Set());
    setBulkShiftTypeId('');
  }

  const allVisibleSelected =
    visibleSchedules.length > 0 && visibleSchedules.every((s) => selectedEntryIds.has(s.id));

  function toggleSelectAll() {
    setSelectedEntryIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const s of visibleSchedules) next.delete(s.id);
        return next;
      }
      const next = new Set(prev);
      for (const s of visibleSchedules) next.add(s.id);
      return next;
    });
  }

  async function applyBulkShiftType() {
    if (!bulkShiftTypeId || selectedEntryIds.size === 0) return;
    setBulkApplying(true);
    try {
      const ids = Array.from(selectedEntryIds);
      const results = await Promise.allSettled(
        ids.map((id) => api.patch(`/schedules/${id}`, { shiftTypeId: bulkShiftTypeId }))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      showToast(
        failed > 0
          ? `${ids.length - failed}건 변경 완료, ${failed}건 실패`
          : `${ids.length}건의 근무 유형이 일괄 변경되었습니다.`
      );
      setSelectedEntryIds(new Set());
      setBulkShiftTypeId('');
      loadMonth();
    } finally {
      setBulkApplying(false);
    }
  }

  async function deleteSelected() {
    if (selectedEntryIds.size === 0) return;
    setBulkApplying(true);
    try {
      const ids = Array.from(selectedEntryIds);
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/schedules/${id}`)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      showToast(
        failed > 0
          ? `${ids.length - failed}건 삭제 완료, ${failed}건 실패`
          : `${ids.length}건의 근무가 삭제되었습니다.`
      );
      setSelectedEntryIds(new Set());
      loadMonth();
    } finally {
      setBulkApplying(false);
    }
  }

  const activeDateEntries = activeDate ? monthData.schedules.filter((s) => s.date === activeDate) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-center text-[20px] font-bold text-gray-900">BTS Shift Schedule</h1>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-100">
            ‹
          </button>
          <h2 className="w-32 text-center text-base font-bold text-gray-900">
            {year}년 {month}월
          </h2>
          <button onClick={() => shiftMonth(1)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-100">
            ›
          </button>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <p className="text-xs font-medium text-gray-500">근무자 필터</p>
          <div className="flex max-w-xs flex-wrap justify-end gap-x-3 gap-y-1">
            {workers
              .filter((w) => w.role === 'worker')
              .map((w) => (
                <label key={w.id} className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={workerFilter.has(w.id)}
                    onChange={() => toggleWorkerFilter(w.id)}
                  />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />
                  {w.name}
                </label>
              ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">날짜를 클릭하면 해당 날짜의 모든 근무자 근무를 강제로 수정/삭제/추가할 수 있습니다.</p>
        <button
          onClick={toggleBulkMode}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            bulkMode ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {bulkMode ? '일괄 수정 모드 끄기' : '일괄 수정 모드'}
        </button>
      </div>

      {bulkMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <label className="flex items-center gap-1.5 text-sm font-medium text-blue-800">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} disabled={visibleSchedules.length === 0} />
            전체 선택
          </label>
          <span className="text-sm font-medium text-blue-800">{selectedEntryIds.size}개 선택됨</span>
          <select
            value={bulkShiftTypeId}
            onChange={(e) => setBulkShiftTypeId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">변경할 근무 유형</option>
            {shiftTypes
              .filter((st) => st.is_active)
              .map((st) => (
                <option key={st.id} value={st.id} translate="no">
                  {st.name}
                </option>
              ))}
          </select>
          <button
            onClick={applyBulkShiftType}
            disabled={bulkApplying || !bulkShiftTypeId || selectedEntryIds.size === 0}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            일괄 변경
          </button>
          <button
            onClick={deleteSelected}
            disabled={bulkApplying || selectedEntryIds.size === 0}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            선택 삭제
          </button>
          <button
            onClick={() => setSelectedEntryIds(new Set())}
            disabled={selectedEntryIds.size === 0}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            선택 해제
          </button>
        </div>
      )}

      <Calendar
        year={year}
        month={month}
        schedules={visibleSchedules}
        currentUserId={null}
        understaffedDates={monthData.understaffedDates}
        onDayClick={(date) => setActiveDate(date)}
        onEntryClick={(entry) => setActiveDate(entry.date)}
        colorBy="shiftType"
        sortEntriesByName
        showAllEntries
        selectionMode={bulkMode}
        selectedEntryIds={selectedEntryIds}
        onToggleEntrySelect={toggleEntrySelect}
      />

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {shiftTypes.map((st) => (
          <div key={st.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
            <span translate="no" className="notranslate">{st.name}</span>
          </div>
        ))}
      </div>

      {activeDate && (
        <AdminScheduleModal
          date={activeDate}
          entries={activeDateEntries}
          workers={workers}
          shiftTypes={shiftTypes.filter((s) => s.is_active)}
          onClose={() => setActiveDate(null)}
          onSaved={loadMonth}
        />
      )}
    </div>
  );
}
