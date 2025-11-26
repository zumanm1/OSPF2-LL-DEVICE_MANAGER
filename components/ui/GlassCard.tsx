import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hoverEffect?: boolean;
    onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className,
    hoverEffect = false,
    onClick
}) => {
    return (
        <motion.div
            whileHover={hoverEffect ? { y: -5, boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)" } : {}}
            transition={{ type: "spring", stiffness: 300 }}
            onClick={onClick}
            className={twMerge(
                "glass-card rounded-xl p-6 transition-all duration-300",
                hoverEffect && "cursor-pointer hover:border-primary-400/30 dark:hover:border-primary-500/30",
                className
            )}
        >
            {children}
        </motion.div>
    );
};
