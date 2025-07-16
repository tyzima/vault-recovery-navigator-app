
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Settings } from 'lucide-react';

interface StepCondition {
  type: 'select_option' | 'checkbox' | 'radio';
  question: string;
  options: string[];
}

interface StepConditionsEditorProps {
  conditions: StepCondition | null;
  onConditionsChange: (conditions: StepCondition | null) => void;
  availableSteps: Array<{ id: string; title: string; step_order: number }>;
  dependsOn: string | null;
  onDependsOnChange: (stepId: string | null) => void;
}

export function StepConditionsEditor({
  conditions,
  onConditionsChange,
  availableSteps,
  dependsOn,
  onDependsOnChange
}: StepConditionsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editConditions, setEditConditions] = useState<StepCondition | null>(conditions);
  const [newOption, setNewOption] = useState('');

  const handleSave = () => {
    onConditionsChange(editConditions);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditConditions(conditions);
    setIsEditing(false);
  };

  const addOption = () => {
    if (newOption.trim() && editConditions) {
      setEditConditions({
        ...editConditions,
        options: [...editConditions.options, newOption.trim()]
      });
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    if (editConditions) {
      setEditConditions({
        ...editConditions,
        options: editConditions.options.filter((_, i) => i !== index)
      });
    }
  };

  const createNewCondition = () => {
    setEditConditions({
      type: 'select_option',
      question: '',
      options: []
    });
    setIsEditing(true);
  };

  // Filter available steps and ensure they have valid IDs
  const validSteps = availableSteps.filter(step => step.id && step.id.trim() !== '');

  if (!isEditing && !conditions) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Step Dependencies</Label>
          <Select value={dependsOn || "no-dependency"} onValueChange={(value) => onDependsOnChange(value === "no-dependency" ? null : value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="No dependency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-dependency">No dependency</SelectItem>
              {validSteps.map((step) => (
                <SelectItem key={step.id} value={step.id}>
                  Step {step.step_order}: {step.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={createNewCondition} variant="outline" size="sm" className="h-8">
          <Settings className="h-3 w-3 mr-1" />
          Add Condition
        </Button>
      </div>
    );
  }

  if (!isEditing && conditions) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Step Dependencies</Label>
          <Select value={dependsOn || "no-dependency"} onValueChange={(value) => onDependsOnChange(value === "no-dependency" ? null : value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="No dependency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-dependency">No dependency</SelectItem>
              {validSteps.map((step) => (
                <SelectItem key={step.id} value={step.id}>
                  Step {step.step_order}: {step.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-900">
                Conditional Step
              </CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  Edit
                </Button>
                <Button onClick={() => onConditionsChange(null)} variant="outline" size="sm">
                  Remove
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="text-sm text-blue-700">
                <strong>Question:</strong> {conditions.question}
              </div>
              <div className="text-sm text-blue-700">
                <strong>Type:</strong> {conditions.type.replace('_', ' ')}
              </div>
              <div className="flex flex-wrap gap-1">
                {conditions.options.map((option, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {option}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Step Dependencies</Label>
        <Select value={dependsOn || "no-dependency"} onValueChange={(value) => onDependsOnChange(value === "no-dependency" ? null : value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="No dependency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no-dependency">No dependency</SelectItem>
            {validSteps.map((step) => (
              <SelectItem key={step.id} value={step.id}>
                Step {step.step_order}: {step.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Edit Step Condition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={editConditions?.question || ''}
              onChange={(e) => setEditConditions(prev => prev ? { ...prev, question: e.target.value } : null)}
              placeholder="What should the user be asked?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Input Type</Label>
            <Select
              value={editConditions?.type || 'select_option'}
              onValueChange={(value: 'select_option' | 'checkbox' | 'radio') =>
                setEditConditions(prev => prev ? { ...prev, type: value } : null)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select_option">Dropdown Select</SelectItem>
                <SelectItem value="radio">Radio Buttons</SelectItem>
                <SelectItem value="checkbox">Checkboxes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Add an option"
                onKeyPress={(e) => e.key === 'Enter' && addOption()}
              />
              <Button onClick={addOption} size="sm">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {editConditions?.options.map((option, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {option}
                  <Button
                    onClick={() => removeOption(index)}
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} size="sm">
              Save
            </Button>
            <Button onClick={handleCancel} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
