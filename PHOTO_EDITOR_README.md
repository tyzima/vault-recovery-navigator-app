# Photo Editor Feature

## Overview

The PhotoLightbox component now includes editing capabilities for Admin users (kelyn_admin and client_admin roles). This allows admins to annotate photos with red circles and save the annotated images back to the system.

## Components

### 1. CircleAnnotation.tsx
Individual draggable circle annotation component.

**Features:**
- Draggable circles
- Hover effects
- Double-click to delete
- Constrained movement within image bounds

### 2. ArrowAnnotation.tsx
Individual draggable arrow annotation component.

**Features:**
- Draggable arrows
- Hover effects
- Double-click to delete
- Constrained movement within image bounds
- Two-point drawing (start and end)

### 3. PhotoEditor.tsx
Main photo editing interface.

**Features:**
- Circle and Arrow drawing tools
- 5-color palette (Red, Blue, Green, Orange, Purple)
- Adjustable circle size (10-100px)
- Two-click arrow drawing
- Drag to move annotations
- Clear all annotations
- Save edited image with annotations burned in
- Real-time tool feedback

### 4. PhotoLightbox.tsx (Updated)
Enhanced lightbox with editing capabilities.

**Features:**
- View-only mode for non-admin users
- Edit mode toggle for admin users
- Context-aware (step vs task)
- Proper photo update callbacks

## Usage

### For Admin Users:
1. Click on any photo to open the lightbox
2. Click "Edit Photo" to enter editing mode
3. **Circle Drawing:**
   - Click "Draw Circles" to activate circle mode
   - Click on the image to add circles
   - Adjust circle size with the slider
4. **Arrow Drawing:**
   - Click "Draw Arrows" to activate arrow mode
   - Click to set the arrow start point
   - Click again to set the arrow end point
5. **Color Selection:**
   - Choose from 5 colors: Red, Blue, Green, Orange, Purple
   - Selected color applies to new annotations
6. **Editing Annotations:**
   - Drag circles and arrows to reposition them
   - Double-click any annotation to delete it
7. Click "Save Changes" to save the annotated image

### For Non-Admin Users:
- Photos open in view-only mode
- No editing controls are shown

## Technical Details

### Circle Drawing
- Uses HTML5 Canvas for rendering final annotated image
- CSS-based circle overlays for editing interface
- Proper scaling between display and canvas coordinates

### File Upload
- Converts canvas to PNG blob
- Uploads via existing photo upload endpoints
- Maintains proper URL structure and database updates

### Role-Based Access
- Only kelyn_admin and client_admin can edit
- Edit button only shows for eligible users
- Non-eligible users see standard lightbox

## Integration

The feature integrates seamlessly with existing:
- Task photo uploads
- Step photo uploads
- Photo display components
- Role-based permissions

## Browser Support

Works in all modern browsers that support:
- HTML5 Canvas
- CSS Grid/Flexbox
- Modern JavaScript (ES2018+) 