import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage, TOKEN_STORAGE_KEY } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import StatsTable from '../StatsTable';
import type { StatsResponse } from '../../types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function StatsPanel() {
  const { showToast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [minStaff, setMinStaff] = useState<number>(0);
  const [savingSetting, setSavingSetting] = useState(false);

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

  useEffect(() => {
    api.get('/settings').then((r) => setMinStaff(r.data.minStaffPerDay));
  }, []);

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

  async function saveMinStaff() {
    setSavingSetting(true);
    try {
      await api.patch('/settings', { minStaffPerDay: minStaff });
      showToast('최소 근무 인원 설정이 저장되었습니다.');
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSavingSetting(false);
    }
  }

  async function downloadCsv() {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const res = await fetch(`/api/export/schedules.csv?month=${monthStr}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('내보내기에 실패했습니다.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedules-${monthStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '내보내기에 실패했습니다.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <button
          onClick={downloadCsv}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          CSV 내보내기
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm text-gray-700">일별 최소 근무 인원</label>
        <input
          type="number"
          min={0}
          max={6}
          value={minStaff}
          onChange={(e) => setMinStaff(Number(e.target.value))}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          onClick={saveMinStaff}
          disabled={savingSetting}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          저장
        </button>
      </div>

      <StatsTable stats={stats} />
    </div>
  );
}
