import React, { useEffect, useState } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Profile } from '@/lib/database';

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      console.log('Fetching profile for user:', userId);
      const { data, error } = await fileClient
        .from('profiles')
        .select('*')
        .eq('id', userId);

      if (!error && data && data.length > 0) {
        console.log('Profile found:', data[0]);
        setProfile(data[0]);
      } else {
        console.log('Profile fetch error:', error);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [userId]);

  return { profile, loading };
}
