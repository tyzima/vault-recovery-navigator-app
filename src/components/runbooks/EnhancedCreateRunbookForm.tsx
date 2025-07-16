import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { fileClient } from '@/lib/fileClient';
import { BookOpen, FileText, Building2, AlertTriangle, Shield, Download, Upload, X } from 'lucide-react';
import { canCreateRunbook, getRunbookUsage } from '@/lib/licensing';

type Client = {
  id: string;
  name: string;
  description?: string;
};

interface EnhancedCreateRunbookFormProps {
  isOpen?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Markdown template for users
const MARKDOWN_TEMPLATE = `# Simple Incident Response
## Description
Concise runbook demonstrating conditional logic. Steps appear/disappear based on previous answers.

**Apps:** AWS, Microsoft, Commvault

---

## Step 1: Initial Assessment
**Duration:** 15 minutes  
**Assigned to:** Test Last  
**Description:** Assess situation type
**Apps:** Microsoft

### Tasks
- [ ] **Check System Status**
  - Description: Review monitoring dashboards and system health
- [ ] **Identify Issue Type**
  - Description: Determine if this is a security or infrastructure issue

### Questions
- **Type:** select
- **Question:** What type of issue is this?
- **Options:** Security Incident, Infrastructure Problem, All Clear
- **Required:** true

### Conditions
always_show

### Dependencies
None - This is the initial step

---

## Step 2: Emergency Response
**Duration:** 30 minutes  
**Assigned to:** Ty Rep  
**Description:** Handle security incidents only
**Apps:** AWS, Microsoft

### Tasks
- [ ] **Secure Systems**
  - Description: Isolate affected systems and reset credentials
- [ ] **Notify Security Team**
  - Description: Alert security team and stakeholders

### Questions
- **Type:** select
- **Question:** Is the incident contained?
- **Options:** Yes, Partially, No
- **Required:** true

### Conditions
step_1_question_equals:Security Incident

### Dependencies
This step depends on: Step 1

---

## Step 3: Final Documentation
**Duration:** 20 minutes  
**Assigned to:** Kevin Cronin  
**Description:** Document and close incident (unless completely failed)
**Apps:** Commvault

### Tasks
- [ ] **Create Incident Report**
  - Description: Document what happened and actions taken
- [ ] **Update Procedures**
  - Description: Update runbooks based on lessons learned

### Questions
- **Type:** select
- **Question:** Is documentation complete?
- **Options:** Yes, No
- **Required:** true

### Conditions
step_2_question_not_equals:No

### Dependencies
This step depends on: Step 2

---

# Usage Instructions

## Markdown Format Rules:

### Runbook Structure:
\`\`\`
# Runbook Title
## Description
Your runbook description here

**Apps:** AWS, Azure, Google (comma-separated list of apps for the entire runbook)

---

## Step X: Step Title
**Duration:** X minutes (optional)
**Assigned to:** Full Name (e.g., John Doe - will be matched to user profiles)
**Description:** Step description
**Apps:** AWS, Microsoft (comma-separated list of apps specific to this step)

### Tasks
- [ ] **Task Title**
  - Description: Task description

### Questions (optional - creates step-level questions)
- **Type:** yes_no | select | text
- **Question:** Your question here
- **Options:** Option1, Option2, Option3 (for select type only)
- **Required:** true | false

### Conditions (optional)
always_show | step_X_question_equals:Answer | step_X_question_not_equals:Answer | step_X_question_equals:Answer1|Answer2

### Dependencies (optional)
This step depends on: Step X
\`\`\`

### Supported Question Types:
- **select:** Multiple choice question (provide comma-separated options)

### Task Format:
- Use \`- [ ]\` for task checkboxes (will be converted to interactive tasks)
- Use \`**Task Title**\` for task names (will become the task title)
- Add descriptions with \`- Description: ...\` (will become task description)

### Assignment Format:
- Use full names from your system - these will be matched to user profiles
- Names are case-insensitive and matched by first and last name
- Leave blank for unassigned steps
- **Available users:** Test Last, Ty Rep, Client Account, Kevin Cronin, John Doe, Test Name

### Apps Format:
- **Runbook-level apps:** Add \`**Apps:** AWS, Azure, Google\` right after the description
- **Step-level apps:** Add \`**Apps:** AWS, Microsoft\` in the step metadata section
- App names are case-insensitive and matched to available apps in the system
- **Available apps:** Microsoft, Azure, Commvault, AWS, Google

### Conditional Logic Format:
- **always_show:** Step always appears (default behavior)
- **step_X_question_equals:Answer:** Show step only if Step X's question answer equals "Answer"
- **step_X_question_not_equals:Answer:** Show step only if Step X's question answer does NOT equal "Answer"
- **step_X_question_equals:Answer1|Answer2:** Show step if Step X's question answer equals any of the listed answers

### Examples:
- **step_1_question_equals:Yes** - Show only if Step 1's question was answered "Yes"
- **step_2_question_not_equals:No** - Show only if Step 2's question was NOT answered "No"
- **step_1_question_equals:Option A|Option B** - Show if Step 1's answer was "Option A" OR "Option B"

### Best Practices:
1. **Be Specific:** Include detailed descriptions for each task
2. **Set Realistic Durations:** Estimate time needed based on complexity
3. **Use Dependencies:** Link steps that must be completed in sequence
4. **Add Questions:** Use step-level questions to capture decisions and validate completion
5. **Include Conditions:** Use conditional logic to show/hide steps based on previous answers
6. **Assign Ownership:** Use full names that match your user profiles
7. **Tag with Apps:** Specify relevant apps at both runbook and step levels

### Notes:
- Questions created in this format become **step-level questions**
- For task-level questions, you'll need to add them manually after import
- The system will automatically create unique IDs for all steps, tasks, and questions
- User names are matched against the profiles database by first and last name
- App names are matched against the apps database (case-insensitive)
- Dependencies and conditions are stored as text descriptions for now
`;

export function EnhancedCreateRunbookForm({ isOpen = true, onSuccess, onCancel }: EnhancedCreateRunbookFormProps) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [dialogOpen, setDialogOpen] = useState(isOpen);
  const [canCreate, setCanCreate] = useState(true);
  const [usage, setUsage] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'markdown'>('form');
  const [markdownContent, setMarkdownContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
  });

  // Update internal dialog state when isOpen prop changes
  useEffect(() => {
    setDialogOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const fetchClients = async () => {
      const response = await fileClient
        .from('clients')
        .select('*')
        .execute();

      if (!response.error && response.data) {
        // Sort clients by name
        const sortedClients = response.data.sort((a, b) => a.name.localeCompare(b.name));
        setClients(sortedClients);
      }
    };

    const checkLicense = async () => {
      if (user) {
        const allowed = await canCreateRunbook(user.id);
        setCanCreate(allowed);
        
        const usageInfo = await getRunbookUsage(user.id);
        setUsage(usageInfo);
      }
    };

    fetchClients();
    checkLicense();
  }, [user]);

  const downloadMarkdownTemplate = () => {
    const blob = new Blob([MARKDOWN_TEMPLATE], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'runbook_template.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const validExtensions = ['.md', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a .md or .txt file only.',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Please upload a file smaller than 5MB.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const text = await file.text();
      setMarkdownContent(text);
      setSelectedFile(file);
      toast({
        title: 'File Uploaded',
        description: `Successfully loaded ${file.name}`,
      });
    } catch (error) {
      toast({
        title: 'Error Reading File',
        description: 'Failed to read the uploaded file. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const triggerFileInput = () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    fileInput?.click();
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setMarkdownContent('');
    // Reset the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const parseMarkdownToRunbook = async (markdown: string) => {
    // Fetch profiles and apps data for name/ID mapping
    const [profilesResponse, appsResponse] = await Promise.all([
      fileClient.from('profiles').select('*').execute(),
      fileClient.from('apps').select('*').execute()
    ]);

    const profiles = profilesResponse.data || [];
    const apps = appsResponse.data || [];

    // Helper function to find user by name
    const findUserByName = (name: string) => {
      if (!name) return null;
      const nameParts = name.trim().split(' ');
      if (nameParts.length < 2) return null;
      
      const firstName = nameParts[0].toLowerCase();
      const lastName = nameParts.slice(1).join(' ').toLowerCase();
      
      return profiles.find(p => 
        p.first_name.toLowerCase() === firstName && 
        p.last_name.toLowerCase() === lastName
      );
    };

    // Helper function to find apps by names
    const findAppsByNames = (appNames: string) => {
      if (!appNames) return [];
      return appNames.split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(name => apps.find(app => app.name.toLowerCase() === name.toLowerCase()))
        .filter(app => app !== undefined);
    };

    const lines = markdown.split('\n');
    let runbookTitle = '';
    let runbookDescription = '';
    let runbookApps: any[] = [];
    const steps: any[] = [];
    
    let currentStep: any = null;
    let currentSection = '';
    let currentTasks: any[] = [];
    let currentQuestion: any = null;
    let currentConditions = '';
    let currentDependencies = '';
    let currentStepApps: any[] = [];
    let pendingTaskQuestion: any = null; // For questions that should attach to the last task
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse runbook title
      if (line.startsWith('# ') && !runbookTitle) {
        runbookTitle = line.substring(2).trim();
        continue;
      }
      
      // Parse runbook description
      if (line.startsWith('## Description')) {
        i++;
        while (i < lines.length && !lines[i].startsWith('#') && !lines[i].startsWith('**Apps:**') && !lines[i].startsWith('---')) {
          if (lines[i].trim()) {
            runbookDescription += lines[i].trim() + ' ';
          }
          i++;
        }
        i--; // Back up one line
        continue;
      }
      
      // Parse runbook-level apps
      if (line.startsWith('**Apps:**') && !currentStep) {
        const appsText = line.substring('**Apps:**'.length).trim();
        runbookApps = findAppsByNames(appsText);
        continue;
      }
      
      // Parse steps
      if (line.startsWith('## Step ')) {
        // Save previous step
        if (currentStep) {
          // Attach any pending question to step conditions
          if (currentQuestion && currentQuestion.question.trim()) {
            const validQuestion = {
              id: currentQuestion.id || crypto.randomUUID(),
              type: currentQuestion.type,
              question: currentQuestion.question,
              options: currentQuestion.options || [],
              required: currentQuestion.required || false
            };
            currentStep.conditions = { question: validQuestion };
          }
          
          currentStep.tasks = currentTasks;
          currentStep.step_apps = currentStepApps;
          
          // Store conditions temporarily - we'll process them after all steps are parsed
          if (currentConditions) {
            currentStep.tempConditions = currentConditions;
          }
          
          if (currentDependencies) currentStep.depends_on = currentDependencies;
          steps.push(currentStep);
        }
        
        // Start new step
        const stepMatch = line.match(/## Step (\d+): (.+)/);
        if (stepMatch) {
          currentStep = {
            id: crypto.randomUUID(),
            title: stepMatch[2],
            step_order: parseInt(stepMatch[1]),
            description: '',
            estimated_duration_minutes: 30,
            assigned_to: null,
            tasks: [],
            conditions: null,
            depends_on: null,
            step_apps: []
          };
          currentTasks = [];
          currentStepApps = [];
          currentQuestion = null;
          currentConditions = '';
          currentDependencies = '';
          pendingTaskQuestion = null;
        }
        continue;
      }
      
      // Parse step metadata
      if (currentStep && line.startsWith('**Duration:**')) {
        const duration = line.match(/\*\*Duration:\*\*\s*(\d+)/);
        if (duration) {
          currentStep.estimated_duration_minutes = parseInt(duration[1]);
        }
        continue;
      }
      
      if (currentStep && line.startsWith('**Assigned to:**')) {
        const assigneeName = line.substring('**Assigned to:**'.length).trim();
        const user = findUserByName(assigneeName);
        if (user) {
          currentStep.assigned_to = user.id;
        }
        continue;
      }
      
      if (currentStep && line.startsWith('**Description:**')) {
        const desc = line.substring('**Description:**'.length).trim();
        currentStep.description = desc;
        continue;
      }
      
      if (currentStep && line.startsWith('**Apps:**')) {
        const appsText = line.substring('**Apps:**'.length).trim();
        currentStepApps = findAppsByNames(appsText);
        continue;
      }
      
      // Parse sections
      if (line.startsWith('### ')) {
        currentSection = line.substring(4).toLowerCase();
        
        // If we were in questions section and have a pending question, it was a step-level question
        if (currentSection !== 'questions' && pendingTaskQuestion) {
          currentQuestion = pendingTaskQuestion;
          pendingTaskQuestion = null;
        }
        continue;
      }
      
      // Parse tasks
      if (currentSection === 'tasks' && line.startsWith('- [ ]')) {
        const taskMatch = line.match(/- \[ \] \*\*(.+?)\*\*/);
        if (taskMatch) {
          const task: any = {
            id: crypto.randomUUID(),
            order: currentTasks.length + 1,
            title: taskMatch[1],
            completed: false,
            description: ''
          };
          
          // Look for description on next line
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('- Description:')) {
            task.description = lines[i + 1].trim().substring('- Description:'.length).trim();
            i++; // Skip the description line
          }
          
          currentTasks.push(task);
        }
        continue;
      }
      
      // Parse questions - these become step-level questions unless specified otherwise
      if (currentSection === 'questions') {
        if (line.startsWith('- **Type:**')) {
          const type = line.substring('- **Type:**'.length).trim();
          // Only allow 'select' type questions
          if (type === 'select') {
            pendingTaskQuestion = { 
              id: crypto.randomUUID(),
              type: 'select', 
              question: '',
              options: [],
              required: false 
            };
          }
        } else if (line.startsWith('- **Question:**')) {
          if (pendingTaskQuestion) {
            pendingTaskQuestion.question = line.substring('- **Question:**'.length).trim();
          }
        } else if (line.startsWith('- **Options:**')) {
          if (pendingTaskQuestion) {
            const options = line.substring('- **Options:**'.length).trim().split(',').map(opt => opt.trim());
            pendingTaskQuestion.options = options;
          }
        } else if (line.startsWith('- **Required:**')) {
          if (pendingTaskQuestion) {
            pendingTaskQuestion.required = line.includes('true');
          }
        }
        continue;
      }
      
      // Parse conditions - now handle structured conditional logic
      if (currentSection === 'conditions' && line.trim()) {
        const conditionText = line.trim();
        
        // Parse structured conditions
        if (conditionText === 'always_show') {
          // No conditional logic - step always shows
          currentConditions = '';
        } else if (conditionText.includes('step_') && conditionText.includes('_question_')) {
          // Parse structured condition: step_X_question_equals:Answer or step_X_question_not_equals:Answer
          const conditionMatch = conditionText.match(/step_(\d+)_question_(equals|not_equals):(.+)/);
          if (conditionMatch) {
            const [, stepNumber, operator, answers] = conditionMatch;
            const answersList = answers.split('|').map(a => a.trim());
            
            // Store the parsed condition temporarily - we'll convert it to VisibilityRule after all steps are parsed
            const structuredCondition = {
              type: 'conditional_visibility',
              referenceStepNumber: parseInt(stepNumber),
              operator: operator,
              requiredAnswers: answersList
            };
            
            currentConditions = JSON.stringify(structuredCondition);
          } else {
            // Fallback to text description for unparseable conditions
            currentConditions += line + ' ';
          }
        } else {
          // Fallback to text description for other condition formats
          currentConditions += line + ' ';
        }
        continue;
      }
      
      // Parse dependencies
      if (currentSection === 'dependencies' && line.trim()) {
        currentDependencies += line + ' ';
        continue;
      }
    }
    
    // Handle the last step
    if (currentStep) {
      // Attach any pending question to step conditions
      if (currentQuestion && currentQuestion.question.trim()) {
        const validQuestion = {
          id: currentQuestion.id || crypto.randomUUID(),
          type: currentQuestion.type,
          question: currentQuestion.question,
          options: currentQuestion.options || [],
          required: currentQuestion.required || false
        };
        currentStep.conditions = { question: validQuestion };
      }
      
      currentStep.tasks = currentTasks;
      currentStep.step_apps = currentStepApps;
      
      // Store conditions temporarily - we'll process them after all steps are parsed
      if (currentConditions) {
        currentStep.tempConditions = currentConditions;
      }
      
      if (currentDependencies) currentStep.depends_on = currentDependencies;
      steps.push(currentStep);
    }
    
    // Post-process steps to convert conditional references to proper VisibilityRule objects
    const processedSteps = steps.map(step => {
      if (!step.tempConditions) {
        return step;
      }

      try {
        const conditionData = JSON.parse(step.tempConditions);
        
        if (conditionData.type === 'conditional_visibility') {
          // Find the referenced step by step number
          const referencedStep = steps.find(s => s.step_order === conditionData.referenceStepNumber);
          
          if (referencedStep && referencedStep.conditions && referencedStep.conditions.question) {
            const referencedQuestion = referencedStep.conditions.question;
            
            // Create visibility rules for each required answer
            const visibilityRules = conditionData.requiredAnswers.map((answer: string) => ({
              id: crypto.randomUUID(),
              stepId: referencedStep.id,
              questionId: referencedQuestion.id,
              requiredAnswer: answer,
              description: `Show when Step ${conditionData.referenceStepNumber} question "${referencedQuestion.question}" = "${answer}"`
            }));

            // Handle both equals and not_equals operators
            if (conditionData.operator === 'equals') {
              // For equals: show if answer matches any of the required answers
              return {
                ...step,
                conditions: {
                  ...step.conditions,
                  visibilityRules: visibilityRules
                },
                tempConditions: undefined
              };
            } else if (conditionData.operator === 'not_equals') {
              // For not_equals: show if answer does NOT match any of the required answers
              // We'll need to create rules for all OTHER possible answers
              const allPossibleAnswers = referencedQuestion.options || [];
              const excludedAnswers = conditionData.requiredAnswers;
              const allowedAnswers = allPossibleAnswers.filter(answer => !excludedAnswers.includes(answer));
              
              const notEqualsVisibilityRules = allowedAnswers.map((answer: string) => ({
                id: crypto.randomUUID(),
                stepId: referencedStep.id,
                questionId: referencedQuestion.id,
                requiredAnswer: answer,
                description: `Show when Step ${conditionData.referenceStepNumber} question "${referencedQuestion.question}" = "${answer}" (not ${excludedAnswers.join(' or ')})`
              }));

              return {
                ...step,
                conditions: {
                  ...step.conditions,
                  visibilityRules: notEqualsVisibilityRules
                },
                tempConditions: undefined
              };
            }
          }
        }
        
        // Fallback to text description
        return {
          ...step,
          conditions: {
            ...step.conditions,
            description: step.tempConditions
          },
          tempConditions: undefined
        };
      } catch {
        // Fallback to text description
        return {
          ...step,
          conditions: {
            ...step.conditions,
            description: step.tempConditions
          },
          tempConditions: undefined
        };
      }
    });

    return {
      title: runbookTitle,
      description: runbookDescription.trim(),
      steps: processedSteps,
      runbook_apps: runbookApps
    };
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDialogOpenChange = (open: boolean) => {
    console.log('Dialog open change:', open);
    setDialogOpen(open);
    if (!open) {
      setFormData({
        title: '',
        description: '',
        client_id: '',
      });
      setMarkdownContent('');
      setSelectedFile(null);
      onCancel?.();
    }
  };

  const handleCancel = () => {
    console.log('Handle cancel called');
    setDialogOpen(false);
    setFormData({
      title: '',
      description: '',
      client_id: '',
    });
    setMarkdownContent('');
    setSelectedFile(null);
    onCancel?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Check license before proceeding
    const allowed = await canCreateRunbook(user.id);
    if (!allowed) {
      toast({
        title: 'License Limit Reached',
        description: 'You have reached the maximum number of runbooks allowed by your license. Please contact your administrator.',
        variant: 'destructive'
      });
      return;
    }

    let runbookData;
    let stepsData: any[] = [];

    if (activeTab === 'markdown') {
      if (!markdownContent.trim()) {
        toast({
          title: 'Error',
          description: 'Markdown content is required',
          variant: 'destructive'
        });
        return;
      }

      if (!formData.client_id) {
        toast({
          title: 'Error',
          description: 'Please select a team',
          variant: 'destructive'
        });
        return;
      }

      try {
        const parsed = await parseMarkdownToRunbook(markdownContent);
        runbookData = {
          title: parsed.title,
          description: parsed.description,
          client_id: formData.client_id,
          runbook_apps: parsed.runbook_apps,
        };
        stepsData = parsed.steps;
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to parse markdown content. Please check the format.',
          variant: 'destructive'
        });
        return;
      }
    } else {
      if (!formData.title.trim()) {
        toast({
          title: 'Error',
          description: 'Runbook title is required',
          variant: 'destructive'
        });
        return;
      }

      if (!formData.client_id) {
        toast({
          title: 'Error',
          description: 'Please select a team',
          variant: 'destructive'
        });
        return;
      }

      runbookData = formData;
    }

    setIsSubmitting(true);
    try {
      const runbookId = crypto.randomUUID();
      const newRunbook = {
        id: runbookId,
        ...runbookData,
        created_by: user.id,
        is_template: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response = await fileClient
        .from('runbooks')
        .insert(newRunbook);

      if (response.error) throw new Error(response.error.message);

      // Insert runbook apps if parsed from markdown
      if (runbookData.runbook_apps && runbookData.runbook_apps.length > 0) {
        for (const app of runbookData.runbook_apps) {
          const runbookAppEntry = {
            id: crypto.randomUUID(),
            runbook_id: runbookId,
            app_id: app.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          const runbookAppResponse = await fileClient
            .from('runbook_apps')
            .insert(runbookAppEntry);

          if (runbookAppResponse.error) {
            console.error('Error inserting runbook app:', runbookAppResponse.error);
          }
        }
      }

      // Insert steps if parsed from markdown
      if (stepsData.length > 0) {
        for (const step of stepsData) {
          const stepApps = step.step_apps || [];
          const stepToInsert = {
            ...step,
            runbook_id: runbookId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          // Remove step_apps from the step object before inserting
          delete stepToInsert.step_apps;
          
          const stepResponse = await fileClient
            .from('runbook_steps')
            .insert(stepToInsert);

          if (stepResponse.error) {
            console.error('Error inserting step:', stepResponse.error);
            continue;
          }

          // Insert step apps if any
          if (stepApps.length > 0) {
            for (const app of stepApps) {
              const stepAppEntry = {
                id: crypto.randomUUID(),
                step_id: step.id,
                app_id: app.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              
              const stepAppResponse = await fileClient
                .from('runbook_step_apps')
                .insert(stepAppEntry);

              if (stepAppResponse.error) {
                console.error('Error inserting step app:', stepAppResponse.error);
              }
            }
          }
        }
      }

      toast({
        title: "Success",
        description: `Runbook created successfully${stepsData.length > 0 ? ` with ${stepsData.length} steps` : ''}`,
      });

      setFormData({
        title: '',
        description: '',
        client_id: '',
      });
      setMarkdownContent('');
      setSelectedFile(null);
      setDialogOpen(false);
      onSuccess?.();

      // Navigate to the new runbook page
      navigate(`/runbooks/${runbookId}`);

      // Trigger the add step modal after a short delay if no steps were created from markdown
      if (stepsData.length === 0) {
        setTimeout(() => {
          const event = new CustomEvent('add-step-click', {
            detail: { runbookId }
          });
          window.dispatchEvent(event);
        }, 500);
      }
    } catch (error) {
      console.error('Error creating runbook:', error);
      toast({
        title: "Error",
        description: "Failed to create runbook",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex mb-2 mt-3 items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span className="text-2xl font-semibold leading-none tracking-tight ">Create Runbook</span>
          </DialogTitle>
          <DialogDescription className="hidden">
            Create a new runbook using the form or import from markdown
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'form' | 'markdown')}>
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-auto">
            <TabsTrigger 
              value="form" 
              className="flex flex-col items-center gap-2 py-4 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Manual Creation</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                Create step-by-step using forms
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="markdown" 
              className="flex flex-col items-center gap-2 py-4 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span className="font-medium">Import from File</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                Upload markdown or text file
              </span>
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="form" className="mt-0">
            <Card className="border-none shadow-none">
              <CardContent className="pt-6 min-h-[400px] flex flex-col">
                <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span>What is this runbook about? *</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      placeholder="Enter runbook title"
                      required
                    />
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="Enter runbook description"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client_id" className="flex items-center space-x-1">
                        <Building2 className="h-4 w-4" />
                        <span>Team *</span>
                      </Label>
                      <Select value={formData.client_id} onValueChange={(value) => handleChange('client_id', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Runbook'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="markdown" className="mt-0">
            <Card className="border-none shadow-none">
              <CardContent className="pt-6 min-h-[400px] flex flex-col">
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Download our markdown template to get started, then upload your .md or .txt file
                    </p>
                    <Button variant="outline" size="sm" onClick={downloadMarkdownTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                    <div className="space-y-4 flex-1">
                      <div className="space-y-2">
                        <Label htmlFor="client_id_md" className="flex items-center space-x-1">
                          <Building2 className="h-4 w-4" />
                          <span>Team *</span>
                        </Label>
                        <Select value={formData.client_id} onValueChange={(value) => handleChange('client_id', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a team" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                                            <div className="space-y-2">
                        <Label className="flex items-center space-x-1">
                          <Upload className="h-4 w-4" />
                          <span>Upload Runbook File *</span>
                        </Label>
                        
                        {/* Hidden file input */}
                        <input
                          id="file-upload"
                          type="file"
                          accept=".md,.txt"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                        
                        {/* Drag and drop area */}
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={triggerFileInput}
                          className={`
                            w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
                            ${isDragOver 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                              : 'border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/50'
                            }
                          `}
                        >
                          <div className="flex flex-col items-center justify-center space-y-3 text-center">
                            <div className={`p-1.5 rounded-full ${isDragOver ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-muted'}`}>
                              <Upload className={`h-4 w-4 ${isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {isDragOver ? 'Drop your file here' : 'Drag and Drop or Click to Browse'}
                              </p>
                            
                            </div>
                          </div>
                        </div>
                      
                      {selectedFile && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">{selectedFile.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearSelectedFile}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {markdownContent && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">File Preview:</Label>
                          <div className="max-h-40 overflow-y-auto p-3 bg-muted rounded-md">
                            <pre className="text-xs font-mono whitespace-pre-wrap">
                              {markdownContent.substring(0, 500)}
                              {markdownContent.length > 500 && '...'}
                            </pre>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                      <Button type="button" variant="outline" onClick={handleCancel}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || !markdownContent.trim()}>
                        {isSubmitting ? 'Creating...' : 'Create from File'}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
