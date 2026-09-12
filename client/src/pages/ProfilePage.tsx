import { useState } from 'react';
import { api, getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [contact, setContact] = useState(user?.contact ?? '');
  const [savingContact, setSavingContact] = useState(false);

  if (!user) return null;

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

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-lg font-bold text-gray-900">프로필</h1>

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
    </div>
  );
}
