import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAppBranding } from '@/hooks/useAppBranding';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getAppBrandingLogoUrl } from '@/utils/urlUtils';
import { Loader2, Upload, Palette, Type, Image, Save, FileText, RefreshCw, ChevronDown, ChevronUp, Shield, AlertTriangle, Moon, Sun } from 'lucide-react';

export function AppBrandingSettings() {
  const { branding, loading, updateBranding, uploadLogo } = useAppBranding();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    app_name: '',
    primary_color: '',
    secondary_color: '',
    theme_mode: 'light' as 'light' | 'dark'
  });

  // Initialize form data when branding loads
  React.useEffect(() => {
    if (branding) {
      console.log('App branding loaded:', branding);
      console.log('Logo URL from branding:', branding.app_logo_url);
      console.log('Processed logo URL (using general directory):', getAppBrandingLogoUrl(branding.app_logo_url));
      setFormData({
        app_name: branding.app_name || '',
        primary_color: branding.primary_color || '#84cc16',
        secondary_color: branding.secondary_color || '#65a30d',
        theme_mode: branding.theme_mode || 'light'
      });
    }
  }, [branding]);

  const handleInputChange = (field: string, value: string | ('light' | 'dark')) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async () => {
    setIsUpdating(true);
    try {
      const { error } = await updateBranding(formData);
      
      if (error) {
        toast({
          title: "Error updating branding",
          description: error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Branding updated!",
          description: "Your changes have been saved."
        });
        setShowRefresh(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
    setIsUpdating(false);
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const { url, error } = await uploadLogo(file);
      
      if (error || !url) {
        toast({
          title: "Error uploading logo",
          description: error || "Failed to upload logo",
          variant: "destructive"
        });
      } else {
        // Update branding with new logo URL
        const { error: updateError } = await updateBranding({ app_logo_url: url });
        
        if (updateError) {
          toast({
            title: "Error updating logo",
            description: updateError,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Logo updated!",
            description: "Your new logo has been saved."
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
    setIsUploading(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if user has permission to access branding settings
  const canAccessBranding = profile?.role === 'kelyn_admin' || profile?.role === 'kelyn_rep';

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Show access denied message if user doesn't have permission
  if (!canAccessBranding) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-gray-100">Access Restricted</h3>
              <p className="text-gray-400 mt-2">
                App branding settings can only be modified by Kelyn Administrators and Kelyn Representatives.
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Contact your system administrator if you need access to these settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-4 bg-gray-900 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-gray-100" />
            <CardTitle className="text-lg text-gray-100">App Branding</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription className="hidden">
          Customize your app's appearance and branding
        </CardDescription>
      </CardHeader>
      <CardContent className="relative bg-gray-900 rounded-b-xl">
        {/* Collapsible Content Container */}
        <div className={`relative transition-all duration-500 ease-in-out ${
          isExpanded ? 'max-h-none' : 'max-h-[300px] overflow-hidden rounded-xl'
        }`}>
          <div className="p-2">
          {/* Fade-out overlay when collapsed */}
          {!isExpanded && (
            <>
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  className="h-8 px-4 text-sm font-medium bg-gray-800/95 backdrop-blur-sm border-gray-600 hover:bg-gray-700 hover:border-gray-500 transition-all duration-200 shadow-sm text-gray-100 hover:text-white"
                >
                  Edit Settings
                </Button>
              </div>
            </>
          )}
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 rounded-xl overflow-hidden">
          
          {/* Left Column - Settings */}
          <div className="space-y-6">
            {/* Logo and Name Section */}
            <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-6 space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-1.5 h-6 bg-primary/80 rounded-full"></div>
                <h3 className="text-base font-semibold text-gray-100">Brand Identity</h3>
              </div>
              
              {/* Logo and App Name Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                    <Image className="h-4 w-4 text-gray-300" />
                    <span>Logo</span>
                  </Label>
                  <div className="flex items-start space-x-3">
                    <div className="w-16 h-16 bg-gray-700/50 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-600/60 hover:border-primary/40 transition-colors">
                      {branding?.app_logo_url ? (
                        <img 
                          src={getAppBrandingLogoUrl(branding.app_logo_url)} 
                          alt="App logo" 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Image className="h-6 w-6 text-gray-400/60" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-6 px-2 text-xs font-medium border-gray-600/60 hover:bg-gray-700/50 hover:border-primary/40 transition-all duration-200 text-gray-200"
                      >
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                      </Button>
                      <p className="text-xs text-gray-400 text-center">
                        Replace
                      </p>
                    </div>
                  </div>
                </div>

                {/* App Name */}
                <div className="space-y-3">
                  <Label htmlFor="app-name" className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                    <Type className="h-4 w-4 text-gray-300" />
                    <span>Application Name</span>
                  </Label>
                  <div className="pt-2">
                    <Input
                      id="app-name"
                      type="text"
                      value={formData.app_name}
                      onChange={(e) => handleInputChange('app_name', e.target.value)}
                      placeholder="Enter your application name"
                      className="h-10 bg-gray-700/50 border-gray-600/60 focus:border-primary/60 focus:bg-gray-700 transition-all duration-200 text-gray-100 placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Colors Section */}
            <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-6 space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-1.5 h-6 bg-primary/80 rounded-full"></div>
                <h3 className="text-base font-semibold text-gray-100">Brand Colors</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Color */}
                <div className="space-y-3">
                  <Label htmlFor="primary-color" className="text-sm font-medium text-gray-200">Primary Color</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Input
                          id="primary-color"
                          type="color"
                          value={formData.primary_color}
                          onChange={(e) => handleInputChange('primary_color', e.target.value)}
                          className="w-10 h-10 p-1 border-2 border-gray-600/60 rounded-lg cursor-pointer hover:border-primary/40 transition-colors bg-gray-700"
                        />
                        <div 
                          className="absolute inset-1 rounded-md border border-white/30 shadow-sm pointer-events-none"
                          style={{ backgroundColor: formData.primary_color }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={formData.primary_color}
                          onChange={(e) => handleInputChange('primary_color', e.target.value)}
                          placeholder="#84cc16"
                          className="font-mono text-sm h-10 bg-gray-700/50 border-gray-600/60 focus:border-primary/60 transition-all duration-200 text-gray-100 placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
                      <div 
                        className="w-3 h-3 rounded-full border-2 border-white/40 shadow-sm"
                        style={{ backgroundColor: formData.primary_color }}
                      />
                      <span className="text-xs text-gray-300">
                        Buttons & accents
                      </span>
                    </div>
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-3">
                  <Label htmlFor="secondary-color" className="text-sm font-medium text-gray-200">Secondary Color</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Input
                          id="secondary-color"
                          type="color"
                          value={formData.secondary_color}
                          onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                          className="w-10 h-10 p-1 border-2 border-gray-600/60 rounded-lg cursor-pointer hover:border-primary/40 transition-colors bg-gray-700"
                        />
                        <div 
                          className="absolute inset-1 rounded-md border border-white/30 shadow-sm pointer-events-none"
                          style={{ backgroundColor: formData.secondary_color }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={formData.secondary_color}
                          onChange={(e) => handleInputChange('secondary_color', e.target.value)}
                          placeholder="#65a30d"
                          className="font-mono text-sm h-10 bg-gray-700/50 border-gray-600/60 focus:border-primary/60 transition-all duration-200 text-gray-100 placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-gray-700/30 rounded-lg border border-gray-600/30">
                      <div 
                        className="w-3 h-3 rounded-full border-2 border-white/40 shadow-sm"
                        style={{ backgroundColor: formData.secondary_color }}
                      />
                      <span className="text-xs text-gray-300">
                        Secondary elements
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Save/Refresh Button */}
            <div className="pt-2">
              <Button 
                onClick={showRefresh ? handleRefreshPage : handleSaveSettings}
                disabled={isUpdating}
                size="default"
                style={{ 
                  backgroundColor: formData.primary_color,
                  borderColor: formData.primary_color
                }}
                className="w-full h-11 text-white font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : showRefresh ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page to Apply Changes
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column - PDF Preview */}
          <div className="space-y-4">
            {/* PDF Cover Page Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-200">PDF Cover Page Preview</Label>
              <div className="flex justify-center">
                <div 
                  className={`shadow-2xl border border-gray-600 relative overflow-hidden transition-all duration-300 ${
                    formData.theme_mode === 'dark' ? 'bg-[#20211f] text-white' : 'bg-white text-gray-900'
                  }`}
                  style={{
                    width: '280px',
                    height: '363px',
                    borderRadius: '4px'
                  }}
                >
                  {/* Logo in top left */}
                  <div className="absolute top-5 left-5 w-10 h-10 flex items-center justify-center">
                    {branding?.app_logo_url ? (
                      <img 
                        src={getAppBrandingLogoUrl(branding.app_logo_url)} 
                        alt="Logo preview" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`w-full h-full rounded flex items-center justify-center ${
                        formData.theme_mode === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                      }`}>
                        <Image className={`w-5 h-5 ${
                          formData.theme_mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`} />
                      </div>
                    )}
                  </div>
                  
                  {/* Accent line */}
                  <div 
                    className="absolute top-20 left-5 right-5 h-0.5"
                    style={{ backgroundColor: formData.primary_color || '#84cc16' }}
                  />
                  
                  {/* Title section - left aligned */}
                  <div className="absolute top-24 left-5 right-5">
                    <div className="text-left">
                      <div className={`text-sm font-bold mb-2 ${
                        formData.theme_mode === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>RUNBOOK</div>
                      <div className={`text-xs font-medium mb-1 ${
                        formData.theme_mode === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Sample Runbook Title</div>
                      <div className={`text-[9px] ${
                        formData.theme_mode === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>Client Name • Generated on {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  {/* Thick colored stripe at bottom - full width */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-4"
                    style={{ backgroundColor: formData.primary_color || '#84cc16' }}
                  />
                  
                  {/* Footer - left aligned, positioned above the stripe */}
                  <div className="absolute bottom-6 left-5 right-5">
                    <div className="text-left">
                      <div className={`text-[8px] ${
                        formData.theme_mode === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Generated by {formData.app_name || 'KELYN'} • Confidential
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Mode Toggle */}
            <div className="flex items-center justify-center space-x-3 p-2 bg-gray-800/50 border border-gray-600/50 rounded-lg max-w-[280px] mx-auto">
              <div className="flex items-center space-x-2">
                <Sun className={`h-4 w-4 transition-colors ${
                  formData.theme_mode === 'light' ? 'text-yellow-500' : 'text-gray-400'
                }`} />
                <span className={`text-sm transition-colors ${
                  formData.theme_mode === 'light' ? 'text-gray-100' : 'text-gray-400'
                }`}>Light</span>
              </div>
              
              <button
                type="button"
                onClick={() => handleInputChange('theme_mode', formData.theme_mode === 'dark' ? 'light' : 'dark')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  formData.theme_mode === 'dark' ? 'bg-primary' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.theme_mode === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              
              <div className="flex items-center space-x-2">
                <Moon className={`h-4 w-4 transition-colors ${
                  formData.theme_mode === 'dark' ? 'text-blue-400' : 'text-gray-400'
                }`} />
                <span className={`text-sm transition-colors ${
                  formData.theme_mode === 'dark' ? 'text-gray-100' : 'text-gray-400'
                }`}>Dark</span>
              </div>
            </div>
          </div>
          </div>
        </div>
        </div>
      </CardContent>
    </Card>
  );
} 