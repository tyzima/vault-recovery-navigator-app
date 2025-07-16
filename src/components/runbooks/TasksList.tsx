import React, { useState } from 'react';
import { fileClient } from '@/lib/fileClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Plus, Edit, Trash2, Save, X, Settings, HelpCircle, Eye, Camera, 
  Image, Copy, Check, Code, ArrowUp, ArrowDown, ChevronRight, ArrowLeft
} from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { TaskQuestion } from '@/types/workflow';
import { TaskQuestionEditor } from './TaskQuestionEditor';
import { QuestionRenderer } from './QuestionRenderer';
import { VisibilityRuleEditor } from './VisibilityRuleEditor';
import { useWorkflowAnswers, VisibilityRule } from '@/hooks/useWorkflowAnswers';
import { getTaskPhotoUrl, getRelativeFileUrl } from '@/utils/urlUtils';
import { TaskPhotoUpload } from './TaskPhotoUpload';
import { PhotoLightbox } from './PhotoLightbox';

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
  question?: TaskQuestion | null;
  visibilityRules?: VisibilityRule[];
  photoUrl?: string;
  codeBlock?: string;
}

interface TasksListProps {
  stepId: string;
  tasks: Task[];
  canEdit: boolean;
  onTasksUpdate: (tasks: Task[]) => void;
  availableQuestions?: Array<{
    stepId: string;
    stepTitle: string;
    stepOrder: number;
    taskId?: string;
    taskTitle?: string;
    questionId: string;
    question: string;
    options: string[];
  }>;
  // New prop to distinguish between runbook and execution contexts
  isExecution?: boolean;
  // For execution context, indicate if user can check tasks on this step
  canCheckTasks?: boolean;
  // Preview mode prevents database saves
  isPreview?: boolean;
  // Current step order for filtering visibility rules
  currentStepOrder?: number;
}

type ConfigPage = 'main' | 'photo' | 'code' | 'question' | 'visibility';

