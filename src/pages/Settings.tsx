import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { fileClient } from '@/lib/fileClient';
import { Loader2, User, Lock, Edit, Shield } from 'lucide-react';
import { AppBrandingSettings } from '@/components/settings/AppBrandingSettings';
import { localAuth } from '@/lib/auth';
import { PasswordRequirements } from '@/components/ui/PasswordRequirements';
import { LicenseManager } from '@/components/licensing/LicenseManager';

export function Settings() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Initialize form fields when profile loads
  React.useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
    }
  }, [profile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    try {
      const updatedProfile = {
        ...profile,
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString()
      };

      const { error } = await fileClient.from('profiles').update(updatedProfile).eq('id', profile.id);

      if (error) {
        toast({
          title: "Error updating profile",
          description: "Failed to update your profile information.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Profile updated successfully!",
          description: "Your profile information has been saved."
        });
        setIsEditing(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const validatePassword = (password: string) => {
    const requirements = [
      { regex: /.{6,}/, message: "at least 6 characters" },
      { regex: /[a-z]/, message: "one lowercase letter" },
      { regex: /[A-Z]/, message: "one uppercase letter" },
      { regex: /\d/, message: "one number" },
      { regex: /[!@#$%^&*(),.?":{}|<>]/, message: "one symbol" }
    ];

    for (const req of requirements) {
      if (!req.regex.test(password)) {
        return { valid: false, message: `Password must contain ${req.message}` };
      }
    }
    return { valid: true };
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both new passwords match.",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(passwordData.newPassword);
    if (!validation.valid) {
      toast({
        title: "Invalid password",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    
    const { error } = await localAuth.changePassword({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });

    if (error) {
      toast({
        title: "Error changing password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password changed successfully!",
        description: "Your password has been updated.",
      });
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
    
    setPasswordLoading(false);
  };

  // Check if user can access branding settings - Only Kelyn Admin and Kelyn Rep
  const canAccessBranding = profile?.role === 'kelyn_admin' || profile?.role === 'kelyn_rep';
  
  // Check if user can access license management - Only Kelyn Admin
  const canAccessLicensing = profile?.role === 'kelyn_admin';

  if (profileLoading) {
    return (
      <div className="flex items-start justify-start min-h-[400px] p-8">
        <div className="text-left">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-lime-500" />
          <p className="text-muted-foreground">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* App Branding Settings - Only for admins */}
      {canAccessBranding && (
        <div className="mb-8">
          <AppBrandingSettings />
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Profile Information */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-lime-100 rounded-lg">
                    <User className="h-5 w-5 text-lime-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-left">Profile Information</CardTitle>
                    <CardDescription className="text-left">Your personal account details</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={loading}
                  className="shrink-0"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditing ? 'Cancel' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name" className="text-sm font-medium text-left">First Name</Label>
                      <Input
                        id="first-name"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                        className="h-11 text-left"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name" className="text-sm font-medium text-left">Last Name</Label>
                      <Input
                        id="last-name"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                        className="h-11 text-left"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground text-left">Email Address</Label>
                        <p className="text-sm text-muted-foreground mt-1 text-left">{user?.email} (cannot be changed)</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground text-left">Account Role</Label>
                        <p className="text-sm text-muted-foreground mt-1 capitalize text-left">
                          {profile?.role?.replace('_', ' ') || 'Not assigned'} (cannot be changed)
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="bg-lime-500 hover:bg-lime-600 flex-1" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setFirstName(profile?.first_name || '');
                        setLastName(profile?.last_name || '');
                      }}
                      disabled={loading}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-col items-start py-2">
                      <Label className="text-sm font-medium text-muted-foreground text-left">First Name</Label>
                      <p className="text-sm font-medium text-left">{profile?.first_name || 'Not set'}</p>
                    </div>
                    <div className="flex flex-col items-start py-2">
                      <Label className="text-sm font-medium text-muted-foreground text-left">Last Name</Label>
                      <p className="text-sm font-medium text-left">{profile?.last_name || 'Not set'}</p>
                    </div>
                    <div className="flex flex-col items-start py-2">
                      <Label className="text-sm font-medium text-muted-foreground text-left">Email Address</Label>
                      <p className="text-sm font-medium text-left">{user?.email}</p>
                    </div>
                    <div className="flex flex-col items-start py-2">
                      <Label className="text-sm font-medium text-muted-foreground text-left">Account Role</Label>
                      <p className="text-sm font-medium capitalize text-left">
                        {profile?.role?.replace('_', ' ') || 'Not assigned'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Information Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-left">Account Information</CardTitle>
                  <CardDescription className="text-left">System details and account history</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex flex-col items-start py-2">
                  <Label className="text-sm font-medium text-muted-foreground text-left">Account Created</Label>
                  <p className="text-sm font-medium text-left">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <div className="flex flex-col items-start py-2">
                  <Label className="text-sm font-medium text-muted-foreground text-left">Last Updated</Label>
                  <p className="text-sm font-medium text-left">
                    {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <div className="flex flex-col items-start py-2">
                  <Label className="text-sm font-medium text-muted-foreground text-left">User ID</Label>
                  <p className="text-xs font-mono text-muted-foreground text-left break-all">{profile?.id}</p>
                </div>
                {profile?.client_id && (
                  <div className="flex flex-col items-start py-2">
                    <Label className="text-sm font-medium text-muted-foreground text-left">Team ID</Label>
                    <p className="text-xs font-mono text-muted-foreground text-left break-all">{profile.client_id}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Security Settings */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Lock className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-left">Security Settings</CardTitle>
                    <CardDescription className="text-left">Manage your account security</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                  disabled={passwordLoading}
                  className="shrink-0"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isChangingPassword ? 'Cancel' : 'Change Password'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isChangingPassword ? (
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password" className="text-sm font-medium text-left">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        placeholder="Enter your current password"
                        className="h-11 text-left"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-sm font-medium text-left">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="Enter your new password"
                        className="h-11 text-left"
                        required
                      />
                      {passwordData.newPassword && (
                        <div className="mt-3">
                          <PasswordRequirements password={passwordData.newPassword} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-sm font-medium text-left">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="Confirm your new password"
                        className="h-11 text-left"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="bg-lime-500 hover:bg-lime-600 flex-1" disabled={passwordLoading}>
                      {passwordLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                      }}
                      disabled={passwordLoading}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                    <div className="flex items-center space-x-3">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-left">Password Protection</p>
                        <p className="text-xs text-muted-foreground text-left">Your password was last updated recently</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Click "Change Password" above to update your account password. Make sure to use a strong, unique password.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* License Management - Only for Kelyn Admin */}
          {canAccessLicensing && (
            <div className="mt-6">
              <LicenseManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}