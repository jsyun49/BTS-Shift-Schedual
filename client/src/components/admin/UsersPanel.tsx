import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { AdminUserView } from '../../types';
import ColorPickerDot from './ColorPickerDot';

function AddWorkerForm({ onCreated }: { onCreated: () => void }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [contact, setContact] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await api.post('/users', { name, username, tempPassword, contact: contact || null, color });
      showToast(`${name} 계정이 생성되었습니다.`);
      setName('');
      setUsername('');
      setTempPassword('');
      setContact('');
      setColor('#3b82f6');
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(getApiErrorMessage(err, '계정 생성에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
      >
        + 근무자 계정 추가
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">새 근무자 계정</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          placeholder="임시 비밀번호"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          placeholder="연락처 (선택)"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2 sm:col-span-2">
          <label className="text-sm text-gray-600">색상 태그</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-14 cursor-pointer rounded border border-gray-300"
          />
        </div>
      </div>
      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={handleCreate}
          disabled={saving || !name || !username || !tempPassword}
          className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          생성
        </button>
      </div>
    </div>
  );
}

function ResetPasswordControl({ userId, name }: { userId: number; name: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleReset() {
    setSaving(true);
    try {
      await api.post(`/users/${userId}/reset-password`, { newPassword });
      showToast(`${name}의 비밀번호가 초기화되었습니다.`);
      setOpen(false);
      setNewPassword('');
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline">
        비밀번호 초기화
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        placeholder="새 임시 비밀번호"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <button
        onClick={handleReset}
        disabled={saving || newPassword.length < 3}
        className="rounded bg-gray-900 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        확인
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400">
        취소
      </button>
    </div>
  );
}

function EditableUsername({ userId, username, onRenamed }: { userId: number; username: string; onRenamed: () => void }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(username);
  }, [username]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === username) {
      setEditing(false);
      setValue(username);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/users/${userId}`, { username: trimmed });
      showToast('아이디가 변경되었습니다.');
      setEditing(false);
      onRenamed();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded px-1 py-0.5 text-left hover:bg-gray-100"
        title="클릭하여 아이디 변경"
      >
        {username}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setEditing(false);
            setValue(username);
          }
        }}
        className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-gray-900 px-1.5 py-0.5 text-xs text-white disabled:opacity-50"
      >
        확인
      </button>
      <button
        onClick={() => {
          setEditing(false);
          setValue(username);
        }}
        className="text-xs text-gray-400"
      >
        취소
      </button>
    </span>
  );
}

function EditableName({ userId, name, onRenamed }: { userId: number; name: string; onRenamed: () => void }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(name);
  }, [name]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/users/${userId}`, { name: trimmed });
      showToast('이름이 변경되었습니다.');
      setEditing(false);
      onRenamed();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded px-1 py-0.5 text-left hover:bg-gray-100"
        title="클릭하여 이름 변경"
      >
        {name}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setEditing(false);
            setValue(name);
          }
        }}
        className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-gray-900 px-1.5 py-0.5 text-xs text-white disabled:opacity-50"
      >
        확인
      </button>
      <button
        onClick={() => {
          setEditing(false);
          setValue(name);
        }}
        className="text-xs text-gray-400"
      >
        취소
      </button>
    </span>
  );
}

export default function UsersPanel() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUserView[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get<AdminUserView[]>('/users');
    setUsers(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(u: AdminUserView) {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      showToast(u.isActive ? `${u.name} 계정을 비활성화했습니다.` : `${u.name} 계정을 재활성화했습니다.`);
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  async function changeColor(u: AdminUserView, color: string) {
    try {
      await api.patch(`/users/${u.id}`, { color });
      showToast(`${u.name}의 색상이 변경되었습니다.`);
      load();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    }
  }

  const workers = users.filter((u) => u.role === 'worker');

  return (
    <div className="space-y-4">
      <AddWorkerForm onCreated={load} />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">아이디</th>
              <th className="px-3 py-2">연락처</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2.5">
                  <span className="mr-1.5 inline-block align-middle">
                    <ColorPickerDot value={u.color} onSave={(color) => changeColor(u, color)} size="sm" />
                  </span>
                  <EditableName userId={u.id} name={u.name} onRenamed={load} />
                  {u.mustChangePassword && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                      초기 비번 미변경
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-gray-500">
                  <EditableUsername userId={u.id} username={u.username} onRenamed={load} />
                </td>
                <td className="px-3 py-2.5 text-gray-500">{u.contact || '-'}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {u.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => toggleActive(u)} className="text-xs text-gray-600 hover:underline">
                      {u.isActive ? '비활성화' : '재활성화'}
                    </button>
                    <ResetPasswordControl userId={u.id} name={u.name} />
                  </div>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  등록된 근무자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
