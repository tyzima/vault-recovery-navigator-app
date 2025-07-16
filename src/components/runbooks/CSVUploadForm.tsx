
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useTemplates } from '@/hooks/useTemplates';
import { Upload, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CSVUploadFormData {
  title: string;
  description: string;
  client_id: string;
}

interface CSVUploadFormProps {
  clients: any[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CSVUploadForm({ clients, onSuccess, onCancel }: CSVUploadFormProps) {
  const { user } = useAuth();
  const { createFromCSV } = useTemplates();
  const { toast } = useToast();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CSVUploadFormData>({
    defaultValues: {
      title: '',
      description: '',
      client_id: '',
    },
  });

  const downloadTemplate = () => {
    const csvContent = `title,description,step_order,estimated_duration_minutes,tasks
"Initial Setup","Set up the initial configuration",1,30,"[{""type"": ""text"", ""content"": ""Configure system settings""}]"
"Data Collection","Gather required information",2,45,"[{""type"": ""text"", ""content"": ""Collect client data""}, {""type"": ""text"", ""content"": ""Verify information""}]"
"Implementation","Execute the main process",3,60,"[{""type"": ""text"", ""content"": ""Follow implementation steps""}]"
"Testing","Verify everything works correctly",4,30,"[{""type"": ""text"", ""content"": ""Run test scenarios""}, {""type"": ""text"", ""content"": ""Document results""}]"
"Completion","Finalize and document",5,15,"[{""type"": ""text"", ""content"": ""Complete final documentation""}]"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'runbook_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    return lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.replace(/"/g, '') || '';
      });
      return row;
    });
  };

  const onSubmit = async (data: CSVUploadFormData) => {
    if (!user || !csvFile) return;

    setIsSubmitting(true);
    try {
      const fileContent = await csvFile.text();
      const csvData = parseCSV(fileContent);

      await createFromCSV(
        csvData,
        data.title,
        data.description,
        data.client_id,
        user.id
      );

      toast({
        title: "Success",
        description: "Runbook created from CSV successfully",
      });

      form.reset();
      setCsvFile(null);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating runbook from CSV:', error);
      toast({
        title: "Error",
        description: "Failed to create runbook from CSV",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="hidden">Create from CSV</CardTitle>
        <CardDescription className="hidden">
          Upload a CSV file to create a runbook with predefined steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Download our template to see the required format
          </p>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Runbook Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter runbook title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter runbook description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <label htmlFor="csv-upload" className="block text-sm font-medium mb-2">
                CSV File
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              {csvFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {csvFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={isSubmitting || !csvFile} 
                className="bg-slate-500 hover:bg-slate-600"
              >
                {isSubmitting ? 'Creating...' : 'Create from CSV'}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
