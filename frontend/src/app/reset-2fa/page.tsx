"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function Reset2FAContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
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
          <Link href="/" className="inline-block font-semibold text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const handleReset = async () => {
    setStatus('loading');
    setMessage('');
    
    try {
      const res = await fetch(`/api/auth/2fa/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || '重置失败，安全链接可能已过期或被使用过。');
      }
      
      setStatus('success');
      setMessage(data.message || '二次验证已成功关闭，您现在可以使用账号密码直接登录。');
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
    <div className="space-y-6">
      <div className="text-center text-gray-700 dark:text-gray-300">
        <p>您即将强制关闭当前账户的二次验证 (2FA)。</p>
        <p className="mt-2 text-sm text-red-500">
          警告：关闭后，您的账户安全性将会降低，任何人只要知道您的密码即可登录。
        </p>
      </div>

      {status === 'error' && (
        <div className="text-sm text-red-600 text-center dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
          {message}
        </div>
      )}

      <div>
        <button
          onClick={handleReset}
          disabled={status === 'loading'}
          className="flex w-full justify-center rounded-md bg-red-600 py-2 px-3 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? '正在关闭...' : '确认关闭二次验证'}
        </button>
      </div>
    </div>
  );
}

export default function Reset2FAPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 sm:p-10 dark:bg-gray-800 dark:ring-white/10">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-8">
          关闭二次验证
        </h2>
        <Suspense fallback={<div className="text-center text-gray-500">加载中...</div>}>
          <Reset2FAContent />
        </Suspense>
      </div>
    </div>
  );
}
