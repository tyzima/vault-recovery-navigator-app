import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, X, Clock, User } from 'lucide-react';
import { fileClient } from '@/lib/fileClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { UserSelector } from './UserSelector';

interface InlineStepEditorProps {
  runbookId: string;
  clientId: string;
  stepOrder: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function InlineStepEditor({ runbookId, clientId, stepOrder, onSuccess, onCancel }: InlineStepEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const canAssignUsers = () => {
    if (!profile) return false;
    return profile.role === 'kelyn_admin' || profile.role === 'client_admin';
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Step title is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('InlineStepEditor: Creating new step');
      
      const stepData = {
        title: title.trim(),
        description: description.trim() || null,
        estimated_duration_minutes: estimatedDuration,
        assigned_to: assignedTo,
        runbook_id: runbookId,
        step_order: stepOrder,
        tasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await fileClient
        .from('runbook_steps')
        .insert(stepData);

      console.log('InlineStepEditor: Insert result:', result);

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: "Success",
        description: "Step created successfully",
      });

      onSuccess();
    } catch (error) {
      console.error('InlineStepEditor: Error creating step:', error);
      toast({
        title: "Error",
        description: "Failed to create step",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="shrink-0">
            Step {stepOrder}
          </Badge>
          <CardTitle className="text-lg text-left text-muted-foreground">
            New Step
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <Input
              placeholder="Enter step title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-left font-medium"
              autoFocus
            />
          </div>
          
          <div>
            <Textarea
              placeholder="Enter step description and instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-left"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Duration (minutes)</span>
              </div>
              <Input
                type="number"
                placeholder="Optional"
                value={estimatedDuration || ''}
                onChange={(e) => setEstimatedDuration(e.target.value ? parseInt(e.target.value) : null)}
                className="text-left"
              />
            </div>

            {canAssignUsers() && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Assign to</span>
                </div>
                <UserSelector
                  clientId={clientId}
                  value={assignedTo || undefined}
                  onValueChange={(userId) => setAssignedTo(userId || null)}
                  placeholder="Select user..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button 
            onClick={handleSave} 
            disabled={isSubmitting || !title.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating...' : 'Create Step'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
