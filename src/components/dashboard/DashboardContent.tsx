
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { KelynAdminDashboard } from './KelynAdminDashboard';
import { KelynRepDashboard } from './KelynRepDashboard';
import { ClientDashboard } from './ClientDashboard';
import { Clients } from '@/pages/Clients';
import { Runbooks } from '@/pages/Runbooks';
import { Users } from '@/pages/Users';
import { ClientDetails } from '@/pages/ClientDetails';
import { RunbookDetails } from '@/pages/RunbookDetails';
import { Executions } from '@/pages/Executions';
import { ExecutionDetails } from '@/pages/ExecutionDetails';
import { KnowledgeBase } from '@/pages/KnowledgeBase';
import { Settings } from '@/pages/Settings';

interface DashboardContentProps {
  refreshKey: number;
  onStepCreated?: () => void;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardContent({ refreshKey, onStepCreated }: DashboardContentProps) {
  const { user } = useAuth();
  const { profile, loading } = useProfile(user?.id);
  const location = useLocation();

  // Show skeleton while profile is loading
  if (loading) {
    return (
      <div className="flex-1 p-6 max-w-6xl mx-auto">
        <PageSkeleton />
      </div>
    );
  }

  const renderContent = () => {
    const path = location.pathname;
    
    // Check for client details route
    if (path.startsWith('/clients/') && path !== '/clients') {
      return <ClientDetails key={refreshKey} />;
    }
    
    // Check for runbook details route
    if (path.startsWith('/runbooks/') && path !== '/runbooks') {
      return <RunbookDetails key={refreshKey} onStepCreated={onStepCreated} />;
    }
    
    // Check for execution details route
    if (path.startsWith('/executions/') && path !== '/executions') {
      return <ExecutionDetails key={refreshKey} />;
    }
    
    switch (path) {
      case '/clients':
        return <Clients key={refreshKey} />;
      case '/runbooks':
        return <Runbooks key={refreshKey} />;
      case '/users':
        return <Users />;
      case '/executions':
        return <Executions />;
      case '/knowledge-base':
        return <KnowledgeBase />;
      case '/settings':
        return <Settings />;
      default:
        // Render role-specific dashboard for home page
        switch (profile?.role) {
          case 'kelyn_admin':
            return <KelynAdminDashboard />;
          case 'kelyn_rep':
            return <KelynRepDashboard />;
          case 'client_admin':
          case 'client_member':
            return <ClientDashboard />;
          default:
            return (
              <div className="p-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">Welcome to KelynTech Portal</h2>
                  <p className="text-muted-foreground mt-2">
                    Your account is being set up. Please contact your administrator.
                  </p>
                </div>
              </div>
            );
        }
    }
  };

  return (
    <div className={`flex-1 ${location.pathname === '/knowledge-base' ? 'p-0' : 'p-6'}`}>
      {renderContent()}
    </div>
  );
}
