"use client";

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function TestActivationPage() {
  const [publicKey, setPublicKey] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [hardwareId, setHardwareId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [verifyStatus, setVerifyStatus] = useState<'none' | 'success' | 'failed'>('none');
  const [errorMsg, setErrorMsg] = useState('');
  const [serverDetails, setServerDetails] = useState<any>(null);
  const [isUnbinding, setIsUnbinding] = useState(false);
  const [offlineToken, setOfflineToken] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router = useRouter();

  useEffect(() => {
    // 权限校验：如果未登录，重定向到登录页
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

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  };

  // Generate a mock hardware ID on load
  useEffect(() => {
    if (!hardwareId) setHardwareId(crypto.randomUUID());
  }, []);

  const randomizeHardwareId = () => {
    setHardwareId(crypto.randomUUID());
    toast.success('硬件码已重新生成');
  };

  const fetchPublicKey = async () => {
    try {
      const res = await fetch('/api/License/public-key/text');
      const data = await res.json();
      if (res.ok && data.PublicKey) {
        setPublicKey(data.PublicKey);
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
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
        },
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
      setVerifyStatus('success');
      toast.success('验签成功！');
      const jsonStr = decodeURIComponent(escape(window.atob(payloadBase64)));
      const payloadObj = JSON.parse(jsonStr);
      setResult(payloadObj);
    } else {
      setVerifyStatus('failed');
      setErrorMsg('验签失败：数据可能被篡改或公钥不匹配');
      toast.error('验签失败：数据可能被篡改或公钥不匹配');
    }
  };

  const handleOfflineTest = async () => {
    if (!publicKey.trim() || !offlineToken.trim()) {
      toast.error('请填写公钥和离线凭证');
      return;
    }
    setLoading(true);
    setVerifyStatus('none');
    setErrorMsg('');
    setServerDetails(null);
    setResult(null);

    try {
      await performLocalVerify(offlineToken);
    } catch (err: any) {
      setVerifyStatus('failed');
      setErrorMsg(err.message || '发生错误');
      toast.error(err.message || '发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!publicKey.trim() || !licenseKey.trim() || !hardwareId.trim()) {
      toast.error('请填写完整信息');
      return;
    }

    setLoading(true);
    setVerifyStatus('none');
    setErrorMsg('');
    setServerDetails(null);
    setResult(null);

    try {
      // 1. 调用激活接口
      const res = await fetch('/api/License/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          licenseKey,
          hardwareId
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`接口返回了非 JSON 格式，可能是被 WAF 或 Cloudflare 拦截（通常由于 JS 质询或浏览器完整性检查）。响应状态码: ${res.status}`);
      }

      if (!res.ok) {
        const err: any = new Error(data.Message || data.message || '激活失败');
        err.details = data.Details || data.details;
        throw err;
      }

      setServerDetails(data.Details || data.details);

      toast.success('接口请求成功，开始本地验签...');
      const signatureStr = data.Signature || data.signature;
      await performLocalVerify(signatureStr);

    } catch (err: any) {
      setVerifyStatus('failed');
      setErrorMsg(err.message || '发生错误');
      setServerDetails(err.details || null);
      toast.error(err.message || '发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleUnbind = async (hwId: string) => {
    if (!hwId) return;
    setIsUnbinding(true);
    try {
      const res = await fetch('/api/device/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardwareId: hwId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.Message || '解绑失败');
      }
      toast.success(data.Message || '解绑成功');
      // 重新执行激活查询以刷新状态
      handleActivate();
    } catch (err: any) {
      toast.error(err.message || '解绑发生错误');
    } finally {
      setIsUnbinding(false);
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

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
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
            <p className="mt-1 text-xs text-gray-500">可在管理员后台“查看RSA公钥”处获取</p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              激活码 (License Key)
            </label>
            <div className="mt-1">
              <input
                type="text"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white p-2 border"
                placeholder="请输入已生成的激活码"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleActivate}
              disabled={loading}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? '正在激活...' : '执行在线激活与验签'}
            </button>
          </div>

          {/* 纯离线许可导入验证 */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">🔧 纯离线许可导入测试</h3>
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
                  disabled={loading}
                  className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  离线验签
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">模拟断网环境，直接校验本地证书是否合法（需要上方先填入对应公钥）</p>
            </div>
          </div>

          {/* 激活结果提示框 (嵌入在激活框内) */}
          {verifyStatus !== 'none' && (
            <div className={`mt-6 p-4 rounded-md border ${
              verifyStatus === 'success' 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {verifyStatus === 'success' ? (
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
                  <h3 className={`text-sm font-medium ${verifyStatus === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {verifyStatus === 'success' ? '激活与验签成功' : '激活失败'}
                  </h3>
                  <div className={`mt-2 text-sm ${verifyStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {verifyStatus === 'success' ? (
                      <p>本地公钥已成功验证服务端签发的凭证，数据未被篡改，可安全信任。</p>
                    ) : (
                      <p>{errorMsg}</p>
                    )}
                  </div>
                  
                  {/* 失败时展示的具体详情 (如有) */}
                  {serverDetails && verifyStatus === 'failed' && (
                    <div className="mt-4 bg-white dark:bg-gray-800 p-4 rounded-md border border-red-200 dark:border-red-800/50 shadow-sm">
                      <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">设备限额详情</div>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">总配额: {serverDetails.maxDevices || serverDetails.MaxDevices} 台</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">已激活: {serverDetails.activatedCount ?? serverDetails.ActivatedCount} 台</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">剩余名额: {serverDetails.remainingCount ?? serverDetails.RemainingCount} 台</span>
                      </div>
                    </div>
                  )}

                  {/* 成功时展示的具体详情 */}
                  {result && verifyStatus === 'success' && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-gray-800 p-4 rounded-md border border-green-200 dark:border-green-800/50 shadow-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">授权类型</div>
                        <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{result.LicenseType === 'Permanent' ? '永久授权 (Permanent)' : result.LicenseType}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">到期时间</div>
                        <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{result.ExpiresAt ? new Date(result.ExpiresAt).toLocaleString() : '无限制'}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">设备激活情况</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">总配额: {result.MaxDevices} 台</span>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">已激活: {result.ActivatedCount !== undefined ? result.ActivatedCount : '?'} 台</span>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">剩余名额: {result.RemainingCount !== undefined ? result.RemainingCount : '?'} 台</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">首次激活时间</div>
                        <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{new Date(result.ActivatedAt).toLocaleString()}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">当前绑定设备ID</div>
                        <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100 break-all bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-700">{result.HardwareId}</div>
                      </div>
                      {result.LicenseType === 'Subscription' && result.ExpiresAt && (
                        <div className="sm:col-span-2 mt-2">
                          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">订阅有效期进度</div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                              style={{ width: `${Math.max(0, Math.min(100, ((Date.now() - new Date(result.ActivatedAt).getTime()) / (new Date(result.ExpiresAt).getTime() - new Date(result.ActivatedAt).getTime())) * 100))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 解绑 / 换绑 提示及列表区 */}
                  {serverDetails && (serverDetails.allowDeviceTransfer || serverDetails.AllowDeviceTransfer) && (serverDetails.devices || serverDetails.Devices)?.length > 0 && (
                    <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200">💡 支持设备换绑</h4>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">此授权码允许反激活。如果达到上限，您可以解绑以下任一设备来释放名额。</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {(serverDetails.devices || serverDetails.Devices).map((dev: any, idx: number) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 shadow-sm gap-3">
                            <div className="overflow-hidden">
                              <div className="text-xs text-gray-500 dark:text-gray-400">硬件 ID</div>
                              <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={dev.hardwareId || dev.HardwareId}>
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
      </div>
    </div>
  );
}
