import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Edit, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { PhotoEditor } from './PhotoEditor';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

// Add custom styles for the gradient animations
const gradientStyles = `
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

interface PhotoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  caption?: string;
  // Additional props for editing context
  contextType?: 'step' | 'task';
  contextId?: string;
  onPhotoUpdated?: (newPhotoUrl: string) => void;
  // Context data for the overlay
  contextData?: {
    title: string;
    description?: string;
  };
}

export function PhotoLightbox({ 
  isOpen, 
  onClose, 
  photoUrl, 
  caption,
  contextType,
  contextId,
  onPhotoUpdated,
  contextData
}: PhotoLightboxProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  
  // Check if user is admin (can edit photos)
  const canEdit = (profile?.role === 'kelyn_admin' || profile?.role === 'client_admin') && contextType && contextId && onPhotoUpdated;

  const handleSave = async (editedImageUrl: string) => {
    if (onPhotoUpdated) {
      onPhotoUpdated(editedImageUrl);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleClose = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      onClose();
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gradientStyles }} />
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className={`${isEditing ? 'max-w-6xl' : 'max-w-4xl'} max-h-[95vh] p-0 overflow-hidden`}>
        <div className="relative flex flex-col h-full max-h-[95vh]">
          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
            {/* Floating Controls */}
            <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button
                    variant={isEditing ? "outline" : "default"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`${
                      isEditing 
                        ? "bg-white/90 hidden backdrop-blur-sm border-white/20 hover:bg-white/95 text-gray-700" 
                        : "bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 text-gray-700 border border-gray-200/60 shadow-sm relative overflow-hidden group"
                    } transition-all duration-200 font-medium`}
                  >
                    <div className="absolute  inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    {isEditing ? (
                      <>
                        <Eye className="h-4 w-4 mr-2 relative z-10" />
                        <span className="relative z-10 ">View Only</span>
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2 relative z-10" />
                        <span className="relative z-10">
                          <span className="bg-gradient-to-r from-gray-700 via-blue-600 to-gray-700 bg-[length:200%_100%] animate-[gradient_3s_ease-in-out_infinite] bg-clip-text text-transparent">
                            Edit Photo
                          </span>
                        </span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Close Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="bg-white/90 backdrop-blur-sm border-white/20 hover:bg-white shadow-sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isEditing && contextType && contextId ? (
              <div className="p-6 h-full overflow-auto">
                <PhotoEditor
                  imageUrl={photoUrl}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  contextType={contextType}
                  contextId={contextId}
                />
              </div>
            ) : (
              <div className="relative h-full flex flex-col">
                {/* Image Container */}
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                  <img
                    src={photoUrl}
                    alt={caption || "Photo"}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: contextData ? 'calc(100vh - 300px)' : 'calc(100vh - 200px)' }}
                  />
                </div>

                {/* Glassmorphic Overlay */}
                {contextData && (
                  <div className="absolute bottom-0 left-0 right-0">
                    <div className="bg-white/30 backdrop-blur-xl border border-white/20 rounded-t-3xl shadow-lg">
                      {/* Always visible glassmorphic background with handle */}
                      <div className="flex justify-center py-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOverlayMinimized(!overlayMinimized)}
                          className="h-6 w-6 p-0 text-black/70 hover:text-black hover:bg-black/10 rounded-full"
                        >
                          {overlayMinimized ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* Content with smooth opacity transition */}
                      <div 
                        className={`px-6 pb-6 max-h-48 overflow-y-auto transition-all duration-300 ease-in-out ${
                          overlayMinimized 
                            ? 'opacity-0 max-h-0 pt-0' 
                            : 'opacity-100 pt-3'
                        }`}
                      >
                        <div>
                          <h3 className="text-lg font-semibold text-black mb-2">
                            {contextType === 'step' ? 'Step' : 'Task'}: {contextData.title}
                          </h3>
                          {contextData.description && (
                            <p className="text-sm text-black/80 leading-relaxed">
                              {contextData.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating caption for legacy mode */}
                {!contextData && caption && (
                  <div className="absolute top-16 left-4 right-4 z-10">
                    <div className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-lg">
                      <p className="text-sm text-gray-700">{caption}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
