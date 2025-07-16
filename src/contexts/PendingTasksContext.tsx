import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fileClient } from '@/lib/fileClient';
import { useAuth } from '@/hooks/useAuth';

interface PendingTasksContextType {
  pendingCount: number;
  loading: boolean;
  refetchPendingTasks: () => Promise<void>;
}

const PendingTasksContext = createContext<PendingTasksContextType | undefined>(undefined);

export function PendingTasksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingTasks = async () => {
    if (!user?.id) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching pending tasks for user:', user?.id);

      // Get all assignments for the current user that are not started
      const assignmentsResult = await fileClient
        .from('execution_step_assignments')
        .select('*')
        .eq('assigned_to', user?.id);

      if (assignmentsResult.error) {
        console.error('Error fetching user assignments:', assignmentsResult.error);
        setPendingCount(0);
        return;
      }

      const userAssignments = assignmentsResult.data || [];
      
      // Filter for not_started assignments
      const notStartedAssignments = userAssignments.filter((assignment: any) => 
        assignment.status === 'not_started'
      );

      console.log('User assignments:', notStartedAssignments);

      if (notStartedAssignments.length === 0) {
        console.log('No assignments found for user');
        setPendingCount(0);
        return;
      }

      // Get all executions to check their status
      const executionsResult = await fileClient
        .from('runbook_executions')
        .select('*')
        .execute();

      if (executionsResult.error) {
        console.error('Error fetching executions:', executionsResult.error);
        setPendingCount(0);
        return;
      }

      const executions = executionsResult.data || [];

      // Get all runbook steps to check step order
      const stepsResult = await fileClient
        .from('runbook_steps')
        .select('*')
        .execute();

      if (stepsResult.error) {
        console.error('Error fetching steps:', stepsResult.error);
        setPendingCount(0);
        return;
      }

      const steps = stepsResult.data || [];

      // Filter assignments for active executions only
      const activeExecutions = executions.filter((exec: any) => 
        ['active', 'started'].includes(exec.status)
      );
      
      const validAssignments = notStartedAssignments.filter((assignment: any) => 
        activeExecutions.some((exec: any) => exec.id === assignment.execution_id)
      );

      // For each assignment, check if it's ready to be started
      let readyCount = 0;

      for (const assignment of validAssignments) {
        const executionId = assignment.execution_id;
        const currentStep = steps.find((step: any) => step.id === assignment.step_id);
        
        if (!currentStep) continue;
        
        const currentStepOrder = currentStep.step_order;

        console.log(`Checking assignment for execution ${executionId}, step order ${currentStepOrder}`);

        // Get all assignments for this execution that come before the current step
        const previousAssignments = userAssignments.filter((assign: any) => {
          const stepData = steps.find((step: any) => step.id === assign.step_id);
          return assign.execution_id === executionId && 
                 stepData && 
                 stepData.step_order < currentStepOrder;
        });

        console.log(`Previous assignments for execution ${executionId}:`, previousAssignments);

        // If there are no previous steps, or all previous steps are completed, this step is ready
        const allPreviousCompleted = previousAssignments.length === 0 || 
          previousAssignments.every((assign: any) => assign.status === 'completed');

        console.log(`All previous completed for step ${currentStepOrder}:`, allPreviousCompleted);

        if (allPreviousCompleted) {
          readyCount++;
          console.log(`Step ${currentStepOrder} in execution ${executionId} is ready`);
        }
      }

      console.log('Total ready count:', readyCount);
      setPendingCount(readyCount);
    } catch (error) {
      console.error('Error in fetchPendingTasks:', error);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTasks();
  }, [user?.id]);

  const refetchPendingTasks = async () => {
    await fetchPendingTasks();
  };

  return (
    <PendingTasksContext.Provider value={{ pendingCount, loading, refetchPendingTasks }}>
      {children}
    </PendingTasksContext.Provider>
  );
}

export function usePendingTasksContext() {
  const context = useContext(PendingTasksContext);
  if (context === undefined) {
    throw new Error('usePendingTasksContext must be used within a PendingTasksProvider');
  }
  return context;
} 