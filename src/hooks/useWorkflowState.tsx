
import { useState, useContext, createContext, ReactNode } from 'react';

export interface WorkflowAnswer {
  stepId: string;
  taskId: string;
  questionId: string;
  answer: string;
  timestamp: Date;
}

export interface WorkflowState {
  answers: WorkflowAnswer[];
  currentStepId?: string;
  executionPath: string[];
}

interface WorkflowContextType {
  state: WorkflowState;
  addAnswer: (answer: WorkflowAnswer) => void;
  getAnswer: (stepId: string, taskId: string, questionId: string) => string | undefined;
  evaluateCondition: (condition: any) => boolean;
  getVisibleSteps: (allSteps: any[]) => any[];
  clearState: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkflowState>({
    answers: [],
    executionPath: []
  });

  const addAnswer = (answer: WorkflowAnswer) => {
    setState(prev => ({
      ...prev,
      answers: [...prev.answers.filter(a => 
        !(a.stepId === answer.stepId && a.taskId === answer.taskId && a.questionId === answer.questionId)
      ), answer],
      executionPath: [...prev.executionPath, answer.stepId].filter((id, index, arr) => arr.indexOf(id) === index)
    }));
  };

  const getAnswer = (stepId: string, taskId: string, questionId: string) => {
    const answer = state.answers.find(a => 
      a.stepId === stepId && a.taskId === taskId && a.questionId === questionId
    );
    return answer?.answer;
  };

  const evaluateCondition = (condition: any) => {
    if (!condition) return true;
    
    if (condition.type === 'dependency') {
      const requiredAnswer = getAnswer(condition.dependsOnStep, 'main', 'main');
      return requiredAnswer === condition.requiredAnswer;
    }
    
    if (condition.type === 'decision_point') {
      // For decision points, we need to check if any of the options' nextSteps include this step
      return true; // Will be handled by getVisibleSteps
    }
    
    return true;
  };

  const getVisibleSteps = (allSteps: any[]) => {
    return allSteps.filter(step => {
      if (!step.conditions) return true;
      return evaluateCondition(step.conditions);
    });
  };

  const clearState = () => {
    setState({
      answers: [],
      executionPath: []
    });
  };

  return (
    <WorkflowContext.Provider value={{
      state,
      addAnswer,
      getAnswer,
      evaluateCondition,
      getVisibleSteps,
      clearState
    }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowState() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflowState must be used within a WorkflowProvider');
  }
  return context;
}
