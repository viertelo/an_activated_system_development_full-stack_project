"use client";

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import useSWR from 'swr';

import { startRegistration } from '@simplewebauthn/browser';

interface GenerateResult {
  message?: string;
  licenseKeys?: string[];
}

interface ChartData {
  date: string;
  activations: number;
  blocks: number;
}

interface StatsData {
  todayActivations: number;
  todayBlocks: number;
  totalActiveLicenses: number;
  totalDevices: number;
  chartData: ChartData[];
}

interface UserData {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  createdAt: string;
}

function LicenseDetailTable({ apiFetch, setActiveTab }: { apiFetch: (url: string, options?: RequestInit) => Promise<Response>, setActiveTab: (tab: string) => void }) {
  const [timeRange, setTimeRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    fetchData();
  }, [timeRange, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      let url = '/api/admin/licenses/detail';
      if (timeRange !== 'all') {
        const end = new Date();
        const start = new Date();
        if (timeRange === 'day') {
          start.setDate(start.getDate() - 1);
        } else if (timeRange === 'week') {
          start.setDate(start.getDate() - 7);
        } else if (timeRange === 'month') {
          start.setMonth(start.getMonth() - 1);
        } else if (timeRange === 'custom') {
          if (customStart) start.setTime(new Date(customStart).getTime());
          if (customEnd) end.setTime(new Date(customEnd).getTime());
        }
        url += `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      }
      
      const res = await apiFetch(url);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              授权详细信息
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              查看所有已生成的授权信息并进行筛选。
            </p>
          </div>
          <div>
            <button onClick={() => setActiveTab('dashboard')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded text-sm font-semibold transition-colors">
              返回大盘
            </button>
          </div>
        </div>
        <div className="flex space-x-2 mb-4 items-center">
          <button onClick={() => setTimeRange('all')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>全部</button>
          <button onClick={() => setTimeRange('day')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>最近一天</button>
          <button onClick={() => setTimeRange('week')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>最近一周</button>
          <button onClick={() => setTimeRange('month')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>最近一月</button>
          <button onClick={() => setTimeRange('custom')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>自定义日期</button>
          
          {timeRange === 'custom' && (
            <div className="flex space-x-2 items-center ml-4">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <span className="text-gray-500">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">已绑定设备 (激活码)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设备限制</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {paginatedData.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-gray-300">
                      {item.activatedDevices && item.activatedDevices.length > 0 ? (
                        <div className="flex flex-col space-y-1">
                          {item.activatedDevices.map((d: string, i: number) => <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded break-all">{d}</span>)}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">暂无设备激活</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.licenseType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.activatedDevices?.length || 0} / {item.maxDevices}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.isActive ? (
                        <span className="text-green-600">正常</span>
                      ) : (
                        <span className="text-red-600">封禁</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center space-x-2 mt-4 items-center text-gray-700 dark:text-gray-300">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
            >
              上一页
            </button>
            <span className="text-sm">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceDetailTable({ apiFetch, setActiveTab }: { apiFetch: (url: string, options?: RequestInit) => Promise<Response>, setActiveTab: (tab: string) => void }) {
  const [timeRange, setTimeRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    fetchData();
  }, [timeRange, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      let url = '/api/admin/devices/detail';
      if (timeRange !== 'all') {
        const end = new Date();
        const start = new Date();
        if (timeRange === 'day') {
          start.setDate(start.getDate() - 1);
        } else if (timeRange === 'week') {
          start.setDate(start.getDate() - 7);
        } else if (timeRange === 'month') {
          start.setMonth(start.getMonth() - 1);
        } else if (timeRange === 'custom') {
          if (customStart) start.setTime(new Date(customStart).getTime());
          if (customEnd) end.setTime(new Date(customEnd).getTime());
        }
        url += `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      }
      
      const res = await apiFetch(url);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              已激活设备列表
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              查看所有绑定了授权的设备及其首次激活时间。
            </p>
          </div>
          <div>
            <button onClick={() => setActiveTab('dashboard')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded text-sm font-semibold transition-colors">
              返回大盘
            </button>
          </div>
        </div>
        <div className="flex space-x-2 mb-4 items-center">
          <button onClick={() => setTimeRange('all')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>全部</button>
          <button onClick={() => setTimeRange('day')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>最近一天</button>
          <button onClick={() => setTimeRange('week')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>最近一周</button>
          <button onClick={() => setTimeRange('month')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>最近一月</button>
          <button onClick={() => setTimeRange('custom')} className={`px-4 py-2 text-sm font-medium rounded ${timeRange === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>自定义日期</button>
          
          {timeRange === 'custom' && (
            <div className="flex space-x-2 items-center ml-4">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <span className="text-gray-500">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设备 ID (激活码)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">授权类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">激活时间</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {paginatedData.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-gray-300 break-all">{item.hardwareId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.licenseType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.activatedAt ? new Date(item.activatedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center space-x-2 mt-4 items-center text-gray-700 dark:text-gray-300">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
            >
              上一页
            </button>
            <span className="text-sm">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicKeyDetail({ apiFetch, setActiveTab }: { apiFetch: (url: string, options?: RequestInit) => Promise<Response>, setActiveTab: (tab: string) => void }) {
  const [pubKey, setPubKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKey();
  }, []);

  const fetchKey = async () => {
    try {
      const res = await apiFetch('/api/License/public-key/text');
      if (res.ok) {
        const data = await res.json();
        setPubKey(data.publicKey);
      } else {
        toast.error('获取公钥失败');
      }
    } catch (err) {
      toast.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const successToast = () => toast.success('公钥已复制到剪贴板', {
      style: { background: '#10B981', color: '#fff' }
    });

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(pubKey)
        .then(successToast)
        .catch(() => toast.error('复制失败'));
    } else {
      // 非 HTTPS 局域网环境降级方案
      const textArea = document.createElement("textarea");
      textArea.value = pubKey;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          successToast();
        } else {
          toast.error('复制失败，请手动选择文字复制');
        }
      } catch (err) {
        toast.error('浏览器不支持自动复制，请手动复制');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              查看 RSA 公钥
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              用于客户端验证授权的 RSA 签名。
            </p>
          </div>
          <div>
            <button onClick={() => setActiveTab('dashboard')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded text-sm font-semibold transition-colors">
              返回大盘
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 font-mono text-sm border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all overflow-x-auto">
              {pubKey}
            </div>
            
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow transition-colors"
            >
              📋 复制公钥
            </button>

            <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">使用说明</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li>点击上方 <strong>复制公钥</strong> 按钮。</li>
                <li>在您的客户端项目（如 C#、Java、Go 等）中，新建一个文本文件，命名为 <code>public_key.pem</code>。</li>
                <li>将复制的内容完全粘贴进该文件中，确保包含 <code>-----BEGIN PUBLIC KEY-----</code> 和 <code>-----END PUBLIC KEY-----</code>。</li>
                <li>在客户端代码中加载该 PEM 文件进行签名验证。</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<{ userId: string, role: string } | null>(null);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const sessionToken = localStorage.getItem('sessionToken');
    const userStr = localStorage.getItem('user');
    const headers = new Headers(options.headers || {});
    if (sessionToken) headers.append('X-Session-Token', sessionToken);
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        if (parsed.userId) headers.append('X-User-Id', parsed.userId);
      } catch (e) {}
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      toast.error('登录已过期或在其他设备登录');
      localStorage.removeItem('user');
      localStorage.removeItem('sessionToken');
      router.push('/');
    }
    return res;
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  // License Generation states
  const [maxDevices, setMaxDevices] = useState(1);
  const [count, setCount] = useState(1);
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [licenseType, setLicenseType] = useState('Permanent');
  const [expirationDate, setExpirationDate] = useState('');
  const [allowDeviceTransfer, setAllowDeviceTransfer] = useState(false);
  const [maxActivations, setMaxActivations] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');

  const fetcher = async (url: string) => {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error('An error occurred while fetching the data.');
    return res.json();
  };

  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR<StatsData>(
    '/api/admin/stats',
    fetcher,
    { refreshInterval: 60000 } // Optionally auto-refresh every minute
  );

  const { data: users, error: usersError, isLoading: usersLoading, mutate: mutateUsers } = useSWR<UserData[]>(
    activeTab === 'users' ? '/api/admin/users' : null,
    fetcher
  );

  // Settings / Security state
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  const fetchRegistrationStatus = async () => {
    try {
      const res = await apiFetch(`/api/admin/settings/registration`);
      if (res.ok) {
        const data = await res.json();
        setRegistrationEnabled(data.enabled ?? data.registrationEnabled);
      }
    } catch (err) {
      console.error("Failed to fetch registration status", err);
    }
  };

  const handleToggleRegistration = async () => {
    const newValue = !registrationEnabled;
    try {
      setSettingsLoading(true);
      const res = await apiFetch(`/api/admin/settings/registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationEnabled: newValue })
      });
      if (res.ok) {
        setRegistrationEnabled(newValue);
        toast.success(newValue ? '已开启用户注册' : '已关闭用户注册');
      } else {
        toast.error('设置失败');
      }
    } catch (err) {
      toast.error('系统错误');
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchSettingsStatus = async () => {
    if (!currentUser?.userId) return;
    try {
      setSettingsLoading(true);
      const res = await apiFetch(`/api/auth/2fa/status/${currentUser.userId}`);
      if (res.ok) {
        const data = await res.json();
        setIs2faEnabled(data.isTwoFactorEnabled);
      }
    } catch (err) {
      console.error("Failed to fetch settings status", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings' && currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSettingsStatus();
      fetchRegistrationStatus();
    }
  }, [activeTab, currentUser]);

  const handleSetup2FA = async () => {
    if (!currentUser?.userId) return;
    try {
      setSettingsLoading(true);
      const res = await apiFetch(`/api/auth/2fa/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.userId })
      });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUri(data.qrCodeUri);
        setTwoFactorSecret(data.secret);
        toast.success(data.message || '二维码已生成');
      } else {
        toast.error(data.message || '生成失败');
      }
    } catch (err) {
      toast.error('系统错误');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!currentUser?.userId) return;
    try {
      setSettingsLoading(true);
      const res = await apiFetch(`/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.userId, code: twoFactorVerifyCode })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '2FA 配置成功');
        setIs2faEnabled(true);
        setQrCodeUri('');
        setTwoFactorSecret('');
        setTwoFactorVerifyCode('');
      } else {
        toast.error(data.message || '验证失败');
      }
    } catch (err) {
      toast.error('系统错误');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!currentUser?.userId || !confirm('确定要关闭 2FA 二次验证吗？这会降低账户安全性。')) return;
    try {
      setSettingsLoading(true);
      const res = await apiFetch(`/api/auth/2fa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.userId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '已关闭 2FA');
        setIs2faEnabled(false);
      } else {
        toast.error(data.message || '关闭失败');
      }
    } catch (err) {
      toast.error('系统错误');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!currentUser?.userId) return;
    try {
      setSettingsLoading(true);
      // 1. Get options from server
      const userId = currentUser.userId; // The guid
      const resp = await apiFetch(`/api/passkey/makeCredentialOptions?userId=${encodeURIComponent(userId)}`, { method: 'POST' });
      if (!resp.ok) throw new Error('Failed to get registration options');
      const options = await resp.json();

      // 2. Pass options to browser authenticator
      const attResp = await startRegistration(options);

      // 3. Send response back to server
      const verifyResp = await apiFetch(`/api/passkey/makeCredential?userId=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });

      if (verifyResp.ok) {
        toast.success('通行密钥添加成功');
      } else {
        const error = await verifyResp.json();
        toast.error(error.ErrorMessage || '通行密钥添加失败');
      }
    } catch (err: any) {
      toast.error(err.message || '通行密钥注册被取消或系统错误');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);



    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/generate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          maxDevices, 
          count, 
          licenseType, 
          expirationDate: expirationDate ? new Date(expirationDate).toISOString() : null,
          allowDeviceTransfer,
          maxActivations
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '生成失败');
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '系统错误');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result || !result.licenseKeys) return;
    
    const headers = [
      "激活码 (License Key)",
      "授权类型 (License Type)",
      "最大并发设备数 (Max Devices)",
      "允许自动换绑 (Allow Transfer)",
      "终生总激活次数 (Max Activations)",
      "过期时间 (Expiration Date)"
    ].join(",");

    const expDateStr = expirationDate ? new Date(expirationDate).toLocaleString() : "永久有效";
    const transferStr = allowDeviceTransfer ? "是 (允许换绑)" : "否 (固定单机)";
    const maxActStr = maxActivations === 0 ? "不限次数" : `${maxActivations}次`;

    const rows = result.licenseKeys.map(key => 
      `${key},${licenseType},${maxDevices},${transferStr},${maxActStr},${expDateStr}`
    ).join("\n");

    // 添加 \uFEFF (BOM) 确保 Excel 打开时不会乱码
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + "\n" + rows;
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `licenses_batch_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'Admin' ? 'User' : 'Admin';
    if (!confirm(`确定要将此用户的角色修改为 ${newRole} 吗？`)) return;
    
    try {
      const res = await apiFetch(`/api/admin/users/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        mutateUsers();
      } else {
        toast.error('更新角色失败');
      }
    } catch {
      toast.error('系统错误');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可逆！')) return;
    try {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        mutateUsers();
      } else {
        toast.error('删除失败');
      }
    } catch {
      toast.error('系统错误');
    }
  };

  const handleResetUserPassword = async (id: string) => {
    const newPassword = prompt('请输入该用户的新密码 (最少6位):');
    if (!newPassword) return;
    if (newPassword.length < 6) {
      toast.error('密码长度至少需要 6 个字符');
      return;
    }
    if (!confirm(`确定要为该用户重置密码吗？`)) return;

    try {
      const res = await apiFetch(`/api/admin/users/${id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        toast.success('密码重置成功');
      } else {
        const errData = await res.json();
        toast.error(errData.Message || '重置失败');
      }
    } catch {
      toast.error('系统错误');
    }
  };

  const initiateGenerateForUser = (id: string) => {
    // Removed setUserId(id) for auto-fill because UserId is no longer needed
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
          <button 
            onClick={() => setActiveTab('api-docs')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'api-docs' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            API 使用说明
          </button>
          <button 
            onClick={() => setActiveTab('help')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors font-medium ${activeTab === 'help' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
          >
            系统帮助文档
          </button>
        </nav>
        
        <div className="absolute bottom-8 w-56 space-y-4">
          <div className="px-4 pb-2">
            <ThemeSwitcher />
          </div>
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
            onClick={() => setActiveTab('api-docs')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${activeTab === 'api-docs' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}
          >
            API 接口
          </button>
          <button 
            onClick={() => setActiveTab('help')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded ${activeTab === 'help' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}
          >
            系统帮助
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
                <button 
                  onClick={() => setActiveTab('public_key_detail')}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded shadow transition-colors inline-block"
                >
                  👀 查看 RSA 公钥 (客户端用)
                </button>
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
                    <div 
                      className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      onClick={() => setActiveTab('licenses_detail')}
                    >
                      <div className="text-sm text-green-600 dark:text-green-400 flex items-center justify-between">
                        总发卡授权存量
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </div>
                      <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">{stats.totalActiveLicenses}</div>
                    </div>
                    <div 
                      className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                      onClick={() => setActiveTab('devices_detail')}
                    >
                      <div className="text-sm text-purple-600 dark:text-purple-400 flex items-center justify-between">
                        系统总激活设备
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </div>
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
                  {/* Removed UserId input field since backend uses Admin Session UserId */}

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

                  <div className="flex items-center mt-6">
                    <input
                      type="checkbox"
                      id="allowDeviceTransfer"
                      checked={allowDeviceTransfer}
                      onChange={(e) => setAllowDeviceTransfer(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="allowDeviceTransfer" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      允许自动换绑 (满设备时踢老设备)
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">终生总激活次数 (0为不限)</label>
                    <input
                      type="number"
                      min="0"
                      value={maxActivations}
                      onChange={(e) => setMaxActivations(parseInt(e.target.value))}
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
                      {(users || []).map(user => (
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
                              onClick={() => handleResetUserPassword(user.id)}
                              className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                            >
                              重置密码
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
                      {(!users || users.length === 0) && (
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

        {activeTab === 'licenses_detail' && (
          <LicenseDetailTable apiFetch={apiFetch} setActiveTab={setActiveTab} />
        )}

        {activeTab === 'devices_detail' && (
          <DeviceDetailTable apiFetch={apiFetch} setActiveTab={setActiveTab} />
        )}

        {activeTab === 'public_key_detail' && (
          <PublicKeyDetail apiFetch={apiFetch} setActiveTab={setActiveTab} />
        )}

        {activeTab === 'settings' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">安全与账户设置</h2>
              
              <div className="space-y-10">
                {/* Registration Setting Section */}
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">系统设置</h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <h4 className="text-md font-medium text-gray-900 dark:text-white">用户注册</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">控制是否允许新用户注册账号。关闭后注册页面将无法提交注册。</p>
                    </div>
                    <button
                      onClick={handleToggleRegistration}
                      disabled={settingsLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 ${registrationEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                      role="switch"
                      aria-checked={registrationEnabled}
                    >
                      <span className="sr-only">Toggle user registration</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${registrationEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* 2FA Section */}
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">二次验证 (2FA)</h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      状态: {is2faEnabled ? <span className="text-green-600 font-bold ml-2">已开启</span> : <span className="text-gray-500 font-bold ml-2">未开启</span>}
                    </p>
                    
                    {!is2faEnabled && !qrCodeUri && (
                      <button 
                        onClick={handleSetup2FA} 
                        disabled={settingsLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded shadow disabled:opacity-50 transition-colors"
                      >
                        配置 2FA
                      </button>
                    )}

                    {qrCodeUri && !is2faEnabled && (
                      <div className="mt-4 p-6 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          1. 请使用 <span className="font-semibold text-gray-900 dark:text-white">Google Authenticator</span> 或其他身份验证器扫描下方二维码。<br/>
                          2. 如果无法扫码，请手动输入密钥：<span className="font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">{twoFactorSecret}</span>
                        </p>
                        <div className="mb-6 bg-white p-4 inline-block rounded-lg shadow-sm border border-gray-100">
                          <QRCodeSVG value={qrCodeUri} size={180} level="M" includeMargin={true} />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">3. 在下方输入应用显示的 6 位验证码以确认绑定：</p>
                        <div className="flex gap-3 max-w-sm">
                          <input 
                            type="text" 
                            maxLength={6}
                            placeholder="输入 6 位验证码" 
                            value={twoFactorVerifyCode}
                            onChange={e => setTwoFactorVerifyCode(e.target.value)}
                            className="flex-1 rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                          />
                          <button 
                            onClick={handleVerify2FA}
                            disabled={settingsLoading || twoFactorVerifyCode.length !== 6}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-md shadow disabled:opacity-50 transition-colors"
                          >
                            验证并开启
                          </button>
                        </div>
                      </div>
                    )}

                    {is2faEnabled && (
                      <button 
                        onClick={handleDisable2FA}
                        disabled={settingsLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded shadow disabled:opacity-50 transition-colors"
                      >
                        关闭 2FA
                      </button>
                    )}
                  </div>
                </div>

                {/* Passkeys Section */}
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">通行密钥 (Passkeys)</h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      使用指纹、面容或设备 PIN 码等免密安全方式快速登录。
                    </p>
                    <div className="flex flex-col max-w-sm space-y-3">
                      <button 
                        onClick={handleRegisterPasskey}
                        disabled={settingsLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded shadow disabled:opacity-50 transition-colors"
                      >
                        注册新的通行密钥
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api-docs' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">API 接入与使用说明</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">1. 激活码激活接口 (客户端调用)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    供您的客户端软件用来激活设备。调用成功后，会返回包含 RSA 签名的离线授权凭证。
                  </p>
                  
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                    <div className="text-gray-400 mb-2">// POST /api/License/activate</div>
                    <div>POST {typeof window !== 'undefined' ? window.location.origin : 'http://<your-domain>'}/api/License/activate</div>
                    <div>Content-Type: application/json</div>
                    <br/>
                    <div className="text-gray-400 mb-1">// Request Body:</div>
                    <div>{'{'}</div>
                    <div className="pl-4">"licenseKey": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",</div>
                    <div className="pl-4">"hardwareId": "YOUR_DEVICE_FINGERPRINT"</div>
                    <div>{'}'}</div>
                  </div>
                  
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                    <strong>返回参数说明:</strong>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li><code>Message</code>: 激活结果的提示信息</li>
                      <li><code>Signature</code>: 经过 RSA 签名的 JWT / Base64，客户端应使用公钥验证其合法性并存储在本地。</li>
                    </ul>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">2. 获取公钥接口</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    客户端可以通过此接口下载最新的 RSA 验证公钥（建议在编译软件时直接内置，以防止网络中间人劫持）。
                  </p>
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                    <div className="text-gray-400 mb-2">// GET /api/License/public-key</div>
                    <div>GET {typeof window !== 'undefined' ? window.location.origin : 'http://<your-domain>'}/api/License/public-key</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">系统帮助与核心功能说明</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">1</span>
                    License 核心模型与设备绑定
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 pl-8 border-l-2 border-gray-100 dark:border-gray-700 ml-2">
                    <p>系统为每个用户下发唯一的激活码。每个激活码可根据您的商业策略设置 <strong>最大设备数 (MaxDevices)</strong> 以及 <strong>到期时间 (Expiration)</strong>。</p>
                    <p>当用户在客户端使用邮箱、激活码及设备唯一机器码（如 CPU ID / 主板序列号生成的 Hash）进行激活时，系统会自动在后台将该设备与激活码进行绑定。若超出最大设备数量，系统将拦截新设备的激活请求。</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="bg-red-100 text-red-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">2</span>
                    离线 RSA 签名与防破解
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 pl-8 border-l-2 border-gray-100 dark:border-gray-700 ml-2">
                    <p>客户端在成功请求 <code>/api/License/activate</code> 后，除了得到成功响应，还会收到一段经后端 <strong>RSA 私钥签名的授权凭证 (Signature)</strong>。</p>
                    <p>客户端软件应内置对应的 <strong>RSA 公钥</strong>。在软件每次启动或者运行核心功能时，可以完全在离线状态下，使用公钥验证该签名是否被篡改、授权类型及过期时间是否合法，从而做到 <strong>离线强验证</strong>，有效防止网络抓包伪造响应的破解手段。</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="bg-green-100 text-green-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">3</span>
                    防爆破与限流机制 (Rate Limit)
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 pl-8 border-l-2 border-gray-100 dark:border-gray-700 ml-2">
                    <p>管理员账户登录以及 API 激活接口均启用了严格的 <strong>频率限制 (Rate Limiting)</strong> 和 <strong>并发锁定</strong> 机制。当同一 IP 尝试恶意爆破激活码时，系统会在多次失败后主动拉黑并锁定该 IP 一段时间，大幅提升系统安全性。</p>
                    <p>激活端点极易受到黑客针对性的暴力破解（尝试枚举不同的 License Key）。本系统在 <code>LicenseController.cs</code> 层启用了 <strong>Rate Limiting</strong> 策略。</p>
                    <p>建议在生产环境中进一步结合 WAF（Web Application Firewall）及 Nginx 的 IP 频率限制，确保系统的绝对安全。一旦发现有恶意 IP 高频试错，应通过 WAF 直接将其封禁。</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-yellow-900 dark:text-yellow-300">4</span>
                    如何给客户批量发卡授权？(操作指南)
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3 pl-8 border-l-2 border-gray-100 dark:border-gray-700 ml-2">
                    <p>如果您需要为某个企业客户或代理商批量生成激活码，请遵循以下流程：</p>
                    <ol className="list-decimal pl-5 space-y-2 text-gray-700 dark:text-gray-300 font-medium">
                      <li>在左侧导航栏进入 <strong>【大盘与发卡】</strong> 页面。</li>
                      <li>向下滚动找到 <strong>【批量生成激活码】</strong> 面板。</li>
                      <li>系统会自动将生成的激活码与您当前的管理账号绑定（无需手动填写目标用户 UserId）。</li>
                      <li>根据该客户采购的权益，选择 <strong>授权类型</strong>（永久版/订阅版/试用版）。如果不是永久版，请务必设定准确的 <strong>过期时间</strong>。</li>
                      <li>填写 <strong>发卡数量</strong>（例如 100 张）以及每张卡允许激活的 <strong>最大设备数</strong>（默认为 1）。</li>
                      <li>点击【生成激活码】按钮。生成成功后，点击下方出现的 <strong>【导出为 CSV】</strong>，即可将 100 个激活码直接打包发给客户！</li>
                    </ol>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="bg-purple-100 text-purple-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-purple-900 dark:text-purple-300">5</span>
                    Passkey 通行密钥与账号安全
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 pl-8 border-l-2 border-gray-100 dark:border-gray-700 ml-2">
                    <p>本系统已全面采用现代化的无密码（WebAuthn / Passkey）技术及 2FA（二次验证）双重保障。</p>
                    <p>对于系统管理员及重要客户，强烈建议在“安全与账户设置”中注册 Passkey（支持指纹、Windows Hello、FaceID 等），这不仅能提供最高级别的防钓鱼保护，也能带来极速的登录体验。</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
