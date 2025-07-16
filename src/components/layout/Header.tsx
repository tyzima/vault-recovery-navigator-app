
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Building2, Users as UsersIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreateClientForm } from '@/components/clients/CreateClientForm';

export function Header() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const location = useLocation();
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleClientCreated = () => {
    setShowCreateClientForm(false);
    setRefreshKey(prev => prev + 1);
  };

  const getPageInfo = () => {
    const path = location.pathname;
    const canCreateClients = profile?.role === 'kelyn_admin' || profile?.role === 'kelyn_rep';
    
    switch (path) {
      case '/clients':
        return {
          title: 'Teams',
          icon: Building2,
          action: canCreateClients ? (
            <Dialog open={showCreateClientForm} onOpenChange={setShowCreateClientForm}>
              <DialogTrigger asChild>
                <Button className="bg-lime-500 hover:bg-lime-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle></DialogTitle>
                </DialogHeader>
                                  <CreateClientForm onClientCreated={handleClientCreated} />
              </DialogContent>
            </Dialog>
          ) : null
        };
      case '/users':
        return {
          title: 'User Management',
          icon: UsersIcon,
        };
      case '/runbooks':
        return {
          title: 'Runbooks',
        };
      case '/settings':
        return {
          title: 'Settings',
        };
      case '/executions':
        return {
          title: 'Executions',
        };
      default:
        return {
          title: getDashboardTitle(),
        };
    }
  };

  const getDashboardTitle = () => {
    switch (profile?.role) {
      case 'kelyn_admin':
        return 'Admin Dashboard';
      case 'kelyn_rep':
        return 'Sales Rep Dashboard';
      case 'client_admin':
      case 'client_member':
        return 'Team Portal';
      default:
        return 'Dashboard';
    }
  };

  const getDashboardBadge = () => {
    switch (profile?.role) {
      case 'kelyn_admin':
        return 'Admin';
      case 'kelyn_rep':
        return 'Sales Rep';
      case 'client_admin':
      case 'client_member':
        return 'Team';
      default:
        return 'User';
    }
  };

  const pageInfo = getPageInfo();
  const PageIcon = pageInfo.icon;

  return (
    <header className="bg-background rounded-xl h-16 flex items-center pl-6 pr-6 sticky top-0 z-10">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-4">
          <SidebarTrigger className="h-8 w-8" />
          <div className="h-6 w-px bg-sidebar-border" />
          <Badge variant="secondary" className="text-xs font-medium bg-sidebar-accent text-sidebar-accent-foreground">
            {getDashboardBadge()}
          </Badge>
          <div className="flex items-center space-x-3">
            {PageIcon && <PageIcon className="h-5 w-5 text-sidebar-foreground" />}
            <h1 className="text-xl font-semibold text-foreground">{pageInfo.title}</h1>
          </div>
        </div>
        
        {pageInfo.action && (
          <div>
            {pageInfo.action}
          </div>
        )}
      </div>
    </header>
  );
}
