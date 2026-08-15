"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { cn } from '@/lib/cn';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed} onCollapseToggle={toggleSidebar} />

      {/* Main content */}
      <div className={cn(
        'flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'ml-16' : 'ml-64'
      )}>
        {/* Topbar */}
        <Topbar isSidebarCollapsed={isSidebarCollapsed} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto pt-16 bg-neutral-50">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;