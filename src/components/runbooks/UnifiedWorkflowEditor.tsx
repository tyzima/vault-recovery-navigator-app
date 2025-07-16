
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { X, HelpCircle, Eye } from 'lucide-react';
import { TaskQuestionEditor } from './TaskQuestionEditor';
import { VisibilityRuleEditor } from './VisibilityRuleEditor';
import { QuestionDefinition, VisibilityRule } from '@/hooks/useWorkflowAnswers';
import { TaskQuestion } from '@/types/workflow';

interface AvailableStep {
  id: string;
  title: string;
  stepOrder: number;
  conditions?: { type: string; options: string[] } | null;
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

interface UnifiedWorkflowEditorProps {
  workflow: any;
  onWorkflowChange: (workflow: any) => void;
  availableSteps: AvailableStep[];
  availableQuestions?: AvailableQuestion[];
  defaultTab?: 'question' | 'visibility';
  autoExpand?: boolean;
  onCancel?: () => void;
  currentStepOrder?: number;
}

// Helper function to convert between TaskQuestion and QuestionDefinition
const convertTaskQuestionToDefinition = (question: TaskQuestion): QuestionDefinition => ({
  id: question.id,
  question: question.question,
  type: question.type === 'checkbox' ? 'select' : question.type as "select" | "text" | "radio" | "yes_no",
  options: question.options,
  required: question.required
});

const convertDefinitionToTaskQuestion = (question: QuestionDefinition): TaskQuestion => ({
  id: question.id,
  question: question.question,
  type: question.type === 'text' ? 'select' : question.type as "select" | "checkbox" | "radio" | "yes_no",
  options: question.options,
  required: question.required
});

export function UnifiedWorkflowEditor({ 
  workflow, 
  onWorkflowChange, 
  availableSteps,
  availableQuestions = [],
  defaultTab = 'question',
  autoExpand = false,
  onCancel,
  currentStepOrder
}: UnifiedWorkflowEditorProps) {
  const [activeTab, setActiveTab] = useState<'question' | 'visibility'>(defaultTab);
  const [autoExpandQuestion, setAutoExpandQuestion] = useState(true);
  const [autoExpandVisibility, setAutoExpandVisibility] = useState(true);

  // Parse current workflow
  const currentQuestion: TaskQuestion | null = workflow?.question || null;
  const currentVisibilityRules: VisibilityRule[] = workflow?.visibilityRules || [];

  // Filter available questions to only show questions from previous steps
  const filteredAvailableQuestions = currentStepOrder 
    ? availableQuestions.filter(q => q.stepOrder < currentStepOrder)
    : availableQuestions;

  const handleQuestionChange = (question: TaskQuestion | null) => {
    const updatedWorkflow = {
      ...workflow,
      question
    };
    onWorkflowChange(updatedWorkflow);
    // Turn off auto-expand after first interaction
    setAutoExpandQuestion(false);
  };

  const handleVisibilityRulesChange = (visibilityRules: VisibilityRule[]) => {
    const updatedWorkflow = {
      ...workflow,
      visibilityRules
    };
    onWorkflowChange(updatedWorkflow);
    // Turn off auto-expand after first interaction
    setAutoExpandVisibility(false);
  };

  const clearWorkflow = () => {
    onWorkflowChange(null);
  };

  const hasWorkflow = currentQuestion || currentVisibilityRules.length > 0;

  return (
    <div className="space-y-4">
      {hasWorkflow && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentQuestion && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <HelpCircle className="h-3 w-3 mr-1" />
                Has Question
              </Badge>
            )}
            {currentVisibilityRules.length > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <Eye className="h-3 w-3 mr-1" />
                {currentVisibilityRules.length} Rule{currentVisibilityRules.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearWorkflow}
            className="text-xs text-red-600 hover:text-red-700"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'question' | 'visibility')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="question" className="text-xs">
            <HelpCircle className="h-3 w-3 mr-1" />
            Question
          </TabsTrigger>
          <TabsTrigger value="visibility" className="text-xs">
            <Eye className="h-3 w-3 mr-1" />
            Show/Hide Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="question" className="space-y-3">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Step Question</CardTitle>
            
            </CardHeader>
            <CardContent>
              <TaskQuestionEditor
                question={currentQuestion}
                onQuestionChange={handleQuestionChange}
                autoExpand={autoExpandQuestion}
                onCancel={onCancel}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Visibility Rules</CardTitle>
              <p className="text-xs text-gray-600">
                Control when this step should be shown or hidden based on answers to previous questions.
              </p>
            </CardHeader>
            <CardContent>
              <VisibilityRuleEditor
                rules={currentVisibilityRules}
                onRulesChange={handleVisibilityRulesChange}
                availableQuestions={filteredAvailableQuestions}
                targetType="step"
                autoExpand={autoExpandVisibility}
                onCancel={onCancel}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
