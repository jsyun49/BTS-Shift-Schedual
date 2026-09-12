import { useState } from 'react';
import UsersPanel from '../components/admin/UsersPanel';
import ShiftTypesPanel from '../components/admin/ShiftTypesPanel';
import AllSchedulesPanel from '../components/admin/AllSchedulesPanel';
import AllSchedulesTablePanel from '../components/admin/AllSchedulesTablePanel';
import SwapsPanel from '../components/admin/SwapsPanel';
import StatsPanel from '../components/admin/StatsPanel';
import ChangeLogsPanel from '../components/admin/ChangeLogsPanel';

const TABS = [
  { key: 'users', label: '근무자 계정' },
  { key: 'shiftTypes', label: '근무 유형' },
  { key: 'schedules', label: '근무표(월)' },
  { key: 'schedules2', label: '근무표(N)' },
  { key: 'swaps', label: '변경요청 관리' },
  { key: 'stats', label: '통계 / 내보내기' },
  { key: 'logs', label: '변경 이력' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>('users');

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">관리자</h1>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersPanel />}
      {tab === 'shiftTypes' && <ShiftTypesPanel />}
      {tab === 'schedules' && <AllSchedulesPanel />}
      {tab === 'schedules2' && <AllSchedulesTablePanel />}
      {tab === 'swaps' && <SwapsPanel />}
      {tab === 'stats' && <StatsPanel />}
      {tab === 'logs' && <ChangeLogsPanel />}
    </div>
  );
}
