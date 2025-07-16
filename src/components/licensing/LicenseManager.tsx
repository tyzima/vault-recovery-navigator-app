import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Key, Clock, Users, Shield } from 'lucide-react';
import { 
  getLicenseInfo, 
  installLicense, 
  getRunbookUsage, 
  removeLicense 
} from '@/lib/licensing';
import { useAuth } from '@/hooks/useAuth';

interface LicenseInfo {
  valid: boolean;
  customer_id?: string;
  max_runbooks?: number;
  expires_at?: number;
  features?: string[];
  error?: string;
}

interface RunbookUsage {
  current_count: number;
  max_allowed: number;
  remaining: number;
}

export function LicenseManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [usage, setUsage] = useState<RunbookUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [licenseKey, setLicenseKey] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    loadLicenseInfo();
  }, [user]);

  const loadLicenseInfo = async () => {
    setIsLoading(true);
    try {
      const info = await getLicenseInfo();
      setLicenseInfo(info);

      if (user && info.valid) {
        const usageInfo = await getRunbookUsage(user.id);
        setUsage(usageInfo);
      }
    } catch (error) {
      console.error('Failed to load license info:', error);
      setLicenseInfo({ valid: false, error: 'Failed to load license' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallLicense = async () => {
    if (!licenseKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a license key',
        variant: 'destructive'
      });
      return;
    }

    setIsInstalling(true);
    try {
      const success = await installLicense(licenseKey);
      if (success) {
        toast({
          title: 'Success',
          description: 'License installed successfully'
        });
        setLicenseKey('');
        await loadLicenseInfo();
      } else {
        toast({
          title: 'Error',
          description: 'Invalid license key',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to install license:', error);
      toast({
        title: 'Error',
        description: 'Failed to install license',
        variant: 'destructive'
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleRemoveLicense = () => {
    removeLicense();
    toast({
      title: 'License Removed',
      description: 'License has been removed from this installation'
    });
    loadLicenseInfo();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (expiresAt: number) => {
    const daysUntilExpiry = Math.floor((expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30;
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading license information...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-left">
          <Shield className="h-5 w-5" />
          <span>License Management</span>
        </CardTitle>
        <CardDescription className="text-left">
          Manage your software license and view usage statistics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* License Status Section */}
        <div className="space-y-4">
          {licenseInfo?.valid ? (
            <>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">License Active</span>
                {licenseInfo.expires_at && isExpiringSoon(licenseInfo.expires_at) && (
                  <Badge variant="destructive" className="ml-2">
                    <Clock className="h-3 w-3 mr-1" />
                    Expires Soon
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div>
                  <p className="text-xs text-gray-500">Customer ID</p>
                  <p className="text-sm font-mono">{licenseInfo.customer_id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Max Runbooks</p>
                  <p className="text-sm font-medium">{licenseInfo.max_runbooks}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Expires</p>
                  <p className="text-sm">{licenseInfo.expires_at ? formatDate(licenseInfo.expires_at) : 'Never'}</p>
                </div>
                {usage && (
                  <div>
                    <p className="text-xs text-gray-500">Usage</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{usage.current_count}/{usage.max_allowed}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-300 ${
                            usage.remaining === 0 ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, (usage.current_count / usage.max_allowed) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {licenseInfo.features && licenseInfo.features.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Features</p>
                  <div className="flex flex-wrap gap-1">
                    {licenseInfo.features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">No Valid License</span>
              <span className="text-sm text-gray-600">- Install a license key to activate the software</span>
            </div>
          )}
        </div>

        {/* License Installation Section */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span className="text-sm font-medium">Install License Key</span>
          </div>
          
          <div className="space-y-3">
            <Textarea
              id="license-key"
              placeholder="Paste your license key here..."
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleInstallLicense}
                disabled={isInstalling || !licenseKey.trim()}
                size="sm"
                className="flex items-center space-x-2"
              >
                <Key className="h-3 w-3" />
                <span>{isInstalling ? 'Installing...' : 'Install License'}</span>
              </Button>

              {licenseInfo?.valid && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRemoveLicense}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove License
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 