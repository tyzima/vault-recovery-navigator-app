import React, { useState, useRef } from 'react';

interface ArrowAnnotationProps {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  onMove: (id: string, startX: number, startY: number, endX: number, endY: number) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
}

export function ArrowAnnotation({ 
  id, 
  startX, 
  startY, 
  endX, 
  endY, 
  color,
  onMove, 
  onDelete, 
  isEditing 
}: ArrowAnnotationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const arrowRef = useRef<SVGSVGElement>(null);

  // Calculate arrow properties
  const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
  const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
  
  // Position the arrow container at the start point
  const containerStyle = {
    left: startX,
    top: startY,
    width: length,
    height: 4,
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 50%'
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing) return;
    
    setIsDragging(true);
    const rect = arrowRef.current?.parentElement?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        offsetX: startX,
        offsetY: startY
      });
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isEditing) return;
    
    const containerRect = arrowRef.current?.parentElement?.getBoundingClientRect();
    if (!containerRect) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const newStartX = dragStart.offsetX + deltaX;
    const newStartY = dragStart.offsetY + deltaY;
    const newEndX = endX + deltaX;
    const newEndY = endY + deltaY;
    
    // Keep arrow within bounds
    const maxX = containerRect.width;
    const maxY = containerRect.height;
    
    if (newStartX >= 0 && newStartY >= 0 && newEndX >= 0 && newEndY >= 0 &&
        newStartX <= maxX && newStartY <= maxY && newEndX <= maxX && newEndY <= maxY) {
      onMove(id, newStartX, newStartY, newEndX, newEndY);
    }
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
    e.stopPropagation();
    onDelete(id);
  };

  return (
    <svg
      ref={arrowRef}
      className={`absolute ${
        isEditing ? 'cursor-move hover:opacity-80' : 'pointer-events-none'
      } ${isDragging ? 'opacity-80' : ''}`}
      style={{
        left: Math.min(startX, endX) - 10,
        top: Math.min(startY, endY) - 10,
        width: Math.abs(endX - startX) + 20,
        height: Math.abs(endY - startY) + 20,
        overflow: 'visible',
        filter: isDragging ? `drop-shadow(0 2px 8px ${color}60)` : undefined,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <defs>
        <marker
          id={`arrowhead-${id}`}
          markerWidth="10"
          markerHeight="7"
          refX="8"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={color}
          />
        </marker>
      </defs>
      
      <line
        x1={startX - Math.min(startX, endX) + 10}
        y1={startY - Math.min(startY, endY) + 10}
        x2={endX - Math.min(startX, endX) + 10}
        y2={endY - Math.min(startY, endY) + 10}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        markerEnd={`url(#arrowhead-${id})`}
      />
    </svg>
  );
} 