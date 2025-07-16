import React, { useState } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StepEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stepId: string;
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
  onUpdate: (updates: { title?: string; description?: string; estimated_duration_minutes?: number }) => void;
}

export function StepEditDialog({
  isOpen,
  onClose,
  stepId,
  title,
  description,
  estimatedDurationMinutes,
  onUpdate
}: StepEditDialogProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || '');
  const [editDuration, setEditDuration] = useState(estimatedDurationMinutes?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setEditTitle(title);
      setEditDescription(description || '');
      setEditDuration(estimatedDurationMinutes?.toString() || '');
    }
  }, [isOpen, title, description, estimatedDurationMinutes]);

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast({
        title: "Error",
        description: "Step title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      console.log('StepEditDialog: Updating step', stepId);
      
      const updates = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        estimated_duration_minutes: editDuration ? parseInt(editDuration) : null,
        updated_at: new Date().toISOString()
      };

      const result = await fileClient
        .from('runbook_steps')
        .update(updates)
        .eq('id', stepId);

      console.log('StepEditDialog: Update result:', result);

      if (result.error) {
        throw new Error(result.error.message);
      }

      onUpdate(updates);
      onClose();
      toast({
        title: "Success",
        description: "Step details updated successfully",
      });
    } catch (error) {
      console.error('StepEditDialog: Error updating step:', error);
      toast({
        title: "Error",
        description: "Failed to update step details",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(title);
    setEditDescription(description || '');
    setEditDuration(estimatedDurationMinutes?.toString() || '');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Step Details</DialogTitle>
          <DialogDescription>
            Update the step title, description, and estimated duration.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Step title"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Step description (optional)"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="duration" className="text-sm font-medium">
              Estimated Duration (minutes)
            </label>
            <Input
              id="duration"
              type="number"
              value={editDuration}
              onChange={(e) => setEditDuration(e.target.value)}
              placeholder="Duration in minutes (optional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
