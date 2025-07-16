import React, { useEffect, useState } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Client } from '@/lib/database';

export function useClientInfo(clientId?: string) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    const fetchClient = async () => {
      console.log('Fetching client info for:', clientId);
      const { data, error } = await fileClient
        .from('clients')
        .select('*')
        .eq('id', clientId);

      if (!error && data && data.length > 0) {
        console.log('Client found:', data[0]);
        setClient(data[0]);
      } else {
        console.log('Client fetch error:', error);
      }
      setLoading(false);
    };

    fetchClient();
  }, [clientId]);

  return { client, loading };
}
