import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fileClient } from '@/lib/fileClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Mail, Phone, MapPin, Palette, ArrowRight, Check, UsersRound  } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClientLogoLibrary } from './ClientLogoLibrary';
import { ClientLogoUpload } from './ClientLogoUpload';

interface CreateClientFormProps {
  onClientCreated?: (client: any) => void;
  onCancel?: () => void;
}

export function CreateClientForm({ onClientCreated, onCancel }: CreateClientFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [createdClient, setCreatedClient] = useState<any>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Team name is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const newClient = {
        id: crypto.randomUUID(),
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        logo_url: null
      };

      const result = await fileClient
        .from('clients')
        .insert(newClient);

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: 'Success',
        description: 'Team created successfully'
      });

      setCreatedClient(result.data);
      setStep(2);
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: 'Error',
        description: 'Failed to create team',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoSelected = (logoUrl: string) => {
    const updatedClient = { ...createdClient, logo_url: logoUrl };
    setCreatedClient(updatedClient);
  };

  const handleLogoUpdated = (logoUrl: string | null) => {
    const updatedClient = { ...createdClient, logo_url: logoUrl };
    setCreatedClient(updatedClient);
  };

  const handleFinishWithLogo = () => {
    finishClientCreation();
  };

  const finishClientCreation = () => {
    onClientCreated?.(createdClient);
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      contact_email: '',
      contact_phone: '',
      address: ''
    });
    setStep(1);
    setCreatedClient(null);
  };

  return (
    <Card className="w-full border-none shadow-none max-w-2xl mx-auto">
      <CardHeader className="pt-0 mt-0">
        <CardTitle className="flex mb-2 pt-0 mt-0 items-center ">
          {step === 1 ? (
            <>
              <UsersRound className="h-5 w-5 mr-2" />
              <span> Create New Team</span>
            </>
          ) : (
            <>
              <Palette className="h-5 w-5" />
              <span>Choose Team Logo</span>
            </>
          )}
        </CardTitle>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <div className={`flex items-center space-x-1 ${step >= 1 ? 'text-primary' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <span>Details</span>
          </div>
          <ArrowRight className="h-3 w-3" />
          <div className={`flex items-center space-x-1 ${step >= 2 ? 'text-primary' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <span>Logo</span>
          </div>
        </div>
      </CardHeader>



      <CardContent>
        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter team name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of the team"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email" className="flex items-center space-x-1">
                  <Mail className="h-4 w-4" />
                  <span>Contact Email</span>
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                  placeholder="contact@team.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone" className="flex items-center space-x-1">
                  <Phone className="h-4 w-4" />
                  <span>Contact Phone</span>
                </Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>Address</span>
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Team address"
                rows={2}
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create Team'}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Team "{createdClient?.name}" Created!</h3>
              <p className="text-muted-foreground">
                Now let's add a logo to make your team stand out.
              </p>
            </div>

            <div className="flex flex-col items-center space-y-6">
              <div className="w-full max-w-sm">
                <ClientLogoUpload
                  clientId={createdClient?.id}
                  currentLogoUrl={createdClient?.logo_url}
                  onLogoUpdated={handleLogoUpdated}
                  canEdit={true}
                />
              </div>

              <Button onClick={handleFinishWithLogo}>
                <Check className="h-4 w-4 mr-2" />
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
