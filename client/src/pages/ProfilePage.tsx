import { useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();

  const [contact, setContact] = useState(user?.contact ?? '');
  const [savingContact, setSavingContact] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;
  const canChangeOwnPassword = user.role === 'admin';

  async function saveContact() {
    setSavingContact(true);
    try {
      await api.patch('/auth/me', { contact: contact || null });
      showToast('연락처가 저장되었습니다.');
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSavingContact(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('비밀번호가 변경되었습니다.');
      await refreshMe();
    } catch (err) {
      setPasswordError(getApiErrorMessage(err, '비밀번호 변경에 실패했습니다.'));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-lg font-bold text-gray-900">프로필</h1>

      {canChangeOwnPassword && user.mustChangePassword && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          최초 로그인입니다. 아래에서 비밀번호를 변경해주세요.
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">기본 정보</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">이름</span>
            <span className="font-medium text-gray-900">{user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">아이디</span>
            <span className="font-medium text-gray-900">{user.username}</span>
          </div>
          <div>
            <label className="mb-1 block text-gray-500">연락처</label>
            <div className="flex gap-2">
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="010-0000-0000"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={saveContact}
                disabled={savingContact}
                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </section>

      {canChangeOwnPassword ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">비밀번호 변경</h2>
          <form onSubmit={changePassword} className="space-y-3 text-sm">
            <input
              type="password"
              placeholder="현재 비밀번호"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="새 비밀번호"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="새 비밀번호 확인"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {passwordError && <div className="text-sm text-red-600">{passwordError}</div>}
            <button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              비밀번호 변경
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-800">비밀번호</h2>
          <p className="text-sm text-gray-500">
            아이디와 비밀번호 변경은 관리자만 할 수 있습니다. 변경이 필요하면 관리자에게 요청해주세요.
          </p>
        </section>
      )}
    </div>
  );
}
