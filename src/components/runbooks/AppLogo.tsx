import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { getAppLogoUrl } from '@/utils/urlUtils';
import { useDynamicSmallTextSize } from '@/hooks/useDynamicTextSize';

interface App {
  id: string;
  name: string;
  logo_url: string;
}

interface AppLogoProps {
  appId: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export function AppLogo({ appId, size = 'sm', showName = false, className = '' }: AppLogoProps) {
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApp = async () => {
      try {
        const { data: apps, error } = await fileClient.from('apps').select('*').execute();
        if (error) {
          console.error('Error fetching apps:', error);
          setApp(null);
        } else {
          const foundApp = apps.find(app => app.id === appId);
          setApp(foundApp || null);
        }
      } catch (error) {
        console.error('Error fetching app:', error);
        setApp(null);
      }
      setLoading(false);
    };

    if (appId) {
      fetchApp();
    } else {
      setLoading(false);
    }
  }, [appId]);

  const dynamicTextSize = useDynamicSmallTextSize(app?.name || '');

  if (loading) {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8';
    return <div className={`${sizeClass} bg-gray-200 animate-pulse rounded ${className}`}></div>;
  }

  if (!app) {
    return null;
  }

  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={getAppLogoUrl(app.logo_url)} 
        alt={app.name} 
        className={`${sizeClass} object-contain flex-shrink-0`}
        onError={(e) => {
          // Hide image if it fails to load
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {showName && (
        <span 
          className={`${dynamicTextSize} font-medium whitespace-nowrap overflow-hidden`}
          title={app.name} // Show full name on hover
        >
          {app.name}
        </span>
      )}
    </div>
  );
}
