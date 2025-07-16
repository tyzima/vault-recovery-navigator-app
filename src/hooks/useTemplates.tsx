import { useState, useEffect } from 'react';
import { db, Runbook, Profile, Client, RunbookStep, generateId, getCurrentTimestamp } from '@/lib/database';

type Template = Runbook & {
  client: {
    name: string;
  } | null;
  creator: {
    first_name: string;
    last_name: string;
  } | null;
  step_count: number;
};

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      // Get all templates
      const templateRunbooks = await db.runbooks
        .where('is_template')
        .equals(1)
        .toArray();

      // Get step counts and additional data for each template
      const templatesWithSteps = await Promise.all(
        templateRunbooks.map(async (template) => {
          // Get step count
          const stepCount = await db.runbook_steps
            .where('runbook_id')
            .equals(template.id)
            .count();

          // Get client info
          const client = template.client_id 
            ? await db.clients.get(template.client_id)
            : null;

          // Get creator info
          const creator = await db.profiles.get(template.created_by);

          return {
            ...template,
            client: client ? { name: client.name } : null,
            creator: creator ? { 
              first_name: creator.first_name || '', 
              last_name: creator.last_name || '' 
            } : null,
            step_count: stepCount
          };
        })
      );

      setTemplates(templatesWithSteps);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const getTemplate = async (templateId: string) => {
    const template = await db.runbooks.get(templateId);
    if (!template) throw new Error('Template not found');
    return template;
  };

  const createFromTemplate = async (
    templateId: string,
    title: string,
    description: string,
    clientId: string,
    creatorId: string
  ) => {
    try {
      // Get the template runbook
      const template = await db.runbooks.get(templateId);
      if (!template) throw new Error('Template not found');

      // Get template steps
      const templateSteps = await db.runbook_steps
        .where('runbook_id')
        .equals(templateId)
        .toArray();

      // Create new runbook
      const newRunbookId = generateId();
      const newRunbook: Runbook = {
        id: newRunbookId,
        title,
        description,
        client_id: clientId,
        created_by: creatorId,
        is_template: false,
        created_at: getCurrentTimestamp()
      };

      await db.runbooks.add(newRunbook);

      // Create new steps based on template
      const newSteps = templateSteps.map(step => ({
        ...step,
        id: generateId(),
        runbook_id: newRunbookId,
        created_at: getCurrentTimestamp()
      }));

      await db.runbook_steps.bulkAdd(newSteps);

      return newRunbookId;
    } catch (error) {
      console.error('Error creating runbook from template:', error);
      throw error;
    }
  };

  const saveAsTemplate = async (
    runbookId: string,
    templateName: string,
    templateDescription?: string
  ) => {
    try {
      await db.runbooks.update(runbookId, {
        is_template: true,
        template_name: templateName,
        template_description: templateDescription,
        updated_at: getCurrentTimestamp()
      });
    } catch (error) {
      console.error('Error saving as template:', error);
      throw error;
    }
  };

  const createFromCSV = async (
    csvData: any[],
    title: string,
    description: string,
    clientId: string,
    creatorId: string
  ) => {
    try {
      // Create the runbook
      const newRunbookId = generateId();
      const newRunbook: Runbook = {
        id: newRunbookId,
        title,
        description,
        client_id: clientId,
        created_by: creatorId,
        is_template: false,
        created_at: getCurrentTimestamp()
      };

      await db.runbooks.add(newRunbook);

      // Create steps from CSV data
      const steps = csvData.map((row, index) => ({
        id: generateId(),
        runbook_id: newRunbookId,
        title: row.title || `Step ${index + 1}`,
        description: row.description || '',
        step_order: row.step_order || index + 1,
        estimated_duration_minutes: row.estimated_duration_minutes ? parseInt(row.estimated_duration_minutes) : undefined,
        tasks: row.tasks ? JSON.parse(row.tasks) : [],
        created_at: getCurrentTimestamp()
      }));

      await db.runbook_steps.bulkAdd(steps);

      return newRunbookId;
    } catch (error) {
      console.error('Error creating runbook from CSV:', error);
      throw error;
    }
  };

  return {
    templates,
    loading,
    fetchTemplates,
    getTemplate,
    createFromTemplate,
    saveAsTemplate,
    createFromCSV
  };
}
