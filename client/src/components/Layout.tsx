import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
    isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-sm font-semibold text-gray-800">{user.name}님</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
              {user.role === 'admin' ? '관리자' : '근무자'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={logout}
              className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              로그아웃
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          <NavLink to="/schedule" className={tabClass}>
            근무표(월)
          </NavLink>
          <NavLink to="/schedule-table" className={tabClass}>
            근무표(N)
          </NavLink>
          <NavLink to="/swaps" className={tabClass}>
            변경요청
          </NavLink>
          <NavLink to="/stats" className={tabClass}>
            근무 통계
          </NavLink>
          <NavLink to="/profile" className={tabClass}>
            프로필
          </NavLink>
          {user.role === 'admin' && (
            <NavLink to="/admin" className={tabClass}>
              관리자
            </NavLink>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
