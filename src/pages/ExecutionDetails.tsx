
import React from 'react';
import { useParams } from 'react-router-dom';
import { ExecutionDetailsView } from '@/components/executions/ExecutionDetailsView';
import { WorkflowAnswersProvider } from '@/hooks/useWorkflowAnswers';

export function ExecutionDetails() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Invalid Execution</h2>
          <p className="text-muted-foreground mt-2">No execution ID provided</p>
        </div>
      </div>
    );
  }

  return (
    <WorkflowAnswersProvider runbookId={id}>
      <ExecutionDetailsView executionId={id} />
    </WorkflowAnswersProvider>
  );
}
