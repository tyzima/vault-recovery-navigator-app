import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fileClient } from '@/lib/fileClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAppBranding } from '@/hooks/useAppBranding';
import { BookOpen, Search, Calendar, User, Building2, Download, Play, Copy, Info, Grid3X3, List, MoreHorizontal, Clock, CheckCircle, Pause, Archive } from 'lucide-react';
import { generateRunbookPDF } from '@/utils/pdfGenerator';
import { StartExecutionDialog } from '@/components/executions/StartExecutionDialog';
import { Tooltip } from '@/components/ui/tooltip';
import { ClientLogo } from '@/components/clients/ClientLogo';
import { getClientLogoUrl, getAppBrandingLogoUrl } from '@/utils/urlUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Runbook {
  id: string;
  client_id?: string;
  title: string;
  description?: string;
  is_template: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
  app_id?: string;
  template_name?: string;
  template_description?: string;
  client?: {
    name: string;
    logo_url?: string;
  } | null;
  creator?: {
    first_name: string;
    last_name: string;
  } | null;
  lastExecution?: {
    id: string;
    title: string;
    status: string;
    started_at?: string;
    completed_at?: string;
  } | null;
}

// Small book component that mimics the PDF cover design
const RunbookBookCover: React.FC<{ 
  title: string; 
  primaryColor?: string; 
  logoUrl?: string;
  themeMode?: 'light' | 'dark';
}> = ({ title, primaryColor = '#84cc16', logoUrl, themeMode = 'dark' }) => {
  const defaultLogoUrl = 'https://xs26tevltn.ufs.sh/f/W00C7B5w6iteSxRR6sGW2dvMzkeIAOiQ9qnsYoEGtr65CZDW';
  const processedLogoUrl = logoUrl ? getAppBrandingLogoUrl(logoUrl) : null;
  const finalLogoUrl = processedLogoUrl || defaultLogoUrl;

  // Truncate title for display
  const truncatedTitle = title.length > 15 ? title.substring(0, 12) + '...' : title;
  
  // Theme-based colors
  const isDarkMode = themeMode === 'dark';
  const backgroundColor = isDarkMode ? '#20211f' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const subtextColor = isDarkMode ? primaryColor : primaryColor;

  return (
    <div className="relative w-12 h-16 rounded-sm shadow-sm overflow-visible border border-gray-200 transition-all duration-300 hover:shadow-sm group">
      {/* Book cover background - matches PDF cover */}
      <div 
        className="absolute inset-0 transition-all duration-300 rounded-sm overflow-hidden" 
        style={{ backgroundColor }}
      >
        {/* Small logo in top left corner */}
        <div className="absolute top-1 left-1 w-3 h-3 rounded-sm overflow-hidden">
          <img 
            src={finalLogoUrl}
            alt="Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback to a small colored square if logo fails
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.style.backgroundColor = '#ffffff';
                parent.style.border = '1px solid #ffffff';
              }
            }}
          />
        </div>
        
        {/* Accent line - matches PDF */}
        <div 
          className="absolute top-4 left-0.5 right-0.5 h-0.5"
          style={{ backgroundColor: primaryColor }}
        />
        
        {/* Title text */}
        <div className="absolute bottom-1 left-0.5 right-0.5">
          <div 
            className="text-[6px] font-bold leading-tight truncate"
            style={{ 
              fontSize: '5px', 
              lineHeight: '6px',
              color: textColor
            }}
          >
            {truncatedTitle}
          </div>
          <div 
            className="text-[5px] font-normal leading-tight"
            style={{ 
              color: subtextColor, 
              fontSize: '4px', 
              lineHeight: '5px' 
            }}
          >
            Runbook
          </div>
        </div>

        {/* Gradient glare effect on hover */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:animate-[glare_0.8s_ease-out_forwards]"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            transform: 'translateX(-150%) skewX(-25deg)',
            width: '200%'
          }}
        />
      </div>
      
      {/* Page turn effect - triangle cutout on hover with correct angle */}
      <div 
        className="absolute -bottom-0.5 -right-0 w-0 h-0 transition-all duration-300 opacity-0 group-hover:opacity-100"
        style={{
          borderLeft: '10px solid transparent',
          borderTop: '12px solid #ffffff',
          transform: 'rotate(90deg)',
        }}
      />
      
      {/* Book spine effect */}
      <div className="absolute left-0 top-0 bottom-0 w-0.2 bg-slate-500 opacity-20" />
      
      {/* Book binding lines */}
      <div className="absolute left-1 top-2 bottom-2 w-px bg-white opacity-20" />
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-white opacity-10" />
    </div>
  );
};

