import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { SwapRequestView } from '../types';

const STATUS_LABEL: Record<string, string> = {
  pending: '대기중',
  accepted: '수락됨',
  rejected: '거절됨',
  cancelled: '취소됨',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function SwapCard({
  swap,
  perspective,
  onAccept,
  onReject,
  onCancel,
}: {
  swap: SwapRequestView;
  perspective: 'received' | 'sent';
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[swap.status]}`}>
          {STATUS_LABEL[swap.status]}
        </span>
        <span className="text-xs text-gray-400">{new Date(swap.created_at.replace(' ', 'T') + 'Z').toLocaleString('ko-KR')}</span>
      </div>
      <p className="text-sm text-gray-800">
        <span className="font-semibold">{swap.requester_name}</span>
        {swap.target_id === swap.requester_id ? (
          <>의 본인</>
        ) : (
          <>
            이(가) <span className="font-semibold">{swap.target_name}</span>님의
          </>
        )}{' '}
        <span className="font-medium">
          {swap.schedule_date} <span translate="no" className="notranslate">{swap.schedule_shift_type_name}</span>
        </span>{' '}
        근무를{' '}
        <span className="font-medium" translate="no">
          {swap.requested_shift_type_name}
        </span>
        (으)로 변경 요청
      </p>
      {swap.status === 'pending' && swap.target_id === swap.requester_id && (
        <p className="mt-1 text-[11px] text-amber-600">관리자 승인 대기중입니다.</p>
      )}

      {swap.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          {perspective === 'received' ? (
            <>
              <button
                onClick={() => onReject(swap.id)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                거절
              </button>
              <button
                onClick={() => onAccept(swap.id)}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                수락
              </button>
            </>
          ) : (
            <button
              onClick={() => onCancel(swap.id)}
              className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              요청 취소
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SwapRequestsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [swaps, setSwaps] = useState<SwapRequestView[]>([]);
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SwapRequestView[]>('/swaps');
      setSwaps(data);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: number, action: 'accept' | 'reject' | 'cancel') {
    try {
      await api.post(`/swaps/${id}/${action}`);
      showToast(
        action === 'accept' ? '변경 요청을 수락했습니다.' : action === 'reject' ? '변경 요청을 거절했습니다.' : '변경 요청을 취소했습니다.'
      );
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  // Self-requests (target === requester) only ever appear under "sent" — a worker
  // cannot approve their own change, so it never belongs in "received".
  const received = swaps.filter((s) => s.target_id === user!.id && s.target_id !== s.requester_id);
  const sent = swaps.filter((s) => s.requester_id === user!.id);
  const list = tab === 'received' ? received : sent;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">변경요청</h1>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('received')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'received' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          받은 요청 ({received.filter((s) => s.status === 'pending').length})
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'sent' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
        >
          보낸 요청 ({sent.filter((s) => s.status === 'pending').length})
        </button>
      </div>

      <div className="space-y-3">
        {list.length === 0 && <p className="py-8 text-center text-sm text-gray-400">변경 요청이 없습니다.</p>}
        {list.map((s) => (
          <SwapCard
            key={s.id}
            swap={s}
            perspective={tab}
            onAccept={(id) => act(id, 'accept')}
            onReject={(id) => act(id, 'reject')}
            onCancel={(id) => act(id, 'cancel')}
          />
        ))}
      </div>
    </div>
  );
}
