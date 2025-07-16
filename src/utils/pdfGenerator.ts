import jsPDF from 'jspdf';
import { getAppBrandingLogoUrl } from './urlUtils';

export interface RunbookPDFData {
  id: string;
  title: string;
  description?: string;
  client: { name: string } | null;
  created_by_profile: { first_name: string; last_name: string } | null;
  created_at: string;
  updated_at: string;
  steps: Array<{
    id: string;
    title: string;
    description?: string;
    step_order: number;
    estimated_duration_minutes?: number;
    assigned_user?: { first_name: string; last_name: string } | null;
    photo_url?: string | null;
    conditions?: {
      question?: {
        id: string;
        question: string;
        type: string;
        options?: string[];
        required?: boolean;
      };
      visibilityRules?: Array<{
        questionId: string;
        expectedAnswer: string;
        operator: string;
      }>;
    } | null;
    tasks?: Array<{
      title: string;
      description?: string;
      completed: boolean;
      question?: {
        id: string;
        question: string;
        type: string;
        options?: string[];
        required?: boolean;
      };
      visibilityRules?: Array<{
        questionId: string;
        expectedAnswer: string;
        operator: string;
      }>;
    }>;
  }>;
}

export const generateRunbookPDF = async (runbook: RunbookPDFData, primaryColor?: string, logoUrl?: string, themeMode?: 'light' | 'dark', returnBlob: boolean = false) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to convert hex color to RGB array
  const hexToRgb = (hex: string): number[] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [132, 204, 22]; // Default lime green if conversion fails
  };

  // Color scheme - uses dynamic primary color or defaults to lime green
  const accentColor = primaryColor ? hexToRgb(primaryColor) : [132, 204, 22];
  const colors = {
    primary: [0, 0, 0], // Black
    secondary: [107, 114, 128], // Gray
    accent: accentColor, // Dynamic primary color
    danger: [239, 68, 68], // Red
    background: [248, 250, 252], // Light gray
    text: [17, 24, 39], // Dark gray
    warning: [255, 193, 7], // Yellow for emergency footer
    question: [59, 130, 246], // Blue for questions
    conditional: [245, 158, 11], // Amber for conditionals
    conditionalBg: [254, 252, 232], // Very light yellow for conditional task containers
    conditionBox: [75, 85, 99] // Dark grey for condition boxes
  };

  // Helper function to add colored rectangle
  const addColoredRect = (x: number, y: number, width: number, height: number, color: number[]) => {
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(x, y, width, height, 'F');
  };

  // Helper function to add gradient background
  const addGradientBackground = (x: number, y: number, width: number, height: number, startColor: number[], endColor: number[]) => {
    // Create multiple horizontal strips to simulate gradient
    const steps = 50;
    const stripHeight = height / steps;
    
    for (let i = 0; i < steps; i++) {
      const ratio = i / (steps - 1);
      const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio);
      const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio);
      const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio);
      
      pdf.setFillColor(r, g, b);
      pdf.rect(x, y + (i * stripHeight), width, stripHeight + 0.5, 'F');
    }
  };

  // Helper function to add rounded colored rectangle
  const addRoundedRect = (x: number, y: number, width: number, height: number, color: number[], radius: number = 4) => {
    // Save current graphics state
    pdf.saveGraphicsState();
    
    // Set fill opacity to 0.3
    pdf.setGState(pdf.GState({ opacity: 0.3 }));
    pdf.setFillColor(color[0], color[1], color[2]);
    
    // Draw filled rounded rectangle with reduced opacity
    pdf.roundedRect(x, y, width, height, radius, radius, 'F');
    
    // Restore graphics state and set full opacity for border
    pdf.restoreGraphicsState();
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(1);
    
    // Draw border with full opacity
    pdf.roundedRect(x, y, width, height, radius, radius, 'S');
  };

  // Helper function to add a circular badge with step number
  const addStepBadge = (x: number, y: number, stepNumber: number, radius: number = 12) => {
    // Draw circle background
    pdf.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    pdf.circle(x, y, radius, 'F');
    
    // Draw circle border
    pdf.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    pdf.setLineWidth(2);
    pdf.circle(x, y, radius, 'S');
    
    // Add step number text
    pdf.setTextColor(255, 255, 255); // White text for contrast
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    
    // Calculate text position to center it in the circle
    const textWidth = pdf.getTextWidth(stepNumber.toString());
    const textX = x - (textWidth / 2);
    const textY = y + 4; // Slight adjustment for vertical centering
    
    pdf.text(stepNumber.toString(), textX, textY);
  };

  // Helper function to add a nice rounded checkbox
  const addCheckbox = (x: number, y: number, isChecked: boolean, size: number = 8) => {
    const radius = 2; // Rounded corners
    
    if (isChecked) {
      // Filled checkbox with accent color
      pdf.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      pdf.roundedRect(x, y, size, size, radius, radius, 'F');
      
      // White checkmark
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(1.5);
      
      // Draw checkmark lines
      const checkSize = size * 0.6;
      const offsetX = size * 0.2;
      const offsetY = size * 0.4;
      
      // First line of checkmark (short line going down-right)
      pdf.line(
        x + offsetX, 
        y + offsetY, 
        x + offsetX + checkSize * 0.4, 
        y + offsetY + checkSize * 0.4
      );
      
      // Second line of checkmark (longer line going up-right)
      pdf.line(
        x + offsetX + checkSize * 0.4, 
        y + offsetY + checkSize * 0.4, 
        x + offsetX + checkSize, 
        y + offsetY - checkSize * 0.2
      );
    } else {
      // Empty checkbox with border
      pdf.setFillColor(255, 255, 255); // White background
      pdf.roundedRect(x, y, size, size, radius, radius, 'F');
      
      // Gray border
      pdf.setDrawColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      pdf.setLineWidth(1);
      pdf.roundedRect(x, y, size, size, radius, radius, 'S');
    }
  };

  // Helper function to add condition badge
  const addConditionBadge = (x: number, y: number, visibilityRules: any[]) => {
    if (!visibilityRules || visibilityRules.length === 0) return 0;
    
    // Create condition text with actual question text and answers
    const conditionTexts = visibilityRules.map(rule => {
      const questionData = findQuestionById(rule.questionId);
      const questionText = questionData?.question || `Question ${rule.questionId}`;
      const operator = rule.operator || 'equals';
      // Use the correct property name from VisibilityRule interface
      const expectedAnswer = rule.requiredAnswer || rule.expectedAnswer || rule.answer || rule.value || 'unknown';
      
      return `${questionText} ${operator} "${expectedAnswer}"`;
    });
    const conditionText = `To Do if: ${conditionTexts.join(' AND ')}`;
    
    // Set font for measuring
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    const textWidth = pdf.getTextWidth(conditionText);
    const badgeWidth = Math.min(textWidth + 8, contentWidth - 20); // Limit badge width
    const badgeHeight = 8; // Reduced height from 10 to 8
    
    // Draw badge background in slate grey
    pdf.setFillColor(100, 116, 139); // Slate grey color
    pdf.roundedRect(x, y, badgeWidth, badgeHeight, 1, 1, 'F');
    
    // Add badge text
    pdf.setTextColor(255, 255, 255);
    // Truncate text if it's too long
    const maxWidth = badgeWidth - 6;
    const truncatedText = pdf.getTextWidth(conditionText) > maxWidth 
      ? conditionText.substring(0, Math.floor(conditionText.length * maxWidth / pdf.getTextWidth(conditionText))) + '...'
      : conditionText;
    pdf.text(truncatedText, x + 4, y + 6); // Adjusted text position for shorter badge
    
    return badgeWidth + 5; // Return width used plus some spacing
  };

  // Helper function to add text with word wrapping and color
  const addText = (text: string, fontSize: number, isBold: boolean = false, maxWidth?: number, textColor?: number[]) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    if (textColor) {
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
    } else {
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    }
    
    const lines = pdf.splitTextToSize(text, maxWidth || contentWidth);
    
    // Check if we need a new page
    if (yPosition + (lines.length * fontSize * 0.35) > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
    
    pdf.text(lines, margin, yPosition);
    yPosition += lines.length * fontSize * 0.35 + 5;
    
    return yPosition;
  };

  // Helper function to convert SVG to high-resolution PNG
  const convertSvgToPng = async (svgUrl: string, targetWidth: number = 200, targetHeight: number = 200): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Create a canvas with high DPI for crisp rendering
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          
          // Set canvas size to target dimensions with 2x scaling for high DPI
          const scale = 2;
          canvas.width = targetWidth * scale;
          canvas.height = targetHeight * scale;
          
          // Scale the context to ensure correct drawing operations
          ctx.scale(scale, scale);
          
          // Set canvas style size (for display, but not used in PDF)
          canvas.style.width = targetWidth + 'px';
          canvas.style.height = targetHeight + 'px';
          
          // Don't fill with white background to preserve transparency
          // Clear the canvas to transparent instead
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          
          // Calculate aspect ratio to maintain proportions
          const aspectRatio = img.width / img.height;
          let drawWidth = targetWidth;
          let drawHeight = targetHeight;
          let offsetX = 0;
          let offsetY = 0;
          
          if (aspectRatio > targetWidth / targetHeight) {
            drawHeight = targetWidth / aspectRatio;
            offsetY = (targetHeight - drawHeight) / 2;
          } else {
            drawWidth = targetHeight * aspectRatio;
            offsetX = (targetWidth - drawWidth) / 2;
          }
          
          // Draw the image centered
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
          
          // Convert to PNG data URL
          const pngDataUrl = canvas.toDataURL('image/png', 1.0);
          resolve(pngDataUrl);
        } catch (error) {
          console.warn('Failed to convert SVG to PNG:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        console.warn('Failed to load SVG for conversion:', svgUrl);
        resolve(null);
      };
      
      img.src = svgUrl;
    });
  };

  // Helper function to load and add image to PDF (with SVG conversion support)
  const addImageToPDF = async (imageUrl: string, x: number, y: number, width: number, height: number): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        let finalImageUrl = imageUrl;
        
        // Check if the image is an SVG and convert it to PNG
        if (imageUrl.toLowerCase().includes('.svg') || imageUrl.toLowerCase().includes('image/svg')) {
          console.log('Converting SVG to PNG for PDF compatibility...');
          const pngDataUrl = await convertSvgToPng(imageUrl, width * 4, height * 4); // 4x resolution for crisp quality
          if (pngDataUrl) {
            finalImageUrl = pngDataUrl;
          } else {
            console.warn('SVG conversion failed, trying original URL');
          }
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            // Calculate aspect ratio to maintain proportions
            const aspectRatio = img.width / img.height;
            let finalWidth = width;
            let finalHeight = height;
            
            if (aspectRatio > width / height) {
              finalHeight = width / aspectRatio;
            } else {
              finalWidth = height * aspectRatio;
            }
            
            // Center the image in the allocated space
            const offsetX = (width - finalWidth) / 2;
            const offsetY = (height - finalHeight) / 2;
            
            // Use PNG format for better compatibility
            const format = finalImageUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            pdf.addImage(img, format, x + offsetX, y + offsetY, finalWidth, finalHeight);
            resolve(true);
          } catch (error) {
            console.warn('Failed to add image to PDF:', error);
            resolve(false);
          }
        };
        
        img.onerror = () => {
          console.warn('Failed to load image:', finalImageUrl);
          resolve(false);
        };
        
        img.src = finalImageUrl;
      } catch (error) {
        console.warn('Error in addImageToPDF:', error);
        resolve(false);
      }
    });
  };

  // Helper function to find question text by ID across all steps
  const findQuestionById = (questionId: string): { question: string; options: string[] } | null => {
    // Search through all steps for the question
    for (const step of runbook.steps) {
      // Check step-level question
      if (step.conditions?.question?.id === questionId) {
        return {
          question: step.conditions.question.question,
          options: step.conditions.question.options || []
        };
      }
      
      // Check task-level questions
      if (step.tasks) {
        for (const task of step.tasks) {
          if (task.question?.id === questionId) {
            return {
              question: task.question.question,
              options: task.question.options || []
            };
          }
        }
      }
    }
    return null;
  };

  // Helper function to draw pseudo button for answer options
  const addPseudoButton = (x: number, y: number, text: string, width: number) => {
    const height = 8;
    
    // Draw button background
    pdf.setFillColor(248, 250, 252); // Slightly lighter, more professional gray
    pdf.roundedRect(x, y, width, height, 1, 1, 'F');
    
    // Draw button border
    pdf.setDrawColor(156, 163, 175); // More subtle border color
    pdf.setLineWidth(0.5);
    pdf.roundedRect(x, y, width, height, 1, 1, 'S');
    
    // Add button text
    pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    
    // Center text in button
    const textWidth = pdf.getTextWidth(text);
    const textX = x + (width - textWidth) / 2;
    const textY = y + 5.5; // Center vertically
    
    pdf.text(text, textX, textY);
  };

  // COVER PAGE
  // Add solid background color based on theme mode
  const isDarkMode = themeMode === 'dark';
  const coverBgColor = isDarkMode ? [32, 33, 31] : [255, 255, 255]; // Dark: #20211f, Light: white
  const coverTextColor = isDarkMode ? [255, 255, 255] : [0, 0, 0]; // Dark: white text, Light: black text
  const coverSubtextColor = isDarkMode ? [200, 200, 200] : [100, 100, 100]; // Dark: light grey, Light: dark grey
  
  addColoredRect(0, 0, pageWidth, pageHeight, coverBgColor);
  
  // Add logo in top left corner - use custom logo or fallback to default
  const defaultLogoUrl = 'https://xs26tevltn.ufs.sh/f/W00C7B5w6iteSxRR6sGW2dvMzkeIAOiQ9qnsYoEGtr65CZDW';
  // Convert relative logo URL to full URL using the proper utility function
  const processedLogoUrl = logoUrl ? getAppBrandingLogoUrl(logoUrl) : null;
  const finalLogoUrl = processedLogoUrl || defaultLogoUrl;
  
  // Debug logging to help troubleshoot logo URL issues
  console.log('PDF Generator - Logo URL Processing:');
  console.log('  Original logoUrl:', logoUrl);
  console.log('  Processed logoUrl:', processedLogoUrl);
  console.log('  Final logoUrl:', finalLogoUrl);
  
  // Try to load and add the logo - await the result
  try {
    const logoSuccess = await addImageToPDF(finalLogoUrl, margin, margin, 50, 50);
    if (!logoSuccess) {
      console.warn('Logo failed to load, continuing without it');
      // Add a fallback white rectangle placeholder for logo
      pdf.setFillColor(60, 60, 60); // Dark grey placeholder
      pdf.roundedRect(margin, margin, 50, 50, 5, 5, 'F');
      // Add border
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(1);
      pdf.roundedRect(margin, margin, 50, 50, 5, 5, 'S');
    }
    } catch (error) {
    console.warn('Logo loading error, continuing without it');
    // Add a fallback white rectangle placeholder for logo
    pdf.setFillColor(60, 60, 60); // Dark grey placeholder
    pdf.roundedRect(margin, margin, 50, 50, 5, 5, 'F');
    // Add border
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(1);
    pdf.roundedRect(margin, margin, 50, 50, 5, 5, 'S');
  }
  
  // Lime green accent line at top (positioned after logo)
  addColoredRect(margin, margin + 60, contentWidth, 4, colors.accent);
  
  yPosition = margin + 80;

  // Title - large, bold, with theme-appropriate color and tightest letter spacing and full width
  pdf.setTextColor(coverTextColor[0], coverTextColor[1], coverTextColor[2]);
  pdf.setFontSize(36);
  pdf.setFont('helvetica', 'bold');
  pdf.setCharSpace(-0.5); // Tightest letter spacing (negative value)
  const titleLines = pdf.splitTextToSize(runbook.title, pageWidth - (margin * 2)); // Full page width
  pdf.text(titleLines, margin, yPosition);
  pdf.setCharSpace(0); // Reset letter spacing for other text
  yPosition += titleLines.length * 36 * 0.9 + 34; // Added 4px more space
  
  // Subtitle - smaller, normal weight, left-aligned with accent color
  pdf.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Runbook Documentation', margin, yPosition);
  yPosition += 35;
  
  // Description if available - left-aligned with theme-appropriate color, full width
  if (runbook.description) {
    pdf.setTextColor(coverSubtextColor[0], coverSubtextColor[1], coverSubtextColor[2]); 
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    const descLines = pdf.splitTextToSize(runbook.description, pageWidth - (margin * 2)); // Full width
    pdf.text(descLines, margin, yPosition);
    yPosition += descLines.length * 14 * 0.4 + 30;
  }
  
  // Format dates helper function (moved up for use in footer)
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // START NEW PAGE FOR STEPS
  pdf.addPage();
  yPosition = margin;

  // Steps
  runbook.steps.forEach((step, index) => {
    // New page for each step (except first one since we're already on page 2)
    if (index > 0) {
      pdf.addPage();
      yPosition = margin;
    }
    
    // Add "STEP" label above square in small caps
    pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]); // Grey color
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    const stepLabelText = 'STEP';
    const stepLabelWidth = pdf.getTextWidth(stepLabelText);
    const stepLabelX = margin + 6 - (stepLabelWidth / 2); // Center above smaller 12px square
    pdf.text(stepLabelText, stepLabelX, yPosition - 2);
    
    // Add step number rounded square below the label - moved up to avoid container conflicts
    const squareSize = 12; // 16x16 rounded square
    const squareX = margin;
    const squareY = yPosition - 1; // Moved up to avoid conflicts with container below
    
    // Draw rounded square background with lime green color
    pdf.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    pdf.roundedRect(squareX, squareY, squareSize, squareSize, 3, 3, 'F');
    
    // Draw rounded square border
    pdf.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    pdf.setLineWidth(1);
    pdf.roundedRect(squareX, squareY, squareSize, squareSize, 3, 3, 'S');
    
    // Add step number text in white - largest size and perfectly centered
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16); // Largest number yet
    pdf.setFont('helvetica', 'bold');
    const stepNumberText = step.step_order.toString();
    const textWidth = pdf.getTextWidth(stepNumberText);
    const textHeight = 16 * 0.35; // Approximate text height for largest font
    const textX = squareX + (squareSize / 2) - (textWidth / 2); // Perfect horizontal centering
    const textY = squareY + (squareSize / 2) + (textHeight / 2); // Perfect vertical centering
    pdf.text(stepNumberText, textX, textY);
    
    // Add step title text to the right of rounded square (without step number)
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(step.title, margin + squareSize + 8, squareY + 8); // Just the title, no "Step X:"
    
    const headerHeight = 18;
    yPosition += headerHeight + 3;
    
    // Step details in a box - now includes description
    if (step.estimated_duration_minutes || step.assigned_user || step.description) {
      // Calculate box height based on content
      let detailsHeight = 16; // Base height
      if (step.description) {
        pdf.setFontSize(9);
        const descLines = pdf.splitTextToSize(step.description, contentWidth - 10);
        detailsHeight += (descLines.length * 9 * 0.35) + 10; // Add height for description + 10px space
      }
      
      addRoundedRect(margin - 5, yPosition - 5, contentWidth + 10, detailsHeight, colors.background);
      
      let currentY = yPosition + 6;
      
      // Duration and assigned user on first row
      if (step.estimated_duration_minutes) {
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Duration:', margin, currentY);
        
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${step.estimated_duration_minutes} minutes`, margin + 25, currentY);
      }
      
      if (step.assigned_user) {
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Assigned to:', margin + 80, currentY);
        
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${step.assigned_user.first_name} ${step.assigned_user.last_name}`, margin + 115, currentY);
      }
      
      // Description on second row if available
      if (step.description) {
        currentY += 6; // Move to next line (reduced by 10px)
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Description:', margin, currentY);
        
        currentY += 8; // Increased vertical space between label and value
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFont('helvetica', 'normal');
        const descLines = pdf.splitTextToSize(step.description, contentWidth - 10);
        pdf.text(descLines, margin, currentY);
      }
      
      yPosition += detailsHeight + 2;
    }
    
    // Step question if available - dark grey box with small white text
    if (step.conditions?.question) {
      yPosition += 3;
      
      // Dark grey box for condition question
      const questionText = step.conditions.question.question;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      const questionLines = pdf.splitTextToSize(questionText, contentWidth - 10);
      const questionHeight = questionLines.length * 7 * 0.35 + 8; // Compact height
      
      // Draw dark grey background
      pdf.setFillColor(colors.conditionBox[0], colors.conditionBox[1], colors.conditionBox[2]);
      pdf.roundedRect(margin - 5, yPosition - 3, contentWidth + 10, questionHeight, 1, 1, 'F');
      
      // Add small white text in corner
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CONDITION', margin, yPosition + 2);
      
      // Question text in white
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(questionLines, margin, yPosition + 8);
      
      yPosition += questionHeight + 2;
      
      // Answer options as pseudo buttons on same line as question
      if (step.conditions.question.options && step.conditions.question.options.length > 0) {
        // Start from the end of the question text
        let currentRowY = yPosition - 2; // Align with the last line of question
        let xOffset = margin + 60; // Start after some space from question
        const buttonSpacing = 4;
        
        step.conditions.question.options.forEach((option: string, optionIndex: number) => {
          pdf.setFontSize(7);
          const buttonWidth = Math.min(pdf.getTextWidth(option) + 6, 35); // Slightly smaller buttons
          
          // Check if button fits on current row
          if (xOffset + buttonWidth > margin + contentWidth) {
            currentRowY += 10; // Move to next row
            xOffset = margin + 60; // Reset to same x position
          }
          
          addPseudoButton(xOffset, currentRowY, option, buttonWidth);
          xOffset += buttonWidth + buttonSpacing;
        });
        
        yPosition = Math.max(yPosition, currentRowY + 10); // Ensure we're below all buttons
      }
    }
    
    // Step photo if available
    if (step.photo_url) {
      yPosition += 10;
      
      // Add photo section header
      pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Step Reference Photo:', margin, yPosition);
      yPosition += 15;
      
      // Add photo placeholder/border
      const photoWidth = 80;
      const photoHeight = 60;
      
      // Draw border for photo
      pdf.setDrawColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      pdf.setLineWidth(1);
      pdf.rect(margin, yPosition, photoWidth, photoHeight);
      
      // Try to load and add the photo
      addImageToPDF(step.photo_url, margin, yPosition, photoWidth, photoHeight).then((success) => {
        if (!success) {
          // Add "Image not available" text if photo fails to load
          pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          const noImageText = 'Image not available';
          const textWidth = pdf.getTextWidth(noImageText);
          const textX = margin + (photoWidth - textWidth) / 2;
          const textY = yPosition + photoHeight / 2;
          pdf.text(noImageText, textX, textY);
        }
      });
      
      yPosition += photoHeight + 15;
    }
    
    // Tasks section
    if (step.tasks && step.tasks.length > 0) {
      yPosition += 8; // Increased spacing before tasks section
      addText('Tasks:', 12, true, undefined, colors.primary);
      yPosition += 5; // Increased spacing after tasks header
      
      step.tasks.forEach((task, taskIndex) => {
        const hasConditions = task.visibilityRules && task.visibilityRules.length > 0;
        let taskStartY = yPosition;
        
        // If task has conditions, create a light yellow container
        if (hasConditions) {
          // Calculate container height needed
          let containerHeight = 25; // Base height for task title and spacing
          
          // Add height for task description if present
          if (task.description) {
            pdf.setFontSize(9);
            const descLines = pdf.splitTextToSize(task.description, contentWidth - 35);
            containerHeight += descLines.length * 9 * 0.35 + 4;
          }
          
          // Add height for task question if present
          if (task.question) {
            containerHeight += 35; // Approximate height for question section
            if (task.question.options && task.question.options.length > 0) {
              containerHeight += task.question.options.length * 8;
            }
          }
          
          // Draw light yellow container for conditional task with smaller radius
          addRoundedRect(margin - 5, yPosition - 5, contentWidth + 10, containerHeight, colors.conditionalBg, 1);
          
          // Add condition badge at top of container
          addConditionBadge(margin, yPosition - 2, task.visibilityRules);
          yPosition += 12; // Space for condition badge
        }
        
        // Draw visual checkbox
        const checkboxY = yPosition - 2; // Slight adjustment for alignment
        addCheckbox(margin + (hasConditions ? 5 : 0), checkboxY, task.completed);
        
        // Task title
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const taskLines = pdf.splitTextToSize(task.title, contentWidth - (hasConditions ? 30 : 20));
        pdf.text(taskLines, margin + (hasConditions ? 20 : 15), yPosition);
        
        yPosition += taskLines.length * 10 * 0.35;
        
        // Task description (indented)
        if (task.description) {
          pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
          pdf.setFontSize(9);
          const descLines = pdf.splitTextToSize(task.description, contentWidth - (hasConditions ? 35 : 25));
          pdf.text(descLines, margin + (hasConditions ? 25 : 20), yPosition + 3);
          yPosition += descLines.length * 9 * 0.35 + 6;
        } else {
          yPosition += 4;
        }
        
        // Task question if available - just the question and pseudo button answers
        if (task.question) {
          yPosition += 5;
          
          // Question text (no header label)
          pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          const taskQuestionLines = pdf.splitTextToSize(task.question.question, contentWidth - (hasConditions ? 40 : 30));
          pdf.text(taskQuestionLines, margin + (hasConditions ? 25 : 20), yPosition);
          yPosition += taskQuestionLines.length * 9 * 0.35 + 5;
          
          // Answer options as pseudo buttons on same line as question
          if (task.question.options && task.question.options.length > 0) {
            // Start from the end of the question text, on the same line
            let currentRowY = yPosition - 2; // Align with the last line of question
            let xOffset = margin + (hasConditions ? 80 : 75); // Start after question text
            const buttonSpacing = 4;
            
            task.question.options.forEach((option: string) => {
              pdf.setFontSize(7);
              const buttonWidth = Math.min(pdf.getTextWidth(option) + 6, 35); // Max width of 35
              
              // Check if button fits on current row
              if (xOffset + buttonWidth > margin + contentWidth - (hasConditions ? 25 : 20)) {
                currentRowY += 10; // Move to next row
                xOffset = margin + (hasConditions ? 80 : 75); // Reset to same x position
              }
              
              addPseudoButton(xOffset, currentRowY, option, buttonWidth);
              xOffset += buttonWidth + buttonSpacing;
            });
            
            yPosition = Math.max(yPosition, currentRowY + 10); // Ensure we're below all buttons
          }
        }
        
        // Add extra spacing between tasks (increased from previous version)
        yPosition += 10; // Increased from 8 to 10
      });
    }
    
    yPosition += 10; // Reduced from 15 to 10
  });

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    if (i === 1) {
      // Cover page footer - generated date instead of emergency message
      addColoredRect(0, pageHeight - 40, pageWidth, 20, colors.accent);
      pdf.setTextColor(0, 0, 0); // Black text on accent color background
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      
      const generatedText = `Generated on ${new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`;
      const generatedTextWidth = pdf.getTextWidth(generatedText);
      const generatedTextX = (pageWidth - generatedTextWidth) / 2; // Center the text
      pdf.text(generatedText, generatedTextX, pageHeight - 28);
      
      // Footer below generated date footer (cover page - no title/page numbers)
      // Use theme-appropriate colors for the footer
      const footerBgColor = isDarkMode ? colors.primary : [240, 240, 240]; // Dark mode: black, Light mode: light grey
      const footerTextColor = isDarkMode ? [255, 255, 255] : [60, 60, 60]; // Dark mode: white, Light mode: dark grey
      
      addColoredRect(0, pageHeight - 20, pageWidth, 20, footerBgColor);
      pdf.setTextColor(footerTextColor[0], footerTextColor[1], footerTextColor[2]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      // Only show metadata on cover page (no title or page numbers)
      const client = runbook.client?.name || 'Unknown';
      const author = runbook.created_by_profile 
        ? `${runbook.created_by_profile.first_name} ${runbook.created_by_profile.last_name}`
        : 'Unknown';
      const metadataText = `Client: ${client} | Author: ${author}`;
      
      // Center the metadata text on the cover page
      const metadataTextWidth = pdf.getTextWidth(metadataText);
      const metadataTextX = (pageWidth - metadataTextWidth) / 2;
      pdf.text(metadataText, metadataTextX, pageHeight - 8);
    } else {
      // Other pages - clean black footer
      addColoredRect(0, pageHeight - 20, pageWidth, 20, colors.primary);
      
      // Left side - page info
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      // Handle title wrapping if over 35 characters
      const pageInfo = ` - Page ${i} of ${totalPages}`;
      if (runbook.title.length > 35) {
        // Split title at around 35 characters, preferring word boundaries
        let splitPoint = 35;
        for (let j = 35; j >= 25; j--) {
          if (runbook.title[j] === ' ') {
            splitPoint = j;
            break;
          }
        }
        const firstLine = runbook.title.substring(0, splitPoint);
        const secondLine = runbook.title.substring(splitPoint).trim() + pageInfo;
        
        pdf.text(firstLine, margin, pageHeight - 14);
        pdf.text(secondLine, margin, pageHeight - 6);
      } else {
        pdf.text(`${runbook.title}${pageInfo}`, margin, pageHeight - 8);
      }
      
      // Right side - emergency contact
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      const emergencyText = 'EMERGENCY SUPPORT: 1800 KELYN';
      const textWidth = pdf.getTextWidth(emergencyText);
      const textX = pageWidth - margin - textWidth;
      const textY = pageHeight - 8; // Standard vertical position
      
      // Add the text
      pdf.text(emergencyText, textX, textY);
      
      // Draw red underline
      pdf.setDrawColor(255, 0, 0); // Red color
      pdf.setLineWidth(1); // Line width for underline
      const underlineY = textY + 1; // Position underline 1 unit below text
      pdf.line(textX, underlineY, textX + textWidth, underlineY);
    }
  }

  // Save the PDF or return blob
  if (returnBlob) {
    return pdf.output('blob');
  } else {
    const fileName = `${runbook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_runbook.pdf`;
    pdf.save(fileName);
  }
};
