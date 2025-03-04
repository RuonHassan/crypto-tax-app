import React from 'react';

const Logo = ({ className = '', size = 'default' }) => {
  const sizeClasses = {
    small: 'text-xl',
    default: 'text-2xl',
    large: 'text-3xl'
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className={`font-bold ${sizeClasses[size]} text-blue-500`}>
        <span className="font-extrabold">Crypto</span>
        <span className="font-black">Tax</span>
      </div>
      <div className="ml-1">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-blue-500"
        >
          <path
            d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 6V12L16 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default Logo; 