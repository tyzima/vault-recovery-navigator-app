
export interface DecisionPoint {
  id: string;
  question: string;
  type: 'select' | 'radio' | 'yes_no';
  options: DecisionOption[];
  required: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  value: string;
  nextSteps: string[]; // IDs of steps that should be executed if this option is chosen
}

export interface WorkflowPath {
  id: string;
  name: string;
  color: string;
  steps: string[];
  triggers: {
    stepId: string;
    decisionId: string;
    optionValue: string;
  }[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  stepOrder: number;
  type: 'standard' | 'decision' | 'conditional';
  decisionPoint?: DecisionPoint;
  conditions?: {
    dependsOnStep: string;
    dependsOnDecision: string;
    requiredAnswer: string;
  }[];
  tasks: WorkflowTask[];
  estimatedDuration?: number;
  assignedTo?: string;
  photoUrl?: string;
}

export interface WorkflowTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
}

export interface Workflow {
  id: string;
  steps: WorkflowStep[];
  paths: WorkflowPath[];
  currentPath?: string;
}

// Legacy types for backward compatibility
export interface WorkflowCondition {
  id: string;
  dependsOnTaskId: string;
  dependsOnStepId: string;
  questionType: 'select' | 'radio' | 'checkbox' | 'yes_no';
  showWhen: string;
}

export interface TaskQuestion {
  id: string;
  type: 'select' | 'radio' | 'checkbox' | 'yes_no';
  question: string;
  options: string[];
  required: boolean;
}

export interface WorkflowNode {
  id: string;
  type: 'step' | 'task' | 'question' | 'branch' | 'decision';
  data: {
    title: string;
    description?: string;
    stepOrder?: number;
    question?: TaskQuestion;
    condition?: WorkflowCondition;
    completed?: boolean;
    decisionPoint?: DecisionPoint;
    paths?: string[];
  };
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'default' | 'conditional' | 'decision';
  data?: {
    condition?: string;
    label?: string;
    pathColor?: string;
    decisionValue?: string;
  };
}

// Additional type for backward compatibility
export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
  conditions?: WorkflowCondition | null;
}
