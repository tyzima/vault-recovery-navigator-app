
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Eye, EyeOff } from 'lucide-react';
import { VisibilityRule } from '@/hooks/useWorkflowAnswers';

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

interface VisibilityRuleEditorProps {
  rules: VisibilityRule[];
  onRulesChange: (rules: VisibilityRule[]) => void;
  availableQuestions: AvailableQuestion[];
  targetType: 'step' | 'task';
  autoExpand?: boolean;
  onCancel?: () => void;
}

export function VisibilityRuleEditor({ 
  rules, 
  onRulesChange, 
  availableQuestions,
  targetType,
  autoExpand = false,
  onCancel
}: VisibilityRuleEditorProps) {
  const [isAdding, setIsAdding] = useState((autoExpand || rules.length === 0) && availableQuestions.length > 0);
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');

  const addRule = () => {
    if (!selectedQuestion || !selectedAnswer) return;
    
    const question = availableQuestions.find(q => 
      `${q.stepId}-${q.questionId}-${q.taskId || ''}` === selectedQuestion
    );
    
    if (!question) return;

    const newRule: VisibilityRule = {
      id: crypto.randomUUID(),
      stepId: question.stepId,
      taskId: question.taskId,
      questionId: question.questionId,
      requiredAnswer: selectedAnswer,
      description: `Show when "${question.question}" = "${selectedAnswer}"`
    };

    onRulesChange([...rules, newRule]);
    setIsAdding(false);
    setSelectedQuestion('');
    setSelectedAnswer('');
  };

  const removeRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const getQuestionOptions = () => {
    const question = availableQuestions.find(q => 
      `${q.stepId}-${q.questionId}-${q.taskId || ''}` === selectedQuestion
    );
    return question?.options || [];
  };

  if (availableQuestions.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic">
        No questions available yet. Add questions to tasks or steps to create visibility rules.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current Rules */}
      {rules.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Eye className="h-3 w-3" />
            Show/Hide Rules
          </div>
          {rules.map(rule => {
            const question = availableQuestions.find(q => 
              q.stepId === rule.stepId && 
              q.questionId === rule.questionId && 
              q.taskId === rule.taskId
            );
            
            return (
              <div key={rule.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                <EyeOff className="h-3 w-3 text-amber-600" />
                <div className="flex-1 text-xs">
                  <span className="text-amber-800">
                    Only show when <strong>Step {question?.stepOrder}</strong>
                    {question?.taskTitle && <span> → Task "{question.taskTitle}"</span>}
                  </span>
                  <br />
                  <span className="text-amber-700">
                    "{question?.question}" = <Badge variant="outline" className="text-xs">{rule.requiredAnswer}</Badge>
                  </span>
                </div>
                <Button
                  onClick={() => removeRule(rule.id)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-amber-600 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Rule */}
      {!isAdding && rules.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="h-8 text-xs border-dashed"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Show/Hide Rule
        </Button>
      )}

      {isAdding && (
        <Card className="border-amber-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs">Add Visibility Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">Based on Question:</label>
              <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select a question..." />
                </SelectTrigger>
                <SelectContent>
                  {availableQuestions.map(q => (
                    <SelectItem key={`${q.stepId}-${q.questionId}-${q.taskId || ''}`} value={`${q.stepId}-${q.questionId}-${q.taskId || ''}`}>
                      <div className="text-left">
                        <div className="font-medium">Step {q.stepOrder}: {q.stepTitle}</div>
                        {q.taskTitle && <div className="text-xs text-gray-500">Task: {q.taskTitle}</div>}
                        <div className="text-xs text-blue-600">"{q.question}"</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedQuestion && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Required Answer:</label>
                <Select value={selectedAnswer} onValueChange={setSelectedAnswer}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select required answer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getQuestionOptions().map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={addRule} size="sm" className="h-7 text-xs" disabled={!selectedQuestion || !selectedAnswer}>
                Add Rule
              </Button>
              <Button onClick={() => {
                setIsAdding(false);
                if (onCancel) {
                  onCancel();
                }
              }} variant="outline" size="sm" className="h-7 text-xs">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