export function RunbooksList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { branding } = useAppBranding();
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [filteredRunbooks, setFilteredRunbooks] = useState<Runbook[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showStartExecution, setShowStartExecution] = useState(false);
  const [selectedRunbook, setSelectedRunbook] = useState<Runbook | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    // Load view mode from localStorage, default to 'card' if not found
    const savedViewMode = localStorage.getItem('runbooks-view-mode');
    return (savedViewMode === 'card' || savedViewMode === 'table') ? savedViewMode : 'card';
  });
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const fetchRunbooks = useCallback(async () => {
    setLoading(true);
    try {
      // Get all runbooks
      const runbooksResult = await fileClient.from('runbooks').select('*').execute();
      if (runbooksResult.error) {
        console.error('Error fetching runbooks:', runbooksResult.error);
        toast({
          title: "Error",
          description: "Failed to load runbooks",
          variant: "destructive"
        });
        return;
      }

      const runbooksData = runbooksResult.data || [];

      // Get all clients
      const clientsResult = await fileClient.from('clients').select('*').execute();
      const clients = clientsResult.data || [];

      // Get all profiles for creators
      const profilesResult = await fileClient.from('profiles').select('*').execute();
      const profiles = profilesResult.data || [];

      // Get all executions to find last execution for each runbook
      const executionsResult = await fileClient.from('runbook_executions').select('*').execute();
      const executions = executionsResult.data || [];

      // Join runbooks with clients and creators
      const runbooksWithDetails = runbooksData.map((runbook: any) => {
        const client = clients.find((c: any) => c.id === runbook.client_id);
        const creator = profiles.find((p: any) => p.id === runbook.created_by);
        
        // Find the most recent execution for this runbook
        const runbookExecutions = executions.filter((exec: any) => exec.runbook_id === runbook.id);
        const lastExecution = runbookExecutions.length > 0 
          ? runbookExecutions.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;
        
        return {
          ...runbook,
          client: client ? { 
            name: client.name,
            logo_url: client.logo_url 
          } : null,
          creator: creator ? {
            first_name: creator.first_name,
            last_name: creator.last_name
          } : null,
          lastExecution: lastExecution ? {
            id: lastExecution.id,
            title: lastExecution.title,
            status: lastExecution.status,
            started_at: lastExecution.started_at,
            completed_at: lastExecution.completed_at
          } : null
        };
      });

      // Sort by created_at descending
      runbooksWithDetails.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRunbooks(runbooksWithDetails);
    } catch (error) {
      console.error('Error fetching runbooks:', error);
      toast({
        title: "Error",
        description: "Failed to load runbooks",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRunbooks();
  }, [fetchRunbooks]);

  useEffect(() => {
    const filtered = runbooks.filter(runbook => {
      const matchesSearch = runbook.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        runbook.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesClient = selectedClient === 'all' || 
        (runbook.client_id === selectedClient);
      
      return matchesSearch && matchesClient;
    });
    setFilteredRunbooks(filtered);
  }, [searchQuery, selectedClient, runbooks]);

  // Get unique clients for the filter dropdown
  const uniqueClients = React.useMemo(() => {
    const clientsMap = new Map();
    runbooks.forEach(runbook => {
      if (runbook.client_id && runbook.client?.name) {
        clientsMap.set(runbook.client_id, runbook.client.name);
      }
    });
    return Array.from(clientsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [runbooks]);

  const handleRunbookClick = (runbookId: string) => {
    navigate(`/runbooks/${runbookId}`);
  };

  const handleDownloadPDF = async (runbook: Runbook) => {
    try {
      // Get runbook steps
      const stepsResult = await fileClient.from('runbook_steps').select('*').eq('runbook_id', runbook.id);
      if (stepsResult.error) {
        console.error('Error fetching runbook steps:', stepsResult.error);
        toast({
          title: "Error",
          description: "Failed to fetch runbook details for PDF generation",
          variant: "destructive"
        });
        return;
      }

      const steps = stepsResult.data || [];
      
      // Get all profiles for assigned users
      const profilesResult = await fileClient.from('profiles').select('*').execute();
      const profiles = profilesResult.data || [];

      // Transform the data to match the PDF generator interface
      const pdfData = {
        id: runbook.id,
        title: runbook.title,
        description: runbook.description,
        client: runbook.client,
        created_by_profile: runbook.creator,
        created_at: runbook.created_at,
        updated_at: runbook.updated_at,
        steps: steps.map((step: any) => {
          const assignedUser = step.assigned_to ? 
            profiles.find((p: any) => p.id === step.assigned_to) : null;
          
          return {
            id: step.id,
            title: step.title,
            description: step.description,
            step_order: step.step_order,
            estimated_duration_minutes: step.estimated_duration_minutes,
            assigned_user: assignedUser ? {
              first_name: assignedUser.first_name,
              last_name: assignedUser.last_name
            } : null,
            photo_url: step.photo_url,
            tasks: step.tasks || []
          };
        }).sort((a: any, b: any) => a.step_order - b.step_order)
      };

      generateRunbookPDF(pdfData, branding?.primary_color, branding?.app_logo_url, branding?.theme_mode);
      toast({
        title: "Success",
        description: "PDF download started"
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    }
  };

  const handleExecuteRunbook = (runbook: Runbook) => {
    setSelectedRunbook(runbook);
    setShowStartExecution(true);
  };

  const handleExecutionStarted = () => {
    setShowStartExecution(false);
    setSelectedRunbook(null);
    navigate('/executions');
  };

  const handleCloneRunbook = async (runbook: Runbook) => {
    console.log('RunbooksList: Cloning runbook:', runbook.id);
    
    try {
      // Fetch the full runbook data with steps
      const [runbookResponse, stepsResponse] = await Promise.all([
        fileClient.from('runbooks').select('*').eq('id', runbook.id),
        fileClient.from('runbook_steps').select('*').eq('runbook_id', runbook.id)
      ]);

      const fullRunbook = runbookResponse.data?.[0];
      const steps = stepsResponse.data || [];

      if (!fullRunbook) {
        throw new Error('Runbook not found');
      }

      // Generate a new UUID for the cloned runbook
      const newRunbookId = crypto.randomUUID();
      
      // Create the cloned runbook with current timestamp
      const currentTimestamp = new Date().toISOString();
      const clonedRunbook = {
        id: newRunbookId,
        title: `${fullRunbook.title} Copy`,
        description: fullRunbook.description,
        client_id: fullRunbook.client_id,
        created_by: user?.id,
        is_template: false,
        created_at: currentTimestamp,
        updated_at: currentTimestamp
      };

      console.log('RunbooksList: Cloned runbook object:', clonedRunbook);

      const runbookResult = await fileClient
        .from('runbooks')
        .insert(clonedRunbook);

      if (runbookResult.error) {
        console.error('RunbooksList: Error inserting runbook:', runbookResult.error);
        throw new Error(runbookResult.error.message);
      }

      // Clone all steps
      if (steps.length > 0) {
        // Sort steps by step_order
        steps.sort((a, b) => a.step_order - b.step_order);
        
        const clonedSteps = steps.map((step: any) => {
          const newStepId = crypto.randomUUID();
          
          // Clone tasks with new UUIDs
          const clonedTasks = (step.tasks || []).map((task: any) => ({
            ...task,
            id: crypto.randomUUID() // Generate new UUID for each task
          }));
          
          return {
            id: newStepId,
            runbook_id: newRunbookId,
            title: step.title,
            description: step.description,
            step_order: step.step_order,
            estimated_duration_minutes: step.estimated_duration_minutes,
            assigned_to: step.assigned_to,
            tasks: clonedTasks,
            photo_url: step.photo_url,
            app_id: step.app_id,
            conditions: step.conditions,
            depends_on: step.depends_on,
            created_at: currentTimestamp,
            updated_at: currentTimestamp
          };
        });

        // Insert steps one by one
        for (let i = 0; i < clonedSteps.length; i++) {
          const step = clonedSteps[i];
          const stepResult = await fileClient
            .from('runbook_steps')
            .insert(step);

          if (stepResult.error) {
            console.error(`RunbooksList: Error inserting step ${i + 1}:`, stepResult.error);
            throw new Error(`Failed to insert step ${i + 1}: ${stepResult.error.message}`);
          }
        }
      }

      toast({
        title: 'Success',
        description: 'Runbook cloned successfully'
      });

      // Refresh the runbooks list
      await fetchRunbooks();

      // Navigate to the new runbook after a short delay
      setTimeout(() => {
        navigate(`/runbooks/${newRunbookId}`);
      }, 500);

    } catch (error) {
      console.error('RunbooksList: Error cloning runbook:', error);
      toast({
        title: 'Error',
        description: 'Failed to clone runbook',
        variant: 'destructive'
      });
    }
  };

  const canStartExecution = () => {
    if (!profile) return false;
    return (
      profile.role === 'kelyn_admin' ||
      profile.role === 'kelyn_rep' ||
      profile.role === 'client_admin'
    );
  };

  const canShowAdminButtons = () => {
    if (!profile) return false;
    return (
      profile.role === 'kelyn_admin' ||
      profile.role === 'kelyn_rep' ||
      profile.role === 'client_admin'
    );
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    
    try {
      // Dynamic import for JSZip to avoid large bundle size
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Generate CSV with table data
      const csvData = generateRunbooksCSV(filteredRunbooks);
      zip.file('runbooks-export.csv', csvData);

      // Generate PDFs for each runbook
      for (let i = 0; i < filteredRunbooks.length; i++) {
        const runbook = filteredRunbooks[i];
        
        try {
          // Get runbook steps
          const stepsResult = await fileClient.from('runbook_steps').select('*').eq('runbook_id', runbook.id);
          if (stepsResult.error) {
            console.error(`Error fetching steps for runbook ${runbook.id}:`, stepsResult.error);
            continue;
          }

          const steps = stepsResult.data || [];
          
          // Get all profiles for assigned users
          const profilesResult = await fileClient.from('profiles').select('*').execute();
          const profiles = profilesResult.data || [];

          // Transform the data to match the PDF generator interface
          const pdfData = {
            id: runbook.id,
            title: runbook.title,
            description: runbook.description,
            client: runbook.client,
            created_by_profile: runbook.creator,
            created_at: runbook.created_at,
            updated_at: runbook.updated_at,
            steps: steps.map((step: any) => {
              const assignedUser = step.assigned_to ? 
                profiles.find((p: any) => p.id === step.assigned_to) : null;
              
              return {
                id: step.id,
                title: step.title,
                description: step.description,
                step_order: step.step_order,
                estimated_duration_minutes: step.estimated_duration_minutes,
                assigned_user: assignedUser ? {
                  first_name: assignedUser.first_name,
                  last_name: assignedUser.last_name
                } : null,
                photo_url: step.photo_url,
                tasks: step.tasks || []
              };
            }).sort((a: any, b: any) => a.step_order - b.step_order)
          };

          // Generate PDF blob instead of downloading directly
          const pdfBlob = await generateRunbookPDF(pdfData, branding?.primary_color, branding?.app_logo_url, branding?.theme_mode, true);
          
          // Add PDF to zip with safe filename
          const safeFileName = runbook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          zip.file(`${safeFileName}.pdf`, pdfBlob);
          
        } catch (error) {
          console.error(`Error generating PDF for runbook ${runbook.title}:`, error);
          // Continue with other runbooks even if one fails
        }
      }

      // Generate and download zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `runbooks-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${filteredRunbooks.length} runbooks successfully`
      });

    } catch (error) {
      console.error('Error exporting runbooks:', error);
      toast({
        title: "Error",
        description: "Failed to export runbooks",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const generateRunbooksCSV = (runbooks: Runbook[]) => {
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push([
      'Title',
      'Team',
      'Creator',
      'Created',
      'Last Run Date',
      'Last Run Status',
      'Description'
    ].map(field => `"${field}"`).join(','));

    // Data rows
    runbooks.forEach(runbook => {
      csvRows.push([
        runbook.title,
        runbook.client?.name || 'Unknown',
        runbook.creator?.first_name && runbook.creator?.last_name 
          ? `${runbook.creator.first_name} ${runbook.creator.last_name}`
          : 'Unknown',
        new Date(runbook.created_at || '').toLocaleDateString(),
        runbook.lastExecution 
          ? new Date(runbook.lastExecution.started_at || runbook.lastExecution.completed_at || '').toLocaleDateString()
          : 'Never',
        runbook.lastExecution?.status || 'N/A',
        runbook.description || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    });

    return csvRows.join('\n');
  };



  // Handle view mode change and save to localStorage
  const handleViewModeChange = (newViewMode: 'card' | 'table') => {
    setViewMode(newViewMode);
    localStorage.setItem('runbooks-view-mode', newViewMode);
  };

  // Table View Component
  const TableView = () => (
    <div className="max-w-7xl mx-auto">
      <div className="w-full overflow-x-auto">
        <div className="border rounded-lg overflow-hidden bg-white min-w-max">
          <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-8 hidden xl:table-cell"></th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[300px]">Title</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-24 hidden lg:table-cell">Team</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 w-32 hidden xl:table-cell">Creator</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 hidden xl:table-cell">Created</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900">Last Run</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-900 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRunbooks.map((runbook, index) => (
                             <tr 
                 key={runbook.id} 
                 className="hover:bg-gray-50 cursor-pointer transition-colors"
                 style={{ 
                   opacity: 0,
                   animation: `fadeIn 0.6s ease-out ${index * 60}ms forwards`
                 }}
                 onClick={() => handleRunbookClick(runbook.id)}
               >
                 <td className="px-4 py-3 hidden xl:table-cell">
                   <RunbookBookCover 
                     title={runbook.title}
                     primaryColor={branding?.primary_color}
                     logoUrl={branding?.app_logo_url}
                     themeMode={branding?.theme_mode}
                   />
                 </td>
                 <td className="px-4 py-3 max-w-[300px]">
                   <div className="flex flex-col text-left">
                     <div className="font-medium text-gray-900 truncate text-left" title={runbook.title}>
                       {runbook.title}
                     </div>
                     {runbook.description && (
                       <div className="text-sm text-gray-600 line-clamp-1 text-left" title={runbook.description}>
                         {runbook.description}
                       </div>
                     )}
                   </div>
                 </td>
                 <td className="px-4 py-3 hidden lg:table-cell w-24">
                   <div className="flex items-center gap-1 text-left">
                     <ClientLogo 
                       logoUrl={getClientLogoUrl(runbook.client?.logo_url)}
                       clientName={runbook.client?.name || 'Unknown Client'}
                       size="sm"
                     />
                     <span className="text-sm text-gray-600 truncate text-left max-w-16" title={runbook.client?.name}>
                       {runbook.client?.name || 'Unknown Client'}
                     </span>
                   </div>
                 </td>
                 <td className="px-4 py-3 hidden xl:table-cell w-32">
                   <div className="text-sm text-gray-600 text-left truncate" title={runbook.creator?.first_name && runbook.creator?.last_name ? `${runbook.creator.first_name} ${runbook.creator.last_name}` : 'Unknown'}>
                     {runbook.creator?.first_name && runbook.creator?.last_name 
                       ? `${runbook.creator.first_name} ${runbook.creator.last_name}`
                       : 'Unknown'
                     }
                   </div>
                 </td>
                 <td className="px-4 py-3 hidden xl:table-cell">
                   <div className="text-sm text-gray-600 text-left">
                     {new Date(runbook.created_at || '').toLocaleDateString('en-US', {
                       month: '2-digit',
                       day: '2-digit',
                       year: '2-digit'
                     })}
                   </div>
                 </td>
                 <td className="px-4 py-3">
                   {runbook.lastExecution ? (
                     <Badge 
                       variant={runbook.lastExecution.status === 'completed' ? 'default' : 
                                runbook.lastExecution.status === 'active' ? 'secondary' : 'outline'}
                       className="text-xs w-fit flex items-center gap-1"
                     >
                       {runbook.lastExecution.status === 'completed' && (
                         <CheckCircle className="h-3 w-3 text-green-600" />
                       )}
                       {runbook.lastExecution.status === 'active' && (
                         <Clock className="h-3 w-3 text-blue-600" />
                       )}
                       {runbook.lastExecution.status === 'paused' && (
                         <Pause className="h-3 w-3 text-orange-600" />
                       )}
                       {runbook.lastExecution.status === 'draft' && (
                         <Clock className="h-3 w-3 text-gray-600" />
                       )}
                       {new Date(runbook.lastExecution.started_at || runbook.lastExecution.completed_at || '').toLocaleDateString('en-US', {
                         month: '2-digit',
                         day: '2-digit',
                         year: '2-digit'
                       })}
                     </Badge>
                   ) : (
                     <span className="text-sm text-gray-500">-</span>
                   )}
                 </td>
                 <td className="px-4 py-3">
                   <div className="flex items-center justify-end gap-1">
                     {canStartExecution() && (
                       <Tooltip content="Execute">
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={(e) => {
                             e.stopPropagation();
                             handleExecuteRunbook(runbook);
                           }} 
                           className="h-7 w-7 p-0 hover:bg-gray-100"
                         >
                           <Play className="h-3 w-3" />
                         </Button>
                       </Tooltip>
                     )}
                     {canShowAdminButtons() && (
                       <Tooltip content="Clone">
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={(e) => {
                             e.stopPropagation();
                             handleCloneRunbook(runbook);
                           }} 
                           className="h-7 w-7 p-0 hover:bg-gray-100"
                         >
                           <Copy className="h-3 w-3" />
                         </Button>
                       </Tooltip>
                     )}
                     <Tooltip content="PDF">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDownloadPDF(runbook);
                         }} 
                         className="h-7 w-7 p-0 hover:bg-gray-100"
                       >
                         <Download className="h-3 w-3" />
                       </Button>
                     </Tooltip>
                   </div>
                 </td>
               </tr>
            ))}
                     </tbody>
         </table>
       </div>
     </div>
   </div>
   );

  if (loading) {
    return null;
  }

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
          
          @keyframes glare {
            0% {
              transform: translateX(150%) skewX(-25deg);
            }
            100% {
              transform: translateX(-150%) skewX(-25deg);
            }
          }
        `}
      </style>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
          
          </div>
        </div>

        {/* Search and Filters */}
        <div className="w-full overflow-x-auto">
          <div className="flex items-center space-x-4 min-w-max px-4 lg:px-0 max-w-7xl mx-auto">
            <div className="relative flex-1 min-w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                type="text" 
                placeholder="Search runbooks..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-10" 
              />
            </div>
            <div className="w-64 flex-shrink-0">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <SelectValue placeholder="Filter by client" className="truncate block" />
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {uniqueClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* View Toggle Button */}
            <div className="flex items-center border rounded-md flex-shrink-0">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('card')}
                className="rounded-r-none border-r"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('table')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Export All Button */}
            <Tooltip content="Export All (PDFs + CSV)">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAll}
                disabled={isExporting || filteredRunbooks.length === 0}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <Archive className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export All'}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === 'card' ? (
          /* Runbooks Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {filteredRunbooks.map((runbook, index) => (
              <Card 
                key={runbook.id} 
                className="border border-white hover:border-primary/30 hover:shadow-md border-primary/10  transition-shadow cursor-pointer flex flex-col h-full" 
                onClick={() => handleRunbookClick(runbook.id)}
                style={{ 
                  opacity: 0,
                  animation: `fadeIn 0.8s ease-out ${index * 80}ms forwards`
                }}
              >
                <CardHeader className="pb-4 flex-shrink-0 relative">
                  {/* Small book cover in top right corner with spacing */}
                  <div className="absolute top-2 right-2">
                                    <RunbookBookCover 
                    title={runbook.title}
                    primaryColor={branding?.primary_color}
                    logoUrl={branding?.app_logo_url}
                    themeMode={branding?.theme_mode}
                  />
                  </div>
                  
                  <div className="mb-3 pr-16">
                    <CardTitle className="text-base font-semibold text-foreground mb-3 leading-tight text-left h-10 flex items-start">
                      <span className="line-clamp-2">
                        {runbook.title}
                      </span>
                    </CardTitle>
                    <div className="flex items-center justify-between gap-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ClientLogo 
                          logoUrl={getClientLogoUrl(runbook.client?.logo_url)}
                          clientName={runbook.client?.name || 'Unknown Client'}
                          size="sm"
                        />
                        <span className="truncate">{runbook.client?.name || 'Unknown Client'}</span>
                      </div>
                      {runbook.description && (
                        <Tooltip 
                          content={runbook.description}
                          side="bottom"
                          className="!whitespace-normal !w-60 !max-w-none !z-[100] bg-white text-foreground border border-border shadow-lg p-3"
                        >
                          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors flex-shrink-0" />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  
                  <div className="h-0 flex items-start">
                    <CardDescription className="text-xs text-muted-foreground leading-relaxed line-clamp-2 text-left">
                      {/* Space reserved for future content or left empty for consistent layout */}
                    </CardDescription>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 flex-grow flex flex-col">
                  <div className="space-y-2 border-t pt-3 mb-3 flex-grow">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Created</span>
                      </div>
                      <span className="font-medium text-foreground">
                        {new Date(runbook.created_at || '').toLocaleDateString()}
                      </span>
                    </div>
                    
                                      <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>Author</span>
                    </div>
                    <span className="font-medium text-foreground truncate ml-2">
                      {runbook.creator?.first_name && runbook.creator?.last_name 
                        ? `${runbook.creator.first_name} ${runbook.creator.last_name}`
                        : 'Unknown'
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Last Run Date</span>
                    </div>
                    <div className="flex items-end">
                      {runbook.lastExecution ? (
                        <Badge 
                          variant={runbook.lastExecution.status === 'completed' ? 'default' : 
                                   runbook.lastExecution.status === 'active' ? 'secondary' : 'outline'}
                          className="text-[10px] px-1 py-0 h-4 flex items-center gap-1"
                        >
                          {runbook.lastExecution.status === 'completed' && (
                            <CheckCircle className="h-2.5 w-2.5 text-green-600" />
                          )}
                          {runbook.lastExecution.status === 'active' && (
                            <Clock className="h-2.5 w-2.5 text-blue-600" />
                          )}
                          {runbook.lastExecution.status === 'paused' && (
                            <Pause className="h-2.5 w-2.5 text-orange-600" />
                          )}
                          {runbook.lastExecution.status === 'draft' && (
                            <Clock className="h-2.5 w-2.5 text-gray-600" />
                          )}
                          {new Date(runbook.lastExecution.started_at || runbook.lastExecution.completed_at || '').toLocaleDateString()}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </div>
                  </div>
                </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 mt-auto">
                    {canStartExecution() && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecuteRunbook(runbook);
                        }} 
                        className="h-7 px-2 text-xs font-medium hover:bg-muted flex items-center gap-1 flex-1 justify-center"
                      >
                        <Play className="h-3 w-3" />
                        Execute
                      </Button>
                    )}
                    {canShowAdminButtons() && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneRunbook(runbook);
                        }} 
                        className="h-7 px-2 text-xs font-medium hover:bg-muted flex items-center gap-1 flex-1 justify-center"
                      >
                        <Copy className="h-3 w-3" />
                        Clone
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPDF(runbook);
                      }} 
                      className="h-7 px-2 text-xs font-medium hover:bg-muted flex items-center gap-1 flex-1 justify-center"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Table View */
          <TableView />
        )}

        {filteredRunbooks.length === 0 && !loading && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No runbooks found</h3>
            <p className="text-muted-foreground">
              {searchQuery || selectedClient !== 'all' ? 'Try adjusting your search criteria or filters.' : 'Get started by creating your first runbook.'}
            </p>
          </div>
        )}

        {/* Start Execution Dialog */}
        {showStartExecution && selectedRunbook && (
          <StartExecutionDialog
            isOpen={showStartExecution}
            onClose={() => {
              setShowStartExecution(false);
              setSelectedRunbook(null);
            }}
            runbookId={selectedRunbook.id}
            runbookTitle={selectedRunbook.title}
            clientId={selectedRunbook.client_id || ''}
            onExecutionStarted={handleExecutionStarted}
          />
        )}
      </div>
    </>
  );
}