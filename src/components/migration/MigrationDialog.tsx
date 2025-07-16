import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertCircle, Download, Upload, Database, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, initializeDatabase } from '@/lib/database';

interface MigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function MigrationDialog({ open, onOpenChange, onComplete }: MigrationDialogProps) {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleInitializeDatabase = async () => {
    setIsInitializing(true);
    
    try {
      await initializeDatabase();
      
      toast({
        title: "Success",
        description: "Local database initialized successfully!",
      });
      
      setIsComplete(true);
      onComplete?.();
    } catch (error) {
      console.error('Database initialization failed:', error);
      toast({
        title: "Error",
        description: "Failed to initialize local database. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Local Database Setup
          </DialogTitle>
          <DialogDescription>
            Set up your local database to store all your runbook data locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!isComplete ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Welcome to Vault Recovery Navigator!</strong><br />
                  This application now uses a local database to store all your data. 
                  Click the button below to initialize your local database with default settings.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Initialize Local Database
                  </CardTitle>
                  <CardDescription>
                    Set up your local database with default administrator account and sample data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">What will be created:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Default administrator account (admin@vault.local)</li>
                      <li>• Sample application entries (Windows Server, Active Directory, etc.)</li>
                      <li>• Local database structure for runbooks, clients, and executions</li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handleInitializeDatabase}
                    disabled={isInitializing}
                    className="w-full"
                    size="lg"
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initializing Database...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Initialize Local Database
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Setup Complete!
                </CardTitle>
                <CardDescription className="text-green-700">
                  Your local database has been initialized successfully.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Default Login Credentials:</h4>
                  <div className="font-mono text-sm text-green-800">
                    <div>Email: <strong>admin@vault.local</strong></div>
                    <div>Password: <strong>admin123</strong></div>
                  </div>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Important:</strong> Please change the default password after your first login for security.
                  </AlertDescription>
                </Alert>

                <Button onClick={handleClose} className="w-full" size="lg">
                  Get Started
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 