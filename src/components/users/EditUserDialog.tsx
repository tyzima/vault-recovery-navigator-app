import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Profile, Client } from '@/lib/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { localAuth } from '@/lib/auth';
import { PasswordRequirements } from '@/components/ui/PasswordRequirements';
import { Separator } from '@/components/ui/separator';
import { KeyRound } from 'lucide-react';

type UserRole = 'kelyn_admin' | 'kelyn_rep' | 'client_admin' | 'client_member';

interface UserWithClient extends Profile {
  client?: Client;
}

interface EditUserDialogProps {
  user: UserWithClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const [formData, setFormData] = useState({
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    role: user.role,
    clientId: user.client_id || 'none',
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchClients();
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        role: user.role,
        clientId: user.client_id || 'none',
      });
    }
  }, [open, user]);

  const fetchClients = async () => {
    const result = await fileClient
      .from('clients')
      .select('*')
      .execute();

    if (!result.error && result.data) {
      // Sort by name
      result.data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClients(result.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('EditUserDialog: Updating user', user.id);
      
      // Update profile
      const profileUpdates = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
        client_id: formData.clientId === 'none' ? null : formData.clientId,
      };

      const profileResult = await fileClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id);

      console.log('EditUserDialog: Profile update result:', profileResult);

      if (profileResult.error) {
        throw new Error(profileResult.error.message);
      }

      // Handle client assignments for kelyn_rep
      if (formData.role === 'kelyn_rep') {
        // Remove existing assignments
        await fileClient
          .from('client_assignments')
          .delete()
          .eq('kelyn_rep_id', user.id);

        // Add new org-wide assignment (no client_id needed)
        const assignmentResult = await fileClient
          .from('client_assignments')
          .insert({
            kelyn_rep_id: user.id,
            created_at: new Date().toISOString(),
          });

        if (assignmentResult.error) {
          console.error('EditUserDialog: Assignment error:', assignmentResult.error);
        }
      } else {
        // Remove any existing assignments if not a kelyn_rep
        await fileClient
          .from('client_assignments')
          .delete()
          .eq('kelyn_rep_id', user.id);
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      onSuccess();
    } catch (error: any) {
      console.error('EditUserDialog: Error updating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast({
        title: "Invalid password",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    
    const { error } = await localAuth.resetUserPassword(user.email, newPassword);

    if (error) {
      toast({
        title: "Error resetting password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password reset successfully!",
        description: `Password has been reset for ${user.email}`,
      });
      setShowPasswordReset(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    
    setPasswordLoading(false);
  };

  const requiresClient = formData.role === 'client_admin' || formData.role === 'client_member';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and assignments
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value: UserRole) => setFormData({ ...formData, role: value, clientId: 'none' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kelyn_admin">Kelyn Admin</SelectItem>
                <SelectItem value="kelyn_rep">Kelyn Rep</SelectItem>
                                      <SelectItem value="client_admin">Team Admin</SelectItem>
                      <SelectItem value="client_member">Team Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(requiresClient || formData.role === 'kelyn_rep') && (
            <div>
              <Label htmlFor="client">
                                    {requiresClient ? 'Team (Required)' : 'Team (Optional)'}
              </Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                required={requiresClient}
              >
                <SelectTrigger>
                                        <SelectValue placeholder="Select a team..." />
                </SelectTrigger>
                <SelectContent>
                                          <SelectItem value="none">No team</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Password Reset Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="h-4 w-4" />
                <Label className="text-sm font-medium">Password Reset</Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordReset(!showPasswordReset)}
                disabled={passwordLoading}
              >
                {showPasswordReset ? 'Cancel' : 'Reset Password'}
              </Button>
            </div>

            {showPasswordReset && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <form onSubmit={handlePasswordReset} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                    {newPassword && (
                      <PasswordRequirements password={newPassword} className="mt-2" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" className="bg-red-500 hover:bg-red-600" disabled={passwordLoading}>
                    {passwordLoading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </form>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
