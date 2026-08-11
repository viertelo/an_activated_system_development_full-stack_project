"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在吊销旧激活码并为您生成全新激活码，请稍候...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('无效的访问：缺少安全 Token。');
      return;
    }

    const resetToken = async () => {
      try {
        const res = await fetch(`/api/license/reset?token=${encodeURIComponent(token)}`, {
          method: 'GET'
        });
        
        const text = await res.text();
        
        if (!res.ok) {
          throw new Error(text || '重置失败，安全链接可能已过期或被使用过。');
        }
        
        setStatus('success');
        setMessage(text || '激活码已重置换新！新的明文激活码已发送到您的邮箱，请查收。');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || '系统内部错误，请稍后重试。');
      }
    };

    resetToken();
  }, [token]);

  return (
    <div className="text-center">
      {status === 'loading' && (
        <div className="text-yellow-600 dark:text-yellow-400">
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
          <div className="mt-6 space-x-4">
            <Link href="/forgot-license" className="inline-block rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500">
              重新申请
            </Link>
            <Link href="/" className="inline-block font-semibold text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300">
              返回首页
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResetLicensePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-8 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 sm:p-10 dark:bg-gray-800 dark:ring-white/10">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-8">
          安全重置换新
        </h2>
        <Suspense fallback={<div className="text-center text-gray-500">加载中...</div>}>
          <ResetContent />
        </Suspense>
      </div>
    </div>
  );
}
