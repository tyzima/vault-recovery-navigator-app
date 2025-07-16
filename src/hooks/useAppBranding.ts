import { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';

interface AppBranding {
  id: string;
  app_name: string;
  app_logo_url: string;
  primary_color: string;
  secondary_color: string;
  theme_mode: 'dark' | 'light';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export function useAppBranding() {
  const [branding, setBranding] = useState<AppBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const { data, error } = await fileClient.from('app_branding').select('*').execute();
      
      if (error) {
        setError('Failed to load app branding');
        console.error('Error fetching app branding:', error);
      } else {
        // Get the default branding or the first one
        const defaultBranding = data?.find((b: AppBranding) => b.id === 'default') || data?.[0];
        setBranding(defaultBranding || null);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load app branding');
      console.error('Error fetching app branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateBranding = async (updates: Partial<AppBranding>) => {
    if (!branding) return { error: 'No branding data to update' };

    try {
      const updatedBranding = {
        ...branding,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { error } = await fileClient.from('app_branding').update(updatedBranding).eq('id', branding.id);
      
      if (error) {
        return { error: 'Failed to update branding' };
      }

      setBranding(updatedBranding);
      return { error: null };
    } catch (err) {
      console.error('Error updating branding:', err);
      return { error: 'Failed to update branding' };
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', 'general');

      // Debug logging
      console.log('Uploading logo with directory: general');
      console.log('FormData entries:');
      for (const [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }

      // Get auth token from storage
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload logo: ${errorText}`);
      }

      const result = await response.json();
      // Store the relative URL, not the full URL
      console.log('Upload result:', result);
      console.log('Expected directory: general, actual URL:', result.url);
      return { url: result.url, error: null };
    } catch (err) {
      console.error('Error uploading logo:', err);
      return { url: null, error: err.message || 'Failed to upload logo' };
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return {
    branding,
    loading,
    error,
    updateBranding,
    uploadLogo,
    refetch: fetchBranding
  };
} 