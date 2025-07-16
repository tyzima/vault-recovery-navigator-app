import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fileClient } from '@/lib/fileClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { chatClient } from '@/lib/chatClient';
import { usePendingTasksContext } from '@/contexts/PendingTasksContext';

interface StartExecutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  runbookId: string;
  runbookTitle: string;
  clientId: string;
  onExecutionStarted: () => void;
}

export function StartExecutionDialog({
  isOpen,
  onClose,
  runbookId,
  runbookTitle,
  clientId,
  onExecutionStarted
}: StartExecutionDialogProps) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { createChannel, loadChannels } = useChat();
  const { refetchPendingTasks } = usePendingTasksContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    setLoading(true);

    try {
      // Create the execution
      const executionId = crypto.randomUUID();
      const executionResponse = await fileClient
        .from('runbook_executions')
        .insert({
          id: executionId,
          title: title.trim(),
          runbook_id: runbookId,
          client_id: clientId,
          started_by: user.id,
          status: 'active',
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (executionResponse.error) throw new Error(executionResponse.error.message);

      // Get all steps for this runbook
      const stepsResponse = await fileClient
        .from('runbook_steps')
        .select('*')
        .eq('runbook_id', runbookId);

      if (stepsResponse.error) throw new Error(stepsResponse.error.message);

      const steps = stepsResponse.data || [];
      
      // Sort steps by step_order
      steps.sort((a, b) => a.step_order - b.step_order);

      // Create step assignments for each step and collect assigned users
      const assignedUserIds = new Set<string>();
      
      for (const step of steps) {
        await fileClient
          .from('execution_step_assignments')
          .insert({
            id: crypto.randomUUID(),
            execution_id: executionId,
            step_id: step.id,
            assigned_to: step.assigned_to,
            status: 'not_started',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        
        // Collect assigned user IDs (if assigned)
        if (step.assigned_to) {
          assignedUserIds.add(step.assigned_to);
        }
      }

      // Add the execution starter to the channel
      assignedUserIds.add(user.id);

      // Create private channel for the execution if there are assigned users
      if (assignedUserIds.size > 0) {
        try {
          console.log('Creating execution channel with members:', Array.from(assignedUserIds));
          
          const channel = await createChannel({
            name: `${title.trim()} - Execution`,
            description: `Private channel for the execution: ${title.trim()}`,
            type: 'private',
            icon: 'play',
            members: Array.from(assignedUserIds)
          });

          console.log('Created execution channel:', channel.id);

          // Send initial message to the channel
          await chatClient.sendMessageHttp(
            channel.id, 
            `🎯 **Execution Started**\n\n` +
            `**Runbook:** ${runbookTitle}\n` +
            `**Execution:** ${title.trim()}\n` +
            `**Started by:** ${user.email}\n\n` +
            `This channel has been created for team collaboration on this execution. All assigned team members have been added automatically.`
          );

          console.log('Sent initial message to execution channel');

          // Refresh the channels list to show the new channel immediately
          await loadChannels();

          toast({
            title: "Success",
            description: "Execution started.",
          });
        } catch (channelError) {
          console.error('Error creating execution channel:', channelError);
          // Don't fail the whole execution creation if channel creation fails
          toast({
            title: "Execution Started",
            description: "Execution started successfully, but team channel creation failed",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Execution started successfully",
        });
      }

      // Refresh pending tasks count to update sidebar badge
      await refetchPendingTasks();

      onExecutionStarted();
      onClose();
      setTitle('');
    } catch (error) {
      console.error('Error starting execution:', error);
      toast({
        title: "Error",
        description: "Failed to start execution",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Execution</DialogTitle>
          <DialogDescription>
            Start a new execution for: {runbookTitle}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Execution Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter execution title..."
              required
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? 'Starting...' : 'Start Execution'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
