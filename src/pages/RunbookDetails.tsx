
import React from 'react';
import { useParams } from 'react-router-dom';
import { RunbookDetailsView } from '@/components/runbooks/RunbookDetailsView';
import { WorkflowAnswersProvider } from '@/hooks/useWorkflowAnswers';

interface RunbookDetailsProps {
  onStepCreated?: () => void;
}

export function RunbookDetails({ onStepCreated }: RunbookDetailsProps) {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Invalid Runbook</h2>
          <p className="text-muted-foreground mt-2">No runbook ID provided</p>
        </div>
      </div>
    );
  }

  return (
    <WorkflowAnswersProvider runbookId={id}>
      <RunbookDetailsView 
        runbookId={id} 
        onStepCreated={onStepCreated} 
      />
    </WorkflowAnswersProvider>
  );
}
