import React from 'react';

interface ProgressBarProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  size = 'md',
  showLabel = true,
}) => {
  const heights = { sm: 'h-2', md: 'h-3', lg: 'h-4' };
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  let colorClass = 'bg-red-500';
  if (clampedPercentage >= 75) colorClass = 'bg-green-500';
  else if (clampedPercentage >= 50) colorClass = 'bg-yellow-500';
  else if (clampedPercentage >= 25) colorClass = 'bg-orange-500';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">Progress</span>
          <span className="text-xs font-medium text-gray-700">{clampedPercentage}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${heights[size]} overflow-hidden`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
};
