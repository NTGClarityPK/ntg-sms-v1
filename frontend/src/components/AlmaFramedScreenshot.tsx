'use client';

import Image from 'next/image';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { AlmaFrame, type AlmaFrameVariant } from '@/components/AlmaFrame';

type Props = {
  src: string;
  alt: string;
  caption?: string;
  variant: AlmaFrameVariant;
  /** When false, omit hover emphasis and cursor-pointer (e.g. pain section). */
  clickable?: boolean;
};

export function AlmaFramedScreenshot({ src, alt, caption, variant, clickable = true }: Props) {
  const inner = (
    <AlmaFrame variant={variant}>
      <div className={clickable ? 'cursor-pointer transition hover:shadow-2xl' : undefined}>
        <Image src={src} alt={alt} width={1200} height={675} className="h-auto w-full" sizes="(max-width: 768px) 100vw, 50vw" />
      </div>
    </AlmaFrame>
  );

  return (
    <div>
      {clickable ? (
        <ImageLightbox src={src} alt={alt}>
          {inner}
        </ImageLightbox>
      ) : (
        inner
      )}
      {caption ? <p className="mt-6 text-center text-lg font-semibold text-gray-600">{caption}</p> : null}
    </div>
  );
}
