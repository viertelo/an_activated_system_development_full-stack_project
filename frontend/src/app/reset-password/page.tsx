"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!token) {
    return (
      <div className="text-center text-red-600 dark:text-red-400">
        <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <p className="font-medium">无效的访问：缺少安全 Token。</p>
        <div className="mt-6 space-x-4">
          <Link href="/forgot-password" className="inline-block rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500">
            重新申请
          </Link>
          <Link href="/" className="inline-block font-semibold text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    
    if (password.length < 6) {
      setStatus('error');
      setMessage('密码长度至少为 6 个字符。');
      return;
    }
    
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('两次输入的密码不一致。');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(`/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '重置失败，安全链接可能已过期或被使用过。');
      }
      
      setStatus('success');
      setMessage(data.message || '密码已成功重置，您可以使新密码登录了。');
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '系统内部错误，请稍后重试。');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center text-green-600 dark:text-green-400">
        <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="font-medium text-lg">{message}</p>
        <Link href="/" className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
          前往登录
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            新密码
          </label>
          <div className="mt-1">
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
              placeholder="••••••••"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            确认新密码
          </label>
          <div className="mt-1">
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm dark:bg-gray-700 dark:text-white dark:ring-gray-600"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {status === 'error' && (
        <div className="text-sm text-red-600 text-center dark:text-red-400 font-medium">
          {message}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="flex w-full justify-center rounded-md bg-blue-600 py-2 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? '提交中...' : '重置密码'}
        </button>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 sm:p-10 dark:bg-gray-800 dark:ring-white/10">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-8">
          设置新密码
        </h2>
        <Suspense fallback={<div className="text-center text-gray-500">加载中...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
