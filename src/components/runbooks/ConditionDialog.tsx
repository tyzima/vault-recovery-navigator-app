
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkflowCondition } from '@/types/workflow';

interface ConditionDialogProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export function ConditionDialog({
  isOpen,
  onClose,
  condition,
  onConditionChange,
  availableQuestions
}: ConditionDialogProps) {
  const [selectedQuestion, setSelectedQuestion] = useState(
    condition ? `${condition.dependsOnStepId}-${condition.dependsOnTaskId}` : ''
  );
  const [selectedAnswer, setSelectedAnswer] = useState(condition?.showWhen || '');

  const handleSave = () => {
    if (!selectedQuestion || !selectedAnswer) return;

    const [stepId, taskId] = selectedQuestion.split('-');
    const question = availableQuestions.find(q => q.stepId === stepId && q.taskId === taskId);
    
    if (!question) return;

    const newCondition: WorkflowCondition = {
      id: condition?.id || crypto.randomUUID(),
      dependsOnTaskId: taskId,
      dependsOnStepId: stepId,
      questionType: 'select', // We'll determine this from the question
      showWhen: selectedAnswer
    };

    onConditionChange(newCondition);
    onClose();
  };

  const selectedQuestionData = availableQuestions.find(q => 
    `${q.stepId}-${q.taskId}` === selectedQuestion
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Condition</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Show this when...</Label>
            <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
              <SelectTrigger>
                <SelectValue placeholder="Select a question" />
              </SelectTrigger>
              <SelectContent>
                {availableQuestions.map((q) => (
                  <SelectItem key={`${q.stepId}-${q.taskId}`} value={`${q.stepId}-${q.taskId}`}>
                    Step {q.stepOrder}: {q.taskTitle} - {q.question}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedQuestionData && (
            <div className="space-y-2">
              <Label>Answer is...</Label>
              <Select value={selectedAnswer} onValueChange={setSelectedAnswer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an answer" />
                </SelectTrigger>
                <SelectContent>
                  {selectedQuestionData.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={!selectedQuestion || !selectedAnswer}>
              Save Condition
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
