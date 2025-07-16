import React, { useState, useRef } from 'react';

interface CircleAnnotationProps {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
}

export function CircleAnnotation({ 
  id, 
  x, 
  y, 
  radius, 
  color,
  onMove, 
  onDelete, 
  isEditing 
}: CircleAnnotationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const circleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - x,
      y: e.clientY - y
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isEditing) return;
    
    const containerRect = circleRef.current?.parentElement?.getBoundingClientRect();
    if (!containerRect) return;

    const newX = e.clientX - dragStart.x - containerRect.left;
    const newY = e.clientY - dragStart.y - containerRect.top;
    
    // Keep circle within bounds
    const maxX = containerRect.width - radius;
    const maxY = containerRect.height - radius;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    onMove(id, boundedX, boundedY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    onDelete(id);
  };

  return (
    <div
      ref={circleRef}
      className={`absolute border-2 rounded-full ${
        isEditing ? 'cursor-move hover:opacity-80' : 'pointer-events-none'
      } ${isDragging ? 'shadow-lg' : ''}`}
      style={{
        left: x,
        top: y,
        width: radius * 2,
        height: radius * 2,
        borderColor: color,
        backgroundColor: `${color}20`,
        boxShadow: isDragging ? `0 4px 12px ${color}60` : undefined
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={isEditing ? "Drag to move, double-click to delete" : ""}
    />
  );
} 