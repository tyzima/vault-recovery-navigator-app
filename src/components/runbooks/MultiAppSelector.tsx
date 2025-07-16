
import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AppLogo } from './AppLogo';
import { getAppLogoUrl } from '@/utils/urlUtils';

interface App {
  id: string;
  name: string;
  logo_url: string;
}

interface MultiAppSelectorProps {
  selectedAppIds: string[];
  onAppsChange: (appIds: string[]) => void;
  placeholder?: string;
}

export function MultiAppSelector({ selectedAppIds, onAppsChange, placeholder = "Add Apps" }: MultiAppSelectorProps) {
  const [availableApps, setAvailableApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const { data, error } = await fileClient
          .from('apps')
          .select('*')
          .execute();

        if (error) {
          console.error('Error fetching apps:', error);
          setAvailableApps([]);
        } else {
          // Sort by name
          const sortedApps = (data || []).sort((a, b) => a.name.localeCompare(b.name));
          setAvailableApps(sortedApps);
        }
      } catch (error) {
        console.error('Error fetching apps:', error);
        setAvailableApps([]);
      }
      setLoading(false);
    };

    fetchApps();
  }, []);

  const handleAppToggle = (appId: string, checked: boolean) => {
    if (checked) {
      onAppsChange([...selectedAppIds, appId]);
    } else {
      onAppsChange(selectedAppIds.filter(id => id !== appId));
    }
  };

  const getDisplayContent = () => {
    if (selectedAppIds.length === 0) {
      return placeholder;
    }
    
    if (selectedAppIds.length <= 3) {
      return (
        <div className="flex items-center gap-1.5">
          {selectedAppIds.map((appId) => (
            <AppLogo key={appId} appId={appId} size="sm" />
          ))}
          {selectedAppIds.length === 1 && (
            <span className="text-sm ml-1 truncate">
              {availableApps.find(app => app.id === selectedAppIds[0])?.name}
            </span>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1.5">
        {selectedAppIds.slice(0, 2).map((appId) => (
          <AppLogo key={appId} appId={appId} size="sm" />
        ))}
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          +{selectedAppIds.length - 2}
        </span>
      </div>
    );
  };

  if (loading) {
    return <div className="w-full h-9 bg-gray-200 animate-pulse rounded"></div>;
  }

  return (
    <Select open={isOpen} onOpenChange={setIsOpen}>
      <SelectTrigger className="w-full h-9">
        <div className="flex-1 min-w-0">
          {selectedAppIds.length === 0 ? (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          ) : (
            getDisplayContent()
          )}
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-60 z-50 bg-white">
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Select apps for this step:
          </div>
          {availableApps.map((app) => (
            <div key={app.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm">
              <Checkbox
                id={`app-${app.id}`}
                checked={selectedAppIds.includes(app.id)}
                onCheckedChange={(checked) => handleAppToggle(app.id, checked as boolean)}
              />
              <label 
                htmlFor={`app-${app.id}`} 
                className="flex items-center gap-2 text-sm cursor-pointer flex-1"
              >
                <img src={getAppLogoUrl(app.logo_url)} alt={app.name} className="w-4 h-4 object-contain" />
                <span>{app.name}</span>
              </label>
            </div>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}
