'use client';

import { motion } from 'framer-motion';
import { marketingColors } from '@/lib/theme/marketingColors';

interface GeometricAccentProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  color?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
}

export function GeometricAccent({ 
  position = 'top-right', 
  color = 'primary',
  size = 'medium' 
}: GeometricAccentProps) {
  const positions = {
    'top-right': { top: '-5%', right: '-5%' },
    'top-left': { top: '-5%', left: '-5%' },
    'bottom-right': { bottom: '-5%', right: '-5%' },
    'bottom-left': { bottom: '-5%', left: '-5%' },
  };

  const sizes = {
    small: { width: '200px', height: '200px' },
    medium: { width: '300px', height: '300px' },
    large: { width: '400px', height: '400px' },
  };

  const accentColor = color === 'primary' ? marketingColors.primaryLight : marketingColors.secondaryLight;
  const accentColorLight = color === 'primary' ? marketingColors.primaryUltraLight : marketingColors.secondaryUltraLight;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 0.15, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1 }}
      style={{
        position: 'absolute',
        ...positions[position],
        ...sizes[size],
        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColorLight} 100%)`,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

