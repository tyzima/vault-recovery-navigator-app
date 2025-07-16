import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CircleAnnotation } from './CircleAnnotation';
import { ArrowAnnotation } from './ArrowAnnotation';
import { RedactionAnnotation } from './RedactionAnnotation';
import { Save, Undo, RotateCcw, Circle, MousePointer, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Circle {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface Arrow {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

interface Redaction {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type AnnotationTool = 'circle' | 'arrow' | 'redaction';

interface PhotoEditorProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => Promise<void>;
  onCancel: () => void;
  contextType: 'step' | 'task';
  contextId: string;
}

export function PhotoEditor({ 
  imageUrl, 
  onSave, 
  onCancel, 
  contextType, 
  contextId 
}: PhotoEditorProps) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [circleRadius, setCircleRadius] = useState(30);
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('circle');
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const [isDrawingRedaction, setIsDrawingRedaction] = useState(false);
  const [arrowStart, setArrowStart] = useState<{ x: number, y: number } | null>(null);
  const [redactionStart, setRedactionStart] = useState<{ x: number, y: number } | null>(null);
  const [previewCircle, setPreviewCircle] = useState<{ x: number, y: number } | null>(null);
  const [previewRedaction, setPreviewRedaction] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Available colors
  const colors = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Purple', value: '#8b5cf6' }
  ];

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return;
    if (!isDrawing && !isDrawingArrow && !isDrawingRedaction) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    // Calculate the actual image display area (accounting for object-contain)
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    const imageAspectRatio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let displayedWidth, displayedHeight, offsetX, offsetY;
    
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider - constrained by width
      displayedWidth = containerWidth;
      displayedHeight = containerWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayedHeight) / 2;
    } else {
      // Image is taller - constrained by height
      displayedHeight = containerHeight;
      displayedWidth = containerHeight * imageAspectRatio;
      offsetX = (containerWidth - displayedWidth) / 2;
      offsetY = 0;
    }

    // Check if click is within the actual image area
    if (clickX < offsetX || clickX > offsetX + displayedWidth || 
        clickY < offsetY || clickY > offsetY + displayedHeight) {
      return; // Click was outside the image area
    }

    if (currentTool === 'circle' && isDrawing) {
      // Calculate position relative to the container (for display purposes)
      const x = clickX - circleRadius;
      const y = clickY - circleRadius;

      // Keep circle within container bounds
      const maxX = containerWidth - circleRadius * 2;
      const maxY = containerHeight - circleRadius * 2;
      
      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));

      const newCircle: Circle = {
        id: crypto.randomUUID(),
        x: boundedX,
        y: boundedY,
        radius: circleRadius,
        color: currentColor
      };

      setCircles(prev => [...prev, newCircle]);
    } else if (currentTool === 'arrow' && isDrawingArrow) {
      if (!arrowStart) {
        // First click - set arrow start
        setArrowStart({ x: clickX, y: clickY });
      } else {
        // Second click - create arrow
        const newArrow: Arrow = {
          id: crypto.randomUUID(),
          startX: arrowStart.x,
          startY: arrowStart.y,
          endX: clickX,
          endY: clickY,
          color: currentColor
        };

        setArrows(prev => [...prev, newArrow]);
        setArrowStart(null);
      }
    }
  }, [isDrawing, isDrawingArrow, isDrawingRedaction, circleRadius, currentTool, currentColor, arrowStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return;
    
    // Handle circle preview
    if (currentTool === 'circle' && isDrawing) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      // Calculate the actual image display area (accounting for object-contain)
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const imageAspectRatio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
      const containerAspectRatio = containerWidth / containerHeight;
      
      let displayedWidth, displayedHeight, offsetX, offsetY;
      
      if (imageAspectRatio > containerAspectRatio) {
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageAspectRatio;
        offsetX = 0;
        offsetY = (containerHeight - displayedHeight) / 2;
      } else {
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageAspectRatio;
        offsetX = (containerWidth - displayedWidth) / 2;
        offsetY = 0;
      }

      // Check if mouse is within the actual image area
      if (mouseX < offsetX || mouseX > offsetX + displayedWidth || 
          mouseY < offsetY || mouseY > offsetY + displayedHeight) {
        setPreviewCircle(null);
        return;
      }

      // Position for preview circle (centered on mouse)
      const x = mouseX - circleRadius;
      const y = mouseY - circleRadius;

      setPreviewCircle({ x, y });
    } else {
      setPreviewCircle(null);
    }

    // Handle redaction preview
    if (currentTool === 'redaction' && redactionStart) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      const x = Math.min(redactionStart.x, mouseX);
      const y = Math.min(redactionStart.y, mouseY);
      const width = Math.abs(mouseX - redactionStart.x);
      const height = Math.abs(mouseY - redactionStart.y);

      setPreviewRedaction({ x, y, width, height });
    }
  }, [isDrawing, currentTool, circleRadius, redactionStart]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return;
    if (currentTool !== 'redaction' || !isDrawingRedaction) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // Calculate the actual image display area (accounting for object-contain)
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    const imageAspectRatio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let displayedWidth, displayedHeight, offsetX, offsetY;
    
    if (imageAspectRatio > containerAspectRatio) {
      displayedWidth = containerWidth;
      displayedHeight = containerWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayedHeight) / 2;
    } else {
      displayedHeight = containerHeight;
      displayedWidth = containerHeight * imageAspectRatio;
      offsetX = (containerWidth - displayedWidth) / 2;
      offsetY = 0;
    }

    // Check if mouse is within the actual image area
    if (mouseX < offsetX || mouseX > offsetX + displayedWidth || 
        mouseY < offsetY || mouseY > offsetY + displayedHeight) {
      return;
    }

    setRedactionStart({ x: mouseX, y: mouseY });
    e.preventDefault();
  }, [isDrawingRedaction, currentTool]);



  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!redactionStart || !previewRedaction) {
      setRedactionStart(null);
      setPreviewRedaction(null);
      return;
    }

    // Only create redaction if it has meaningful size
    if (previewRedaction.width > 10 && previewRedaction.height > 10) {
      const newRedaction: Redaction = {
        id: crypto.randomUUID(),
        x: previewRedaction.x,
        y: previewRedaction.y,
        width: previewRedaction.width,
        height: previewRedaction.height
      };

      setRedactions(prev => [...prev, newRedaction]);
    }

    setRedactionStart(null);
    setPreviewRedaction(null);
  }, [redactionStart, previewRedaction]);

  const handleCircleMove = useCallback((id: string, x: number, y: number) => {
    setCircles(prev => prev.map(circle => 
      circle.id === id ? { ...circle, x, y } : circle
    ));
  }, []);

  const handleCircleDelete = useCallback((id: string) => {
    setCircles(prev => prev.filter(circle => circle.id !== id));
  }, []);

  const handleArrowMove = useCallback((id: string, startX: number, startY: number, endX: number, endY: number) => {
    setArrows(prev => prev.map(arrow => 
      arrow.id === id ? { ...arrow, startX, startY, endX, endY } : arrow
    ));
  }, []);

  const handleArrowDelete = useCallback((id: string) => {
    setArrows(prev => prev.filter(arrow => arrow.id !== id));
  }, []);

  const handleRedactionMove = useCallback((id: string, x: number, y: number) => {
    setRedactions(prev => prev.map(redaction => 
      redaction.id === id ? { ...redaction, x, y } : redaction
    ));
  }, []);

  const handleRedactionResize = useCallback((id: string, width: number, height: number) => {
    setRedactions(prev => prev.map(redaction => 
      redaction.id === id ? { ...redaction, width, height } : redaction
    ));
  }, []);

  const handleRedactionDelete = useCallback((id: string) => {
    setRedactions(prev => prev.filter(redaction => redaction.id !== id));
  }, []);

  const clearAllAnnotations = () => {
    setCircles([]);
    setArrows([]);
    setRedactions([]);
    setArrowStart(null);
    setRedactionStart(null);
    setPreviewRedaction(null);
  };

  const startDrawing = (tool: AnnotationTool) => {
    setCurrentTool(tool);
    if (tool === 'circle') {
      setIsDrawing(true);
      setIsDrawingArrow(false);
      setIsDrawingRedaction(false);
      setArrowStart(null);
      setRedactionStart(null);
      setPreviewRedaction(null);
    } else if (tool === 'arrow') {
      setIsDrawingArrow(true);
      setIsDrawing(false);
      setIsDrawingRedaction(false);
      setArrowStart(null);
      setRedactionStart(null);
      setPreviewRedaction(null);
    } else if (tool === 'redaction') {
      setIsDrawingRedaction(true);
      setIsDrawing(false);
      setIsDrawingArrow(false);
      setArrowStart(null);
      setRedactionStart(null);
      setPreviewRedaction(null);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setIsDrawingArrow(false);
    setIsDrawingRedaction(false);
    setArrowStart(null);
    setRedactionStart(null);
    setPreviewCircle(null);
    setPreviewRedaction(null);
  };

  const renderImageWithAnnotations = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      const container = containerRef.current;
      
      if (!canvas || !img || !container) {
        resolve(imageUrl);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      // Wait for image to be fully loaded
      const drawWhenReady = () => {
        // Set canvas dimensions to match image natural size
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the original image
        ctx.drawImage(img, 0, 0);

        // Calculate the actual display area of the image (accounting for object-contain)
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // Calculate how the image is actually displayed with object-contain
        const imageAspectRatio = img.naturalWidth / img.naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        
        let displayedWidth, displayedHeight, offsetX, offsetY;
        
        if (imageAspectRatio > containerAspectRatio) {
          // Image is wider - constrained by width
          displayedWidth = containerWidth;
          displayedHeight = containerWidth / imageAspectRatio;
          offsetX = 0;
          offsetY = (containerHeight - displayedHeight) / 2;
        } else {
          // Image is taller - constrained by height
          displayedHeight = containerHeight;
          displayedWidth = containerHeight * imageAspectRatio;
          offsetX = (containerWidth - displayedWidth) / 2;
          offsetY = 0;
        }

        // Calculate scale factors based on actual displayed vs natural dimensions
        const scaleX = img.naturalWidth / displayedWidth;
        const scaleY = img.naturalHeight / displayedHeight;

        // Draw circles with proper scaling
        circles.forEach(circle => {
          // Adjust circle position to account for letterboxing offset
          const adjustedX = circle.x - offsetX;
          const adjustedY = circle.y - offsetY;
          
          // Convert to natural image coordinates
          const scaledCenterX = (adjustedX + circle.radius) * scaleX;
          const scaledCenterY = (adjustedY + circle.radius) * scaleY;
          const scaledRadius = circle.radius * Math.min(scaleX, scaleY);

          ctx.strokeStyle = circle.color;
          ctx.fillStyle = `${circle.color}20`;
          ctx.lineWidth = Math.max(2, 3 * Math.min(scaleX, scaleY));
          
          ctx.beginPath();
          ctx.arc(scaledCenterX, scaledCenterY, scaledRadius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });

        // Draw arrows with proper scaling
        arrows.forEach(arrow => {
          // Adjust arrow positions to account for letterboxing offset
          const adjustedStartX = arrow.startX - offsetX;
          const adjustedStartY = arrow.startY - offsetY;
          const adjustedEndX = arrow.endX - offsetX;
          const adjustedEndY = arrow.endY - offsetY;
          
          // Convert to natural image coordinates
          const scaledStartX = adjustedStartX * scaleX;
          const scaledStartY = adjustedStartY * scaleY;
          const scaledEndX = adjustedEndX * scaleX;
          const scaledEndY = adjustedEndY * scaleY;

          // Calculate arrow properties
          const length = Math.sqrt(Math.pow(scaledEndX - scaledStartX, 2) + Math.pow(scaledEndY - scaledStartY, 2));
          const angle = Math.atan2(scaledEndY - scaledStartY, scaledEndX - scaledStartX);
          
          // Draw arrow line
          ctx.strokeStyle = arrow.color;
          ctx.lineWidth = Math.max(3, 4 * Math.min(scaleX, scaleY));
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(scaledStartX, scaledStartY);
          ctx.lineTo(scaledEndX, scaledEndY);
          ctx.stroke();
          
          // Draw arrow head
          const headLength = Math.max(15, 20 * Math.min(scaleX, scaleY));
          const headAngle = Math.PI / 6; // 30 degrees
          
          ctx.fillStyle = arrow.color;
          ctx.beginPath();
          ctx.moveTo(scaledEndX, scaledEndY);
          ctx.lineTo(
            scaledEndX - headLength * Math.cos(angle - headAngle),
            scaledEndY - headLength * Math.sin(angle - headAngle)
          );
          ctx.lineTo(
            scaledEndX - headLength * Math.cos(angle + headAngle),
            scaledEndY - headLength * Math.sin(angle + headAngle)
          );
          ctx.closePath();
          ctx.fill();
        });

        // Draw redactions with proper scaling
        redactions.forEach(redaction => {
          // Adjust redaction position to account for letterboxing offset
          const adjustedX = redaction.x - offsetX;
          const adjustedY = redaction.y - offsetY;
          
          // Convert to natural image coordinates
          const scaledX = adjustedX * scaleX;
          const scaledY = adjustedY * scaleY;
          const scaledWidth = redaction.width * scaleX;
          const scaledHeight = redaction.height * scaleY;

          ctx.fillStyle = '#000000';
          ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
        });

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const editedUrl = URL.createObjectURL(blob);
            resolve(editedUrl);
          } else {
            resolve(imageUrl);
          }
        }, 'image/png', 0.9);
      };

      // If image is already loaded, draw immediately, otherwise wait for load
      if (img.complete && img.naturalHeight !== 0) {
        drawWhenReady();
      } else {
        img.onload = drawWhenReady;
        img.onerror = () => resolve(imageUrl);
      }
    });
  }, [circles, arrows, redactions, imageUrl]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Render image with annotations
      const editedImageUrl = await renderImageWithAnnotations();
      
      // Convert blob URL to file and upload
      const response = await fetch(editedImageUrl);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('photo', blob, 'edited-photo.png');

      // Get auth token
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      // Upload to appropriate endpoint
      const endpoint = contextType === 'step' 
        ? `http://localhost:3001/api/steps/${contextId}/photo`
        : `http://localhost:3001/api/tasks/${contextId}/photo`;

      const uploadResponse = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await uploadResponse.json();
      const newPhotoUrl = `http://localhost:3001${result.photo_url}`;

      // Call the save callback
      await onSave(newPhotoUrl);

      // Clean up blob URL
      URL.revokeObjectURL(editedImageUrl);

      toast({
        title: "Success",
        description: "Photo annotations saved successfully",
      });
    } catch (error) {
      console.error('Error saving photo annotations:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save annotations",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3">
        {/* Tool Selection */}
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
          <div className="flex items-center gap-3 ">
            {/* Tool Buttons */}
            <Button
              onClick={() => startDrawing('circle')}
              variant={currentTool === 'circle' && isDrawing ? "default" : "outline"}
              size="sm"
              className={currentTool === 'circle' && isDrawing ? `hover:opacity-90` : ""}
              style={{ 
                backgroundColor: currentTool === 'circle' && isDrawing ? currentColor : undefined,
                borderColor: currentTool === 'circle' && isDrawing ? currentColor : undefined
              }}
            >
              <Circle className="h-4 w-4 mr-1" />
              {currentTool === 'circle' && isDrawing ? "Drawing Circles" : "Draw Circles"}
            </Button>
            
            <Button
              onClick={() => startDrawing('arrow')}
              variant={currentTool === 'arrow' && isDrawingArrow ? "default" : "outline"}
              size="sm"
              className={currentTool === 'arrow' && isDrawingArrow ? `hover:opacity-90` : ""}
              style={{ 
                backgroundColor: currentTool === 'arrow' && isDrawingArrow ? currentColor : undefined,
                borderColor: currentTool === 'arrow' && isDrawingArrow ? currentColor : undefined
              }}
            >
              <MousePointer className="h-4 w-4 mr-1" />
              {currentTool === 'arrow' && isDrawingArrow ? 
                (arrowStart ? "Click end point" : "Click start point") : 
                "Draw Arrows"
              }
            </Button>

            <Button
              onClick={() => startDrawing('redaction')}
              variant={currentTool === 'redaction' && isDrawingRedaction ? "default" : "outline"}
              size="sm"
              className={currentTool === 'redaction' && isDrawingRedaction ? `bg-black hover:bg-gray-800` : ""}
            >
              <Square className="h-4 w-4 mr-1" />
              {currentTool === 'redaction' && isDrawingRedaction ? "Drag to redact" : "Redact"}
            </Button>

            {(isDrawing || isDrawingArrow || isDrawingRedaction) && (
              <Button
                onClick={stopDrawing}
                variant="outline"
                size="sm"
              >
                Stop Drawing
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={clearAllAnnotations}
              variant="outline"
              size="sm"
              disabled={circles.length === 0 && arrows.length === 0 && redactions.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Color Picker */}
        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border">
          <span className="text-sm font-medium text-gray-600">Color:</span>
          <div className="flex items-center gap-2">
            {colors.map(color => (
              <button
                key={color.value}
                onClick={() => setCurrentColor(color.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  currentColor === color.value ? 'border-gray-800 shadow-md' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
          
          {/* Circle Size */}
          {currentTool === 'circle' && (isDrawing || circles.length > 0) && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
              <span className="text-sm text-gray-600">Size:</span>
              <Slider
                value={[circleRadius]}
                onValueChange={([value]) => setCircleRadius(value)}
                min={10}
                max={100}
                step={5}
                className="w-24"
              />
              <span className="text-sm text-gray-500 w-8">{circleRadius}</span>
            </div>
          )}
        </div>
      </div>

      {/* Image Container */}
      <div className="relative border rounded-lg overflow-hidden bg-gray-50">
                <div 
          ref={containerRef}
          className="relative inline-block w-full"
          onClick={handleImageClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setPreviewCircle(null);
            setPreviewRedaction(null);
          }}
          style={{ cursor: (isDrawing || isDrawingArrow || isDrawingRedaction) ? 'crosshair' : 'default' }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Photo to edit"
            className="w-full h-auto max-h-[50vh] object-contain"
            draggable={false}
            crossOrigin="anonymous"
          />
          
          {/* Circle annotations */}
          {circles.map(circle => (
            <CircleAnnotation
              key={circle.id}
              id={circle.id}
              x={circle.x}
              y={circle.y}
              radius={circle.radius}
              color={circle.color}
              onMove={handleCircleMove}
              onDelete={handleCircleDelete}
              isEditing={!isDrawing && !isDrawingArrow && !isDrawingRedaction}
            />
          ))}

          {/* Arrow annotations */}
          {arrows.map(arrow => (
            <ArrowAnnotation
              key={arrow.id}
              id={arrow.id}
              startX={arrow.startX}
              startY={arrow.startY}
              endX={arrow.endX}
              endY={arrow.endY}
              color={arrow.color}
              onMove={handleArrowMove}
              onDelete={handleArrowDelete}
              isEditing={!isDrawing && !isDrawingArrow && !isDrawingRedaction}
            />
          ))}

          {/* Redaction annotations */}
          {redactions.map(redaction => (
            <RedactionAnnotation
              key={redaction.id}
              id={redaction.id}
              x={redaction.x}
              y={redaction.y}
              width={redaction.width}
              height={redaction.height}
              onMove={handleRedactionMove}
              onResize={handleRedactionResize}
              onDelete={handleRedactionDelete}
              isEditing={!isDrawing && !isDrawingArrow && !isDrawingRedaction}
            />
          ))}

          {/* Circle preview while hovering */}
          {previewCircle && currentTool === 'circle' && isDrawing && (
            <div
              className="absolute pointer-events-none border-2 border-dashed rounded-full opacity-40 animate-pulse"
              style={{
                left: previewCircle.x,
                top: previewCircle.y,
                width: circleRadius * 2,
                height: circleRadius * 2,
                borderColor: currentColor,
                backgroundColor: `${currentColor}15`,
                boxShadow: `0 0 20px ${currentColor}40`,
              }}
            />
          )}

          {/* Redaction preview while dragging */}
          {previewRedaction && currentTool === 'redaction' && isDrawingRedaction && (
            <div
              className="absolute pointer-events-none bg-black opacity-50 border-2 border-dashed border-white"
              style={{
                left: previewRedaction.x,
                top: previewRedaction.y,
                width: previewRedaction.width,
                height: previewRedaction.height,
              }}
            />
          )}

          {/* Arrow preview while drawing */}
          {isDrawingArrow && arrowStart && (
            <div
              className="absolute pointer-events-none border-2 border-dashed opacity-50"
              style={{
                left: arrowStart.x,
                top: arrowStart.y,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: currentColor,
                borderColor: currentColor,
                transform: 'translate(-50%, -50%)'
              }}
            />
          )}
        </div>
      </div>

      {/* Hidden canvas for rendering */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />



      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || (circles.length === 0 && arrows.length === 0 && redactions.length === 0)}
          className="bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-gray-700 border border-gray-200/60 shadow-sm relative overflow-hidden group transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          <Save className="h-4 w-4 mr-2 relative z-10" />
          <span className="relative z-10">
            {isSaving ? (
              "Saving..."
            ) : (
              <span className="bg-gradient-to-r from-gray-700 via-green-600 to-gray-700 bg-[length:200%_100%] animate-[gradient_3s_ease-in-out_infinite] bg-clip-text text-transparent">
                Save Changes
              </span>
            )}
          </span>
        </Button>
      </div>
    </div>
  );
} 