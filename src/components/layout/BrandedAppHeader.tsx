import React from 'react';
import { useAppBranding } from '@/hooks/useAppBranding';
import { useProfile } from '@/hooks/useProfile';
import { useClientInfo } from '@/hooks/useClientInfo';
import { useAuth } from '@/hooks/useAuth';
import { getAppBrandingLogoUrl } from '@/utils/urlUtils';
import { Image } from 'lucide-react';
import { useDynamicHeaderTextSize } from '@/hooks/useDynamicTextSize';

export function BrandedAppHeader() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { client } = useClientInfo(profile?.client_id);
  const { branding } = useAppBranding();

  const getSidebarTitle = () => {
    return branding?.app_name || 'KELYN';
  };

  const getLogoUrl = () => {
    // For client users, we could potentially use client logos in the future
    // For now, everyone uses the app branding logo
    return getAppBrandingLogoUrl(branding?.app_logo_url);
  };

  const getPrimaryColor = () => {
    return branding?.primary_color || '#84cc16';
  };

  const getSecondaryColor = () => {
    return branding?.secondary_color || '#65a30d';
  };

  const logoUrl = getLogoUrl();
  const title = getSidebarTitle();
  const isClientUser = profile?.role === 'client_admin' || profile?.role === 'client_member';
  const dynamicTextSize = useDynamicHeaderTextSize(title);

  return (
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 flex items-center justify-center overflow-hidden flex-shrink-0">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={`${title} Logo`} 
            className="w-full h-full object-contain" 
            onError={(e) => {
              // Fallback to a colored background with icon if image fails
              const target = e.target as HTMLImageElement;
              const fallbackDiv = document.createElement('div');
              fallbackDiv.className = 'w-8 h-8 flex items-center justify-center rounded';
              fallbackDiv.style.backgroundColor = getPrimaryColor();
              
              const icon = document.createElement('div');
              icon.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
              fallbackDiv.appendChild(icon.firstElementChild!);
              
              target.parentNode?.replaceChild(fallbackDiv, target);
            }}
          />
        ) : (
          <div 
            className="w-8 h-8 flex items-center justify-center rounded"
            style={{ backgroundColor: getPrimaryColor() }}
          >
            <Image className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      <span 
        className={`${dynamicTextSize} font-semibold uppercase text-sidebar-foreground whitespace-nowrap overflow-hidden ${
          isClientUser ? 'uppercase tracking-wider' : ''
        }`}
        style={{ 
          color: isClientUser ? undefined : getSecondaryColor()
        }}
        title={title} // Show full title on hover
      >
        {title}
      </span>
    </div>
  );
} 