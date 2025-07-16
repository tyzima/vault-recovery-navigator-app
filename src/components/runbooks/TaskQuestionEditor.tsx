
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, HelpCircle, Edit } from 'lucide-react';
import { TaskQuestion } from '@/types/workflow';

interface TaskQuestionEditorProps {
  question: TaskQuestion | null;
  onQuestionChange: (question: TaskQuestion | null) => void;
  autoExpand?: boolean;
  onCancel?: () => void;
}

export function TaskQuestionEditor({ question, onQuestionChange, autoExpand = false, onCancel }: TaskQuestionEditorProps) {
  const [isEditing, setIsEditing] = useState(autoExpand || !question);
  const [editQuestion, setEditQuestion] = useState<TaskQuestion | null>(
    !question 
      ? {
          id: crypto.randomUUID(),
          type: 'select',
          question: '',
          options: [],
          required: false
        }
      : question
  );
  const [newOption, setNewOption] = useState('');

  const handleSave = () => {
    if (!editQuestion || !editQuestion.question.trim()) return;
    onQuestionChange(editQuestion);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditQuestion(question);
    setIsEditing(false);
    if (onCancel) {
      onCancel();
    }
  };

  const addOption = () => {
    if (!newOption.trim() || !editQuestion) return;
    setEditQuestion({
      ...editQuestion,
      options: [...editQuestion.options, newOption.trim()]
    });
    setNewOption('');
  };

  const removeOption = (index: number) => {
    if (!editQuestion) return;
    setEditQuestion({
      ...editQuestion,
      options: editQuestion.options.filter((_, i) => i !== index)
    });
  };

  const createNewQuestion = () => {
    setEditQuestion({
      id: crypto.randomUUID(),
      type: 'select',
      question: '',
      options: [],
      required: false
    });
    setIsEditing(true);
  };

  if (!isEditing && question) {
    return (
      <Card className="mt-2 bg-slate-50 border-slate-200 hover:bg-slate-100 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-4 w-4 text-slate-600" />
                <span className="font-medium text-sm text-slate-900">{question.question}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">
                  {question.type}
                </Badge>
                {question.required && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
              {question.options.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Options:</span>
                  <div className="flex flex-wrap gap-1">
                    {question.options.map((option, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-slate-200 text-slate-700">
                        {option}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button 
                onClick={() => setIsEditing(true)} 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button 
                onClick={() => onQuestionChange(null)} 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-2">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Question</Label>
          <Input
            value={editQuestion?.question || ''}
            onChange={(e) => setEditQuestion(prev => prev ? { ...prev, question: e.target.value } : null)}
            placeholder="What question should be asked?"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Answer Options</Label>
          <div className="flex gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="Add an option"
              className="h-8 text-xs"
              onKeyPress={(e) => e.key === 'Enter' && addOption()}
            />
            <Button onClick={addOption} size="sm" className="h-8">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {editQuestion?.options.map((option, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 text-xs">
                {option}
                <Button
                  onClick={() => removeOption(index)}
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} size="sm" className="h-7 text-xs">
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
