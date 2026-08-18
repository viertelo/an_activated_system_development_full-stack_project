"use client";

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function TestActivationPage() {
  const [publicKey, setPublicKey] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [hardwareId, setHardwareId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [verifyStatus, setVerifyStatus] = useState<'none' | 'success' | 'failed'>('none');

  // Generate a mock hardware ID on load
  useEffect(() => {
    setHardwareId(crypto.randomUUID());
  }, []);

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
    } catch (e) {
      console.error(e);
      throw new Error("公钥解析失败，请检查是否为有效的 RSA 公钥 PEM");
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

  const handleActivate = async () => {
    if (!publicKey.trim()) {
      toast.error('请填写公钥');
      return;
    }
    if (!licenseKey.trim()) {
      toast.error('请填写激活码');
      return;
    }
    if (!hardwareId.trim()) {
      toast.error('请填写设备标识(HardwareId)');
      return;
    }

    setLoading(true);
    setResult(null);
    setVerifyStatus('none');

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
        throw new Error(data.Message || data.message || '激活失败');
      }

      toast.success('接口请求成功，开始本地验签...');

      const signatureStr = data.Signature || data.signature;
      if (!signatureStr || !signatureStr.includes('.')) {
        throw new Error("返回的签名格式不正确");
      }

      const [payloadBase64, signatureBase64] = signatureStr.split('.');

      // 2. 导入公钥并验签
      const cryptoKey = await importPublicKey(publicKey);
      const isValid = await verifySignature(cryptoKey, payloadBase64, signatureBase64);

      if (isValid) {
        setVerifyStatus('success');
        toast.success('验签成功！');
        
        // 解析 payload
        // Escape and decodeURIComponent are used to correctly decode UTF-8 strings that were base64 encoded
        const jsonStr = decodeURIComponent(escape(window.atob(payloadBase64)));
        const payloadObj = JSON.parse(jsonStr);
        setResult(payloadObj);
      } else {
        setVerifyStatus('failed');
        toast.error('验签失败：数据可能被篡改或公钥不匹配');
      }

    } catch (err: any) {
      toast.error(err.message || '发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              RSA 公钥 (PEM格式)
            </label>
            <div className="mt-1">
              <textarea
                rows={5}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">可在管理员后台“查看RSA公钥”处获取</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              设备标识 (Hardware ID)
            </label>
            <div className="mt-1">
              <input
                type="text"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
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
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
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
              {loading ? '正在激活...' : '执行激活与验签'}
            </button>
          </div>
        </div>

        {/* 结果展示区 */}
        {(verifyStatus !== 'none' || result) && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white border-b pb-2 dark:border-gray-700">
              激活结果
            </h2>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">本地验签状态：</span>
              {verifyStatus === 'success' && <span className="text-green-600 font-bold">验证通过，数据可信</span>}
              {verifyStatus === 'failed' && <span className="text-red-600 font-bold">验证失败，签名不匹配</span>}
            </div>

            {result && verifyStatus === 'success' && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border dark:border-gray-700">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">授权类型</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {result.LicenseType === 'Permanent' ? '永久授权 (Permanent)' : result.LicenseType}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">到期时间</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {result.ExpiresAt ? new Date(result.ExpiresAt).toLocaleString() : '无限制'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">支持最多设备数</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {result.MaxDevices} 台
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">绑定设备ID</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white break-all">
                    {result.HardwareId}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">首次激活时间</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(result.ActivatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
            
            {result && verifyStatus === 'success' && (
              <div className="mt-4 text-xs text-gray-400">
                注：本次显示的“支持最多设备数”及“到期时间”均来自于经过 RSA 签名保护的数据块。由于签名无法伪造，客户端可绝对信任此信息。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
