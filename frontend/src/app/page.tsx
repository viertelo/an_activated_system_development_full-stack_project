"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Key } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot2FALoading, setForgot2FALoading] = useState(false);
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

      if (data.userId) {
        localStorage.setItem('user', JSON.stringify({ userId: data.userId, role: data.role }));
        if (data.sessionToken) {
          localStorage.setItem('sessionToken', data.sessionToken);
        }
      }
      router.push('/admin');
      
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '系统内部错误，请稍后重试。');
      setError(err instanceof Error ? err.message : '系统内部错误，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot2FA = async () => {
    if (!email || !email.includes('@')) {
      toast.error('请先在上方输入您的邮箱地址');
      return;
    }

    setForgot2FALoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/2fa/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '重置链接已发送到该邮箱。');
      } else {
        toast.error(data.message || '发送失败，请检查邮箱是否正确。');
      }
    } catch (err) {
      console.error(err);
      toast.error('网络或服务器错误，请稍后再试。');
    } finally {
      setForgot2FALoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!email || !email.includes('@')) {
      toast.error('请先输入您的邮箱地址以进行通行密钥登录。');
      return;
    }

    setLoading(true);
    try {
      // 1. Get assertion options from server
      const resp = await fetch(`/api/passkey/assertionOptions?email=${encodeURIComponent(email)}`, { method: 'POST' });
      if (!resp.ok) {
        const errorMsg = await resp.json();
        throw new Error(errorMsg.Message || errorMsg.ErrorMessage || '无法获取登录选项，可能是该账号未绑定通行密钥');
      }
      const options = await resp.json();

      // 2. Prompt user to authenticate
      const asseResp = await startAuthentication(options);

      // 3. Send response back to server
      const verifyResp = await fetch(`/api/passkey/makeAssertion?email=${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      });

      const data = await verifyResp.json();

      if (verifyResp.ok) {
        if (data.userId) {
          localStorage.setItem('user', JSON.stringify({ userId: data.userId, role: data.role }));
          if (data.sessionToken) {
            localStorage.setItem('sessionToken', data.sessionToken);
          }
        }
        toast.success('通行密钥登录成功');
        router.push('/admin');
      } else {
        throw new Error(data.ErrorMessage || '登录验证失败');
      }
    } catch (err: any) {
      toast.error(err.message || '通行密钥登录取消或发生错误');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="relative w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 sm:p-10 dark:bg-gray-800 dark:ring-white/10">
        <div className="absolute top-4 right-4">
          <ThemeSwitcher />
        </div>
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
                  autoComplete="username webauthn"
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
                </div>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                  placeholder="输入您的登录密码"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  2FA 动态密码 (若未开启请留空)
                </label>
                <button
                  type="button"
                  onClick={handleForgot2FA}
                  disabled={forgot2FALoading}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 disabled:opacity-50"
                >
                  {forgot2FALoading ? '发送中...' : '丢失验证器？'}
                </button>
              </div>
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
            <div className="text-sm text-red-600 text-center dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-blue-400 transition-colors"
            >
              {loading ? '正在验证...' : '授权登录'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handlePasskeyLogin}
              className="flex w-full items-center justify-center space-x-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <Key className="h-4 w-4" />
              <span>通行密钥 (Passkey) 快捷登录</span>
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
