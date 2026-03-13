'use client';

import { motion } from 'framer-motion';
import { marketingColors } from '@/lib/theme/marketingColors';

interface GradientBackgroundProps {
  variant?: 'primary' | 'secondary';
  intensity?: 'light' | 'medium' | 'strong';
}

export function GradientBackground({ 
  variant = 'primary',
  intensity = 'medium'
}: GradientBackgroundProps) {
  const gradients = {
    primary: {
      light: marketingColors.gradientBackgroundLight,
      medium: marketingColors.gradientBackgroundPrimary,
      strong: marketingColors.gradientBackgroundPrimary,
    },
    secondary: {
      light: marketingColors.gradientBackgroundLight,
      medium: marketingColors.gradientBackgroundSecondary,
      strong: marketingColors.gradientBackgroundSecondary,
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1 }}
      style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: '120%',
        height: '140%',
        background: gradients[variant][intensity],
        borderRadius: '50%',
        filter: 'blur(100px)',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}

