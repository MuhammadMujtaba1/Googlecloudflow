import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'full' | 'icon';
  className?: string;
}

export function Logo({ variant = 'full', className, ...props }: LogoProps) {
  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center bg-blue-600 rounded-lg text-white font-bold ${className}`} style={{ width: '40px', height: '40px' }}>
        FT
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 font-sans ${className}`}>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">FlowThread</span>
      <span className="h-2 w-2 rounded-full bg-blue-600 mb-1"></span>
    </div>
  );
}
