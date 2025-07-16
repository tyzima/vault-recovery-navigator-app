import React, { useState, useEffect } from 'react';
import { fileClient } from '@/lib/fileClient';
import { RunbookExecution } from '@/lib/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Clock, User, Calendar, Building2, CheckCircle, ArrowRight, AlertCircle, Download, FileText, FileSpreadsheet, Search, Archive, Grid3X3, List, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';
import { MultiAppDisplay } from '@/components/runbooks/MultiAppDisplay';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { generateExecutionCSV, generateExecutionPDF, ExecutionReportData } from '@/utils/executionReportGenerator';

// Define enriched execution type
type EnrichedExecution = RunbookExecution & {
  runbook?: {
    title: string;
    description?: string;
    runbook_apps: Array<{
      app: { id: string; name: string; logo_url: string };
    }>;
  };
  client?: { name: string };
  started_by_profile?: {
    first_name?: string;
    last_name?: string;
  };
  step_assignments: Array<{
    id: string;
    status?: string;
    assigned_to?: string;
    step: { step_order: number };
  }>;
};

export function ExecutionsList() {
  const [executions, setExecutions] = useState<EnrichedExecution[]>([]);
  const [filteredExecutions, setFilteredExecutions] = useState<EnrichedExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingReport, setExportingReport] = useState<'csv' | 'pdf' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRunbook, setSelectedRunbook] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const savedViewMode = localStorage.getItem('executions-view-mode');
    return (savedViewMode === 'card' || savedViewMode === 'table') ? savedViewMode : 'card';
  });
  const [isExportingAll, setIsExportingAll] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      fetchExecutions();
    }
  }, [profile]);

  const fetchExecutions = async () => {
    if (!profile) {
      console.log('No profile available, skipping execution fetch');
      return;
    }

    try {
      console.log('Fetching executions for profile:', profile.role, profile.client_id);
      
      // Fetch executions
      const executionsResult = await fileClient.from('runbook_executions').select('*').execute();
      if (executionsResult.error) {
        console.error('Error fetching executions:', executionsResult.error);
        throw executionsResult.error;
      }
      
      let executions = executionsResult.data || [];
      console.log('Raw executions fetched:', executions.length);
      
      // Filter based on user role - client users can only see their own client's executions
      if (profile.role === 'client_admin' || profile.role === 'client_member') {
        console.log('Filtering executions for client_id:', profile.client_id);
        executions = executions.filter(exec => exec.client_id === profile.client_id);
        console.log('Filtered executions:', executions.length);
      }
      
      // Sort by created_at descending
      executions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Fetch related data for each execution
      const enrichedExecutions = await Promise.all(executions.map(async (execution): Promise<EnrichedExecution> => {
        try {
          console.log('Enriching execution:', execution.id);
          
          // Fetch runbook data
          const runbookResult = await fileClient.from('runbooks').select('*').eq('id', execution.runbook_id);
          const runbook = runbookResult.data?.[0];
          
          // Fetch client data
          const clientResult = await fileClient.from('clients').select('*').eq('id', execution.client_id);
          const client = clientResult.data?.[0];
          
          // Fetch started by profile
          const profileResult = await fileClient.from('profiles').select('*').eq('id', execution.started_by);
          const started_by_profile = profileResult.data?.[0];
          
          // Fetch step assignments
          const assignmentsResult = await fileClient.from('execution_step_assignments').select('*').eq('execution_id', execution.id);
          const step_assignments = assignmentsResult.data || [];
          console.log('Step assignments for execution', execution.id, ':', step_assignments.length);
        
        // Fetch runbook apps if runbook exists
        let runbook_apps = [];
        if (runbook) {
          const runbookAppsResult = await fileClient.from('runbook_apps').select('*').eq('runbook_id', runbook.id);
          const runbookAppsData = runbookAppsResult.data || [];
          
          runbook_apps = await Promise.all(runbookAppsData.map(async (ra) => {
            const appResult = await fileClient.from('apps').select('*').eq('id', ra.app_id);
            return {
              app: appResult.data?.[0]
            };
          }));
        }
        
        // Fetch step data for assignments
        const enrichedAssignments = await Promise.all(step_assignments.map(async (assignment) => {
          const stepResult = await fileClient.from('runbook_steps').select('*').eq('id', assignment.step_id);
          const step = stepResult.data?.[0];
          return {
            ...assignment,
            assigned_to: assignment.assigned_to,
            step: step ? { step_order: step.step_order } : { step_order: 0 }
          };
        }));
        
          return {
            ...execution,
            runbook: runbook ? {
              title: runbook.title,
              description: runbook.description,
              runbook_apps
            } : undefined,
            client: client ? { name: client.name } : undefined,
            started_by_profile: started_by_profile ? {
              first_name: started_by_profile.first_name,
              last_name: started_by_profile.last_name
            } : undefined,
            step_assignments: enrichedAssignments
          };
        } catch (error) {
          console.error('Error enriching execution', execution.id, ':', error);
          // Return a basic execution with empty step_assignments to avoid breaking the UI
          return {
            ...execution,
            step_assignments: []
          };
        }
      }));
      
      console.log('Final enriched executions:', enrichedExecutions.length);
      setExecutions(enrichedExecutions);
      setFilteredExecutions(enrichedExecutions);
      
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast({
        title: "Error",
        description: `Failed to load executions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter executions based on search and filters
  React.useEffect(() => {
    const filtered = executions.filter(execution => {
      const matchesSearch = execution.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        execution.runbook?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        execution.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRunbook = selectedRunbook === 'all' || 
        execution.runbook?.title === selectedRunbook;
      
      const matchesTeam = selectedTeam === 'all' || 
        execution.client?.name === selectedTeam;
        
      const matchesStatus = selectedStatus === 'all' || 
        execution.status === selectedStatus;
      
      return matchesSearch && matchesRunbook && matchesTeam && matchesStatus;
    });
    setFilteredExecutions(filtered);
  }, [searchQuery, selectedRunbook, selectedTeam, selectedStatus, executions]);

  // Get unique values for filter options
  const uniqueRunbooks = React.useMemo(() => {
    const runbooks = new Set();
    executions.forEach(execution => {
      if (execution.runbook?.title) {
        runbooks.add(execution.runbook.title);
      }
    });
    return Array.from(runbooks).sort();
  }, [executions]);

  const uniqueTeams = React.useMemo(() => {
    const teams = new Set();
    executions.forEach(execution => {
      if (execution.client?.name) {
        teams.add(execution.client.name);
      }
    });
    return Array.from(teams).sort();
  }, [executions]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = new Set();
    executions.forEach(execution => {
      if (execution.status) {
        statuses.add(execution.status);
      }
    });
    return Array.from(statuses).sort();
  }, [executions]);

  // Handle view mode change and save to localStorage
  const handleViewModeChange = (newViewMode: 'card' | 'table') => {
    setViewMode(newViewMode);
    localStorage.setItem('executions-view-mode', newViewMode);
  };

  const getExecutionProgress = (stepAssignments: EnrichedExecution['step_assignments']) => {
    if (!stepAssignments || stepAssignments.length === 0) return 0;
    const completedSteps = stepAssignments.filter(sa => sa.status === 'completed').length;
    return Math.round((completedSteps / stepAssignments.length) * 100);
  };

  const hasUserActiveAssignments = (execution: EnrichedExecution) => {
    if (!user?.id || !execution.step_assignments || execution.status !== 'active') return false;
    
    // Check if user has any steps they can work on
    return execution.step_assignments.some(assignment => {
      if (assignment.assigned_to !== user.id) return false;
      
      // If step is already in progress, user can work on it
      if (assignment.status === 'in_progress') return true;
      
      // If step is not started, check if it's ready to be worked on
      if (assignment.status === 'not_started') {
        const currentStepOrder = assignment.step.step_order;
        
        // Check if all previous steps are completed
        const previousSteps = execution.step_assignments.filter(sa => 
          sa.step.step_order < currentStepOrder
        );
        
        // If no previous steps, this step is ready
        if (previousSteps.length === 0) return true;
        
        // If all previous steps are completed, this step is ready
        return previousSteps.every(ps => ps.status === 'completed');
      }
      
      return false;
    });
  };

  const hasUserAnyAssignments = (execution: EnrichedExecution) => {
    if (!user?.id || !execution.step_assignments) return false;
    return execution.step_assignments.some(assignment => assignment.assigned_to === user.id);
  };

  const getStatusBadgeProps = (status: RunbookExecution['status'], progress: number) => {
    const isCompleted = progress === 100;
    
    if (isCompleted) {
      return {
        variant: 'default' as const,
        className: 'bg-green-600 hover:bg-green-700 text-white'
      };
    }
    
    switch (status) {
      case 'active':
        return {
          variant: 'default' as const,
          className: 'bg-blue-600 hover:bg-blue-700 text-white'
        };
      case 'paused':
        return {
          variant: 'secondary' as const,
          className: ''
        };
      default:
        return {
          variant: 'outline' as const,
          className: ''
        };
    }
  };

  const formatStatusText = (status: RunbookExecution['status'], progress: number) => {
    if (progress === 100) return 'Completed';
    return status?.charAt(0).toUpperCase() + status?.slice(1) || 'Draft';
  };

  const getStatusIcon = (status: RunbookExecution['status'], progress: number) => {
    const isCompleted = progress === 100;
    
    if (isCompleted) {
      return {
        icon: CheckCircle,
        className: 'text-green-600',
        tooltip: 'Completed'
      };
    }
    
    switch (status) {
      case 'active':
        return {
          icon: Play,
          className: 'text-blue-600',
          tooltip: 'Active'
        };
      case 'paused':
        return {
          icon: Pause,
          className: 'text-orange-600',
          tooltip: 'Paused'
        };
      default:
        return {
          icon: Clock,
          className: 'text-gray-600',
          tooltip: 'Draft'
        };
    }
  };

  // Export all functionality
  const handleExportAll = async () => {
    if (filteredExecutions.length === 0) {
      toast({
        title: "No Data",
        description: "No executions to export",
        variant: "destructive",
      });
      return;
    }

    setIsExportingAll(true);
    
    try {
      // Dynamic import to avoid bundle bloat
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Generate manifest CSV
      const manifestHeaders = [
        'ID',
        'Title',
        'Runbook',
        'Team',
        'Status',
        'Progress',
        'Started By',
        'Created Date',
        'Started Date',
        'Completed Date',
        'Total Steps',
        'Completed Steps'
      ];

      const manifestRows = filteredExecutions.map(execution => {
        const progress = getExecutionProgress(execution.step_assignments);
        const completedSteps = execution.step_assignments?.filter(sa => sa.status === 'completed').length || 0;
        const totalSteps = execution.step_assignments?.length || 0;

        return [
          execution.id,
          execution.title,
          execution.runbook?.title || 'Unknown Runbook',
          execution.client?.name || 'Unknown Team',
          formatStatusText(execution.status || 'draft', progress),
          `${progress}%`,
          `${execution.started_by_profile?.first_name || ''} ${execution.started_by_profile?.last_name || ''}`.trim() || 'Unknown',
          execution.created_at ? new Date(execution.created_at).toLocaleString() : '',
          execution.started_at ? new Date(execution.started_at).toLocaleString() : '',
          execution.completed_at ? new Date(execution.completed_at).toLocaleString() : '',
          totalSteps.toString(),
          completedSteps.toString()
        ];
      });

      // Create manifest CSV content
      const manifestCsvContent = [
        manifestHeaders,
        ...manifestRows
      ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

      // Add manifest to zip
      zip.file('manifest.csv', manifestCsvContent);

      // Generate detailed CSV for each execution
      let successCount = 0;
      const errorExecutions: string[] = [];

      for (const execution of filteredExecutions) {
        try {
          const reportData = await fetchDetailedExecutionData(execution.id);
          
          if (reportData) {
            // Generate detailed execution data in CSV format
            const executionHeaders = [
              'Step Order',
              'Step Title',
              'Step Description',
              'Assigned To',
              'Status',
              'Created Date',
              'Started Date',
              'Completed Date',
              'Duration',
              'Estimated Duration (min)',
              'Notes'
            ];

            const executionRows = reportData.step_assignments.map(step => [
              step.step_order.toString(),
              step.step_title,
              step.step_description || '',
              step.assigned_to || '',
              step.status,
              step.created_at ? new Date(step.created_at).toLocaleString() : '',
              step.started_at ? new Date(step.started_at).toLocaleString() : '',
              step.completed_at ? new Date(step.completed_at).toLocaleString() : '',
              step.duration || '',
              step.estimated_duration_minutes?.toString() || '',
              step.notes || ''
            ]);

            // Create execution CSV content with metadata header
            const metadataRows = [
              ['Execution ID', reportData.id],
              ['Title', reportData.title],
              ['Runbook', reportData.runbook_title],
              ['Team', reportData.client_name],
              ['Status', reportData.status],
              ['Progress', `${reportData.progress}%`],
              ['Started By', reportData.started_by],
              ['Created Date', reportData.created_at ? new Date(reportData.created_at).toLocaleString() : ''],
              ['Started Date', reportData.started_at ? new Date(reportData.started_at).toLocaleString() : ''],
              ['Completed Date', reportData.completed_at ? new Date(reportData.completed_at).toLocaleString() : ''],
              ['Total Duration', reportData.total_duration || ''],
              ['', ''], // Empty row for separation
              ['STEP DETAILS', ''],
              ['', ''] // Empty row for separation
            ];

            const executionCsvContent = [
              ...metadataRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
              executionHeaders.map(header => `"${header}"`).join(','),
              ...executionRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            // Safe filename
            const safeFilename = `execution_${reportData.id}_${reportData.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.csv`;
            zip.file(safeFilename, executionCsvContent);
            successCount++;
          } else {
            errorExecutions.push(execution.title);
          }
        } catch (error) {
          console.error(`Error generating CSV for execution ${execution.id}:`, error);
          errorExecutions.push(execution.title);
        }
      }

      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `executions_export_${timestamp}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success/error summary
      if (errorExecutions.length === 0) {
        toast({
          title: "Export Successful",
          description: `Successfully exported ${successCount} execution reports`,
        });
      } else {
        toast({
          title: "Export Completed with Errors",
          description: `Exported ${successCount} executions. Failed: ${errorExecutions.length}`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error generating export:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate export file",
        variant: "destructive",
      });
    } finally {
      setIsExportingAll(false);
    }
  };







  const fetchDetailedExecutionData = async (executionId: string): Promise<ExecutionReportData | null> => {
    try {
      console.log('Fetching detailed execution data for:', executionId);
      
      // Fetch execution
      const executionResult = await fileClient.from('runbook_executions').select('*').eq('id', executionId);
      const execution = executionResult.data?.[0];
      
      if (!execution) {
        console.log('Execution not found:', executionId);
        return null;
      }
      
      // Fetch runbook data
      const runbookResult = await fileClient.from('runbooks').select('*').eq('id', execution.runbook_id);
      const runbook = runbookResult.data?.[0];
      
      // Fetch client data
      const clientResult = await fileClient.from('clients').select('*').eq('id', execution.client_id);
      const client = clientResult.data?.[0];
      
      // Fetch started by profile
      const profileResult = await fileClient.from('profiles').select('*').eq('id', execution.started_by);
      const started_by_profile = profileResult.data?.[0];
      
      // Fetch step assignments with full details
      const assignmentsResult = await fileClient.from('execution_step_assignments').select('*').eq('execution_id', execution.id);
      const step_assignments = assignmentsResult.data || [];
      
      // Fetch detailed step and assignment data
      const enrichedAssignments = await Promise.all(step_assignments.map(async (assignment) => {
        const stepResult = await fileClient.from('runbook_steps').select('*').eq('id', assignment.step_id);
        const step = stepResult.data?.[0];
        
        // Fetch assigned profile if exists
        let assigned_profile = null;
        if (assignment.assigned_to) {
          const assignedProfileResult = await fileClient.from('profiles').select('*').eq('id', assignment.assigned_to);
          assigned_profile = assignedProfileResult.data?.[0];
        }
        
        return {
          assignment,
          step,
          assigned_profile
        };
      }));

      // Calculate total duration
      const calculateTotalDuration = () => {
        if (!execution.created_at) return null;
        
        const endTime = execution.completed_at ? new Date(execution.completed_at) : new Date();
        const startTime = new Date(execution.created_at);
        const diffMs = endTime.getTime() - startTime.getTime();
        
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const remainingMinutes = diffMinutes % 60;
        const diffDays = Math.floor(diffHours / 24);
        const remainingHours = diffHours % 24;
        
        if (diffDays > 0) {
          return `${diffDays}d ${remainingHours}h ${remainingMinutes}m`;
        } else if (diffHours > 0) {
          return remainingMinutes > 0 
            ? `${diffHours}h ${remainingMinutes}m`
            : `${diffHours}h`;
        }
        
        return `${diffMinutes}m`;
      };

      // Calculate step duration
      const calculateStepDuration = (startedAt: string | null, completedAt: string | null) => {
        if (!startedAt || !completedAt) return null;
        
        const start = new Date(startedAt);
        const end = new Date(completedAt);
        const diffMs = end.getTime() - start.getTime();
        
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const remainingMinutes = diffMinutes % 60;
        
        if (diffHours > 0) {
          return remainingMinutes > 0 
            ? `${diffHours}h ${remainingMinutes}m`
            : `${diffHours}h`;
        }
        
        return `${diffMinutes}m`;
      };

      // Calculate progress
      const completedSteps = enrichedAssignments.filter(ea => ea.assignment.status === 'completed').length;
      const progress = enrichedAssignments.length > 0 ? Math.round((completedSteps / enrichedAssignments.length) * 100) : 0;

      return {
        id: execution.id,
        title: execution.title,
        runbook_title: runbook?.title || 'Unknown Runbook',
        runbook_description: runbook?.description || undefined,
        client_name: client?.name || 'Unknown Client',
        status: execution.status || 'draft',
        started_by: started_by_profile 
          ? `${started_by_profile.first_name} ${started_by_profile.last_name}`
          : 'Unknown User',
        created_at: execution.created_at || '',
        started_at: execution.started_at || undefined,
        completed_at: execution.completed_at || undefined,
        total_duration: calculateTotalDuration() || undefined,
        progress,
        step_assignments: enrichedAssignments.map(({ assignment, step, assigned_profile }) => ({
          id: assignment.id,
          step_order: step?.step_order || 0,
          step_title: step?.title || `Step ${step?.step_order || 0}`,
          step_description: step?.description || undefined,
          assigned_to: assigned_profile 
            ? `${assigned_profile.first_name} ${assigned_profile.last_name}`
            : undefined,
          status: assignment.status || 'not_started',
          created_at: assignment.created_at,
          started_at: assignment.started_at || undefined,
          completed_at: assignment.completed_at || undefined,
          duration: calculateStepDuration(assignment.started_at, assignment.completed_at) || undefined,
          notes: assignment.notes || undefined,
          estimated_duration_minutes: step?.estimated_duration_minutes || undefined
        }))
      };
    } catch (error) {
      console.error('Error fetching detailed execution data:', error);
      return null;
    }
  };

  const handleExportSingleExecution = async (execution: EnrichedExecution, format: 'csv' | 'pdf', event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to execution details
    
    setExportingReport(format);
    try {
      // Fetch detailed data including step completion times, notes, etc.
      const reportData = await fetchDetailedExecutionData(execution.id);
      
      if (!reportData) {
        toast({
          title: "Error",
          description: "Unable to fetch detailed execution data",
          variant: "destructive"
        });
        return;
      }

      if (format === 'csv') {
        generateExecutionCSV(reportData);
        toast({
          title: "Success",
          description: "Detailed execution report exported to CSV successfully"
        });
      } else {
        await generateExecutionPDF(reportData);
        toast({
          title: "Success",
          description: "Detailed execution report exported to PDF successfully"
        });
      }
    } catch (error) {
      console.error(`Error generating ${format.toUpperCase()}:`, error);
      toast({
        title: "Error",
        description: `Failed to generate ${format.toUpperCase()} export`,
        variant: "destructive"
      });
    } finally {
      setExportingReport(null);
    }
  };

  if (loading) {
    return null;
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No executions found</h3>
          <p className="text-sm text-muted-foreground">
            Executions will appear here once runbooks are started
          </p>
        </div>
      </div>
    );
  }

  // Split executions into two groups using filtered executions
  const myExecutions = filteredExecutions.filter(execution => hasUserAnyAssignments(execution));
  const otherExecutions = filteredExecutions.filter(execution => !hasUserAnyAssignments(execution));

  const renderExecutionCard = (execution: EnrichedExecution, index: number) => {
    const progress = getExecutionProgress(execution.step_assignments);
    const isCompleted = progress === 100;
    const badgeProps = getStatusBadgeProps(execution.status || 'draft', progress);
    const runbookAppIds = execution.runbook?.runbook_apps?.map(ra => ra.app.id) || [];
    const userHasActiveAssignments = hasUserActiveAssignments(execution);
    
    return (
      <Card 
        key={execution.id} 
        className={`transition-all duration-200 cursor-pointer group animate-fade-in ${
          isCompleted 
            ? 'border-green-300 bg-gradient-to-r from-green-50/30 to-emerald-50/20 shadow-sm shadow-green-100/50 hover:shadow-md hover:shadow-green-200/60 hover:border-green-400' 
            : 'border-gray-200 bg-white shadow-sm hover:shadow-lg hover:shadow-gray-200/50 hover:border-blue-300 hover:bg-blue-50/20'
        }`}
        style={{ 
          opacity: 0,
          animation: `fadeIn 0.8s ease-out ${index * 80}ms forwards`
        }}
        onClick={() => navigate(`/executions/${execution.id}`)}
      >
        <CardContent className="p-4">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h3 className={`text-lg font-semibold truncate ${
                isCompleted ? 'text-green-800' : 'text-gray-900'
              }`}>
                {execution.title}
              </h3>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={badgeProps.variant}
                  className={`${badgeProps.className} text-xs shadow-sm`}
                >
                  {formatStatusText(execution.status || 'draft', progress)}
                </Badge>
                {userHasActiveAssignments && !isCompleted && (
                  <Badge 
                    variant="outline" 
                    className="text-xs bg-orange-50 text-orange-700 border-orange-200 animate-pulse shadow-sm"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Your Turn
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={exportingReport !== null}
                    className={`${
                      isCompleted 
                        ? 'hover:bg-green-100 hover:text-green-700' 
                        : 'hover:bg-blue-100 hover:text-blue-700'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem 
                    onClick={(e) => handleExportSingleExecution(execution, 'csv', e)}
                    disabled={exportingReport !== null}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => handleExportSingleExecution(execution, 'pdf', e)}
                    disabled={exportingReport !== null}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Details Button */}
              <Button 
                variant="ghost" 
                size="sm"
                className={`${
                  isCompleted 
                    ? 'hover:bg-green-100 hover:text-green-700' 
                    : 'hover:bg-blue-100 hover:text-blue-700'
                }`}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Runbook and Apps Row */}
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm text-left truncate flex-1 ${
              isCompleted ? 'text-green-700' : 'text-gray-600'
            }`}>
              Runbook: <span className="font-medium">{execution.runbook?.title}</span>
            </p>
            {runbookAppIds.length > 0 && (
              <MultiAppDisplay 
                appIds={runbookAppIds}
                size="sm"
                maxDisplay={3}
                className="ml-4 flex-shrink-0"
              />
            )}
          </div>
          
          {/* Progress and Metadata Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Progress Section - Left Side */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Progress 
                  value={progress} 
                  className={`w-24 h-2 ${
                    isCompleted 
                      ? '[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-emerald-500 bg-green-100' 
                      : 'bg-gray-100'
                  }`}
                />
                <span className={`text-sm font-medium ${
                  isCompleted ? 'text-green-700' : 'text-gray-700'
                }`}>
                  {progress}%
                </span>
              </div>
              
              <div className={`text-xs whitespace-nowrap ${
                isCompleted ? 'text-green-600' : 'text-gray-500'
              }`}>
                {execution.step_assignments?.filter(sa => sa.status === 'completed').length || 0}/{execution.step_assignments?.length || 0} steps
              </div>
              
              {isCompleted && (
                <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">Complete</span>
                </div>
              )}
            </div>

            {/* Metadata - Right Side */}
            <div className={`flex items-center gap-6 text-sm flex-shrink-0 ${
              isCompleted ? 'text-green-700' : 'text-gray-600'
            }`}>
              {/* Started by */}
              <div className="flex items-center gap-1.5">
                <User className={`h-3 w-3 ${
                  isCompleted ? 'text-green-500' : 'text-gray-400'
                }`} />
                <span className="truncate max-w-24">
                  {execution.started_by_profile?.first_name} {execution.started_by_profile?.last_name}
                </span>
              </div>

              {/* Client */}
              <div className="flex items-center gap-1.5">
                <Building2 className={`h-3 w-3 ${
                  isCompleted ? 'text-green-500' : 'text-gray-400'
                }`} />
                <span className="truncate max-w-32">{execution.client?.name}</span>
              </div>

              {/* Created date */}
              <div className="flex items-center gap-1.5">
                <Calendar className={`h-3 w-3 ${
                  isCompleted ? 'text-green-500' : 'text-gray-400'
                }`} />
                <span className="whitespace-nowrap">
                  {new Date(execution.created_at || '').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Table view component
  const renderExecutionTable = (executions: EnrichedExecution[], startIndex = 0) => (
    <div className="w-full overflow-x-auto">
      <div className="border rounded-lg overflow-hidden bg-white min-w-max">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-8">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-1/3">Title</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-1/5">Runbook</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-24">Team</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-20">Progress</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-24">Created</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {executions.map((execution, index) => {
              const progress = getExecutionProgress(execution.step_assignments);
              const isCompleted = progress === 100;
              const badgeProps = getStatusBadgeProps(execution.status || 'draft', progress);
              const userHasActiveAssignments = hasUserActiveAssignments(execution);
              
              return (
                <tr 
                  key={execution.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  style={{ 
                    opacity: 0,
                    animation: `fadeIn 0.6s ease-out ${(startIndex + index) * 60}ms forwards`
                  }}
                  onClick={() => navigate(`/executions/${execution.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tooltip 
                        content={getStatusIcon(execution.status || 'draft', progress).tooltip}
                        side="right"
                        className="bg-white text-gray-900 border border-gray-200 shadow-lg"
                      >
                        <div className="cursor-help">
                          {(() => {
                            const statusInfo = getStatusIcon(execution.status || 'draft', progress);
                            const StatusIcon = statusInfo.icon;
                            return <StatusIcon className={`h-4 w-4 ${statusInfo.className}`} />;
                          })()}
                        </div>
                      </Tooltip>
                      {userHasActiveAssignments && !isCompleted && (
                        <Tooltip 
                          content="Your Turn"
                          side="right"
                          className="bg-white text-gray-900 border border-gray-200 shadow-lg"
                        >
                          <div className="cursor-help">
                            <AlertCircle className="h-3 w-3 text-orange-600" />
                          </div>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="font-medium text-gray-900 truncate text-left" title={execution.title}>
                      {execution.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="text-sm text-gray-600 truncate text-left" title={execution.runbook?.title}>
                      {execution.runbook?.title || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="text-sm text-gray-600 truncate text-left" title={execution.client?.name}>
                      {execution.client?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={progress} 
                        className={`w-16 h-2 ${
                          isCompleted 
                            ? '[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-emerald-500 bg-green-100' 
                            : 'bg-gray-100'
                        }`}
                      />
                      <span className="text-xs text-gray-600 w-8">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="text-sm text-gray-600 text-left">
                      {new Date(execution.created_at || '').toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={exportingReport !== null}
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem 
                            onClick={(e) => handleExportSingleExecution(execution, 'csv', e)}
                            disabled={exportingReport !== null}
                          >
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Export CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => handleExportSingleExecution(execution, 'pdf', e)}
                            disabled={exportingReport !== null}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Export PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Search and Filter Header */}
        <div className="w-full overflow-x-auto">
          <div className="flex items-center justify-between gap-4 min-w-max px-4 lg:px-0">
            <div className="flex items-center gap-4 flex-1">
              {/* Search Input */}
              <div className="relative w-80 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <Select value={selectedRunbook} onValueChange={setSelectedRunbook}>
                <SelectTrigger className="w-48 flex-shrink-0">
                  <SelectValue placeholder="Filter by runbook" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Runbooks</SelectItem>
                  {uniqueRunbooks.map((runbook) => (
                    <SelectItem key={runbook as string} value={runbook as string}>
                      {runbook as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-36 flex-shrink-0">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {uniqueTeams.map((team) => (
                    <SelectItem key={team as string} value={team as string}>
                      {team as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-36 flex-shrink-0">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status as string} value={status as string}>
                      {formatStatusText(status as RunbookExecution['status'], 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Export All Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportAll}
                disabled={isExportingAll || filteredExecutions.length === 0}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                {isExportingAll ? 'Exporting...' : 'Export All'}
              </Button>

              {/* View Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('card')}
                  className="h-7 px-2"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('table')}
                  className="h-7 px-2"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* Content based on view mode */}
        {viewMode === 'card' ? (
          <>
            {/* My Executions Section */}
            {myExecutions.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">My Assignments</h2>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {myExecutions.length}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {myExecutions.map((execution, index) => renderExecutionCard(execution, index))}
                </div>
              </div>
            )}

            {/* Other Executions Section */}
            {otherExecutions.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {myExecutions.length > 0 ? 'Other Executions' : 'All Executions'}
                  </h2>
                  <Badge variant="outline" className="text-gray-600">
                    {otherExecutions.length}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {otherExecutions.map((execution, index) => renderExecutionCard(execution, myExecutions.length + index))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Table View */
          <div className="space-y-6">
            {/* My Assignments Table */}
            {myExecutions.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">My Assignments</h2>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {myExecutions.length}
                  </Badge>
                </div>
                {renderExecutionTable(myExecutions, 0)}
              </div>
            )}

            {/* Other Executions Table */}
            {otherExecutions.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {myExecutions.length > 0 ? 'Other Executions' : 'All Executions'}
                  </h2>
                  <Badge variant="outline" className="text-gray-600">
                    {otherExecutions.length}
                  </Badge>
                </div>
                {renderExecutionTable(otherExecutions, myExecutions.length)}
              </div>
            )}
          </div>
        )}

        {/* Empty state when user has no executions */}
        {myExecutions.length === 0 && otherExecutions.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No executions found</h3>
              <p className="text-sm text-muted-foreground">
                Executions will appear here once runbooks are started
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
