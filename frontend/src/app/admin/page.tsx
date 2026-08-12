"use client";

import { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from 'react-hot-toast';

export default function AdminDashboard() {
  const router = typeof window !== 'undefined' ? require('next/navigation').useRouter() : null;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (router) {
      router.push('/');
    } else {
      window.location.href = '/';
    }
  };

  const [userId, setUserId] = useState('');
  const [maxDevices, setMaxDevices] = useState(1);
  const [count, setCount] = useState(1);
  const [licenseType, setLicenseType] = useState('Permanent');
  const [expirationDate, setExpirationDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // 统计大盘数据
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // 用户数据
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!userId) {
      setError('请输入 UserId。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/generate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId, 
          maxDevices, 
          count, 
          licenseType, 
          expirationDate: expirationDate ? new Date(expirationDate).toISOString() : null 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '生成失败');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || '系统错误');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result || !result.licenseKeys) return;
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + "LicenseKey\n"
      + result.licenseKeys.join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "licenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'Admin' ? 'User' : 'Admin';
    if (!confirm(`确定要将此用户的角色修改为 ${newRole} 吗？`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        toast.error('更新角色失败');
      }
    } catch (err) {
      toast.error('系统错误');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可逆！')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchUsers();
      } else {
        toast.error('删除失败');
      }
    } catch (err) {
      toast.error('系统错误');
    }
  };

  const initiateGenerateForUser = (id: string) => {
    setUserId(id);
    setActiveTab('dashboard');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-screen p-4 hidden md:block">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-8">管理后台</h1>
        <nav className="space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            大盘与发卡
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'users' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            注册人员管理
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            安全与账户设置
          </button>
        </nav>
        
        <div className="absolute bottom-8 w-56 space-y-4">
          {currentUser && (
            <div className="px-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="truncate">当前用户: {currentUser.userId}</div>
              <div className="font-semibold text-xs mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 inline-block rounded">
                角色: {currentUser.role || 'Admin'}
              </div>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-lg transition-colors font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span>退出登录 (Logout)</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
        {/* Mobile Navigation */}
        <div className="md:hidden flex gap-2 mb-6 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}
          >
            大盘与发卡
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${activeTab === 'users' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}
          >
            用户管理
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}
          >
            安全设置
          </button>
          <button 
            onClick={handleLogout}
            className="flex-1 px-4 py-2 text-sm font-medium rounded text-red-600 dark:text-red-400"
          >
            退出
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            {/* 数据大盘 Header */}
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    商业运营与风控大盘
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    实时掌控授权发放、激活趋势与防爆破拦截情况。
                  </p>
                </div>
                <a 
                  href="/api/License/public-key" 
                  target="_blank" 
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded shadow transition-colors"
                >
                  ⬇️ 下载 RSA 公钥 (客户端用)
                </a>
              </div>

              {!statsLoading && stats ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                      <div className="text-sm text-blue-600 dark:text-blue-400">今日新增激活</div>
                      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">{stats.todayActivations}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                      <div className="text-sm text-red-600 dark:text-red-400">今日风控拦截攻击</div>
                      <div className="text-3xl font-bold text-red-900 dark:text-red-100 mt-2">{stats.todayBlocks}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                      <div className="text-sm text-green-600 dark:text-green-400">总发卡授权存量</div>
                      <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">{stats.totalActiveLicenses}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                      <div className="text-sm text-purple-600 dark:text-purple-400">系统总激活设备</div>
                      <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">{stats.totalDevices}</div>
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActivations" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorBlocks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Area type="monotone" dataKey="activations" name="成功激活量" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorActivations)" />
                        <Area type="monotone" dataKey="blocks" name="风控拦截量" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorBlocks)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  数据加载中...
                </div>
              )}
            </div>

            {/* 批量发卡工具 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  批量生成激活码
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                  为经销商或活动批量生成包含过期限制的授权凭证。
                </p>
              </div>

              <form onSubmit={handleGenerate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">目标用户 (UserId GUID)</label>
                    <input
                      type="text"
                      required
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                      placeholder="例如: 123e4567-e89b-12d3-a456-426614174000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">授权类型 (License Type)</label>
                    <select
                      value={licenseType}
                      onChange={(e) => setLicenseType(e.target.value)}
                      className="mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="Permanent">永久版 (Permanent)</option>
                      <option value="Subscription">按年/月订阅 (Subscription)</option>
                      <option value="Trial">试用版 (Trial)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">发卡数量 (Batch Count)</label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value))}
                      className="mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">最大设备数 (Max Devices)</label>
                    <input
                      type="number"
                      min="1"
                      value={maxDevices}
                      onChange={(e) => setMaxDevices(parseInt(e.target.value))}
                      className="mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  {licenseType !== 'Permanent' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">过期时间 (Expiration Date)</label>
                      <input
                        type="datetime-local"
                        required={licenseType !== 'Permanent'}
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {error && <div className="text-red-500 text-sm">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full justify-center rounded-md bg-blue-600 py-2.5 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                >
                  {loading ? '生成中...' : '生成激活码'}
                </button>
              </form>

              {result && result.licenseKeys && (
                <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                  <h3 className="text-green-800 dark:text-green-200 font-bold mb-2">{result.message}</h3>
                  <div className="max-h-40 overflow-y-auto p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-sm">
                    {result.licenseKeys.map((key: string, idx: number) => (
                      <div key={idx} className="font-mono">{key}</div>
                    ))}
                  </div>
                  <button
                    onClick={handleExport}
                    className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded shadow"
                  >
                    导出为 CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            {/* 注册用户管理界面，保留原有逻辑 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                注册用户管理
              </h2>
              {usersLoading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">验证状态</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                      {users.map(user => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{user.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {user.isEmailVerified ? (
                              <span className="text-green-600 font-medium">已验证</span>
                            ) : (
                              <span className="text-yellow-600 font-medium">未验证</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                            <button
                              onClick={() => initiateGenerateForUser(user.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              生成发卡
                            </button>
                            <button
                              onClick={() => handleUpdateRole(user.id, user.role)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              设为{user.role === 'Admin' ? 'User' : 'Admin'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                            暂无用户数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
