import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, Loader2 } from 'lucide-react';

interface StepPhotoUploadProps {
  stepId: string;
  onPhotoUploaded: (photoUrl: string) => void;
  className?: string;
}

export function StepPhotoUpload({ stepId, onPhotoUploaded, className }: StepPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('photo', file);

      // Get auth token from storage
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      // Upload to local server
      const response = await fetch(`http://localhost:3001/api/steps/${stepId}/photo`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      const photoUrl = `http://localhost:3001${result.photo_url}`;

      onPhotoUploaded(photoUrl);
      
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <>
      <Input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
        id={`photo-upload-${stepId}`}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => document.getElementById(`photo-upload-${stepId}`)?.click()}
        disabled={uploading}
        className={className || "h-9 w-full text-xs"}
      >
        {uploading ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Camera className="h-3 w-3 mr-1" />
        )}
        {uploading ? 'Uploading...' : 'Add Photo'}
      </Button>
    </>
  );
}
