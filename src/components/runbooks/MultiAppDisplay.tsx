
import React from 'react';
import { AppLogo } from './AppLogo';

interface MultiAppDisplayProps {
  appIds: string[];
  size?: 'sm' | 'md' | 'lg';
  showNames?: boolean;
  maxDisplay?: number;
  className?: string;
}

export function MultiAppDisplay({ 
  appIds, 
  size = 'sm', 
  showNames = false, 
  maxDisplay = 5,
  className = '' 
}: MultiAppDisplayProps) {
  if (!appIds || appIds.length === 0) {
    return null;
  }

  const visibleApps = appIds.slice(0, maxDisplay);
  const remainingCount = appIds.length - maxDisplay;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {visibleApps.map((appId) => (
        <AppLogo 
          key={appId} 
          appId={appId} 
          size={size} 
          showName={showNames && appIds.length === 1}
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
