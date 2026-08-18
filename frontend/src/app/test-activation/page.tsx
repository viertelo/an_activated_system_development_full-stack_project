"use client";

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function TestActivationPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // 1. 本地环境配置
  const [publicKey, setPublicKey] = useState('');
  const [hardwareId, setHardwareId] = useState('');

  // 2. 状态查询专用
  const [queryLicenseKey, setQueryLicenseKey] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState('');

  // 3. 在线激活专用
  const [licenseKey, setLicenseKey] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineVerifyStatus, setOnlineVerifyStatus] = useState<'none' | 'success' | 'failed'>('none');
  const [onlineErrorMsg, setOnlineErrorMsg] = useState('');
  const [onlineSuccessMsg, setOnlineSuccessMsg] = useState('');
  const [onlineServerDetails, setOnlineServerDetails] = useState<any>(null);
  const [onlineResult, setOnlineResult] = useState<any>(null);
  const [isUnbinding, setIsUnbinding] = useState(false);

  // 4. 离线验证专用
  const [offlineToken, setOfflineToken] = useState('');
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineVerifyStatus, setOfflineVerifyStatus] = useState<'none' | 'success' | 'failed'>('none');
  const [offlineErrorMsg, setOfflineErrorMsg] = useState('');
  const [offlineSuccessMsg, setOfflineSuccessMsg] = useState('');
  const [offlineResult, setOfflineResult] = useState<any>(null);
  
  const router = useRouter();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      toast.error('请先登录系统');
      router.push('/');
      return;
    }

    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  useEffect(() => {
    if (!hardwareId) setHardwareId("TEST-" + crypto.randomUUID());
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  };

  const randomizeHardwareId = () => {
    setHardwareId("TEST-" + crypto.randomUUID());
    toast.success('硬件码已重新生成');
  };

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
    return fetch(url, { ...options, headers });
  };

  const fetchPublicKey = async () => {
    try {
      const res = await apiFetch('/api/License/public-key/text');
      const data = await res.json();
      const keyStr = data.publicKey || data.PublicKey;
      if (res.ok && keyStr) {
        setPublicKey(keyStr);
        toast.success('公钥已自动加载');
      } else {
        toast.error('获取公钥失败');
      }
    } catch (e) {
      toast.error('网络请求失败');
    }
  };

  const str2ab = (str: string) => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  const importPublicKey = async (pem: string) => {
    try {
      const pemHeader = "-----BEGIN PUBLIC KEY-----";
      const pemFooter = "-----END PUBLIC KEY-----";
      if (!pem.includes(pemHeader) || !pem.includes(pemFooter)) {
        throw new Error("公钥格式不正确，必须包含 BEGIN 和 END 头");
      }
      const pemContents = pem.substring(
        pem.indexOf(pemHeader) + pemHeader.length,
        pem.indexOf(pemFooter)
      ).replace(/\s/g, '');
      const binaryDerString = window.atob(pemContents);
      const binaryDer = str2ab(binaryDerString);

      return await window.crypto.subtle.importKey(
        "spki",
        binaryDer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        true,
        ["verify"]
      );
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || "公钥解析失败，请检查是否为有效的 RSA 公钥 PEM");
    }
  };

  const verifySignature = async (key: CryptoKey, payloadBase64: string, signatureBase64: string) => {
    try {
      const signatureBytes = str2ab(window.atob(signatureBase64));
      const payloadBytes = str2ab(window.atob(payloadBase64));
      return await window.crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        signatureBytes,
        payloadBytes
      );
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const performLocalVerify = async (signatureStr: string) => {
    if (!signatureStr || !signatureStr.includes('.')) {
      throw new Error("签名格式不正确，应包含 '.'");
    }
    const [payloadBase64, signatureBase64] = signatureStr.split('.');
    const cryptoKey = await importPublicKey(publicKey);
    const isValid = await verifySignature(cryptoKey, payloadBase64, signatureBase64);
    
    if (isValid) {
      const jsonStr = decodeURIComponent(escape(window.atob(payloadBase64)));
      return JSON.parse(jsonStr);
    } else {
      throw new Error('验签失败：数据可能被篡改或公钥不匹配');
    }
  };

  const handleQueryStatus = async () => {
    if (!queryLicenseKey.trim()) {
      toast.error('请输入需要查询的激活码');
      return;
    }
    setQueryLoading(true);
    setQueryError('');
    setQueryResult(null);

    try {
      const res = await apiFetch('/api/License/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: queryLicenseKey })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.Message || '查询失败或找不到该激活码');
      }

      const details = data.details || data.Details;
      setQueryResult(details);
      toast.success('查询成功');
    } catch (err: any) {
      setQueryError(err.message || '查询发生错误');
      toast.error(err.message || '查询发生错误');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!publicKey.trim() || !licenseKey.trim() || !hardwareId.trim()) {
      toast.error('请填写完整信息（公钥、硬件码、激活码）');
      return;
    }

    setOnlineLoading(true);
    setOnlineVerifyStatus('none');
    setOnlineErrorMsg('');
    setOnlineSuccessMsg('');
    setOnlineServerDetails(null);
    setOnlineResult(null);

    try {
      const res = await fetch('/api/License/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, hardwareId })
      });

      let data;
      try { data = await res.json(); } 
      catch (e) { throw new Error(`接口返回了非 JSON 格式。响应状态码: ${res.status}`); }

      if (!res.ok) {
        const err: any = new Error(data.Message || data.message || '激活失败');
        err.details = data.Details || data.details;
        throw err;
      }

      setOnlineServerDetails(data.Details || data.details);
      toast.success('接口请求成功，开始本地验签...');
      
      const signatureStr = data.Signature || data.signature;
      const resultObj = await performLocalVerify(signatureStr);
      setOnlineResult(resultObj);
      setOnlineVerifyStatus('success');
      setOnlineSuccessMsg(data.Message || data.message || '验签成功，本地证书合法。');
      toast.success(data.Message || data.message || '验签成功！');

    } catch (err: any) {
      setOnlineVerifyStatus('failed');
      setOnlineErrorMsg(err.message || '发生错误');
      setOnlineServerDetails(err.details || null);
      toast.error(err.message || '发生错误');
    } finally {
      setOnlineLoading(false);
    }
  };

  const refreshLicenseInfo = async () => {
    if (!licenseKey) return;
    try {
      const res = await apiFetch('/api/License/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });
      const data = await res.json();
      const details = data.details || data.Details;
      if (res.ok && details) {
        setOnlineServerDetails(details);
        if (onlineResult && onlineVerifyStatus === 'success') {
           setOnlineResult((prev: any) => ({
             ...prev,
             ActivatedCount: details.activatedCount ?? details.ActivatedCount,
             RemainingCount: details.remainingCount ?? details.RemainingCount
           }));
        }
      }
    } catch (err) {
      console.error("Failed to refresh license info", err);
    }
  };

  const handleResetActivations = async () => {
    if (!licenseKey) return;
    setIsUnbinding(true);
    try {
      const res = await apiFetch('/api/License/reset-activations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });
      const data = await res.json();
      const msg = data.message || data.Message;
      if (!res.ok) throw new Error(msg || '重置失败');
      toast.success(msg || '重置成功');
      await refreshLicenseInfo();
    } catch (err: any) {
      toast.error(err.message || '发生错误');
    } finally {
      setIsUnbinding(false);
    }
  };

  const handleUnbind = async (hwId: string) => {
    if (!hwId) return;
    setIsUnbinding(true);
    try {
      const res = await apiFetch('/api/device/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardwareId: hwId })
      });
      const data = await res.json();
      const msg = data.message || data.Message;
      if (!res.ok) throw new Error(msg || '解绑失败');
      toast.success(msg || '解绑成功');
      await refreshLicenseInfo();
    } catch (err: any) {
      toast.error(err.message || '解绑发生错误');
    } finally {
      setIsUnbinding(false);
    }
  };

  const handleOfflineTest = async () => {
    if (!publicKey.trim() || !offlineToken.trim()) {
      toast.error('请填写公钥和离线凭证');
      return;
    }
    setOfflineLoading(true);
    setOfflineVerifyStatus('none');
    setOfflineErrorMsg('');
    setOfflineResult(null);

    try {
      toast.success('开始本地验签...');
      const resultObj = await performLocalVerify(offlineToken);
      setOfflineResult(resultObj);
      setOfflineVerifyStatus('success');
      setOfflineSuccessMsg('离线验签成功，本地证书合法。');
      toast.success('离线验签成功！');
    } catch (err: any) {
      setOfflineVerifyStatus('failed');
      setOfflineErrorMsg(err.message || '发生错误');
      toast.error(err.message || '发生错误');
    } finally {
      setOfflineLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-end">
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 transition-colors"
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            客户端激活模拟测试
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            在网页端模拟客户端的激活过程，包括接口调用和本地 RSA 验签。
          </p>
        </div>

        {/* 1. 本地环境配置 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6 border-l-4 border-indigo-500">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">⚙️ 本地环境配置</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">请配置用于模拟客户端的硬件码与验签公钥。此配置为全局生效。</p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                RSA 公钥 (PEM格式)
              </label>
              <button onClick={fetchPublicKey} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">⚡ 一键获取服务器公钥</button>
            </div>
            <div className="mt-1">
              <textarea
                rows={5}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white p-2 border"
                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">用于校验服务器下发的授权证书（下方在线或离线验签均需使用）</p>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                设备标识 (Hardware ID)
              </label>
              <button onClick={randomizeHardwareId} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">🎲 随机更换设备</button>
            </div>
            <div className="mt-1">
              <input
                type="text"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white p-2 border"
                value={hardwareId}
                onChange={(e) => setHardwareId(e.target.value)}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">模拟本机的唯一硬件识别码</p>
          </div>
        </div>

        {/* 2. 激活码状态查询 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6 border-l-4 border-green-500">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">🔍 激活码状态查询</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              仅提供只读查询功能，可一目了然查看正式商用和测试用激活码的设备数量、剩余次数等详细状态。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              要查询的激活码
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                type="text"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white p-2 border"
                placeholder="请输入激活码"
                value={queryLicenseKey}
                onChange={(e) => setQueryLicenseKey(e.target.value)}
              />
              <button
                onClick={handleQueryStatus}
                disabled={queryLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${queryLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {queryLoading ? '查询中...' : '查询状态'}
              </button>
            </div>
          </div>

          {queryError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm dark:bg-red-900/30 dark:text-red-200 dark:border-red-800">
              {queryError}
            </div>
          )}

          {queryResult && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-bold text-gray-900 dark:text-gray-100">查询结果明细</h3>
                <span className={`px-2 py-1 text-xs font-bold rounded ${(queryResult.isActive ?? queryResult.IsActive) ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>
                  {(queryResult.isActive ?? queryResult.IsActive) ? '状态：正常可用' : '状态：已被吊销/禁用'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">授权类型</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                    {(queryResult.licenseType ?? queryResult.LicenseType) === 'Permanent' ? '永久授权 (Permanent)' : (queryResult.licenseType ?? queryResult.LicenseType)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">到期时间</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                    {(queryResult.expirationDate ?? queryResult.ExpirationDate) ? new Date((queryResult.expirationDate ?? queryResult.ExpirationDate)).toLocaleString() : '无限制'}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">设备绑定配额</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">总配额: {queryResult.maxDevices ?? queryResult.MaxDevices} 台</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">已激活: {queryResult.activatedCount ?? queryResult.ActivatedCount} 台</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">剩余可绑: {queryResult.remainingCount ?? queryResult.RemainingCount} 台</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">总体激活次数限制</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">最大允许激活次数: {(queryResult.maxActivations ?? queryResult.MaxActivations) === 0 ? '无限制' : (queryResult.maxActivations ?? queryResult.MaxActivations) + ' 次'}</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">历史已使用: {queryResult.currentActivationCount ?? queryResult.CurrentActivationCount} 次</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">剩余机会: {queryResult.remainingActivations ?? queryResult.RemainingActivations}</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">是否允许自动换绑</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                    {(queryResult.allowDeviceTransfer ?? queryResult.AllowDeviceTransfer) ? '✅ 允许 (超出数量将自动解绑最旧设备)' : '❌ 不允许 (一旦满额将不可自动换绑)'}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">已绑定的设备明细</div>
                  <div className="mt-2 space-y-2">
                    {((queryResult.devices ?? queryResult.Devices) || []).length > 0 ? (
                      ((queryResult.devices ?? queryResult.Devices)).map((dev: any, idx: number) => (
                        <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm shadow-sm">
                          <span className={`font-mono text-sm truncate max-w-[60%] ${(dev.hardwareId || dev.HardwareId).startsWith('TEST-') ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-300'}`} title={dev.hardwareId || dev.HardwareId}>{dev.hardwareId || dev.HardwareId}</span>
                          <span className="text-xs text-gray-400">{new Date(dev.activatedAt || dev.ActivatedAt).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 italic">尚未绑定任何设备</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. 在线激活测试 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6 border-l-4 border-blue-500">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">🚀 在线激活与验签测试</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">发送请求至服务端进行激活，获取授权证书并立刻在本地完成 RSA 验签。</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              激活码 (License Key)
            </label>
            <div className="mt-1">
              <input
                type="text"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white p-2 border"
                placeholder="请输入用于激活的授权码"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleActivate}
              disabled={onlineLoading}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${onlineLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {onlineLoading ? '正在激活...' : '执行在线激活与验签'}
            </button>
          </div>

          {/* 在线激活结果框 */}
          {onlineVerifyStatus !== 'none' && (
            <div className={`mt-6 p-4 rounded-md border ${
              onlineVerifyStatus === 'success' 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {onlineVerifyStatus === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 w-full">
                  <h3 className={`text-sm font-medium ${onlineVerifyStatus === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {onlineVerifyStatus === 'success' ? '激活与验签成功' : '激活失败'}
                  </h3>
                  <div className={`mt-2 text-sm ${onlineVerifyStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {onlineVerifyStatus === 'success' ? (
                      <p>本地公钥已成功验证服务端签发的凭证，数据未被篡改，可安全信任。</p>
                    ) : (
                      <p>{onlineErrorMsg}</p>
                    )}
                  </div>
                  
                  {/* 失败时展示的具体详情 */}
                  {onlineVerifyStatus === 'failed' && (
                    <div className="mt-4 space-y-4">
                      {onlineServerDetails && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-md border border-red-200 dark:border-red-800/50 shadow-sm">
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">设备限额详情</div>
                          <div className="flex flex-wrap items-center gap-x-3 text-sm">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">总配额: {onlineServerDetails.maxDevices || onlineServerDetails.MaxDevices} 台</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">已激活: {onlineServerDetails.activatedCount ?? onlineServerDetails.ActivatedCount} 台</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">剩余名额: {onlineServerDetails.remainingCount ?? onlineServerDetails.RemainingCount} 台</span>
                          </div>
                        </div>
                      )}

                      {onlineErrorMsg.includes('次数限制') && (
                        <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-md border border-orange-200 dark:border-orange-800">
                           <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200">🛠️ 测试专用：突破激活次数限制</h4>
                           <p className="text-xs mt-1 text-orange-700 dark:text-orange-300">
                             正式商用时，激活码达到终生最大激活次数后将被永久作废。此处提供重置功能仅为方便您进行反复激活测试。
                           </p>
                           <button 
                             onClick={handleResetActivations} 
                             disabled={isUnbinding}
                             className={`mt-3 inline-flex items-center text-xs font-medium bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-800 dark:text-orange-200 dark:hover:bg-orange-700 py-1.5 px-3 rounded shadow-sm border border-orange-300 dark:border-orange-600 transition-colors ${isUnbinding ? 'opacity-50 cursor-not-allowed' : ''}`}>
                             {isUnbinding ? '处理中...' : '清零该激活码的激活次数'}
                           </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 成功时展示的具体详情 */}
                  {onlineResult && onlineVerifyStatus === 'success' && (
                    <div className="mt-4">
                      {onlineSuccessMsg && (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded border border-green-200 dark:border-green-800 flex items-start gap-2">
                          <span>✅</span>
                          <span className="text-sm font-medium">{onlineSuccessMsg}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-gray-800 p-4 rounded-md border border-green-200 dark:border-green-800/50 shadow-sm">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">授权类型</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{onlineResult.LicenseType === 'Permanent' ? '永久授权 (Permanent)' : onlineResult.LicenseType}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">到期时间</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{onlineResult.ExpiresAt ? new Date(onlineResult.ExpiresAt).toLocaleString() : '无限制'}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">设备激活情况</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">总配额: {onlineResult.MaxDevices} 台</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">已激活: {onlineResult.ActivatedCount !== undefined ? onlineResult.ActivatedCount : '?'} 台</span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">剩余名额: {onlineResult.RemainingCount !== undefined ? onlineResult.RemainingCount : '?'} 台</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">首次激活时间</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{new Date(onlineResult.ActivatedAt).toLocaleString()}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">当前绑定设备ID</div>
                          <div className={`mt-1 font-mono text-sm break-all p-2 rounded border ${onlineResult.HardwareId.startsWith('TEST-') ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 font-bold' : 'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-100 dark:border-gray-700'}`}>{onlineResult.HardwareId}</div>
                        </div>
                        {onlineResult.LicenseType === 'Subscription' && onlineResult.ExpiresAt && (
                          <div className="sm:col-span-2 mt-2">
                            <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">订阅有效期进度</div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.max(0, Math.min(100, ((Date.now() - new Date(onlineResult.ActivatedAt).getTime()) / (new Date(onlineResult.ExpiresAt).getTime() - new Date(onlineResult.ActivatedAt).getTime())) * 100))}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 解绑 / 换绑 提示及列表区 */}
                  {onlineServerDetails && (onlineServerDetails.devices || onlineServerDetails.Devices)?.length > 0 && (
                    <div className={`mt-6 p-4 rounded-md border ${
                      (onlineServerDetails.allowDeviceTransfer || onlineServerDetails.AllowDeviceTransfer) 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                        : 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className={`text-sm font-semibold ${
                            (onlineServerDetails.allowDeviceTransfer || onlineServerDetails.AllowDeviceTransfer) 
                              ? 'text-blue-800 dark:text-blue-200' 
                              : 'text-orange-800 dark:text-orange-200'
                          }`}>
                            {(onlineServerDetails.allowDeviceTransfer || onlineServerDetails.AllowDeviceTransfer) ? '💡 支持自动换绑' : '🛠️ 测试专用：强制设备重置'}
                          </h4>
                          <p className={`text-xs mt-1 ${
                            (onlineServerDetails.allowDeviceTransfer || onlineServerDetails.AllowDeviceTransfer) 
                              ? 'text-blue-700 dark:text-blue-300' 
                              : 'text-orange-700 dark:text-orange-300'
                          }`}>
                            {(onlineServerDetails.allowDeviceTransfer || onlineServerDetails.AllowDeviceTransfer) 
                              ? '此授权码允许反激活。当名额满时会自动踢出最早的设备。您也可以在下方手动解绑以释放名额。' 
                              : '【注意】此授权码禁止换绑！正式商用时，客户端一旦满额将彻底无法激活。此处提供解绑功能仅为方便您循环测试触发上限的逻辑。'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {(onlineServerDetails.devices || onlineServerDetails.Devices).map((dev: any, idx: number) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 shadow-sm gap-3">
                            <div className="overflow-hidden">
                              <div className="text-xs text-gray-500 dark:text-gray-400">硬件 ID</div>
                              <div className={`font-mono text-sm font-medium truncate ${(dev.hardwareId || dev.HardwareId).startsWith('TEST-') ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`} title={dev.hardwareId || dev.HardwareId}>
                                {dev.hardwareId || dev.HardwareId}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                激活于: {new Date(dev.activatedAt || dev.ActivatedAt).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnbind(dev.hardwareId || dev.HardwareId)}
                              disabled={isUnbinding}
                              className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${isUnbinding ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isUnbinding ? '处理中...' : '解绑此设备'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. 纯离线许可导入测试 */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6 border-l-4 border-purple-500">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">🔧 纯离线许可导入验证</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">模拟断网环境，直接校验本地 Base64 证书是否合法（依赖上方全局配置的公钥）。</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              离线授权证书 (Base64 Signature)
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                type="text"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white p-2 border"
                placeholder="粘贴由服务端生成的签名字符串"
                value={offlineToken}
                onChange={(e) => setOfflineToken(e.target.value)}
              />
              <button
                onClick={handleOfflineTest}
                disabled={offlineLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${offlineLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {offlineLoading ? '验证中...' : '离线验签'}
              </button>
            </div>
          </div>

          {/* 离线验证结果框 */}
          {offlineVerifyStatus !== 'none' && (
            <div className={`mt-6 p-4 rounded-md border ${
              offlineVerifyStatus === 'success' 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {offlineVerifyStatus === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 w-full">
                  <h3 className={`text-sm font-medium ${offlineVerifyStatus === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {offlineVerifyStatus === 'success' ? '离线验签成功' : '离线验签失败'}
                  </h3>
                  <div className={`mt-2 text-sm ${offlineVerifyStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {offlineVerifyStatus === 'success' ? (
                      <p>本地公钥已成功验证离线凭证，数据未被篡改，可安全信任。</p>
                    ) : (
                      <p>{offlineErrorMsg}</p>
                    )}
                  </div>

                  {/* 成功时展示的具体详情 */}
                  {offlineResult && offlineVerifyStatus === 'success' && (
                    <div className="mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-gray-800 p-4 rounded-md border border-green-200 dark:border-green-800/50 shadow-sm">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">授权类型</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{offlineResult.LicenseType === 'Permanent' ? '永久授权 (Permanent)' : offlineResult.LicenseType}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">到期时间</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{offlineResult.ExpiresAt ? new Date(offlineResult.ExpiresAt).toLocaleString() : '无限制'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">首次激活时间</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{new Date(offlineResult.ActivatedAt).toLocaleString()}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">当前绑定设备ID</div>
                          <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100 break-all bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-700">{offlineResult.HardwareId}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
