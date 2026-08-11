"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址。');
      return;
    }
    if (!password || password.length < 6) {
      setError('请输入有效的密码。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, twoFactorCode: twoFactorCode || null }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '登录失败，请检查凭据。');
      }

      alert('登录成功！');
      // 实际项目中可在此处将 token 存入 localStorage/Cookie 并跳转
      // localStorage.setItem('token', data.token);
      // router.push('/dashboard');
      
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
            系统授权与登录
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            欢迎回来，请使用您的邮箱与密码登录
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                邮箱地址
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  密码
                </label>
                <div className="text-sm flex space-x-3">
                  <Link href="/forgot-password" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400">
                    忘记密码
                  </Link>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <Link href="/forgot-license" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400">
                    忘记激活码
                  </Link>
                </div>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                  placeholder="输入您的登录密码"
                />
              </div>
            </div>

            <div>
              <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                2FA 动态密码 (若未开启请留空)
              </label>
              <div className="mt-1">
                <input
                  id="twoFactorCode"
                  name="twoFactorCode"
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                  placeholder="6位数动态验证码"
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
              className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-blue-400 transition-colors"
            >
              {loading ? '正在验证...' : '授权登录'}
            </button>
          </div>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
            没有账号？ <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500">立即注册</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
