import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface ChangeLogRow {
  id: number;
  action: string;
  target_schedule_id: number | null;
  detail: string | null;
  timestamp: string;
  user_name: string;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_SCHEDULE: '근무 등록',
  UPDATE_SCHEDULE: '근무 수정',
  DELETE_SCHEDULE: '근무 삭제',
  SWAP_ACCEPT: '교대 수락(자동 반영)',
};

export default function ChangeLogsPanel() {
  const [logs, setLogs] = useState<ChangeLogRow[]>([]);

  useEffect(() => {
    api.get<ChangeLogRow[]>('/schedules/change-logs').then((r) => setLogs(r.data));
  }, []);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2">시각</th>
            <th className="px-3 py-2">수행자</th>
            <th className="px-3 py-2">작업</th>
            <th className="px-3 py-2">상세</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-gray-50 last:border-0 align-top">
              <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                {new Date(log.timestamp.replace(' ', 'T') + 'Z').toLocaleString('ko-KR')}
              </td>
              <td className="px-3 py-2.5 font-medium text-gray-800">{log.user_name}</td>
              <td className="px-3 py-2.5">{ACTION_LABEL[log.action] ?? log.action}</td>
              <td className="max-w-xs px-3 py-2.5 text-xs text-gray-400">
                <pre className="whitespace-pre-wrap break-all font-mono">{log.detail}</pre>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                변경 이력이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
