
import React, { useState } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { Save, X } from 'lucide-react';
import { UserSelector } from './UserSelector';

interface CreateRunbookStepFormData {
  title: string;
  description: string;
  estimated_duration_minutes: number | null;
  assigned_to: string | null;
}

interface CreateRunbookStepFormProps {
  runbookId: string;
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateRunbookStepForm({ runbookId, clientId, onSuccess, onCancel }: CreateRunbookStepFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateRunbookStepFormData>({
    defaultValues: {
      title: '',
      description: '',
      estimated_duration_minutes: null,
      assigned_to: null,
    },
  });

  const onSubmit = async (data: CreateRunbookStepFormData) => {
    setIsSubmitting(true);
    try {
      // Get the next step order
      const maxOrderResponse = await fileClient
        .from('runbook_steps')
        .select('step_order')
        .eq('runbook_id', runbookId);

      const existingSteps = maxOrderResponse.data || [];
      const nextOrder = existingSteps.length > 0 
        ? Math.max(...existingSteps.map(step => step.step_order)) + 1 
        : 1;

      const response = await fileClient
        .from('runbook_steps')
        .insert({
          id: crypto.randomUUID(),
          ...data,
          runbook_id: runbookId,
          step_order: nextOrder,
          estimated_duration_minutes: data.estimated_duration_minutes || null,
          assigned_to: data.assigned_to || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: "Success",
        description: "Runbook step created successfully",
      });

      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating runbook step:', error);
      toast({
        title: "Error",
        description: "Failed to create runbook step",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Step Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter step title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter step description and instructions" 
                  rows={4}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="estimated_duration_minutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated Duration (minutes)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="Enter estimated duration" 
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="assigned_to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assign to User</FormLabel>
              <FormControl>
                <UserSelector
                  clientId={clientId}
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  placeholder="Select a user to assign this step to..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex space-x-2">
          <Button type="submit" disabled={isSubmitting} className="bg-slate-500 hover:bg-slate-600">
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating...' : 'Create Step'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
