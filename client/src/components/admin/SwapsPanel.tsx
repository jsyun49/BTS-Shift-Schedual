import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { SwapRequestView, SwapStatus } from '../../types';

const STATUS_LABEL: Record<SwapStatus, string> = {
  pending: '대기중',
  accepted: '수락됨',
  rejected: '거절됨',
  cancelled: '취소됨',
};

const STATUS_STYLE: Record<SwapStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function SwapsPanel() {
  const { showToast } = useToast();
  const [swaps, setSwaps] = useState<SwapRequestView[]>([]);
  const [statusFilter, setStatusFilter] = useState<SwapStatus | 'all'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const { data } = await api.get<SwapRequestView[]>('/swaps');
    setSwaps(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: number, action: 'accept' | 'reject' | 'cancel') {
    try {
      await api.post(`/swaps/${id}/${action}`);
      showToast('처리되었습니다.');
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  const filtered = useMemo(
    () => (statusFilter === 'all' ? swaps : swaps.filter((s) => s.status === statusFilter)),
    [statusFilter, swaps]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const s of filtered) next.delete(s.id);
        return next;
      }
      const next = new Set(prev);
      for (const s of filtered) next.add(s.id);
      return next;
    });
  }

  async function deleteOne(id: number) {
    try {
      await api.delete(`/swaps/${id}`);
      showToast('교대 요청을 삭제했습니다.');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    try {
      const { data } = await api.post('/swaps/bulk-delete', { ids: Array.from(selected) });
      showToast(`${data.deleted}건의 교대 요청을 삭제했습니다.`);
      setSelected(new Set());
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SwapStatus | 'all')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">전체 상태</option>
          <option value="pending">대기중</option>
          <option value="accepted">수락됨</option>
          <option value="rejected">거절됨</option>
          <option value="cancelled">취소됨</option>
        </select>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} disabled={filtered.length === 0} />
            전체 선택
          </label>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            선택 삭제{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggleOne(s.id)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="text-sm text-gray-800">
                <span className="font-semibold">{s.requester_name}</span>
                {s.target_id === s.requester_id ? (
                  <span className="text-gray-400"> (본인)</span>
                ) : (
                  <>
                    {' → '}
                    <span className="font-semibold">{s.target_name}</span>
                  </>
                )}
                {' · '}
                {s.schedule_date} <span translate="no" className="notranslate">{s.schedule_shift_type_name}</span>
                {' → '}
                <span translate="no" className="notranslate">{s.requested_shift_type_name}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.status === 'pending' && (
                  <>
                    <button
                      onClick={() => act(s.id, 'accept')}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      강제 승인
                    </button>
                    <button
                      onClick={() => act(s.id, 'reject')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => act(s.id, 'cancel')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteOne(s.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-gray-400">해당하는 교대 요청이 없습니다.</p>}
      </div>
    </div>
  );
}
