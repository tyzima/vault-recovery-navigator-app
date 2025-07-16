
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface WorkflowAnswer {
  id: string;
  stepId: string;
  taskId?: string; // Optional - null if it's a step-level question
  questionId: string;
  answer: string;
  timestamp: Date;
}

export interface QuestionDefinition {
  id: string;
  question: string;
  type: 'select' | 'radio' | 'yes_no' | 'text';
  options?: string[];
  required?: boolean;
}

export interface VisibilityRule {
  id: string;
  stepId: string;
  taskId?: string; // Optional - if specified, rule applies to a task; otherwise to a step
  questionId: string;
  requiredAnswer: string;
  description?: string;
}

interface WorkflowAnswersContextType {
  answers: WorkflowAnswer[];
  addAnswer: (answer: Omit<WorkflowAnswer, 'timestamp'>) => void;
  getAnswer: (stepId: string, questionId: string, taskId?: string) => WorkflowAnswer | undefined;
  clearAnswers: () => void;
  checkVisibility: (rules: VisibilityRule[]) => boolean;
}

const WorkflowAnswersContext = createContext<WorkflowAnswersContextType | undefined>(undefined);

interface WorkflowAnswersProviderProps {
  children: ReactNode;
  runbookId?: string;
}

export function WorkflowAnswersProvider({ children, runbookId }: WorkflowAnswersProviderProps) {
  const [answers, setAnswers] = useState<WorkflowAnswer[]>([]);

  // Clear answers when runbook ID changes or component unmounts for temporary interaction
  useEffect(() => {
    setAnswers([]);
  }, [runbookId]);

  // Clear answers when component unmounts or page changes for temporary interaction
  useEffect(() => {
    return () => {
      setAnswers([]);
    };
  }, []);

  const addAnswer = (answerData: Omit<WorkflowAnswer, 'timestamp'>) => {
    setAnswers(prev => {
      // Remove any existing answer for the same question
      const filtered = prev.filter(a => 
        !(a.stepId === answerData.stepId && 
          a.questionId === answerData.questionId && 
          a.taskId === answerData.taskId)
      );
      
      return [...filtered, { ...answerData, timestamp: new Date() }];
    });
  };

  const getAnswer = (stepId: string, questionId: string, taskId?: string) => {
    return answers.find(a => 
      a.stepId === stepId && 
      a.questionId === questionId && 
      a.taskId === taskId
    );
  };

  const checkVisibility = (rules: VisibilityRule[]) => {
    if (!rules || rules.length === 0) return true;
    
    // All rules must be satisfied for the item to be visible
    return rules.every(rule => {
      const answer = getAnswer(rule.stepId, rule.questionId, rule.taskId);
      return answer?.answer === rule.requiredAnswer;
    });
  };

  const clearAnswers = () => {
    setAnswers([]);
  };

  return (
    <WorkflowAnswersContext.Provider value={{
      answers,
      addAnswer,
      getAnswer,
      clearAnswers,
      checkVisibility
    }}>
      {children}
    </WorkflowAnswersContext.Provider>
  );
}

export function useWorkflowAnswers() {
  const context = useContext(WorkflowAnswersContext);
  if (!context) {
    throw new Error('useWorkflowAnswers must be used within a WorkflowAnswersProvider');
  }
  return context;
}
