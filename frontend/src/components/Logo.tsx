import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 20, showText = true }) => {
  return (
    <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Book shape */}
        <path
          d="M6 4C6 2.89543 6.89543 2 8 2H24C25.1046 2 26 2.89543 26 4V28C26 29.1046 25.1046 30 24 30H8C6.89543 30 6 29.1046 6 28V4Z"
          fill="#1a2332"
          stroke="#d4a853"
          strokeWidth="1.5"
        />
        {/* Book spine */}
        <line x1="10" y1="2" x2="10" y2="30" stroke="#d4a853" strokeWidth="1.5" />
        {/* Page lines */}
        <line x1="13" y1="10" x2="22" y2="10" stroke="#d4a853" strokeWidth="1" opacity="0.6" />
        <line x1="13" y1="14" x2="20" y2="14" stroke="#d4a853" strokeWidth="1" opacity="0.6" />
        <line x1="13" y1="18" x2="21" y2="18" stroke="#d4a853" strokeWidth="1" opacity="0.6" />
        {/* Clock circle on spine */}
        <circle cx="8" cy="16" r="3.5" fill="#d4a853" />
        {/* Clock hands */}
        <line
          x1="8"
          y1="16"
          x2="8"
          y2="13.5"
          stroke="#1a2332"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="16"
          x2="10"
          y2="16"
          stroke="#1a2332"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx="8" cy="16" r="0.8" fill="#1a2332" />
      </svg>
      {showText && <span className="logo-text">Logwise</span>}
    </div>
  );
};
