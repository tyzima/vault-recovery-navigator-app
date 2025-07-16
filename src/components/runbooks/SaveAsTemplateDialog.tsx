
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useTemplates } from '@/hooks/useTemplates';
import { BookMarked } from 'lucide-react';

interface SaveAsTemplateFormData {
  template_name: string;
  template_description: string;
}

interface SaveAsTemplateDialogProps {
  runbookId: string;
  runbookTitle: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function SaveAsTemplateDialog({ 
  runbookId, 
  runbookTitle, 
  children, 
  onSuccess 
}: SaveAsTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { saveAsTemplate } = useTemplates();

  const form = useForm<SaveAsTemplateFormData>({
    defaultValues: {
      template_name: runbookTitle,
      template_description: '',
    },
  });

  const onSubmit = async (data: SaveAsTemplateFormData) => {
    setIsSubmitting(true);
    try {
      await saveAsTemplate(runbookId, data.template_name, data.template_description);
      
      toast({
        title: "Success",
        description: "Runbook saved as template successfully",
      });

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving as template:', error);
      toast({
        title: "Error",
        description: "Failed to save runbook as template",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <BookMarked className="h-4 w-4 mr-1" />
            Save Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="template_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter template name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe what this template is for and when to use it" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save as Template'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
