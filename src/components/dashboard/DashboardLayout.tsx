import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useState } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { DashboardContent } from './DashboardContent';

export function DashboardLayout() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleClientCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleRunbookCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleStepCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader 
            onClientCreated={handleClientCreated} 
            onRunbookCreated={handleRunbookCreated}
            onStepCreated={handleStepCreated}
          />
          
          <SidebarInset className="flex-1 p-0 m-0 pt-16">
            <DashboardContent 
              refreshKey={refreshKey} 
              onStepCreated={handleStepCreated}
            />
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
