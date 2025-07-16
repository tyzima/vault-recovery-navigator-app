import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette, Check, ArrowLeft } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ClientLogoLibraryProps {
  clientId: string;
  onLogoSelected: (logoUrl: string) => void;
  canEdit: boolean;
}

const AVAILABLE_LOGOS = [
  { id: 'brackets', name: 'Brackets', path: '/data/uploads/saved-client-logos/brackets.png' },
  { id: 'bug', name: 'Bug', path: '/data/uploads/saved-client-logos/bug.png' },
  { id: 'chain', name: 'Chain', path: '/data/uploads/saved-client-logos/chain.png' },
  { id: 'cog', name: 'Cog', path: '/data/uploads/saved-client-logos/cog.png' },
  { id: 'folder', name: 'Folder', path: '/data/uploads/saved-client-logos/folder.png' },
  { id: 'horn', name: 'Horn', path: '/data/uploads/saved-client-logos/horn.png' },
  { id: 'key', name: 'Key', path: '/data/uploads/saved-client-logos/key.png' },
  { id: 'lock2', name: 'Lock', path: '/data/uploads/saved-client-logos/lock2.png' },
  { id: 'shield2', name: 'Shield', path: '/data/uploads/saved-client-logos/shield2.png' },
  { id: 'terminal', name: 'Terminal', path: '/data/uploads/saved-client-logos/terminal.png' },
  { id: 'thumb', name: 'Thumb', path: '/data/uploads/saved-client-logos/thumb.png' },
  { id: 'truck', name: 'Truck', path: '/data/uploads/saved-client-logos/truck.png' },
  { id: 'upload', name: 'Upload', path: '/data/uploads/saved-client-logos/upload.png' },
  { id: 'plug', name: 'Plug', path: '/data/uploads/saved-client-logos/plug.png' },
  { id: 'node', name: 'Node', path: '/data/uploads/saved-client-logos/node.png' },
  { id: 'servers', name: 'Servers', path: '/data/uploads/saved-client-logos/servers.png' },
];
const COLOR_PALETTE = [
  // REDS
  { name: 'Crimson', value: '#DC2626' },
  { name: 'Cherry', value: '#E11D48' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Scarlet', value: '#F87171' },

  // ORANGES
  { name: 'Coral', value: '#FB923C' },
  { name: 'Tangerine', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Burnt Orange', value: '#EA580C' },

  // YELLOWS
  { name: 'Gold', value: '#FACC15' },
  { name: 'Sunflower', value: '#EAB308' },
  { name: 'Lemon', value: '#FDE047' },
  { name: 'Mustard', value: '#D97706' },

  // GREENS
  { name: 'Mint', value: '#4ADE80' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Forest', value: '#16A34A' },

  // BLUES
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Azure', value: '#38BDF8' },
  { name: 'Cobalt', value: '#3B82F6' },
  { name: 'Navy', value: '#1E40AF' },

  // INDIGOS
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Denim', value: '#4F46E5' },
  { name: 'Ultramarine', value: '#4338CA' },
  { name: 'Ink', value: '#312E81' },

  // VIOLETS
  { name: 'Lavender', value: '#C084FC' },
  { name: 'Violet', value: '#A855F7' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Grape', value: '#7E22CE' },
  { name: 'Plum', value: '#6B21A8' },
  { name: 'Orchid', value: '#D946EF' },

  // NEUTRALS
  { name: 'Black', value: '#000000' },
  { name: 'Charcoal', value: '#374151' },
  { name: 'Slate', value: '#64748B' },
  { name: 'Silver', value: '#94A3B8' },
  { name: 'Pearl', value: '#E2E8F0' },
  { name: 'White', value: '#FFFFFF' },
];

// Global image cache for even faster loading across component instances
const imageCache = new Map<string, string>();
let globalPreloadPromise: Promise<void> | null = null;

// Global preload function that runs once per app load
const preloadImagesGlobally = async (): Promise<void> => {
  if (globalPreloadPromise) return globalPreloadPromise;
  
  globalPreloadPromise = (async () => {
    const loadPromises = AVAILABLE_LOGOS.map(async (logo) => {
      if (imageCache.has(logo.id)) return;
      
      try {
        const response = await fetch(logo.path);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        imageCache.set(logo.id, objectUrl);
      } catch (error) {
        console.warn(`Failed to preload ${logo.name}:`, error);
      }
    });
    
    await Promise.allSettled(loadPromises);
  })();
  
  return globalPreloadPromise;
};

// Start preloading immediately when module loads
preloadImagesGlobally();

export function ClientLogoLibrary({ clientId, onLogoSelected, canEdit }: ClientLogoLibraryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(COLOR_PALETTE[0].value);
  const [customColor, setCustomColor] = useState<string>('#000000');
  const [showColorSelection, setShowColorSelection] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preloadingComplete, setPreloadingComplete] = useState(imageCache.size === AVAILABLE_LOGOS.length);
  const { toast } = useToast();

  // Check preloading status when component mounts or when popover opens
  useEffect(() => {
    if (isOpen && !preloadingComplete) {
      globalPreloadPromise?.then(() => {
        setPreloadingComplete(true);
      });
    }
  }, [isOpen, preloadingComplete]);

  // Get image source (from cache if available, fallback to original path)
  const getImageSrc = (logoId: string): string => {
    return imageCache.get(logoId) || AVAILABLE_LOGOS.find(l => l.id === logoId)?.path || '';
  };

  const handleLogoSelect = (logoId: string) => {
    setSelectedLogo(logoId);
    setShowColorSelection(true);
  };

  const handleBackToLogos = () => {
    setShowColorSelection(false);
    setSelectedLogo(null);
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    setSelectedColor(color);
  };

  const generateColoredLogo = async () => {
    if (!selectedLogo) return;

    setProcessing(true);

    try {
      const logo = AVAILABLE_LOGOS.find(l => l.id === selectedLogo);
      if (!logo) throw new Error('Logo not found');

      // Use cached image if available, otherwise use original path
      const imageSrc = getImageSrc(selectedLogo);
      const coloredImageBlob = await createColoredLogoBlob(imageSrc, selectedColor);
      
      // Create a File object from the blob
      const file = new File([coloredImageBlob], `${logo.name.toLowerCase()}-logo.png`, {
        type: 'image/png'
      });

      // Use the existing logo upload logic
      const formData = new FormData();
      formData.append('logo', file);

      // Get auth token from storage
      const session = localStorage.getItem('file_session');
      const headers: HeadersInit = {};
      
      if (session) {
        const sessionData = JSON.parse(session);
        headers['Authorization'] = `Bearer ${sessionData.access_token}`;
      }

      // Upload using the existing logo endpoint
      const response = await fetch(`http://localhost:3001/api/clients/${clientId}/logo`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply logo');
      }

      const result = await response.json();
      const logoUrl = `http://localhost:3001${result.logo_url}`;

      onLogoSelected(logoUrl);
      setIsOpen(false);
      setSelectedLogo(null);
      setShowColorSelection(false);
      
      toast({
        title: "Success",
        description: "Logo applied successfully"
      });
    } catch (error) {
      console.error('Error applying logo:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred while applying the logo",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  // Helper function to create a colored logo blob
  const createColoredLogoBlob = (imagePath: string, color: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Apply color overlay using multiply blend mode
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Reset blend mode and draw the original image again to preserve transparency
        ctx.globalCompositeOperation = 'destination-atop';
        ctx.drawImage(img, 0, 0);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        }, 'image/png');
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      img.src = imagePath;
    });
  };

  if (!canEdit) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <img 
            src={getImageSrc('bug')} 
            alt="Library" 
            className="h-6 w-6 mr-1 object-contain" 
          />
          Create Icon
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          {!showColorSelection ? (
            /* Logo Selection */
            <div>
              {!preloadingComplete && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading icons...
                </div>
              )}
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_LOGOS.map((logo) => {
                  const isLoaded = imageCache.has(logo.id);
                  return (
                    <button
                      key={logo.id}
                      onClick={() => handleLogoSelect(logo.id)}
                      className="relative aspect-square p-3 border rounded-lg hover:bg-muted transition-colors border-border flex items-center justify-center disabled:opacity-50"
                      title={logo.name}
                      disabled={!isLoaded && !preloadingComplete}
                    >
                      {isLoaded || preloadingComplete ? (
                        <img
                          src={getImageSrc(logo.id)}
                          alt={logo.name}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Color Selection View */
            <div className="space-y-4">
              {/* Header with back button and selected logo */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleBackToLogos}>
                  <ArrowLeft className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-2">
                  <img
                    src={getImageSrc(selectedLogo!)}
                    alt="Selected logo"
                    className="w-6 h-6 object-contain"
                  />
                  <span className="text-sm font-medium">
                    {AVAILABLE_LOGOS.find(l => l.id === selectedLogo)?.name}
                  </span>
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleColorSelect(color.value)}
                      className={`relative w-8 h-8 rounded-md border-2 transition-all ${
                        selectedColor === color.value ? 'border-foreground scale-110' : 'border-border'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {selectedColor === color.value && (
                        <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Custom Color Picker */}
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-md border-2 border-border shadow-sm cursor-pointer relative overflow-hidden"
                      style={{ backgroundColor: customColor }}
                      onClick={() => {
                        const colorInput = document.getElementById('custom-color-input') as HTMLInputElement;
                        colorInput?.click();
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />
                    </div>
                    <Input
                      id="custom-color-input"
                      type="color"
                      value={customColor}
                      onChange={(e) => handleCustomColorChange(e.target.value)}
                      className="sr-only"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="custom-color-input" className="text-xs font-medium cursor-pointer">
                      Custom Color
                    </Label>
                    <div className="text-xs text-muted-foreground font-mono">
                      {customColor.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="flex justify-center p-3 bg-muted rounded-lg">
                <div className="relative">
                  <img
                    src={getImageSrc(selectedLogo!)}
                    alt="Preview"
                    className="w-10 h-10 object-contain"
                  />
                  <div 
                    className="absolute inset-0 w-10 h-10 rounded"
                    style={{
                      backgroundColor: selectedColor,
                      mixBlendMode: 'multiply',
                      opacity: 0.8
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={generateColoredLogo} 
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      Applying...
                    </>
                  ) : (
                    'Apply Logo'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
} 