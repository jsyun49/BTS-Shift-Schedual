import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import StatsTable from '../components/StatsTable';
import type { StatsResponse } from '../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function StatsPage() {
  const { showToast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const monthStr = `${year}-${pad(month)}`;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<StatsResponse>('/stats', { params: { month: monthStr } });
      setStats(data);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }, [monthStr, showToast]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="space-y-4">
      <h1 className="text-center text-[20px] font-bold text-gray-900">BTS Shift Schedule</h1>

      <h2 className="text-lg font-bold text-gray-900">근무 통계 현황</h2>

      <div className="flex items-center gap-2">
        <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-100">
          ‹
        </button>
        <h3 className="w-32 text-center text-base font-bold text-gray-900">
          {year}년 {month}월
        </h3>
        <button onClick={() => shiftMonth(1)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-100">
          ›
        </button>
      </div>

      <StatsTable stats={stats} />
    </div>
  );
}
