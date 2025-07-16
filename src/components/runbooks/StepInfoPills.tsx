
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, User, CheckCircle, GitBranch } from 'lucide-react';
import { MultiAppDisplay } from './MultiAppDisplay';

interface StepInfoPillsProps {
  estimatedDurationMinutes?: number;
  stepApps: string[];
  hasWorkflowLogic: boolean;
  assignedUser?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  completion: {
    completed: number;
    total: number;
    percentage: number;
  };
}

export function StepInfoPills({
  estimatedDurationMinutes,
  stepApps,
  hasWorkflowLogic,
  assignedUser,
  completion
}: StepInfoPillsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap gap-9">
      {estimatedDurationMinutes && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
          <Clock className="h-3 w-3" />
          <span>{estimatedDurationMinutes} min</span>
        </div>
      )}
      
      {stepApps.length > 0 && (
        <MultiAppDisplay appIds={stepApps} size="sm" maxDisplay={5} />
      )}
      
      {hasWorkflowLogic && (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <GitBranch className="h-3 w-3 mr-1" />
          Smart Logic
        </Badge>
      )}
      
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium cursor-help hover:bg-gray-100 transition-colors">
            <User className="h-3 w-3" />
            <span>
              {assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : 'Unassigned'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-gray-900 text-white text-xs px-3 py-2 rounded-md shadow-lg">
          {assignedUser ? assignedUser.email : 'No user assigned to this step'}
        </TooltipContent>
      </Tooltip>
      
      {completion.total > 0 && (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          completion.percentage === 100 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <CheckCircle className="h-3 w-3" />
          <span>{completion.completed}/{completion.total} tasks</span>
          <span className="ml-1 px-1.5 py-0.5 bg-white/60 rounded text-xs">
            {completion.percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
