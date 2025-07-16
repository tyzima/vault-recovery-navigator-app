import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { fileClient } from '@/lib/fileClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Runbook, Client, Profile } from '@/lib/database';
import { BookOpen, FileText, Building2, AlertTriangle, Shield } from 'lucide-react';
import { canCreateRunbook, getRunbookUsage } from '@/lib/licensing';

interface CreateRunbookFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateRunbookForm({ onSuccess, onCancel }: CreateRunbookFormProps) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [canCreate, setCanCreate] = useState(true);
  const [usage, setUsage] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
  });

  useEffect(() => {
    const fetchClients = async () => {
      const response = await fileClient
        .from('clients')
        .select('*')
        .execute();

      if (!response.error && response.data) {
        // Sort clients by name
        const sortedClients = response.data.sort((a, b) => a.name.localeCompare(b.name));
        setClients(sortedClients);
      }
    };

    const checkLicense = async () => {
      if (user) {
        const allowed = await canCreateRunbook(user.id);
        setCanCreate(allowed);
        
        const usageInfo = await getRunbookUsage(user.id);
        setUsage(usageInfo);
      }
    };

    fetchClients();
    checkLicense();
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Check license before proceeding
    const allowed = await canCreateRunbook(user.id);
    if (!allowed) {
      toast({
        title: 'License Limit Reached',
        description: 'You have reached the maximum number of runbooks allowed by your license. Please contact your administrator.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Runbook title is required',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.client_id) {
      toast({
        title: 'Error',
        description: 'Please select a client',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newRunbook = {
        id: crypto.randomUUID(),
        ...formData,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response = await fileClient
        .from('runbooks')
        .insert(newRunbook);

      if (response.error) throw new Error(response.error.message);

      toast({
        title: "Success",
        description: "Runbook created successfully",
      });

      // Reset form and refresh license info
      setFormData({
        title: '',
        description: '',
        client_id: '',
      });
      
      // Refresh license usage
      if (user) {
        const usageInfo = await getRunbookUsage(user.id);
        setUsage(usageInfo);
        setCanCreate(await canCreateRunbook(user.id));
      }
      
      onSuccess?.();
    } catch (error) {
      console.error('Error creating runbook:', error);
      toast({
        title: "Error",
        description: "Failed to create runbook",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5" />
          <span>
            Create New Runbook
          </span>
        </CardTitle>
        <CardDescription>Create a new runbook</CardDescription>
      </CardHeader>
      <CardContent>
        {/* License Status Display */}
        {usage && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">License Usage</span>
              </div>
              <span className="text-sm text-gray-600">
                {usage.current_count} of {usage.max_allowed} runbooks used
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  usage.remaining === 0 ? 'bg-red-500' : 
                  usage.remaining <= 2 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (usage.current_count / usage.max_allowed) * 100)}%` 
                }}
              />
            </div>
            {usage.remaining === 0 && (
              <div className="mt-2 flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">License limit reached - cannot create more runbooks</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center space-x-1">
              <FileText className="h-4 w-4" />
              <span>What is this runbook about? *</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter runbook title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter runbook description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id" className="flex items-center space-x-1">
              <Building2 className="h-4 w-4" />
              <span>Team *</span>
            </Label>
            <Select value={formData.client_id} onValueChange={(value) => handleChange('client_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={isSubmitting || !canCreate} className="flex-1">
              {isSubmitting ? 'Creating...' : 'Create Runbook'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
