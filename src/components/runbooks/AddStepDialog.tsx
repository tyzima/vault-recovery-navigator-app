
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreateRunbookStepForm } from './CreateRunbookStepForm';

interface AddStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runbookId: string;
  clientId: string;
  onSuccess: () => void;
}

export function AddStepDialog({ open, onOpenChange, runbookId, clientId, onSuccess }: AddStepDialogProps) {
  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Step</DialogTitle>
        </DialogHeader>
        <CreateRunbookStepForm
          runbookId={runbookId}
          clientId={clientId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
