import type { ScheduleEntry, WorkerSummary } from '../../types';
import { isKoreanHoliday } from '../../utils/holidays';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function weekdayTextClass(dayOfWeek: number, isHoliday: boolean): string {
  if (isHoliday || dayOfWeek === 0) return 'text-red-400';
  if (dayOfWeek === 6) return 'text-blue-400';
  return 'text-white';
}

interface ScheduleGridTableProps {
  year: number;
  month: number;
  workers: WorkerSummary[];
  schedules: ScheduleEntry[];
}

// Read-only mirror of the schedule data — editing only ever happens in 근무표(월).
export default function ScheduleGridTable({ year, month, workers, schedules }: ScheduleGridTableProps) {
  const monthStr = `${year}-${pad(month)}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const byUserDate = new Map<string, ScheduleEntry>();
  for (const s of schedules) {
    byUserDate.set(`${s.user_id}_${s.date}`, s);
  }

  const activeWorkers = workers.filter((w) => w.role === 'worker');

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[110px] border border-gray-700 bg-gray-900 px-3 py-2 text-left font-semibold text-white">
              근무자이름
            </th>
            {days.map((d) => {
              const dow = new Date(year, month - 1, d).getDay();
              const isHoliday = isKoreanHoliday(year, month, d);
              const colorClass = weekdayTextClass(dow, isHoliday);
              return (
                <th
                  key={d}
                  className={`min-w-[64px] whitespace-nowrap border border-gray-700 bg-gray-900 px-2 py-1 text-center font-semibold ${colorClass}`}
                >
                  {month}/{d}
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 border border-gray-700 bg-gray-800 px-3 py-1 text-left text-xs font-semibold text-white">
              요일
            </th>
            {days.map((d) => {
              const dow = new Date(year, month - 1, d).getDay();
              const isHoliday = isKoreanHoliday(year, month, d);
              const colorClass = weekdayTextClass(dow, isHoliday);
              return (
                <th
                  key={d}
                  className={`border border-gray-700 bg-gray-800 px-2 py-1 text-center text-xs font-semibold ${colorClass}`}
                >
                  {WEEKDAY_LABELS[dow]}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {activeWorkers.map((w) => (
            <tr key={w.id}>
              <td className="sticky left-0 z-10 h-10 whitespace-nowrap border border-gray-300 bg-white px-3 align-middle font-medium text-gray-800">
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: w.color }} />
                {w.name}
              </td>
              {days.map((d) => {
                const date = `${monthStr}-${pad(d)}`;
                const entry = byUserDate.get(`${w.id}_${date}`);
                return (
                  <td key={d} className="h-10 border border-gray-200 px-2 text-center align-middle">
                    {entry ? (
                      <span translate="no" className="notranslate font-medium" style={{ color: entry.shift_type_color }}>
                        {entry.shift_type_name}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {activeWorkers.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="px-3 py-8 text-center text-gray-400">
                등록된 근무자가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
