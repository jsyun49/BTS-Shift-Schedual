import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Calendar from '../components/Calendar';
import ShiftModal from '../components/ShiftModal';
import SwapRequestModal from '../components/SwapRequestModal';
import type { MonthSchedulesResponse, ScheduleEntry, ShiftType, WorkerSummary } from '../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type FilterValue = 'all' | 'mine' | number;

export default function MySchedulePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [filter, setFilter] = useState<FilterValue>('all');

  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [monthData, setMonthData] = useState<MonthSchedulesResponse>({
    schedules: [],
    understaffedDates: [],
    minStaffPerDay: 0,
  });

  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [swapEntry, setSwapEntry] = useState<ScheduleEntry | null>(null);

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
    api.get('/shift-types').then((r) => setShiftTypes(r.data));
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

  const visibleSchedules = useMemo(() => {
    if (filter === 'all') return monthData.schedules;
    if (filter === 'mine') return monthData.schedules.filter((s) => s.user_id === user!.id);
    return monthData.schedules.filter((s) => s.user_id === filter);
  }, [filter, monthData.schedules, user]);

  const activeDateEntries = useMemo(
    () => (activeDate ? monthData.schedules.filter((s) => s.date === activeDate) : []),
    [activeDate, monthData.schedules]
  );
  const myEntryForActiveDate = activeDateEntries.find((e) => e.user_id === user!.id) ?? null;
  const otherEntriesForActiveDate = activeDateEntries.filter((e) => e.user_id !== user!.id);

  return (
    <div className="space-y-4">
      <h1 className="text-center text-[20px] font-bold text-gray-900">BTS Shift Schedule</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            ‹
          </button>
          <h2 className="w-32 text-center text-lg font-bold text-gray-900">
            {year}년 {month}월
          </h2>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            ›
          </button>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value === 'all' || e.target.value === 'mine' ? e.target.value : Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">전체 보기</option>
          <option value="mine">내 근무만</option>
          {workers
            .filter((w) => w.id !== user!.id)
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}만 보기
              </option>
            ))}
        </select>
      </div>

      <Calendar
        year={year}
        month={month}
        schedules={visibleSchedules}
        currentUserId={user!.id}
        understaffedDates={monthData.understaffedDates}
        onDayClick={(date) => setActiveDate(date)}
        onEntryClick={(entry) => setActiveDate(entry.date)}
        colorBy="shiftType"
        sortEntriesByName
        showAllEntries
      />

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {shiftTypes.map((st) => (
          <div key={st.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
            <span translate="no" className="notranslate">{st.name}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {workers.map((w) => (
          <div key={w.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: w.color }} />
            {w.name}
          </div>
        ))}
      </div>

      {activeDate && (
        <ShiftModal
          date={activeDate}
          myEntry={myEntryForActiveDate}
          otherEntries={otherEntriesForActiveDate}
          shiftTypes={shiftTypes}
          isAdmin={user!.role === 'admin'}
          onClose={() => setActiveDate(null)}
          onSaved={loadMonth}
          onRequestSwap={(entry) => {
            setActiveDate(null);
            setSwapEntry(entry);
          }}
        />
      )}

      {swapEntry && (
        <SwapRequestModal
          myEntry={swapEntry}
          shiftTypes={shiftTypes}
          currentUserId={user!.id}
          monthSchedules={monthData.schedules}
          onClose={() => setSwapEntry(null)}
          onSubmitted={loadMonth}
        />
      )}
    </div>
  );
}
