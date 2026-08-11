"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证您的邮箱，请稍候...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('无效的访问：缺少验证 Token。');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: 'GET'
        });
        
        // Backend text response or json? The backend returns Ok("邮箱验证成功...")
        // So we might get text.
        const text = await res.text();
        
        if (!res.ok) {
          throw new Error(text || '验证失败，链接可能已过期。');
        }
        
        setStatus('success');
        setMessage(text || '邮箱验证成功！您现在可以登录。');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || '系统内部错误，请稍后重试。');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="text-center">
      {status === 'loading' && (
        <div className="text-blue-600 dark:text-blue-400">
          <svg className="animate-spin h-8 w-8 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>{message}</p>
        </div>
      )}
      
      {status === 'success' && (
        <div className="text-green-600 dark:text-green-400">
          <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="font-medium text-lg">{message}</p>
          <Link href="/" className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
            前往登录
          </Link>
        </div>
      )}
      
      {status === 'error' && (
        <div className="text-red-600 dark:text-red-400">
          <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="font-medium">{message}</p>
          <Link href="/" className="mt-6 inline-block font-semibold text-blue-600 hover:text-blue-500">
            返回首页
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 sm:p-10 dark:bg-gray-800 dark:ring-white/10">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-8">
          邮箱安全验证
        </h2>
        <Suspense fallback={<div className="text-center text-gray-500">加载中...</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
