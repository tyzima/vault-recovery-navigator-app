import React, { useState, useRef } from 'react';

interface RedactionAnnotationProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
}

export function RedactionAnnotation({ 
  id, 
  x, 
  y, 
  width, 
  height, 
  onMove, 
  onResize,
  onDelete, 
  isEditing 
}: RedactionAnnotationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, mouseX: 0, mouseY: 0 });
  const redactionRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Check if clicking near the bottom-right corner for resizing (within 10px)
    const isNearResizeCorner = 
      mouseX > rect.right - 10 && 
      mouseY > rect.bottom - 10;
    
    if (isNearResizeCorner) {
      setIsResizing(true);
      setResizeStart({
        width,
        height,
        mouseX,
        mouseY
      });
    } else {
      setIsDragging(true);
      setDragStart({
        x: mouseX,
        y: mouseY,
        offsetX: x,
        offsetY: y
      });
    }
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isEditing) return;
    
    const containerRect = redactionRef.current?.parentElement?.getBoundingClientRect();
    if (!containerRect) return;

    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      const newX = dragStart.offsetX + deltaX;
      const newY = dragStart.offsetY + deltaY;
      
      // Keep redaction within bounds
      const maxX = containerRect.width - width;
      const maxY = containerRect.height - height;
      
      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));
      
      onMove(id, boundedX, boundedY);
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.mouseX;
      const deltaY = e.clientY - resizeStart.mouseY;
      
      const newWidth = Math.max(20, resizeStart.width + deltaX);
      const newHeight = Math.max(20, resizeStart.height + deltaY);
      
      // Keep within container bounds
      const maxWidth = containerRect.width - x;
      const maxHeight = containerRect.height - y;
      
      const boundedWidth = Math.min(newWidth, maxWidth);
      const boundedHeight = Math.min(newHeight, maxHeight);
      
      onResize(id, boundedWidth, boundedHeight);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <div
      ref={redactionRef}
      className={`absolute bg-black ${
        isEditing ? 'cursor-move hover:opacity-90' : 'pointer-events-none'
      } ${isDragging || isResizing ? 'opacity-80 shadow-lg' : ''}`}
      style={{
        left: x,
        top: y,
        width,
        height,
        boxShadow: (isDragging || isResizing) ? '0 4px 12px rgba(0, 0, 0, 0.3)' : undefined
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Resize handle - only show when editing */}
      {isEditing && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-white border border-gray-400 cursor-nw-resize hover:bg-gray-100"
          style={{
            transform: 'translate(50%, 50%)'
          }}
        />
      )}
    </div>
  );
} 