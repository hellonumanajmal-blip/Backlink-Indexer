"use client";

import React from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell/AppShell';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/StatusBadge';
import { useDashboardData } from '@/lib/dashboard';
import { cn } from '@/lib/cn';

const DashboardPage: React.FC = () => {
  const {
    kpiMetrics,
    pipelineStatus,
    recentBacklinks,
    activityEvents,
    discoveryChannels,
    indexingHealth,
    isLoading,
    error,
  } = useDashboardData();

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-neutral-600 mb-6">{error.message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-pulse">
          {[...Array(4)].map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="h-8 w-24 bg-neutral-200 rounded mb-4"></div>
                <div className="h-6 w-16 bg-neutral-200 rounded mb-2"></div>
                <div className="h-4 w-32 bg-neutral-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="h-64 bg-neutral-100 rounded-lg"></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="h-6 w-48 bg-neutral-200 rounded mb-4"></div>
                <div className="space-y-4">
                  {[...Array(5)].map((_, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-neutral-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 w-32 bg-neutral-200 rounded mb-2"></div>
                        <div className="h-3 w-48 bg-neutral-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="h-6 w-32 bg-neutral-200 rounded mb-4"></div>
                  <div className="h-48 bg-neutral-100 rounded-lg"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-neutral-900">Overview</h1>
          <p className="text-neutral-500">Monitor your backlink discovery, crawling, and indexing pipeline.</p>
        </div>
        <Link href="/dashboard/backlinks/add">
          <Button>Add Backlinks</Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {kpiMetrics.map((metric: any, index: number) => (
          <Card key={index} className="transition-all hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-neutral-500">{metric.label}</div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${metric.iconBgColor}`}>
                  {metric.icon}
                </div>
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-2">
                {metric.value !== null ? metric.value : '—'}
              </div>
              <div className="text-sm text-neutral-500">
                {metric.description}
              </div>
              {metric.trend && (
                <div className={`flex items-center mt-2 ${metric.trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {metric.trend.direction === 'up' ? (
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  <span className="text-sm">{metric.trend.value}%</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Indexing Pipeline */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Indexing Pipeline</CardTitle>
          <CardDescription>Current status of your backlink workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between items-center">
            {pipelineStatus.map((stage: any, index: number) => (
              <React.Fragment key={index}>
                <div className={`flex flex-col items-center ${index < pipelineStatus.length - 1 ? 'md:flex-row' : ''}`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${stage.status === 'completed' ? 'bg-green-100 text-green-600' : stage.status === 'active' ? 'bg-blue-100 text-blue-600' : stage.status === 'waiting' ? 'bg-neutral-100 text-neutral-600' : 'bg-red-100 text-red-600'} mb-2 md:mb-0`}>
                    {stage.icon}
                  </div>
                  <div className="text-center md:text-left mb-4 md:mb-0 md:ml-4">
                    <div className="font-medium text-neutral-900">{stage.label}</div>
                    <div className="text-sm text-neutral-500">{stage.description}</div>
                  </div>
                </div>
                {index < pipelineStatus.length - 1 && (
                  <div className="hidden md:block w-16 h-px bg-neutral-200 mx-4"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Backlinks */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Backlinks</CardTitle>
            <CardDescription>Your most recent backlink submissions</CardDescription>
          </div>
          <Link href="/dashboard/backlinks/add">
            <Button variant="outline" size="sm">Add Backlinks</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentBacklinks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-neutral-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No backlinks yet</h3>
              <p className="text-neutral-500 mb-6">Add your first backlink to start the indexing workflow.</p>
              <Link href="/dashboard/backlinks/add">
                <Button>Add Backlinks</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Source URL</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Target URL</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Discovery</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Index Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Last Checked</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBacklinks.map((backlink: any, index: number) => (
                    <tr key={index} className={cn(
                      'border-b border-neutral-100',
                      index % 2 === 0 ? 'bg-neutral-50' : 'bg-white'
                    )}>
                      <td className="px-4 py-3 text-sm text-neutral-900 truncate max-w-xs">
                        {backlink.sourceUrl}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 truncate max-w-xs">
                        {backlink.targetUrl}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={backlink.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={backlink.discoveryStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={backlink.indexStatus} />
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        {backlink.lastChecked ? new Date(backlink.lastChecked).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/backlinks/${backlink.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity / Pipeline Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Events in your backlink workflow</CardDescription>
            </CardHeader>
            <CardContent>
              {activityEvents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-neutral-500 mb-2">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-neutral-500">Your indexing activity will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityEvents.map((event: any, index: number) => (
                    <div key={index} className="flex items-start">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${event.type === 'success' ? 'bg-green-100 text-green-600' : event.type === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'} mr-3`}>
                        {event.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-900">{event.title}</div>
                        <div className="text-sm text-neutral-500">{event.description}</div>
                        <div className="text-xs text-neutral-400 mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Discovery Status Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Discovery Status</CardTitle>
              <CardDescription>Current state of discovery channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {discoveryChannels.map((channel: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${channel.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-600'} mr-3`}>
                        {channel.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-neutral-900">{channel.name}</div>
                        <div className="text-xs text-neutral-500">{channel.description}</div>
                      </div>
                    </div>
                    <Badge variant={channel.status === 'active' ? 'success' : 'default'} size="sm">
                      {channel.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Indexing Health */}
          <Card>
            <CardHeader>
              <CardTitle>Indexing Health</CardTitle>
              <CardDescription>Summary of your indexing performance</CardDescription>
            </CardHeader>
            <CardContent>
              {indexingHealth.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-neutral-500 mb-2">
                    <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-neutral-500">Indexing health data will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {indexingHealth.map((item: any, index: number) => (
                    <div key={index} className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ${item.color} mr-3`}></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-900">{item.label}</div>
                      </div>
                      <div className="text-sm font-medium text-neutral-900 w-12 text-right">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Shortcuts to common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link href="/dashboard/backlinks/add">
                  <Button variant="outline" className="w-full">Add Backlinks</Button>
                </Link>
                <Link href="/dashboard/backlinks/import">
                  <Button variant="outline" className="w-full">Import CSV</Button>
                </Link>
                <Link href="/dashboard/discovery">
                  <Button variant="outline" className="w-full">View Discovery</Button>
                </Link>
                <Link href="/dashboard/crawl-monitoring">
                  <Button variant="outline" className="w-full">Crawl Monitoring</Button>
                </Link>
                <Link href="/dashboard/index-verification">
                  <Button variant="outline" className="w-full">Index Verification</Button>
                </Link>
                <Link href="/dashboard/intelligence">
                  <Button variant="outline" className="w-full">Intelligence</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default DashboardPage;