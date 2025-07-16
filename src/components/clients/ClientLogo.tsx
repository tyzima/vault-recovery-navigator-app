import React from 'react';
import { Building2 } from 'lucide-react';

interface ClientLogoProps {
  logoUrl?: string | null;
  clientName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showFallback?: boolean;
  logoColor?: string; // Optional color for library logos
}

export function ClientLogo({ 
  logoUrl, 
  clientName, 
  size = 'md', 
  className = '',
  showFallback = true,
  logoColor
}: ClientLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  if (!logoUrl && !showFallback) {
    return null;
  }

  if (!logoUrl) {
    return (
      <div className={`${sizeClasses[size]} bg-muted rounded flex items-center justify-center ${className}`}>
        <Building2 className={`${iconSizeClasses[size]} text-muted-foreground`} />
      </div>
    );
  }

  // Check if this is a library logo that supports coloring
  const isLibraryLogo = logoUrl.includes('/data/uploads/saved-client-logos/') || logoUrl.includes('/colored-logos/');

  return (
    <div className={`${sizeClasses[size]} relative ${className}`}>
      <img 
        src={logoUrl} 
        alt={`${clientName} logo`} 
        className={`${sizeClasses[size]} object-contain rounded`}
        onError={(e) => {
          if (showFallback) {
            const target = e.target as HTMLImageElement;
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = `${sizeClasses[size]} bg-muted rounded flex items-center justify-center ${className}`;
            
            const icon = document.createElement('div');
            icon.innerHTML = `<svg class="${iconSizeClasses[size]} text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`;
            fallbackDiv.appendChild(icon.firstElementChild!);
            
            target.parentNode?.replaceChild(fallbackDiv, target);
          } else {
            (e.target as HTMLImageElement).style.display = 'none';
          }
        }}
      />
      
      {/* Color overlay for library logos if color is specified */}
      {isLibraryLogo && logoColor && (
        <div 
          className={`absolute inset-0 ${sizeClasses[size]} rounded pointer-events-none`}
          style={{
            backgroundColor: logoColor,
            mixBlendMode: 'multiply',
            WebkitMask: `url(${logoUrl}) no-repeat center`,
            WebkitMaskSize: 'contain',
            mask: `url(${logoUrl}) no-repeat center`,
            maskSize: 'contain'
          }}
        />
      )}
    </div>
  );
}
