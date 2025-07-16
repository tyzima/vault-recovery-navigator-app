import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Settings } from 'lucide-react';

interface TaskCondition {
  type: 'select_option' | 'checkbox' | 'radio';
  depends_on_step: string;
  depends_on_task?: string;
  show_when: string;
}

interface AvailableQuestion {
  stepId: string;
  stepTitle: string;
  stepOrder: number;
  taskId?: string;
  taskTitle?: string;
  questionId: string;
  question: string;
  options: string[];
}

interface TaskConditionsEditorProps {
  conditions: TaskCondition | null;
  onConditionsChange: (conditions: TaskCondition | null) => void;
  availableQuestions: AvailableQuestion[];
}

export function TaskConditionsEditor({
  conditions,
  onConditionsChange,
  availableQuestions
}: TaskConditionsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editConditions, setEditConditions] = useState<TaskCondition | null>(conditions);

  const handleSave = () => {
    onConditionsChange(editConditions);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditConditions(conditions);
    setIsEditing(false);
  };

  const createNewCondition = () => {
    setEditConditions({
      type: 'select_option',
      depends_on_step: '',
      show_when: ''
    });
    setIsEditing(true);
  };

  // Filter questions and ensure valid IDs
  const questionsWithOptions = availableQuestions.filter(question => 
    question.questionId && 
    question.stepId && 
    question.stepId.trim() !== '' &&
    question.options &&
    Array.isArray(question.options) &&
    question.options.length > 0
  );

  // Find the selected question based on step and task IDs stored in conditions
  const selectedQuestion = questionsWithOptions.find(question => {
    if (editConditions?.depends_on_task) {
      // If depends_on_task is set, match both step and task
      return question.stepId === editConditions.depends_on_step && 
             question.taskId === editConditions.depends_on_task;
    } else {
      // If no depends_on_task, match step and ensure it's not a task-level question
      return question.stepId === editConditions?.depends_on_step && !question.taskId;
    }
  });
  
  const availableOptions = selectedQuestion?.options?.filter(option => option && option.trim() !== '') || [];

  if (!isEditing && !conditions) {
    return (
      <>
        {questionsWithOptions.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            No questions available yet. Add questions to tasks or steps to create conditions.
          </div>
        ) : (
          <Button onClick={createNewCondition} variant="outline" size="sm" className="h-6 text-xs">
            <Settings className="h-2 w-2 mr-1" />
            Add Condition
          </Button>
        )}
      </>
    );
  }

  if (!isEditing && conditions) {
    const dependentQuestion = questionsWithOptions.find(question => {
      if (conditions.depends_on_task) {
        return question.stepId === conditions.depends_on_step && 
               question.taskId === conditions.depends_on_task;
      } else {
        return question.stepId === conditions.depends_on_step && !question.taskId;
      }
    });
    
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-amber-700">
              <div><strong>Depends on:</strong> Step {dependentQuestion?.stepOrder}</div>
              {dependentQuestion?.taskTitle && (
                <div><strong>Task:</strong> {dependentQuestion.taskTitle}</div>
              )}
              <div><strong>Show when:</strong> {conditions.show_when}</div>
            </div>
            <div className="flex gap-1">
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="h-6 text-xs">
                Edit
              </Button>
              <Button onClick={() => onConditionsChange(null)} variant="outline" size="sm" className="h-6 text-xs">
                Remove
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs">Task Condition</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Depends on Question</Label>
          <Select
            value={
              editConditions?.depends_on_step && editConditions?.depends_on_task
                ? `${editConditions.depends_on_step}-${editConditions.depends_on_task}`
                : editConditions?.depends_on_step && !editConditions?.depends_on_task
                ? `${editConditions.depends_on_step}-step`
                : "no-question"
            }
            onValueChange={(value) => {
              if (value === "no-question") {
                setEditConditions(prev => prev ? { 
                  ...prev, 
                  depends_on_step: '', 
                  depends_on_task: undefined,
                  show_when: '' 
                } : null);
              } else {
                const [stepId, identifier] = value.split('-');
                if (identifier === 'step') {
                  // Step-level question
                  setEditConditions(prev => prev ? { 
                    ...prev, 
                    depends_on_step: stepId, 
                    depends_on_task: undefined,
                    show_when: '' 
                  } : null);
                } else {
                  // Task-level question
                  setEditConditions(prev => prev ? { 
                    ...prev, 
                    depends_on_step: stepId, 
                    depends_on_task: identifier,
                    show_when: '' 
                  } : null);
                }
              }
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select question" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-question">Select question...</SelectItem>
              {questionsWithOptions.map((question) => (
                <SelectItem 
                  key={`${question.stepId}-${question.taskId || 'step'}`} 
                  value={`${question.stepId}-${question.taskId || 'step'}`}
                >
                  <div className="text-left">
                    <div className="font-medium">Step {question.stepOrder}: {question.stepTitle}</div>
                    {question.taskTitle && <div className="text-xs text-gray-500">Task: {question.taskTitle}</div>}
                    <div className="text-xs text-blue-600">"{question.question}"</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedQuestion && availableOptions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Show when answer is</Label>
            <Select
              value={editConditions?.show_when || "no-option"}
              onValueChange={(value) => setEditConditions(prev => prev ? { 
                ...prev, 
                show_when: value === "no-option" ? '' : value 
              } : null)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-option">Select option...</SelectItem>
                {availableOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} size="sm" className="h-7 text-xs">
            Save
          </Button>
          <Button onClick={handleCancel} variant="outline" size="sm" className="h-7 text-xs">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
