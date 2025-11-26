
import React from 'react';

const NetworkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5M15.75 3v1.5m0 16.5v-1.5"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v.01M12 21v-.01"
    />
  </svg>
);

export default NetworkIcon;
