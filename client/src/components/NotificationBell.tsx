import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { AppNotification } from '../types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore transient polling failures
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleClickNotification(n: AppNotification) {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/read`);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.type.startsWith('SWAP_')) {
      navigate('/swaps');
    }
  }

  async function markAllRead() {
    await api.post('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
        aria-label="알림"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 17a3 3 0 0 0 6 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-sm font-semibold text-gray-800">알림</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                모두 읽음 처리
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">알림이 없습니다.</div>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`block w-full border-b border-gray-50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-gray-50 ${
                  n.is_read ? 'text-gray-500' : 'font-medium text-gray-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                  <div className="flex-1">
                    <div>{n.message}</div>
                    <div className="mt-0.5 text-xs text-gray-400">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
