
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, X } from 'lucide-react';
import { ConditionDialog } from './ConditionDialog';
import { WorkflowCondition } from '@/types/workflow';

interface ConditionButtonProps {
  condition: WorkflowCondition | null;
  onConditionChange: (condition: WorkflowCondition | null) => void;
  availableQuestions: Array<{
    taskId: string;
    stepId: string;
    stepOrder: number;
    taskTitle: string;
    question: string;
    options: string[];
  }>;
  size?: 'sm' | 'default';
}

export function ConditionButton({ 
  condition, 
  onConditionChange, 
  availableQuestions,
  size = 'sm' 
}: ConditionButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (condition) {
    const sourceQuestion = availableQuestions.find(q => 
      q.taskId === condition.dependsOnTaskId && 
      q.stepId === condition.dependsOnStepId
    );

    return (
      <div className="flex items-center gap-1">
        <Badge 
          variant="outline" 
          className="text-xs bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100"
          onClick={() => setIsDialogOpen(true)}
        >
          <GitBranch className="h-2 w-2 mr-1" />
          {sourceQuestion ? `Step ${sourceQuestion.stepOrder}` : 'Conditional'}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onConditionChange(null)}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-2 w-2" />
        </Button>
        
        <ConditionDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          condition={condition}
          onConditionChange={onConditionChange}
          availableQuestions={availableQuestions}
        />
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setIsDialogOpen(true)}
        className="h-6 text-xs text-muted-foreground border-dashed"
        disabled={availableQuestions.length === 0}
      >
        <GitBranch className="h-2 w-2 mr-1" />
        Add Condition
      </Button>
      
      <ConditionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        condition={null}
        onConditionChange={onConditionChange}
        availableQuestions={availableQuestions}
      />
    </>
  );
}
