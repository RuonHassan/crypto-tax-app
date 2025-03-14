import React from 'react';

const Step1PersonalDetails = ({ formData, onChange }) => {
  return (
    <div>
      <p className="text-geist-accent-600 dark:text-geist-accent-400 mb-6">
        Let's start with your basic information. This helps us personalize your experience.
      </p>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-1">
            First Name
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={onChange}
            className="w-full px-3 py-2 border border-geist-accent-300 dark:border-geist-accent-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-geist-accent-500 dark:bg-geist-accent-900 dark:text-white"
            placeholder="Your first name"
          />
        </div>
        
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-geist-accent-700 dark:text-geist-accent-300 mb-1">
            Last Name
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={onChange}
            className="w-full px-3 py-2 border border-geist-accent-300 dark:border-geist-accent-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-geist-accent-500 dark:bg-geist-accent-900 dark:text-white"
            placeholder="Your last name"
          />
        </div>
      </div>
      
      <div className="mt-6">
        <p className="text-sm text-geist-accent-500 dark:text-geist-accent-400">
          Your profile information helps us personalize your dashboard and reporting.
        </p>
      </div>
    </div>
  );
};

export default Step1PersonalDetails; 