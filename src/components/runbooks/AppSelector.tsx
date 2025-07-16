
import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAppLogoUrl } from '@/utils/urlUtils';

interface App {
  id: string;
  name: string;
  logo_url: string;
}

interface AppSelectorProps {
  value?: string;
  onValueChange: (appId: string | undefined) => void;
  placeholder?: string;
}

export function AppSelector({ value, onValueChange, placeholder = "Select app..." }: AppSelectorProps) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const { data, error } = await fileClient
          .from('apps')
          .select('*')
          .execute();

        if (error) {
          console.error('Error fetching apps:', error);
          setApps([]);
        } else {
          // Sort by name
          const sortedApps = (data || []).sort((a, b) => a.name.localeCompare(b.name));
          setApps(sortedApps);
        }
      } catch (error) {
        console.error('Error fetching apps:', error);
        setApps([]);
      }
      setLoading(false);
    };

    fetchApps();
  }, []);

  if (loading) {
    return <div className="w-32 h-8 bg-gray-200 animate-pulse rounded"></div>;
  }

  const handleValueChange = (val: string) => {
    if (val === "no-app") {
      onValueChange(undefined);
    } else {
      onValueChange(val);
    }
  };

  return (
    <Select value={value || "no-app"} onValueChange={handleValueChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="no-app">No app</SelectItem>
        {apps.map((app) => (
          <SelectItem key={app.id} value={app.id}>
            <div className="flex items-center gap-2">
              <img src={getAppLogoUrl(app.logo_url)} alt={app.name} className="w-4 h-4 object-contain" />
              <span>{app.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
