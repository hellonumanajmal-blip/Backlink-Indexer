import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface TopbarProps {
  isSidebarCollapsed: boolean;
}

const Topbar: React.FC<TopbarProps> = ({ isSidebarCollapsed }) => {
  const pathname = usePathname();

  const getPageTitle = () => {
    const pathSegments = pathname.split('/').filter(segment => segment !== '');
    if (pathSegments.length === 0) return 'Dashboard';

    // Custom titles for specific routes
    const routeTitles: Record<string, string> = {
      'internal': 'Dashboard',
      'backlinks': 'Backlinks',
      'add': 'Add Backlinks',
      'discover': 'Discovery',
      'engine': 'Indexing Engine',
      'experiment': 'Experiments',
      'analytics': 'Analytics',
      'domains': 'Domains',
      'settings': 'Settings',
    };

    // Find the most specific matching route title
    for (let i = pathSegments.length; i > 0; i--) {
      const path = pathSegments.slice(0, i).join('/');
      if (routeTitles[path]) {
        return routeTitles[path];
      }
    }

    // Default to capitalizing the last segment
    return pathSegments[pathSegments.length - 1]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={cn(
      'fixed top-0 right-0 z-40 w-full border-b border-neutral-200 bg-white transition-all duration-300 ease-in-out',
      isSidebarCollapsed ? 'pl-16' : 'pl-64'
    )}>
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-neutral-900">{getPageTitle()}</h1>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/internal" className={cn(
              'text-sm font-medium',
              pathname === '/internal' ? 'text-primary' : 'text-neutral-500 hover:text-neutral-700'
            )}>
              Overview
            </Link>
            <Link href="/internal/backlinks" className={cn(
              'text-sm font-medium',
              pathname.startsWith('/internal/backlinks') ? 'text-primary' : 'text-neutral-500 hover:text-neutral-700'
            )}>
              Backlinks
            </Link>
            <Link href="/internal/engine" className={cn(
              'text-sm font-medium',
              pathname.startsWith('/internal/engine') ? 'text-primary' : 'text-neutral-500 hover:text-neutral-700'
            )}>
              Engine
            </Link>
            <Link href="/internal/experiment" className={cn(
              'text-sm font-medium',
              pathname.startsWith('/internal/experiment') ? 'text-primary' : 'text-neutral-500 hover:text-neutral-700'
            )}>
              Experiments
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="w-64 px-4 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <button className="p-2 rounded-full hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary">
            <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <button className="p-2 rounded-full hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary">
            <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="hidden md:inline text-sm font-medium text-neutral-700">User</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;