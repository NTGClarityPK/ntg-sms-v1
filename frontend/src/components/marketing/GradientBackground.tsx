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
      strong: 'linear-gradient(135deg, rgba(255, 107, 107, 0.25) 0%, rgba(101, 173, 232, 0.25) 100%)',
    },
    secondary: {
      light: marketingColors.gradientBackgroundLight,
      medium: marketingColors.gradientBackgroundSecondary,
      strong: 'linear-gradient(135deg, rgba(101, 173, 232, 0.25) 0%, rgba(255, 107, 107, 0.25) 100%)',
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

