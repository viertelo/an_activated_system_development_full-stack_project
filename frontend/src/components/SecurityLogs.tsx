"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface AuditLog {
  id: number;
  action: string;
  operator: string;
  target: string;
  isSuccess: boolean;
  details: string;
  timestamp: string;
}

interface SecurityLogsProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function SecurityLogs({ apiFetch }: SecurityLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [action, setAction] = useState('all');
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      });
      
      if (action !== 'all') params.append('action', action);
      if (status !== 'all') params.append('isSuccess', status === 'success' ? 'true' : 'false');
      if (keyword.trim()) params.append('keyword', keyword.trim());

      const res = await apiFetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.total === 'number') {
          setLogs(data.data || []);
          setTotal(data.total);
        } else if (Array.isArray(data)) {
          // Fallback if backend hasn't updated yet
          setLogs(data);
          setTotal(data.length);
        }
      } else {
        toast.error('获取风控日志失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('系统错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, status]);

  // When searching, reset to page 1 and fetch
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1) {
      fetchLogs();
    } else {
      setPage(1);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const getActionLabel = (act: string) => {
    switch (act) {
      case 'UserLogin': return '用户登录';
      case 'RateLimitBlocked': return '风控拦截';
      case 'DeviceActivate': return '设备激活';
      default: return act;
    }
  };

  const getActionColor = (act: string) => {
    switch (act) {
      case 'UserLogin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'RateLimitBlocked': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'DeviceActivate': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            风控安全中心
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">全面监控系统安全事件、登录异常与恶意攻击拦截。</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 w-full md:w-auto">
          <select 
            value={action} 
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有事件</option>
            <option value="UserLogin">登录记录</option>
            <option value="RateLimitBlocked">风控拦截</option>
            <option value="DeviceActivate">授权激活</option>
          </select>
          
          <select 
            value={status} 
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有状态</option>
            <option value="success">成功 / 正常</option>
            <option value="failed">失败 / 拦截</option>
          </select>
          
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <input 
              type="text" 
              placeholder="搜索 IP、邮箱或目标..." 
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              搜索
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold">时间</th>
                <th className="px-6 py-4 font-semibold">事件类型</th>
                <th className="px-6 py-4 font-semibold">操作者 / IP</th>
                <th className="px-6 py-4 font-semibold">状态</th>
                <th className="px-6 py-4 font-semibold w-full">详细信息</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">未找到相关安全日志记录。</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(log.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-gray-200">{log.operator}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{log.target}</div>
                    </td>
                    <td className="px-6 py-4">
                      {log.isSuccess ? (
                        <span className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                          成功
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600 dark:text-red-400 text-sm font-medium">
                          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                          失败/拦截
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-700 dark:text-gray-300 truncate max-w-xs md:max-w-md lg:max-w-xl" title={log.details}>
                        {log.details}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              共 <span className="font-medium text-gray-900 dark:text-white">{total}</span> 条记录
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 flex items-center">
                {page} / {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
