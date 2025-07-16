import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fileClient } from '@/lib/fileClient';
import { Client } from '@/lib/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Users, Phone, Mail, ChevronRight } from 'lucide-react';
import { ClientLogo } from './ClientLogo';
import { getClientLogoUrl } from '@/utils/urlUtils';

interface ClientsListProps {
  onClientSelect?: (client: Client) => void;
  refreshKey?: number;
}

export function ClientsList({ onClientSelect, refreshKey }: ClientsListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
  }, [refreshKey]);

  const fetchClients = async () => {
    try {
      const result = await fileClient.from('clients').select('*').execute();
      
      if (result.error) {
        console.error('Error fetching clients:', result.error);
        return;
      }

      const clientsData = result.data || [];
      // Sort by created_at descending
      clientsData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (client: Client) => {
    if (onClientSelect) {
      onClientSelect(client);
    } else {
      // Navigate to client details page
      navigate(`/clients/${client.id}`);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="grid grid-cols-1 gap-4  max-w-7xl mx-auto">
        {clients.length === 0 ? (
          <div className="col-span-full text-left py-8 text-muted-foreground">
            No teams found. Create your first team to get started.
          </div>
        ) : (
          clients.map((client, index) => (
            <Card 
              key={client.id} 
              className="hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-muted/30"
              onClick={() => handleViewDetails(client)}
              style={{ 
                opacity: 0,
                animation: `fadeIn 0.8s ease-out ${index * 80}ms forwards`
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-3">
                  <ClientLogo 
                    logoUrl={getClientLogoUrl(client.logo_url)} 
                    clientName={client.name} 
                    size="md"
                  />
                  <CardTitle className="text-xl text-left">{client.name}</CardTitle>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {client.description && (
                  <p className="text-[9px] text-muted-foreground mb-5 text-left">
                    {client.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm">
                  {client.contact_email && (
                    <div className="flex items-center space-x-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-left">{client.contact_email}</span>
                    </div>
                  )}
                  
                  {client.contact_phone && (
                    <div className="flex items-center space-x-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-left">{client.contact_phone}</span>
                    </div>
                  )}
                  
                  {client.address && (
                    <div className="flex items-center space-x-1">
                      <span className="text-left">{client.address}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Badge variant="secondary">
                      Created {new Date(client.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}