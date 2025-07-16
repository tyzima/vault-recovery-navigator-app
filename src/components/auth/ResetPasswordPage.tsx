import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { localAuth } from '@/lib/auth';
import { PasswordRequirements } from '@/components/ui/PasswordRequirements';

export function ResetPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await localAuth.getSession();
      if (!data.session) {
        toast({
          title: "Not authenticated",
          description: "Please log in to change your password.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };
    
    checkAuth();
  }, [navigate, toast]);

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

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      toast({
        title: "Invalid password",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await localAuth.changePassword({
      currentPassword: currentPassword,
      newPassword: password
    });
    
    if (error) {
      toast({
        title: "Error updating password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated successfully!",
        description: "You can now sign in with your new password.",
      });
      navigate('/');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src="https://1ykb2g02vo.ufs.sh/f/vZDRAlpZjEG4TZBYSPUfXALlFeY9JmRyhkrKDWMPvS5a4CpB" 
            alt="KelynTech Logo" 
            className="h-12 mx-auto mb-4"
          />
          <CardTitle>Change Your Password</CardTitle>
          <CardDescription>
            Enter your current password and set a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                required
              />
              {password && (
                <PasswordRequirements password={password} className="mt-3" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-lime-500 hover:bg-lime-600" disabled={loading}>
              {loading ? 'Updating password...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
