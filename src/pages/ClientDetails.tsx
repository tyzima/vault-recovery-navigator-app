
import React from 'react';
import { useParams } from 'react-router-dom';
import { ClientDetailsView } from '@/components/clients/ClientDetailsView';

export function ClientDetails() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Invalid Team</h2>
          <p className="text-muted-foreground mt-2">No team ID provided</p>
        </div>
      </div>
    );
  }

  return <ClientDetailsView clientId={id} />;
}