export function TasksList({ 
  stepId, 
  tasks, 
  canEdit, 
  onTasksUpdate, 
  availableQuestions = [],
  isExecution = false,
  canCheckTasks = true,
  isPreview = false,
  currentStepOrder = 0
}: TasksListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [editTask, setEditTask] = useState({ title: '', description: '' });
  const [configureTaskId, setConfigureTaskId] = useState<string | null>(null);
  const [configPage, setConfigPage] = useState<ConfigPage>('main');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxTaskId, setLightboxTaskId] = useState<string | null>(null);
  const [editingCodeTaskId, setEditingCodeTaskId] = useState<string | null>(null);
  const [editingQuestionTaskId, setEditingQuestionTaskId] = useState<string | null>(null);
  const [tempCodeBlocks, setTempCodeBlocks] = useState<{ [taskId: string]: string }>({});
  const { toast } = useToast();
  const { checkVisibility } = useWorkflowAnswers();

  // Determine if user can complete tasks:
  // - In runbook context: all users can check tasks
  // - In execution context: depends on canCheckTasks prop
  const canCompleteTasks = isExecution ? canCheckTasks : true;

  // Filter available questions to only include current step and previous steps
  const filteredAvailableQuestions = availableQuestions.filter(q => 
    q.stepOrder <= currentStepOrder
  );

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: crypto.randomUUID(),
      title: newTask.title.trim(),
      description: newTask.description.trim() || undefined,
      completed: false,
      order: tasks.length + 1,
    };

    const updatedTasks = [...tasks, task];
    await saveTasksToDatabase(updatedTasks);
    setNewTask({ title: '', description: '' });
    setIsCreating(false);
  };

  const handleUpdateTask = async (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId
        ? { ...task, title: editTask.title.trim(), description: editTask.description.trim() || undefined }
        : task
    );
    await saveTasksToDatabase(updatedTasks);
    setEditingTask(null);
    setEditTask({ title: '', description: '' });
  };

  const handleDeleteTask = async (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId)
      .map((task, index) => ({ ...task, order: index + 1 })); // Reorder after deletion
    await saveTasksToDatabase(updatedTasks);
  };

  const handleMoveTask = async (taskId: string, direction: 'up' | 'down') => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    const targetOrder = direction === 'up' ? currentTask.order - 1 : currentTask.order + 1;
    const targetTask = tasks.find(t => t.order === targetOrder);
    
    if (!targetTask) return; // Can't move beyond bounds

    // Swap the orders
    const updatedTasks = tasks.map(task => {
      if (task.id === currentTask.id) {
        return { ...task, order: targetOrder };
      } else if (task.id === targetTask.id) {
        return { ...task, order: currentTask.order };
      }
      return task;
    });

    await saveTasksToDatabase(updatedTasks);
  };

  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed } : task
    );
    
    // Only update local state - don't save to database for temporary interaction
    onTasksUpdate(updatedTasks);
  };

  const handleTaskCompleteFromQuestion = async (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: true } : task
    );
    
    // Only update local state - don't save to database for temporary interaction
    onTasksUpdate(updatedTasks);
  };

  const handleQuestionUpdate = async (taskId: string, question: TaskQuestion | null) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, question } : task
    );
    await saveTasksToDatabase(updatedTasks);
  };

  const handleVisibilityRulesUpdate = async (taskId: string, visibilityRules: VisibilityRule[]) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, visibilityRules } : task
    );
    await saveTasksToDatabase(updatedTasks);
  };

  const handlePhotoUploaded = async (taskId: string, photoUrl: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, photoUrl: getRelativeFileUrl(photoUrl) } : task
    );
    await saveTasksToDatabase(updatedTasks);
  };

  const handleTaskPhotoRemove = async (taskId: string) => {
    try {
      // In preview mode, skip server calls and just update local state
      if (!isPreview) {
        // Get auth token from storage
        const session = localStorage.getItem('file_session');
        const headers: HeadersInit = {};
        
        if (session) {
          const sessionData = JSON.parse(session);
          headers['Authorization'] = `Bearer ${sessionData.access_token}`;
        }

        // Call the server endpoint to remove the photo
        const response = await fetch(`http://localhost:3001/api/tasks/${taskId}/photo`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to remove photo');
        }
      }

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, photoUrl: null } : task
      );
      await saveTasksToDatabase(updatedTasks);
      
      if (!isPreview) {
        toast({
          title: "Success",
          description: "Photo removed successfully",
        });
      }
    } catch (error) {
      console.error('Error removing task photo:', error);
      if (!isPreview) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to remove photo",
          variant: "destructive",
        });
      }
    }
  };

  const handleCodeBlockUpdate = async (taskId: string, codeBlock: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, codeBlock: codeBlock.trim() || undefined } : task
    );
    await saveTasksToDatabase(updatedTasks);
  };

  const handleCodeBlockTempUpdate = (taskId: string, codeBlock: string) => {
    setTempCodeBlocks(prev => ({
      ...prev,
      [taskId]: codeBlock
    }));
  };

  const saveCodeBlock = async (taskId: string) => {
    const codeBlock = tempCodeBlocks[taskId];
    if (codeBlock !== undefined) {
      await handleCodeBlockUpdate(taskId, codeBlock);
      setTempCodeBlocks(prev => {
        const newTemp = { ...prev };
        delete newTemp[taskId];
        return newTemp;
      });
    }
  };

  const handleCopyCode = async (code: string, taskId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId(null), 2000);
      toast({
        title: "Copied!",
        description: "Code has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      });
    }
  };

  const saveTasksToDatabase = async (updatedTasks: Task[]) => {
    try {
      console.log('TasksList: Saving tasks to database for step:', stepId);
      console.log('TasksList: Updated tasks:', updatedTasks);
      
      // In preview mode, skip database operations and just update local state
      if (isPreview) {
        onTasksUpdate(updatedTasks);
        // Don't show success toast in preview mode to avoid confusion
        return;
      }
      
      const result = await fileClient
        .from('runbook_steps')
        .update({ 
          tasks: updatedTasks as any,
          updated_at: new Date().toISOString() 
        })
        .eq('id', stepId);

      console.log('TasksList: Save result:', result);

      if (result.error) {
        throw new Error(result.error.message);
      }

      onTasksUpdate(updatedTasks);
      toast({
        title: "Success",
        description: "Tasks updated successfully",
      });
    } catch (error) {
      console.error('TasksList: Error updating tasks:', error);
      toast({
        title: "Error",
        description: "Failed to update tasks",
        variant: "destructive",
      });
    }
  };

  const startEditing = (task: Task) => {
    setEditTask({ title: task.title, description: task.description || '' });
    setEditingTask(task.id);
  };

  const cancelEditing = () => {
    setEditingTask(null);
    setEditTask({ title: '', description: '' });
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewTask({ title: '', description: '' });
  };

  const openTaskConfig = (taskId: string) => {
    setConfigureTaskId(taskId);
    setConfigPage('main');
  };

  const closeTaskConfig = () => {
    setConfigureTaskId(null);
    setConfigPage('main');
  };

  const navigateToConfigPage = (page: ConfigPage) => {
    setConfigPage(page);
  };

  const getCurrentTask = () => {
    return tasks.find(task => task.id === configureTaskId);
  };

  const renderConfigContent = () => {
    const currentTask = getCurrentTask();
    if (!currentTask) return null;

    switch (configPage) {
      case 'main':
        return (
          <div className="space-y-1">
            {/* Photo Section */}
            <button
              onClick={() => navigateToConfigPage('photo')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2.5 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Camera className="h-5 w-5 text-blue-700" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-gray-900">Photo</h4>
                  <p className="text-xs text-gray-500">
                    {currentTask.photoUrl ? 'Edit photo' : 'Add photo to task'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentTask.photoUrl && (
                  <Badge variant="secondary" className="text-xs">
                    Added
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>

            {/* Code Block Section */}
            <button
              onClick={() => navigateToConfigPage('code')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2.5 rounded-lg group-hover:bg-indigo-200 transition-colors">
                  <Code className="h-5 w-5 text-indigo-700" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-gray-900">Code Block</h4>
                  <p className="text-xs text-gray-500">
                    {currentTask.codeBlock ? 'Edit code block' : 'Add copyable code'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentTask.codeBlock && (
                  <>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCodeBlockUpdate(currentTask.id, '');
                      }}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Clear
                    </Button>
                    <Badge variant="secondary" className="text-xs">
                      Added
                    </Badge>
                  </>
                )}
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>

            {/* Question Section */}
            <button
              onClick={() => navigateToConfigPage('question')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2.5 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <HelpCircle className="h-5 w-5 text-purple-700" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-gray-900">Question</h4>
                  <p className="text-xs text-gray-500">
                    {currentTask.question ? 'Edit question' : 'Add interactive question'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentTask.question && (
                  <Badge variant="secondary" className="text-xs">
                    Added
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>

            {/* Visibility Rules Section */}
            <button
              onClick={() => navigateToConfigPage('visibility')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2.5 rounded-lg group-hover:bg-amber-200 transition-colors">
                  <Eye className="h-5 w-5 text-amber-700" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-gray-900">Show/Hide Rules</h4>
                  <p className="text-xs text-gray-500">
                    {currentTask.visibilityRules?.length ? 
                      `${currentTask.visibilityRules.length} rule${currentTask.visibilityRules.length !== 1 ? 's' : ''}` : 
                      'Control when task appears'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentTask.visibilityRules?.length ? (
                  <Badge variant="secondary" className="text-xs">
                    {currentTask.visibilityRules.length}
                  </Badge>
                ) : null}
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          </div>
        );

      case 'photo':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <Button
                onClick={() => navigateToConfigPage('main')}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold">Photo</h4>
              </div>
            </div>
            
            {currentTask.photoUrl && (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">Current photo:</p>
                <div className="relative rounded-lg overflow-hidden border-2 border-white shadow-sm w-full max-w-xs">
                  <img
                    src={getTaskPhotoUrl(currentTask.photoUrl)}
                    alt={`Task: ${currentTask.title}`}
                    className="w-full h-32 object-cover"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleTaskPhotoRemove(currentTask.id)} 
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove Photo
                </Button>
              </div>
            )}
            
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                {currentTask.photoUrl ? 'Replace with new photo:' : 'Upload a photo:'}
              </p>
              <TaskPhotoUpload
                taskId={currentTask.id}
                onPhotoUploaded={(photoUrl) => handlePhotoUploaded(currentTask.id, photoUrl)}
              />
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <Button
                onClick={() => navigateToConfigPage('main')}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-semibold">Code Block</h4>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-600">
                Enter code that users can copy:
              </label>
              <Textarea
                value={currentTask.codeBlock || ''}
                onChange={(e) => handleCodeBlockUpdate(currentTask.id, e.target.value)}
                placeholder="#!/bin/bash&#10;echo 'Hello World'&#10;# Add your code here..."
                className="text-xs font-mono min-h-[160px] bg-slate-900 text-green-400 placeholder:text-gray-500"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  This code will be displayed in a dark theme with syntax highlighting and a copy button.
                </p>
                {currentTask.codeBlock && (
                  <Button
                    onClick={() => {
                      handleCodeBlockUpdate(currentTask.id, '');
                      navigateToConfigPage('main');
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove Code
                  </Button>
                )}
              </div>
            </div>
                    </div>
        );

      case 'question':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <Button
                onClick={() => navigateToConfigPage('main')}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-purple-600" />
                <h4 className="text-sm font-semibold">Question</h4>
              </div>
            </div>
            
            <TaskQuestionEditor
              question={currentTask.question}
              onQuestionChange={(question) => handleQuestionUpdate(currentTask.id, question)}
            />
          </div>
        );

      case 'visibility':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <Button
                onClick={() => navigateToConfigPage('main')}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-semibold">Show/Hide Rules</h4>
              </div>
            </div>
            
            <VisibilityRuleEditor
              rules={currentTask.visibilityRules || []}
              onRulesChange={(rules) => handleVisibilityRulesUpdate(currentTask.id, rules)}
              availableQuestions={filteredAvailableQuestions}
              targetType="task"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Filter tasks based on visibility rules and sort by order
  const visibleTasks = tasks
    .filter(task => {
      if (!task.visibilityRules || task.visibilityRules.length === 0) return true;
      return checkVisibility(task.visibilityRules);
    })
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {visibleTasks.map((task, index) => {
        const hasVisibilityRules = task.visibilityRules && task.visibilityRules.length > 0;
        const hasQuestion = task.question;
        const isFirstTask = index === 0;
        const isLastTask = index === visibleTasks.length - 1;
        
        return (
          <Card 
            key={task.id} 
            className={`border shadow-sm transition-colors ${
              hasVisibilityRules 
                ? 'border-amber-200 bg-amber-50/30 ml-4' 
                : 'border-gray-200'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Only show checkbox if task doesn't have a question */}
                {!hasQuestion && (
                  <div className="flex-shrink-0 pt-1">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={(checked) => handleTaskComplete(task.id, !!checked)}
                      disabled={!canCompleteTasks}
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  {editingTask === task.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editTask.title}
                        onChange={(e) => setEditTask(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Task title"
                        className="text-sm"
                      />
                      <Textarea
                        value={editTask.description}
                        onChange={(e) => setEditTask(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Task description (optional)"
                        className="text-sm min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUpdateTask(task.id)}
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-medium text-left ${
                            task.completed && !hasQuestion 
                              ? 'line-through text-muted-foreground' 
                              : 'text-gray-900'
                          }`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className={`text-sm text-left mt-1 ${
                              task.completed && !hasQuestion 
                                ? 'line-through text-muted-foreground' 
                                : 'text-gray-600'
                            }`}>
                              {task.description}
                            </p>
                          )}
                          
                          {/* Task Code Block */}
                          {editingCodeTaskId === task.id ? (
                            <div className="mt-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Code className="h-4 w-4 text-indigo-600" />
                                  <span className="text-sm font-medium text-indigo-700">Editing Code Block</span>
                                </div>
                                <Textarea
                                  value={tempCodeBlocks[task.id] ?? task.codeBlock ?? ''}
                                  onChange={(e) => handleCodeBlockTempUpdate(task.id, e.target.value)}
                                  onBlur={() => saveCodeBlock(task.id)}
                                  placeholder="#!/bin/bash&#10;echo 'Hello World'&#10;# Add your code here..."
                                  className="text-xs font-mono min-h-[120px] bg-slate-900 text-green-400 placeholder:text-gray-500"
                                />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-500">
                                    Will be displayed with syntax highlighting and a copy button.
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => {
                                        handleCodeBlockUpdate(task.id, '');
                                        setEditingCodeTaskId(null);
                                        setTempCodeBlocks(prev => {
                                          const newTemp = { ...prev };
                                          delete newTemp[task.id];
                                          return newTemp;
                                        });
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Remove
                                    </Button>
                                    <Button
                                      onClick={async () => {
                                        await saveCodeBlock(task.id);
                                        setEditingCodeTaskId(null);
                                      }}
                                      size="sm"
                                      className="h-7 text-xs"
                                    >
                                      Done
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : task.codeBlock ? (
                            <div className="mt-3">
                              <div className="relative bg-gray-900 rounded-md p-3 text-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Code className="h-3 w-3 text-gray-400" />
                                    <span className="text-xs text-gray-400 font-medium">Code</span>
                                  </div>
                                  <Tooltip content={copiedTaskId === task.id ? 'Copied!' : 'Copy code'}>
                                    <Button
                                      onClick={() => handleCopyCode(task.codeBlock!, task.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                                    >
                                      {copiedTaskId === task.id ? (
                                        <Check className="h-3 w-3" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </Tooltip>
                                </div>
                                <pre className="text-green-400 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
                                  {task.codeBlock}
                                </pre>
                              </div>
                            </div>
                          ) : null}
                          
                          {/* Task Photo */}
                          {task.photoUrl && (
                            <div className="mt-3">
                              <div className="flex items-start gap-4 bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                                <div 
                                  className="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-white shadow-sm w-32 h-24 shrink-0 hover:shadow-md transition-shadow"
                                  onClick={() => {
                                    setLightboxPhoto(getTaskPhotoUrl(task.photoUrl));
                                    setLightboxTaskId(task.id);
                                  }}
                                >
                                  <img
                                    src={getTaskPhotoUrl(task.photoUrl)}
                                    alt={`Task: ${task.title}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                    <Image className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                {canEdit && (
                                  <div className="flex flex-col gap-2 w-28">
                                    <TaskPhotoUpload
                                      taskId={task.id}
                                      onPhotoUploaded={(photoUrl) => handlePhotoUploaded(task.id, photoUrl)}
                                      className="h-9 w-full text-xs flex items-center justify-center"
                                    />
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleTaskPhotoRemove(task.id)} 
                                      className="h-9 w-full text-xs text-destructive hover:text-destructive flex items-center justify-center"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Remove
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Task Question */}
                          {editingQuestionTaskId === task.id ? (
                            <div className="mt-3">
                              <div className="space-y-4 border border-purple-200 rounded-lg p-4 bg-purple-50/30">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className="h-4 w-4 text-purple-600" />
                                  <span className="text-sm font-medium text-purple-700">Editing Question</span>
                                </div>
                                <TaskQuestionEditor
                                  question={task.question}
                                  onQuestionChange={(question) => handleQuestionUpdate(task.id, question)}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    onClick={() => {
                                      handleQuestionUpdate(task.id, null);
                                      setEditingQuestionTaskId(null);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Remove
                                  </Button>
                                  <Button
                                    onClick={() => setEditingQuestionTaskId(null)}
                                    size="sm"
                                    className="h-7 text-xs"
                                  >
                                    Done
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : task.question ? (
                            <div className="mt-3">
                              <QuestionRenderer
                                question={{
                                  id: task.question.id,
                                  question: task.question.question,
                                  type: task.question.type as "select" | "text" | "radio" | "yes_no",
                                  options: task.question.options,
                                  required: task.question.required
                                }}
                                stepId={stepId}
                                taskId={task.id}
                                onTaskComplete={handleTaskCompleteFromQuestion}
                              />
                            </div>
                          ) : null}
                        </div>
                        
                        {canEdit && (
                          <div className="flex items-center gap-1 ml-3">
                            {/* Task reordering buttons */}
                            <Tooltip content="Move task up">
                              <Button
                                onClick={() => handleMoveTask(task.id, 'up')}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={isFirstTask}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Move task down">
                              <Button
                                onClick={() => handleMoveTask(task.id, 'down')}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={isLastTask}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </Tooltip>
                            
                            {/* Direct action icons */}
                            <div className="flex items-center gap-1 mx-1 px-1 border-l border-white">
                              {/* Direct photo upload */}
                              <Tooltip content="Add photo">
                                <TaskPhotoUpload
                                  taskId={task.id}
                                  onPhotoUploaded={(photoUrl) => handlePhotoUploaded(task.id, photoUrl)}
                                  className="h-7 w-7 p-0 border border-gray-200 hover:border-gray-300"
                                  hideText={true}
                                />
                              </Tooltip>
                              
                              {/* Direct code block toggle */}
                              <Tooltip content={editingCodeTaskId === task.id ? 'Close code editor' : task.codeBlock ? 'Edit code block' : 'Add code block'}>
                                <Button
                                  onClick={() => {
                                    if (editingCodeTaskId === task.id) {
                                      // If currently editing, stop editing
                                      setEditingCodeTaskId(null);
                                    } else {
                                      // Start editing this task's code
                                      setEditingCodeTaskId(task.id);
                                      // If no code exists, add a template
                                      if (!task.codeBlock) {
                                        setTempCodeBlocks(prev => ({
                                          ...prev,
                                          [task.id]: '# Add your code here...'
                                        }));
                                      } else {
                                        // Initialize temp with current code
                                        setTempCodeBlocks(prev => ({
                                          ...prev,
                                          [task.id]: task.codeBlock || ''
                                        }));
                                      }
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 border border-gray-200 hover:border-gray-300 ${
                                    editingCodeTaskId === task.id ? 'bg-indigo-100 border-indigo-300' : ''
                                  }`}
                                >
                                  <Code className={`h-3 w-3 ${
                                    editingCodeTaskId === task.id ? 'text-indigo-700' : 
                                    task.codeBlock ? 'text-indigo-600' : 'text-gray-400'
                                  }`} />
                                </Button>
                              </Tooltip>
                              
                              {/* Direct question toggle */}
                              <Tooltip content={editingQuestionTaskId === task.id ? 'Close question editor' : task.question ? 'Edit question' : 'Add question'}>
                                <Button
                                  onClick={() => {
                                    if (editingQuestionTaskId === task.id) {
                                      // If currently editing, stop editing
                                      setEditingQuestionTaskId(null);
                                    } else {
                                      // Start editing this task's question
                                      setEditingQuestionTaskId(task.id);
                                      // If no question exists, add a template
                                      if (!task.question) {
                                        const newQuestion: TaskQuestion = {
                                          id: crypto.randomUUID(),
                                          question: 'Enter your question here',
                                          type: 'yes_no',
                                          options: ['Yes', 'No'],
                                          required: false
                                        };
                                        handleQuestionUpdate(task.id, newQuestion);
                                      }
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 border border-gray-200 hover:border-gray-300 ${
                                    editingQuestionTaskId === task.id ? 'bg-purple-100 border-purple-300' : ''
                                  }`}
                                >
                                  <HelpCircle className={`h-3 w-3 ${
                                    editingQuestionTaskId === task.id ? 'text-purple-700' : 
                                    task.question ? 'text-purple-600' : 'text-gray-400'
                                  }`} />
                                </Button>
                              </Tooltip>
                              
                              {/* Visibility rules indicator/toggle */}
                              <Tooltip content="Show/hide rules">
                                <Button
                                  onClick={() => {
                                    openTaskConfig(task.id);
                                    setConfigPage('visibility');
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 border border-gray-200 hover:border-gray-300"
                                >
                                  <Eye className={`h-3 w-3 ${hasVisibilityRules ? 'text-amber-600' : 'text-gray-400'}`} />
                                </Button>
                              </Tooltip>
                            </div>
                            
                            {/* Hidden popover for configuration (still needed for direct action buttons) */}
                            <Popover 
                              open={configureTaskId === task.id} 
                              onOpenChange={(open) => open ? openTaskConfig(task.id) : closeTaskConfig()}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 opacity-0 pointer-events-none absolute"
                                  title="Hidden trigger"
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-96 p-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200" align="end">
                                {/* New Task Configuration Popup */}
                                <div className="bg-white rounded-lg shadow-lg min-h-[360px] max-h-[600px] overflow-hidden relative">
                                  {/* Floating Close Button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={closeTaskConfig}
                                    className="absolute top-4 right-4 h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full z-10"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  
                                  {/* Content */}
                                  <div className="p-6 overflow-y-auto flex-1">
                                    {renderConfigContent()}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            <Tooltip content="Edit task">
                              <Button
                                onClick={() => startEditing(task)}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 border border-gray-200 hover:border-gray-300"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Delete task">
                              <Button
                                onClick={() => handleDeleteTask(task.id)}
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive border border-gray-200 hover:border-gray-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Create New Task */}
      {canEdit && (
        <>
          {isCreating ? (
            <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Task title"
                    className="text-sm"
                    autoFocus
                  />
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description (optional)"
                    className="text-sm min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateTask}
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!newTask.title.trim()}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save Task
                    </Button>
                    <Button
                      onClick={cancelCreating}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              onClick={() => setIsCreating(true)}
              variant="outline"
              size="sm"
              className="w-full border-dashed border-2 h-12 text-sm text-muted-foreground hover:text-foreground hover:border-solid"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </>
      )}

      {visibleTasks.length === 0 && !isCreating && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No tasks added yet
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && lightboxTaskId && (
        <PhotoLightbox 
          isOpen={!!lightboxPhoto} 
          onClose={() => {
            setLightboxPhoto(null);
            setLightboxTaskId(null);
          }} 
          photoUrl={lightboxPhoto}
          contextType="task"
          contextId={lightboxTaskId}
          onPhotoUpdated={(newPhotoUrl) => {
            handlePhotoUploaded(lightboxTaskId, newPhotoUrl);
            setLightboxPhoto(null);
            setLightboxTaskId(null);
          }}
          contextData={(() => {
            const task = tasks.find(t => t.id === lightboxTaskId);
            return task ? {
              title: task.title,
              description: task.description
            } : undefined;
          })()}
        />
      )}
    </div>
  );
}
