
import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { StepEditDialog } from './StepEditDialog';

interface InlineStepDetailsEditorProps {
  stepId: string;
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
  canEdit: boolean;
  onUpdate: (updates: { title?: string; description?: string; estimated_duration_minutes?: number }) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export function InlineStepDetailsEditor({
  stepId,
  title,
  description,
  estimatedDurationMinutes,
  canEdit,
  onUpdate,
  onEditingChange
}: InlineStepDetailsEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDialogOpen(true);
    onEditingChange?.(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    onEditingChange?.(false);
  };

  const handleUpdate = (updates: { title?: string; description?: string; estimated_duration_minutes?: number }) => {
    onUpdate(updates);
    onEditingChange?.(false);
  };

  if (!canEdit) {
    return (
      <div className="flex-1 min-w-0 text-left">
        <h3 className="text-lg font-semibold text-gray-900 truncate">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
            {description}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 min-w-0 group text-left">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                {description}
              </p>
            )}
          </div>
          <div
            onClick={handleEditClick}
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-gray-100 rounded flex items-center justify-center"
          >
            <Edit2 className="h-3 w-3" />
          </div>
        </div>
      </div>

      <StepEditDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        stepId={stepId}
        title={title}
        description={description}
        estimatedDurationMinutes={estimatedDurationMinutes}
        onUpdate={handleUpdate}
      />
    </>
  );
}
