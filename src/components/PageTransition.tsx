import React from 'react';
import { motion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.015, filter: 'blur(4px)' }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1]
      }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
};
