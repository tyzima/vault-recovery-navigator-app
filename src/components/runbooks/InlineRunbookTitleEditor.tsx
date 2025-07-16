import React, { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fileClient } from '@/lib/fileClient';
import { useToast } from '@/hooks/use-toast';

interface InlineRunbookTitleEditorProps {
  runbookId: string;
  title: string;
  description?: string;
  canEdit: boolean;
  onUpdate: (updates: { title?: string; description?: string }) => void;
}

export function InlineRunbookTitleEditor({
  runbookId,
  title,
  description,
  canEdit,
  onUpdate
}: InlineRunbookTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleEdit = () => {
    setEditTitle(title);
    setEditDescription(description || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditTitle(title);
    setEditDescription(description || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast({
        title: "Error",
        description: "Runbook title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      console.log('InlineRunbookTitleEditor: Updating runbook', runbookId);
      
      const updates = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString()
      };

      const result = await fileClient
        .from('runbooks')
        .update(updates)
        .eq('id', runbookId);

      console.log('InlineRunbookTitleEditor: Update result:', result);

      if (result.error) {
        throw new Error(result.error.message);
      }

      onUpdate(updates);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Runbook updated successfully",
      });
    } catch (error) {
      console.error('InlineRunbookTitleEditor: Error updating runbook:', error);
      toast({
        title: "Error",
        description: "Failed to update runbook",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-left tracking-tight">{title}</h1>
        {description && (
          <p className="text-md text-muted-foreground mt-2 text-left leading-relaxed">
            {description}
          </p>
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex-1 space-y-4">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Runbook title"
          className="text-2xl font-bold h-12 border-2"
          disabled={isSaving}
        />
        <Textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="text-base border-2"
          disabled={isSaving}
        />
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving || !editTitle.trim()}
            className="h-9 px-4 font-medium"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-9 px-4"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-left tracking-tight">{title}</h1>
          {description && (
            <p className="text-md text-muted-foreground mt-2 text-left leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
