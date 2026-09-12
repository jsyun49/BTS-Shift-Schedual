import type { ReactNode } from 'react';
import type { StatsResponse } from '../types';

const SHIFT_DAY_TYPES = ['GY', 'SW', 'Day'];

function shiftDayCount(byShiftType: Record<string, number>): number {
  return SHIFT_DAY_TYPES.reduce((sum, name) => sum + (byShiftType[name] ?? 0), 0);
}

// Break long header labels onto two lines instead of an awkward mid-word wrap.
function twoLineLabel(text: string): ReactNode {
  if (text === 'Shift일수') {
    return (
      <>
        Shift
        <br />
        일수
      </>
    );
  }
  if (text.length === 4 && /^[가-힣]+$/.test(text)) {
    return (
      <>
        {text.slice(0, 2)}
        <br />
        {text.slice(2)}
      </>
    );
  }
  return text;
}

export default function StatsTable({ stats }: { stats: StatsResponse | null }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2">근무자</th>
            {stats?.shiftTypes.map((name) => (
              <th key={name} className="whitespace-nowrap px-3 py-2 text-right leading-tight">
                <span translate="no" className="notranslate">{twoLineLabel(name)}</span>
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-2 text-right leading-tight">{twoLineLabel('Shift일수')}</th>
            <th className="whitespace-nowrap px-3 py-2 text-right leading-tight">{twoLineLabel('근무일수')}</th>
            <th className="whitespace-nowrap px-3 py-2 text-right leading-tight">{twoLineLabel('휴무일수')}</th>
          </tr>
        </thead>
        <tbody>
          {stats?.stats.map((row) => (
            <tr key={row.userId} className="border-b border-gray-50 last:border-0">
              <td className="px-3 py-2.5">
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: row.color }} />
                {row.name}
              </td>
              {stats?.shiftTypes.map((name) => (
                <td key={name} className="px-3 py-2.5 text-right text-gray-600">
                  {row.byShiftType[name] ?? 0}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{shiftDayCount(row.byShiftType)}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{row.totalWorkDays}</td>
              <td className="px-3 py-2.5 text-right text-gray-500">{row.offDays}</td>
            </tr>
          ))}
          {stats && stats.stats.length === 0 && (
            <tr>
              <td colSpan={stats.shiftTypes.length + 4} className="px-3 py-8 text-center text-gray-400">
                통계 데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
