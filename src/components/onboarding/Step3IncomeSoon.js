import React from 'react';

const Step3IncomeSoon = () => {
  return (
    <div>
      <p className="text-geist-accent-600 dark:text-geist-accent-400 mb-6">
        You're almost done! Your crypto tax insights are just moments away.
      </p>
      
      <div className="p-6 bg-geist-accent-100 dark:bg-geist-accent-800 rounded-lg border border-geist-accent-200 dark:border-geist-accent-700 mb-6">
        <div className="flex items-center mb-3">
          <svg className="w-5 h-5 text-geist-accent-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300">
            Coming Soon: Income Information
          </h3>
        </div>
        
        <p className="text-sm text-geist-accent-500 dark:text-geist-accent-400">
          In the future, you'll be able to add additional income sources here to get a more complete tax picture. For now, we'll focus on your crypto activity.
        </p>
      </div>
      
      <div className="p-4 bg-geist-accent-50 dark:bg-geist-accent-900 rounded-lg">
        <h3 className="text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-2">
          What happens next?
        </h3>
        
        <ul className="space-y-2 text-sm text-geist-accent-600 dark:text-geist-accent-400">
          <li className="flex items-start">
            <svg className="w-4 h-4 text-geist-accent-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            We'll analyze your wallet transactions
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-geist-accent-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Calculate your potential tax obligations
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-geist-accent-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Provide insights and suggestions for tax optimization
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Step3IncomeSoon; 