
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { HelpCircle, CheckCircle } from 'lucide-react';
import { QuestionDefinition, useWorkflowAnswers } from '@/hooks/useWorkflowAnswers';

interface QuestionRendererProps {
  question: QuestionDefinition;
  stepId: string;
  taskId?: string;
  className?: string;
  onTaskComplete?: (taskId: string) => void;
}

export function QuestionRenderer({
  question,
  stepId,
  taskId,
  className,
  onTaskComplete
}: QuestionRendererProps) {
  const {
    getAnswer,
    addAnswer
  } = useWorkflowAnswers();
  
  const currentAnswer = getAnswer(stepId, question.id, taskId);

  const handleAnswer = (answer: string) => {
    // If the same answer is clicked again, deselect it (clear the answer)
    if (currentAnswer?.answer === answer) {
      addAnswer({
        id: crypto.randomUUID(),
        stepId,
        taskId,
        questionId: question.id,
        answer: '' // Clear the answer to deselect
      });
    } else {
      // Select the new answer
      addAnswer({
        id: crypto.randomUUID(),
        stepId,
        taskId,
        questionId: question.id,
        answer
      });

      // If this question is associated with a task, mark the task as complete
      if (taskId && onTaskComplete) {
        onTaskComplete(taskId);
      }
    }
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case 'yes_no':
        return <div className="flex gap-2">
            <Button variant={currentAnswer?.answer === 'yes' ? 'default' : 'outline'} size="sm" onClick={() => handleAnswer('yes')} className="flex-1">
              Yes
            </Button>
            <Button variant={currentAnswer?.answer === 'no' ? 'default' : 'outline'} size="sm" onClick={() => handleAnswer('no')} className="flex-1">
              No
            </Button>
          </div>;
      case 'select':
      case 'radio':
        return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {question.options?.map(option => (
              <Button 
                key={option} 
                variant={currentAnswer?.answer === option ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => handleAnswer(option)}
                className="justify-center text-center"
              >
                {option}
              </Button>
            ))}
          </div>;
      case 'text':
        return <Input value={currentAnswer?.answer || ''} onChange={e => handleAnswer(e.target.value)} placeholder="Enter your answer..." />;
      default:
        return null;
    }
  };

  return <Card className={`border-blue-200 bg-blue-50/30 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {currentAnswer && currentAnswer.answer !== '' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <HelpCircle className="h-4 w-4 text-blue-600" />}
          </div>
          <div className="flex-1 space-y-3">
            <div className="font-medium text-left text-sm text-blue-900">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            {renderQuestionInput()}
            {currentAnswer && currentAnswer.answer !== '' && <div className="text-xs text-green-700 hidden">
                Answered: <strong>{currentAnswer.answer}</strong>
              </div>}
          </div>
        </div>
      </CardContent>
    </Card>;
}
