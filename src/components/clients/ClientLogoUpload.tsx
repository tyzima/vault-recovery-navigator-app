import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';
import { ClientLogoLibrary } from './ClientLogoLibrary';

interface ClientLogoUploadProps {
  clientId: string;
  currentLogoUrl?: string | null;
  onLogoUpdated: (logoUrl: string | null) => void;
  canEdit: boolean;
}

export function ClientLogoUpload({ clientId, currentLogoUrl, onLogoUpdated, canEdit }: ClientLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, GIF, or WebP image",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('logo', file);

      // Get auth token from storage
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      // Upload to local server
      const response = await fetch(`http://localhost:3001/api/clients/${clientId}/logo`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      const logoUrl = `http://localhost:3001${result.logo_url}`;

      onLogoUpdated(logoUrl);
      toast({
        title: "Success",
        description: "Team logo updated successfully"
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred while uploading the logo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setRemoving(true);

    try {
      // Get auth token from storage
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      // Remove from local server
      const response = await fetch(`http://localhost:3001/api/clients/${clientId}/logo`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Remove failed');
      }

      onLogoUpdated(null);
      toast({
        title: "Success",
        description: "Team logo removed successfully"
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred while removing the logo",
        variant: "destructive"
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-left block mb-1 text-xs text-muted-foreground">Team Logo</Label>
      
      <div className="flex items-start gap-4">
        {/* Left column - Logo */}
        <div className="flex-shrink-0">
          {currentLogoUrl ? (
            <img 
              src={currentLogoUrl} 
              alt="Team logo" 
              className="w-20 h-20 object-contain rounded border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No logo</span>
            </div>
          )}
        </div>

        {/* Right column - Controls */}
        {canEdit && (
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileUpload}
                disabled={uploading}
                className="text-xs flex-1"
                id={`logo-upload-${clientId}`}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            
            <div className="flex justify-between items-center">
              <ClientLogoLibrary
                clientId={clientId}
                onLogoSelected={onLogoUpdated}
                canEdit={canEdit}
              />
              {currentLogoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={removing}
                  className="text-xs px-2 py-1 h-auto"
                >
                  {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {!currentLogoUrl && !canEdit && (
        <p className="text-xs text-muted-foreground">No logo uploaded</p>
      )}
    </div>
  );
}
