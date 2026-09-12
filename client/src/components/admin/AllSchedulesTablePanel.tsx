import { useCallback, useEffect, useMemo, useState } from 'react';
import writeXlsxFile from 'write-excel-file/browser';
import type { Row } from 'write-excel-file/browser';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { isKoreanHoliday } from '../../utils/holidays';
import ScheduleGridTable from './ScheduleGridTable';
import type { MonthSchedulesResponse, ScheduleEntry, ShiftType, WorkerSummary } from '../../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Read-only mirror of 근무표(월)'s data — no editing here; all changes are made in 근무표(월).
export default function AllSchedulesTablePanel() {
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

  const [workerFilter, setWorkerFilter] = useState<Set<number>>(new Set());

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

  async function downloadExcel() {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const activeWorkers = workers.filter((w) => w.role === 'worker');

    const byUserDate = new Map<string, ScheduleEntry>();
    for (const s of visibleSchedules) byUserDate.set(`${s.user_id}_${s.date}`, s);

    function headerCellStyle(d: number) {
      const dow = new Date(year, month - 1, d).getDay();
      const holiday = isKoreanHoliday(year, month, d);
      const textColor = holiday || dow === 0 ? '#F87171' : dow === 6 ? '#60A5FA' : '#FFFFFF';
      return { backgroundColor: '#111827', textColor, fontWeight: 'bold' as const, align: 'center' as const };
    }

    const dateRow: Row = [
      { value: '근무자이름', backgroundColor: '#111827', textColor: '#FFFFFF', fontWeight: 'bold', align: 'center' },
      ...days.map((d) => ({ value: `${month}/${d}`, ...headerCellStyle(d) })),
    ];

    const weekdayRow: Row = [
      { value: '요일', backgroundColor: '#1F2937', textColor: '#FFFFFF', fontWeight: 'bold', align: 'center' },
      ...days.map((d) => {
        const dow = new Date(year, month - 1, d).getDay();
        return { value: WEEKDAY_LABELS[dow], ...headerCellStyle(d), backgroundColor: '#1F2937' };
      }),
    ];

    const dataRows: Row[] = activeWorkers.map((w) => [
      { value: w.name, fontWeight: 'bold' as const, align: 'left' as const },
      ...days.map((d) => {
        const date = `${monthStr}-${pad(d)}`;
        const entry = byUserDate.get(`${w.id}_${date}`);
        return entry
          ? { value: entry.shift_type_name, textColor: entry.shift_type_color, align: 'center' as const }
          : { value: '-', align: 'center' as const };
      }),
    ]);

    await writeXlsxFile([dateRow, weekdayRow, ...dataRows], {
      columns: [{ width: 14 }, ...days.map(() => ({ width: 8 }))],
    }).toFile(`근무표_${monthStr}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <h1 className="text-center text-[20px] font-bold text-gray-900">BTS Shift Schedule</h1>
        <button
          onClick={downloadExcel}
          title="엑셀 다운로드"
          className="absolute right-0 top-0 flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          <DownloadIcon />
          <span className="hidden sm:inline">엑셀 다운로드</span>
        </button>
      </div>

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

      <p className="text-xs text-gray-500">이 화면은 조회 전용입니다. 근무를 등록/수정/삭제하려면 근무표(월)을 이용해주세요.</p>

      <ScheduleGridTable year={year} month={month} workers={workers} schedules={visibleSchedules} />

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {shiftTypes.map((st) => (
          <div key={st.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
            <span translate="no" className="notranslate">{st.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
