import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, ChevronUp, ChevronDown, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useUploadFile } from '@/hooks/useUploadFile';
import type { UploadedImage } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  onInsertUrl?: (url: string) => void;
  maxImages?: number;
  className?: string;
}

export function ImageUploader({
  images,
  onImagesChange,
  onInsertUrl,
  maxImages = 10,
  className,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: uploadFile } = useUploadFile();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      if (images.length + newImages.length >= maxImages) break;

      try {
        const tags = await uploadFile(file);
        // Parse NIP-94 tags to build our UploadedImage
        const img: UploadedImage = { url: '' };

        for (const tag of tags) {
          const [name, value] = tag;
          switch (name) {
            case 'url':
              img.url = value;
              break;
            case 'ox':
            case 'x':
              img.sha256 = value;
              break;
            case 'm':
              img.mimeType = value;
              break;
            case 'dim':
              img.dimensions = value;
              break;
            case 'size':
              img.size = parseInt(value);
              break;
            case 'blurhash':
              img.blurhash = value;
              break;
          }
        }

        if (img.url) {
          newImages.push(img);
        }
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
    setUploading(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    onImagesChange(images.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    const newImages = [...images];
    [newImages[idx], newImages[newIdx]] = [newImages[newIdx], newImages[idx]];
    onImagesChange(newImages);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.url}
              className="relative aspect-square rounded-lg overflow-hidden border border-border group"
            >
              <img
                src={img.url}
                alt={img.alt || `Upload ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => moveImage(idx, 'up')}>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Move left</TooltipContent>
                    </Tooltip>
                  )}
                  {idx < images.length - 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => moveImage(idx, 'down')}>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Move right</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {/* Insert + Remove */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onInsertUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => onInsertUrl(img.url)}>
                          <LinkIcon className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Insert URL into note</TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(idx)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {idx === 0 && (
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {images.length < maxImages && (
        <div
          className={cn(
            'relative border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer',
            'hover:border-primary/50 hover:bg-primary/5 transition-all duration-200',
            uploading && 'pointer-events-none opacity-50'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading via Blossom...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {images.length === 0 ? (
                  <ImageIcon className="w-5 h-5 text-primary" />
                ) : (
                  <Upload className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {images.length === 0 ? 'Upload images' : 'Add more images'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {maxImages - images.length} remaining. Uploaded via Blossom (NIP-92)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
