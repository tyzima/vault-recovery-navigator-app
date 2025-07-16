import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAppBranding } from '@/hooks/useAppBranding';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LogOut, User, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSidebar } from '@/components/ui/sidebar';
import { BackupDialog, BackupStatus } from '@/components/BackupDialog';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile(user?.id);
  const { branding } = useAppBranding();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  const handleBackupStatusChange = (status: BackupStatus) => {
    // Handle backup status changes - for now just log
    console.log('Backup status changed:', status);
  };

  const handleSignOut = async () => {
    await signOut();
    // Navigate to auth page after successful sign out
    navigate('/auth', { replace: true });
  };

  if (!user || !profile) {
    return null;
  }

  const getInitials = () => {
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const isAdmin = profile.role === 'kelyn_admin';

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            className={state === 'collapsed' ? "w-full justify-center p-2 h-auto" : "w-full justify-start p-2 h-auto"}
          >
            <div className={state === 'collapsed' ? "flex items-center justify-center" : "flex items-center space-x-3"}>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: branding?.primary_color || '#84cc16' }}
              >
                <span className="text-white font-medium text-sm">
                  {getInitials()}
                </span>
              </div>
              {state === 'expanded' && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium truncate">
                    {profile.first_name} {profile.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                </div>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: branding?.primary_color || '#84cc16' }}
              >
                <span className="text-white font-medium">
                  {getInitials()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium">{profile.first_name} {profile.last_name}</h4>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {profile.role?.replace('_', ' ')} 
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <Button 
                variant="outline" 
                asChild
                className="w-full flex items-center justify-start space-x-2 text-left"
              >
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </Button>
              
              {isAdmin && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowBackupDialog(true)}
                  className="w-full flex items-center justify-start space-x-2 text-left"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Backup to Google Drive</span>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="w-full flex items-center justify-start space-x-2 text-left"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <BackupDialog 
        open={showBackupDialog} 
        onOpenChange={setShowBackupDialog}
        onBackupStatusChange={handleBackupStatusChange}
      />
    </>
  );
}
