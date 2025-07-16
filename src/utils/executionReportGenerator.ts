import jsPDF from 'jspdf';
import { getAppBrandingLogoUrl } from './urlUtils';

// Define the execution data interface for reports
export interface ExecutionReportData {
  id: string;
  title: string;
  runbook_title: string;
  runbook_description?: string;
  client_name: string;
  status: string;
  started_by: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_duration?: string;
  progress: number;
  step_assignments: Array<{
    id: string;
    step_order: number;
    step_title: string;
    step_description?: string;
    assigned_to?: string;
    status: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    duration?: string;
    notes?: string;
    estimated_duration_minutes?: number;
  }>;
}

// Generate CSV report
export const generateExecutionCSV = (execution: ExecutionReportData) => {
  const csvRows: string[] = [];
  
  // Header row
  csvRows.push([
    'Step Order',
    'Step Title',
    'Step Description',
    'Assigned To',
    'Status',
    'Estimated Duration (min)',
    'Actual Duration',
    'Created At',
    'Started At',
    'Completed At',
    'Notes'
  ].map(field => `"${field}"`).join(','));

  // Data rows
  execution.step_assignments.forEach(step => {
    csvRows.push([
      step.step_order.toString(),
      step.step_title,
      step.step_description || '',
      step.assigned_to || 'Unassigned',
      step.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      step.estimated_duration_minutes?.toString() || '',
      step.duration || '',
      formatDateForCSV(step.created_at),
      step.started_at ? formatDateForCSV(step.started_at) : '',
      step.completed_at ? formatDateForCSV(step.completed_at) : '',
      step.notes || ''
    ].map(field => `"${field.replace(/"/g, '""')}"`).join(','));
  });

  // Add summary rows
  csvRows.push(''); // Empty row
  csvRows.push('"EXECUTION SUMMARY"');
  csvRows.push(`"Execution Title","${execution.title}"`);
  csvRows.push(`"Runbook","${execution.runbook_title}"`);
  csvRows.push(`"Client","${execution.client_name}"`);
  csvRows.push(`"Started By","${execution.started_by}"`);
  csvRows.push(`"Status","${execution.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}"`);
  csvRows.push(`"Progress","${execution.progress}%"`);
  csvRows.push(`"Created At","${formatDateForCSV(execution.created_at)}"`);
  if (execution.started_at) {
    csvRows.push(`"Started At","${formatDateForCSV(execution.started_at)}"`);
  }
  if (execution.completed_at) {
    csvRows.push(`"Completed At","${formatDateForCSV(execution.completed_at)}"`);
  }
  if (execution.total_duration) {
    csvRows.push(`"Total Duration","${execution.total_duration}"`);
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const cleanTitle = execution.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${cleanTitle}_execution_report_${dateStr}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Generate PDF report
export const generateExecutionPDF = async (execution: ExecutionReportData, primaryColor?: string, logoUrl?: string) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Color scheme
  const hexToRgb = (hex: string): number[] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [132, 204, 22];
  };

  const accentColor = primaryColor ? hexToRgb(primaryColor) : [132, 204, 22];
  const colors = {
    primary: [0, 0, 0],
    secondary: [107, 114, 128],
    accent: accentColor,
    success: [34, 197, 94],
    warning: [245, 158, 11],
    danger: [239, 68, 68],
    background: [248, 250, 252],
    text: [17, 24, 39]
  };

  // Helper functions
  const addColoredRect = (x: number, y: number, width: number, height: number, color: number[]) => {
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(x, y, width, height, 'F');
  };

  const addImageToPDF = async (imageUrl: string, x: number, y: number, width: number, height: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const aspectRatio = img.width / img.height;
          let finalWidth = width;
          let finalHeight = height;
          
          if (aspectRatio > width / height) {
            finalHeight = width / aspectRatio;
          } else {
            finalWidth = height * aspectRatio;
          }
          
          const offsetX = (width - finalWidth) / 2;
          const offsetY = (height - finalHeight) / 2;
          
          pdf.addImage(img, 'JPEG', x + offsetX, y + offsetY, finalWidth, finalHeight);
          resolve(true);
        } catch (error) {
          console.warn('Failed to add image to PDF:', error);
          resolve(false);
        }
      };
      
      img.onerror = () => {
        console.warn('Failed to load image:', imageUrl);
        resolve(false);
      };
      
      img.src = imageUrl;
    });
  };

  const getStatusColor = (status: string): number[] => {
    switch (status.toLowerCase()) {
      case 'completed':
        return colors.success;
      case 'in_progress':
        return colors.warning;
      case 'blocked':
        return colors.danger;
      default:
        return colors.secondary;
    }
  };

  // HEADER
  try {
    const defaultLogoUrl = 'https://xs26tevltn.ufs.sh/f/W00C7B5w6iteSxRR6sGW2dvMzkeIAOiQ9qnsYoEGtr65CZDW';
    const processedLogoUrl = logoUrl ? getAppBrandingLogoUrl(logoUrl) : null;
    const finalLogoUrl = processedLogoUrl || defaultLogoUrl;
    await addImageToPDF(finalLogoUrl, margin, margin, 40, 40);
  } catch (error) {
    console.warn('Logo loading error, continuing without it');
  }
  
  // Title
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Execution Report', margin + 50, margin + 20);
  
  // Execution title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  const titleLines = pdf.splitTextToSize(execution.title, contentWidth - 50);
  pdf.text(titleLines, margin + 50, margin + 35);
  
  yPosition = margin + 60;

  // Summary section
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary', margin, yPosition);
  yPosition += 20;

  // Summary in two columns
  const leftColumn = [
    ['Client:', execution.client_name],
    ['Runbook:', execution.runbook_title],
    ['Started By:', execution.started_by]
  ];

  const rightColumn = [
    ['Status:', execution.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())],
    ['Progress:', `${execution.progress}% (${execution.step_assignments.filter(s => s.status === 'completed').length}/${execution.step_assignments.length} steps)`],
    ['Duration:', execution.total_duration || 'In progress']
  ];

  // Left column
  leftColumn.forEach(([label, value]) => {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    pdf.text(label, margin, yPosition);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    const valueLines = pdf.splitTextToSize(value, (contentWidth / 2) - 40);
    pdf.text(valueLines, margin + 40, yPosition);
    yPosition += 12;
  });

  // Reset position for right column
  yPosition -= 36; // Go back up for right column

  // Right column
  rightColumn.forEach(([label, value]) => {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    pdf.text(label, margin + (contentWidth / 2), yPosition);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    const valueLines = pdf.splitTextToSize(value, (contentWidth / 2) - 40);
    pdf.text(valueLines, margin + (contentWidth / 2) + 40, yPosition);
    yPosition += 12;
  });

  yPosition += 20;

  // Steps section
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  pdf.text('Steps', margin, yPosition);
  yPosition += 15;

  // Steps table header
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  pdf.text('#', margin, yPosition);
  pdf.text('Step', margin + 15, yPosition);
  pdf.text('Assigned To', margin + 80, yPosition);
  pdf.text('Status', margin + 130, yPosition);
  pdf.text('Duration', margin + 165, yPosition);
  yPosition += 12;

  // Steps table rows
  execution.step_assignments.forEach((step) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    
    // Step number
    pdf.text(step.step_order.toString(), margin, yPosition);
    
    // Step title (truncated if too long)
    const stepTitle = step.step_title.length > 25 ? step.step_title.substring(0, 25) + '...' : step.step_title;
    pdf.text(stepTitle, margin + 15, yPosition);
    
    // Assigned to
    const assignedTo = step.assigned_to || 'Unassigned';
    const assignedText = assignedTo.length > 15 ? assignedTo.substring(0, 15) + '...' : assignedTo;
    pdf.text(assignedText, margin + 80, yPosition);
    
    // Status with color
    const statusColor = getStatusColor(step.status);
    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.setFont('helvetica', 'bold');
    const statusText = step.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    pdf.text(statusText, margin + 130, yPosition);
    
    // Duration
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.setFont('helvetica', 'normal');
    pdf.text(step.duration || '-', margin + 165, yPosition);
    
    yPosition += 10;

    // Add notes if they exist (on next line, indented)
    if (step.notes && step.notes.trim()) {
      pdf.setFontSize(8);
      pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      const notesText = step.notes.length > 80 ? step.notes.substring(0, 80) + '...' : step.notes;
      pdf.text(`Notes: ${notesText}`, margin + 15, yPosition);
      yPosition += 8;
    }

    yPosition += 2; // Small spacing between rows
  });

  // Footer
  addColoredRect(0, pageHeight - 15, pageWidth, 15, colors.accent);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const generatedText = `Generated on ${new Date().toLocaleDateString('en-US')}`;
  pdf.text(generatedText, margin, pageHeight - 5);
  pdf.text(`Page 1 of 1`, pageWidth - margin - 30, pageHeight - 5);

  // Save the PDF
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const cleanTitle = execution.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `${cleanTitle}_execution_report_${dateStr}.pdf`;
  pdf.save(fileName);
};

// Helper functions
const formatDateForCSV = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

const formatDateForPDF = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}; 