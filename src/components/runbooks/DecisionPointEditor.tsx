
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, GitBranch, Save, Edit, Trash2 } from 'lucide-react';
import { DecisionPoint, DecisionOption } from '@/types/workflow';

interface DecisionPointEditorProps {
  decisionPoint: DecisionPoint | null;
  onDecisionPointChange: (decisionPoint: DecisionPoint | null) => void;
  availableSteps: Array<{
    id: string;
    title: string;
    stepOrder: number;
  }>;
}

export function DecisionPointEditor({
  decisionPoint,
  onDecisionPointChange,
  availableSteps
}: DecisionPointEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDecision, setEditDecision] = useState<DecisionPoint | null>(decisionPoint);
  const [newOptionLabel, setNewOptionLabel] = useState('');

  const handleSave = () => {
    if (!editDecision || !editDecision.question.trim()) return;
    onDecisionPointChange(editDecision);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditDecision(decisionPoint);
    setIsEditing(false);
  };

  const createNewDecision = () => {
    setEditDecision({
      id: crypto.randomUUID(),
      question: '',
      type: 'select',
      options: [],
      required: true
    });
    setIsEditing(true);
  };

  const addOption = () => {
    if (!newOptionLabel.trim() || !editDecision) return;
    
    const newOption: DecisionOption = {
      id: crypto.randomUUID(),
      label: newOptionLabel.trim(),
      value: newOptionLabel.trim().toLowerCase().replace(/\s+/g, '_'),
      nextSteps: []
    };

    setEditDecision({
      ...editDecision,
      options: [...editDecision.options, newOption]
    });
    setNewOptionLabel('');
  };

  const removeOption = (optionId: string) => {
    if (!editDecision) return;
    setEditDecision({
      ...editDecision,
      options: editDecision.options.filter(opt => opt.id !== optionId)
    });
  };

  const updateOptionNextSteps = (optionId: string, stepIds: string[]) => {
    if (!editDecision) return;
    setEditDecision({
      ...editDecision,
      options: editDecision.options.map(opt =>
        opt.id === optionId ? { ...opt, nextSteps: stepIds } : opt
      )
    });
  };

  if (!isEditing && !decisionPoint) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={createNewDecision}
        className="h-8 text-xs border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
      >
        <GitBranch className="h-3 w-3 mr-1" />
        Add Decision Point
      </Button>
    );
  }

  if (!isEditing && decisionPoint) {
    return (
      <Card className="mt-3 bg-blue-50 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-600" />
              Decision Point
            </CardTitle>
            <div className="flex gap-1">
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="h-6 text-xs">
                <Edit className="h-3 w-3" />
              </Button>
              <Button onClick={() => onDecisionPointChange(null)} variant="outline" size="sm" className="h-6 text-xs text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Question:</Label>
              <p className="text-sm text-gray-700">{decisionPoint.question}</p>
            </div>
            <div>
              <Label className="text-xs font-medium">Answer Options:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {decisionPoint.options.map((option) => (
                  <Badge key={option.id} variant="secondary" className="text-xs">
                    {option.label}
                    {option.nextSteps.length > 0 && (
                      <span className="ml-1 text-blue-600">→ {option.nextSteps.length} steps</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-3 border-blue-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-blue-600" />
          Configure Decision Point
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Question</Label>
          <Input
            value={editDecision?.question || ''}
            onChange={(e) => setEditDecision(prev => prev ? { ...prev, question: e.target.value } : null)}
            placeholder="What question should determine the next steps?"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Answer Type</Label>
          <Select
            value={editDecision?.type || 'select'}
            onValueChange={(value: 'select' | 'radio' | 'yes_no') =>
              setEditDecision(prev => prev ? { ...prev, type: value } : null)
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="select">Dropdown</SelectItem>
              <SelectItem value="radio">Radio Buttons</SelectItem>
              <SelectItem value="yes_no">Yes/No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {editDecision?.type !== 'yes_no' && (
          <div className="space-y-2">
            <Label className="text-xs">Answer Options</Label>
            <div className="flex gap-2">
              <Input
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                placeholder="Add answer option"
                className="h-8 text-xs"
                onKeyPress={(e) => e.key === 'Enter' && addOption()}
              />
              <Button onClick={addOption} size="sm" className="h-8">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {editDecision?.options.map((option) => (
                <div key={option.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Badge variant="outline" className="text-xs">
                    {option.label}
                  </Badge>
                  <span className="text-xs text-gray-500">leads to:</span>
                  <Select
                    value={option.nextSteps.join(',')}
                    onValueChange={(value) => updateOptionNextSteps(option.id, value ? value.split(',') : [])}
                  >
                    <SelectTrigger className="h-6 text-xs flex-1">
                      <SelectValue placeholder="Select next steps..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSteps.map((step) => (
                        <SelectItem key={step.id} value={step.id}>
                          Step {step.stepOrder}: {step.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => removeOption(option.id)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} size="sm" className="h-7 text-xs">
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button onClick={handleCancel} variant="outline" size="sm" className="h-7 text-xs">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
