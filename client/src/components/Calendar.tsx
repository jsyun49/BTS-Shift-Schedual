import type { ScheduleEntry } from '../types';
import { isKoreanHoliday } from '../utils/holidays';

interface CalendarProps {
  year: number;
  month: number; // 1-12
  schedules: ScheduleEntry[];
  currentUserId: number | null;
  understaffedDates: string[];
  onDayClick: (date: string) => void;
  onEntryClick: (entry: ScheduleEntry) => void;
  /** 'user' colors entries by the worker's color tag (default); 'shiftType' colors by shift type. */
  colorBy?: 'user' | 'shiftType';
  /** Sort each day's entries by worker name (가나다/alphabetical order). Default false. */
  sortEntriesByName?: boolean;
  /** Render every entry in a day instead of truncating to 3 with a "+N more" line. Default false. */
  showAllEntries?: boolean;
  /** When true, entries show a checkbox and clicking one toggles selection instead of opening it. */
  selectionMode?: boolean;
  selectedEntryIds?: Set<number>;
  onToggleEntrySelect?: (entry: ScheduleEntry) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function Calendar({
  year,
  month,
  schedules,
  currentUserId,
  understaffedDates,
  onDayClick,
  onEntryClick,
  colorBy = 'user',
  sortEntriesByName = false,
  showAllEntries = false,
  selectionMode = false,
  selectedEntryIds,
  onToggleEntrySelect,
}: CalendarProps) {
  const monthStr = `${year}-${pad(month)}`;
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  const byDate: Record<string, ScheduleEntry[]> = {};
  for (const s of schedules) {
    (byDate[s.date] ??= []).push(s);
  }
  if (sortEntriesByName) {
    for (const date in byDate) {
      byDate[date].sort((a, b) => a.user_name.localeCompare(b.user_name, 'ko'));
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${monthStr}-${pad(d)}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-medium text-gray-500">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return <div key={idx} className="min-h-[84px] border-b border-r border-gray-100 bg-gray-50/40 sm:min-h-[104px]" />;
          }
          const entries = byDate[cell.date] || [];
          const isUnderstaffed = understaffedDates.includes(cell.date);
          const isToday = cell.date === todayStr;
          const weekdayIdx = idx % 7;
          const isHoliday = cell.day != null && isKoreanHoliday(year, month, cell.day);

          return (
            <button
              key={cell.date}
              onClick={() => onDayClick(cell.date!)}
              className={`flex min-h-[84px] flex-col items-stretch border-b border-r border-gray-100 p-1 text-left align-top transition-colors hover:bg-blue-50/50 sm:min-h-[104px] sm:p-1.5 ${
                isUnderstaffed ? 'bg-red-50/60' : ''
              }`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-xs font-medium ${
                    isToday
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white'
                      : weekdayIdx === 0 || isHoliday
                        ? 'text-red-500'
                        : weekdayIdx === 6
                          ? 'text-blue-500'
                          : 'text-gray-700'
                  }`}
                >
                  {cell.day}
                </span>
              </div>
              <div className={`mt-1 flex flex-1 flex-col gap-0.5 ${showAllEntries ? '' : 'overflow-hidden'}`}>
                {(showAllEntries ? entries : entries.slice(0, 3)).map((e) => {
                  const isMine = currentUserId == null || e.user_id === currentUserId;
                  const baseColor = colorBy === 'shiftType' ? e.shift_type_color : e.user_color;
                  const isSelected = selectionMode && !!selectedEntryIds?.has(e.id);
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (selectionMode) {
                          onToggleEntrySelect?.(e);
                        } else {
                          onEntryClick(e);
                        }
                      }}
                      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight text-white sm:text-[11px] ${
                        isMine ? 'font-semibold' : 'font-medium'
                      } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                      style={{ backgroundColor: baseColor }}
                      title={`${e.user_name} · ${e.shift_type_name}`}
                    >
                      {selectionMode ? (
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected}
                          className="h-3 w-3 shrink-0 accent-blue-600"
                        />
                      ) : (
                        colorBy === 'shiftType' && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/80"
                            style={{ backgroundColor: e.user_color }}
                          />
                        )
                      )}
                      <span className="min-w-0 truncate">
                        {e.user_name} <span translate="no" className="notranslate">{e.shift_type_name}</span>
                      </span>
                    </div>
                  );
                })}
                {!showAllEntries && entries.length > 3 && (
                  <div className="px-1 text-[10px] text-gray-400">+{entries.length - 3}명 더</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
