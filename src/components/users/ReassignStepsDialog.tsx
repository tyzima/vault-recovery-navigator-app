/**
 * ReassignStepsDialog - Dialog component for bulk reassigning steps from one user to another
 * 
 * Features:
 * - Shows all steps currently assigned to a selected user
 * - Allows bulk selection of steps for reassignment
 * - Supports reassigning to another user or unassigning completely
 * - Permission-based filtering of target users (Kelyn/Client admin restrictions)
 * - Displays step details including runbook, client, duration, and order
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { fileClient } from '@/lib/fileClient';
import { useToast } from '@/hooks/use-toast';
import { User, Calendar, Clock, BookOpen } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  client_id?: string;
  created_at: string;
  updated_at?: string;
}

interface Client {
  id: string;
  name: string;
}

interface UserWithClient extends Profile {
  client?: Client;
}

interface RunbookStep {
  id: string;
  runbook_id: string;
  title: string;
  description?: string;
  step_order: number;
  estimated_duration_minutes?: number;
  assigned_to?: string;
  created_at: string;
  updated_at?: string;
  runbook_title?: string;
  client_name?: string;
}

interface ReassignStepsDialogProps {
  fromUser: UserWithClient;
  users: UserWithClient[];
  currentUserProfile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReassignStepsDialog({
  fromUser,
  users,
  currentUserProfile,
  open,
  onOpenChange,
  onSuccess
}: ReassignStepsDialogProps) {
  const [assignedSteps, setAssignedSteps] = useState<RunbookStep[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const { toast } = useToast();

  // Filter users that can be assigned to based on current user's role
  const getAssignableUsers = () => {
    return users.filter(user => {
      // Don't include the from user in the list
      if (user.id === fromUser.id) return false;

      if (currentUserProfile?.role === 'kelyn_admin') {
        // Kelyn admins can assign to anyone
        return true;
      }

      if (currentUserProfile?.role === 'client_admin') {
        // Client admins can only assign to users in their own client (excluding kelyn roles)
        return user.client_id === currentUserProfile.client_id && 
               !['kelyn_admin', 'kelyn_rep'].includes(user.role);
      }

      return false;
    });
  };

  const fetchAssignedSteps = async () => {
    if (!fromUser.id) return;

    setLoading(true);
    try {
      // Get all steps assigned to this user
      const stepsResult = await fileClient
        .from('runbook_steps')
        .select('*')
        .eq('assigned_to', fromUser.id);

      if (stepsResult.error) {
        console.error('Error fetching assigned steps:', stepsResult.error);
        toast({
          title: "Error",
          description: "Failed to fetch assigned steps",
          variant: "destructive"
        });
        return;
      }

      const steps = stepsResult.data || [];

      if (steps.length === 0) {
        setAssignedSteps([]);
        return;
      }

      // Get runbook information for each step
      const runbookIds = [...new Set(steps.map(step => step.runbook_id))];
      const runbooksResult = await fileClient
        .from('runbooks')
        .select('*')
        .in('id', runbookIds);

      const runbooks = runbooksResult.data || [];

      // Get client information for each runbook
      const clientIds = [...new Set(runbooks.map(rb => rb.client_id).filter(Boolean))];
      const clientsResult = clientIds.length > 0 
        ? await fileClient.from('clients').select('*').in('id', clientIds)
        : { data: [] };

      const clients = clientsResult.data || [];

      // Enrich steps with runbook and client information
      const enrichedSteps = steps.map(step => {
        const runbook = runbooks.find(rb => rb.id === step.runbook_id);
        const client = runbook ? clients.find(c => c.id === runbook.client_id) : null;

        return {
          ...step,
          runbook_title: runbook?.title || 'Unknown Runbook',
          client_name: client?.name || 'Unknown Client'
        };
      });

      // Sort by runbook title, then by step order
      enrichedSteps.sort((a, b) => {
        if (a.runbook_title !== b.runbook_title) {
          return a.runbook_title.localeCompare(b.runbook_title);
        }
        return a.step_order - b.step_order;
      });

      setAssignedSteps(enrichedSteps);
    } catch (error) {
      console.error('Error fetching assigned steps:', error);
      toast({
        title: "Error",
        description: "Failed to fetch assigned steps",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && fromUser.id) {
      fetchAssignedSteps();
      setSelectedStepIds([]);
      setTargetUserId('');
    }
  }, [open, fromUser.id]);

  const handleStepSelection = (stepId: string, checked: boolean) => {
    if (checked) {
      setSelectedStepIds(prev => [...prev, stepId]);
    } else {
      setSelectedStepIds(prev => prev.filter(id => id !== stepId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStepIds(assignedSteps.map(step => step.id));
    } else {
      setSelectedStepIds([]);
    }
  };

  const handleReassign = async () => {
    if (selectedStepIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one step to reassign",
        variant: "destructive"
      });
      return;
    }

    if (!targetUserId) {
      toast({
        title: "Error",
        description: "Please select a user to assign the steps to",
        variant: "destructive"
      });
      return;
    }

    setReassigning(true);
    try {
      // Update each selected step
      const updatePromises = selectedStepIds.map(stepId =>
        fileClient
          .from('runbook_steps')
          .update({
            assigned_to: targetUserId === 'unassign' ? null : targetUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', stepId)
      );

      const results = await Promise.all(updatePromises);
      
      // Check if any updates failed
      const failedUpdates = results.filter(result => result.error);
      if (failedUpdates.length > 0) {
        console.error('Some updates failed:', failedUpdates);
        toast({
          title: "Partial Success",
          description: `${selectedStepIds.length - failedUpdates.length} steps reassigned successfully, ${failedUpdates.length} failed`,
          variant: "destructive"
        });
      } else {
        const targetUser = users.find(u => u.id === targetUserId);
        const targetName = targetUserId === 'unassign' 
          ? 'Unassigned' 
          : `${targetUser?.first_name} ${targetUser?.last_name}`;

        toast({
          title: "Success",
          description: `${selectedStepIds.length} step${selectedStepIds.length === 1 ? '' : 's'} reassigned to ${targetName}`
        });
        onSuccess();
      }
    } catch (error) {
      console.error('Error during reassignment:', error);
      toast({
        title: "Error",
        description: "Failed to reassign steps",
        variant: "destructive"
      });
    } finally {
      setReassigning(false);
    }
  };

  const assignableUsers = getAssignableUsers();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Reassign Steps from {fromUser.first_name} {fromUser.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Target User Selection */}
          <div className="space-y-2">
            <Label htmlFor="target-user">Assign steps to:</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">
                  <span className="text-muted-foreground">Unassign (remove assignment)</span>
                </SelectItem>
                {assignableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.first_name} {user.last_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.role.replace('_', ' ')}
                      </Badge>
                      {user.client?.name && (
                        <span className="text-xs text-muted-foreground">
                          ({user.client.name})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Steps List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Select Steps to Reassign ({assignedSteps.length} total)
              </Label>
              {assignedSteps.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedStepIds.length === assignedSteps.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm">
                    Select All
                  </Label>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading assigned steps...</p>
              </div>
            ) : assignedSteps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No steps are currently assigned to this user.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                {assignedSteps.map(step => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Checkbox
                      id={`step-${step.id}`}
                      checked={selectedStepIds.includes(step.id)}
                      onCheckedChange={(checked) => handleStepSelection(step.id, !!checked)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <Label htmlFor={`step-${step.id}`} className="font-medium cursor-pointer">
                            {step.title}
                          </Label>
                          {step.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {step.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Step {step.step_order}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          <span>{step.runbook_title}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{step.client_name}</span>
                        </div>
                        {step.estimated_duration_minutes && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{step.estimated_duration_minutes} min</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(step.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedStepIds.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedStepIds.length} step{selectedStepIds.length === 1 ? '' : 's'} selected
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleReassign}
            disabled={reassigning || selectedStepIds.length === 0 || !targetUserId}
          >
            {reassigning ? 'Reassigning...' : `Reassign ${selectedStepIds.length} Step${selectedStepIds.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 