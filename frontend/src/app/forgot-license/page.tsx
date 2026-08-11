"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotLicensePage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/license/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '请求失败，请稍后重试。');
      }

      setSuccessMsg(data.message || '如果您的邮箱存在，重置链接已发送到您的邮箱。');
      setEmail('');
    } catch (err: any) {
      setError(err.message || '系统内部错误，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 sm:p-10 dark:bg-gray-800 dark:ring-white/10">
        <div>
          <h2 className="mt-2 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            找回激活码 / 密码重置
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            为保证绝对安全，系统将吊销您的旧激活码并为您颁发全新的激活码。
          </p>
        </div>
        
        {successMsg ? (
          <div className="mt-8 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">{successMsg}</h3>
                <div className="mt-4 text-sm">
                  <Link href="/" className="font-semibold text-green-700 hover:text-green-600">
                    &larr; 返回登录页面
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  绑定的邮箱地址
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center dark:text-red-400 font-medium">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-600 disabled:bg-yellow-400 transition-colors"
              >
                {loading ? '正在提交...' : '发送重置安全链接'}
              </button>
            </div>
            
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
              想起激活码了？ <Link href="/" className="font-semibold text-blue-600 hover:text-blue-500">直接登录</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
