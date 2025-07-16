import { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { useAuth } from './useAuth';

export function useActiveStepAssignments() {
  const { user } = useAuth();
  const [hasActiveAssignments, setHasActiveAssignments] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setHasActiveAssignments(false);
      setActiveCount(0);
      setLoading(false);
      return;
    }

    fetchActiveStepAssignments();

    // Note: Real-time subscriptions not implemented in file-based system
    // You could implement polling if needed
  }, [user?.id]);

  const fetchActiveStepAssignments = async () => {
    try {
      setLoading(true);
      console.log('Fetching active step assignments for user:', user?.id);

      // Get all step assignments for the current user
      const assignmentsResult = await fileClient
        .from('execution_step_assignments')
        .select('*')
        .eq('assigned_to', user?.id);

      if (assignmentsResult.error) {
        console.error('Error fetching user assignments:', assignmentsResult.error);
        setHasActiveAssignments(false);
        setActiveCount(0);
        return;
      }

      const userAssignments = assignmentsResult.data || [];
      
      console.log('All user assignments:', userAssignments);

      if (userAssignments.length === 0) {
        console.log('No assignments found for user');
        setHasActiveAssignments(false);
        setActiveCount(0);
        return;
      }

      // Get all executions to check their status
      const executionsResult = await fileClient
        .from('runbook_executions')
        .select('*')
        .execute();

      if (executionsResult.error) {
        console.error('Error fetching executions:', executionsResult.error);
        setHasActiveAssignments(false);
        setActiveCount(0);
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
        setHasActiveAssignments(false);
        setActiveCount(0);
        return;
      }

      const steps = stepsResult.data || [];

      // Filter assignments for active executions only
      const activeExecutions = executions.filter((exec: any) => 
        exec.status === 'active'
      );
      
      const assignmentsInActiveExecutions = userAssignments.filter((assignment: any) => 
        activeExecutions.some((exec: any) => exec.id === assignment.execution_id)
      );

      console.log('Active executions:', activeExecutions);
      console.log('Assignments in active executions:', assignmentsInActiveExecutions);

      // Check which assignments are actionable (in_progress or ready to start)
      let actionableCount = 0;

      for (const assignment of assignmentsInActiveExecutions) {
        // If already in progress, it's actionable
        if (assignment.status === 'in_progress') {
          actionableCount++;
          continue;
        }

        // If not started, check if it's ready to be worked on
        if (assignment.status === 'not_started') {
          const currentStep = steps.find((step: any) => step.id === assignment.step_id);
          if (!currentStep) continue;
          
          const currentStepOrder = currentStep.step_order;
          const executionId = assignment.execution_id;

          // Get all assignments for this execution that come before the current step
          const previousAssignments = userAssignments.filter((assign: any) => {
            const stepData = steps.find((step: any) => step.id === assign.step_id);
            return assign.execution_id === executionId && 
                   stepData && 
                   stepData.step_order < currentStepOrder;
          });

          // If there are no previous steps, or all previous steps are completed, this step is ready
          const allPreviousCompleted = previousAssignments.length === 0 || 
            previousAssignments.every((assign: any) => assign.status === 'completed');

          if (allPreviousCompleted) {
            actionableCount++;
          }
        }
      }

      const count = actionableCount;
      setActiveCount(count);
      setHasActiveAssignments(count > 0);

      console.log('Total active assignments count:', count);
    } catch (error) {
      console.error('Error in fetchActiveStepAssignments:', error);
      setHasActiveAssignments(false);
      setActiveCount(0);
    } finally {
      setLoading(false);
    }
  };

  return { 
    hasActiveAssignments, 
    activeCount, 
    loading, 
    refetch: fetchActiveStepAssignments 
  };
} 