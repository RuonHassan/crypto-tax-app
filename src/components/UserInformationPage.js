import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../services/databaseService';

const UserInformationPage = ({
  formData,
  setFormData,
  handleInputChange,
  goBackToDashboard
}) => {
  const { user, userProfile, fetchUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [localFormData, setLocalFormData] = useState(formData);

  // Initialize local form data from userProfile when it's loaded
  useEffect(() => {
    if (userProfile) {
      setLocalFormData(prev => ({
        ...prev,
        firstName: userProfile.first_name || '',
        lastName: userProfile.last_name || '',
      }));
    }
  }, [userProfile]);

  const handleLocalInputChange = (e) => {
    const { name, value } = e.target;
    setLocalFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      console.log('Attempting to save with data:', {
        user_id: user.id,
        first_name: localFormData.firstName,
        last_name: localFormData.lastName
      });

      const { success, error } = await updateUserProfile(user.id, {
        firstName: localFormData.firstName,
        lastName: localFormData.lastName
      });

      if (!success) {
        throw error || new Error('Failed to update profile');
      }

      // Refresh the profile in the context
      await fetchUserProfile(user.id);

      // Update the parent state
      setFormData(prev => ({
        ...prev,
        firstName: localFormData.firstName,
        lastName: localFormData.lastName
      }));
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleCancel = () => {
    setLocalFormData(formData);
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-geist-accent-900 dark:text-geist-foreground">
          My Account
        </h1>
        <div className="flex space-x-4">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-geist-accent-600 dark:text-geist-accent-300 hover:text-geist-accent-900 dark:hover:text-geist-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-geist-success text-white rounded-xl font-medium hover:bg-opacity-90 transition-all"
              >
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-geist-accent-100 dark:bg-geist-accent-800 text-geist-accent-900 dark:text-geist-foreground rounded-xl font-medium hover:bg-opacity-90 transition-all flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white dark:bg-geist-accent-800 rounded-2xl border border-geist-accent-200 dark:border-geist-accent-700 p-6">
          <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground mb-6">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={isEditing ? localFormData.firstName : formData.firstName}
                onChange={handleLocalInputChange}
                disabled={!isEditing}
                className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={isEditing ? localFormData.lastName : formData.lastName}
                onChange={handleLocalInputChange}
                disabled={!isEditing}
                className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                placeholder="Enter your last name"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="block w-full px-4 py-3 bg-geist-accent-50 dark:bg-geist-accent-900 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl text-geist-accent-500 dark:text-geist-accent-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Non-Crypto Income */}
        <div className="bg-white dark:bg-geist-accent-800 rounded-2xl border border-geist-accent-200 dark:border-geist-accent-700 p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-geist-accent-900 dark:text-geist-foreground">
              Non-Crypto Income
            </h2>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm rounded-full">
              Coming Soon
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
            <div>
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Salary Income
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-geist-accent-500">$</span>
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  disabled
                  className="block w-full pl-8 pr-4 py-3 bg-geist-accent-50 dark:bg-geist-accent-900 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Stock Trading Income
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-geist-accent-500">$</span>
                <input
                  type="number"
                  name="stockIncome"
                  value={formData.stockIncome}
                  disabled
                  className="block w-full pl-8 pr-4 py-3 bg-geist-accent-50 dark:bg-geist-accent-900 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Real Estate Income
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-geist-accent-500">$</span>
                <input
                  type="number"
                  name="realEstateIncome"
                  value={formData.realEstateIncome}
                  disabled
                  className="block w-full pl-8 pr-4 py-3 bg-geist-accent-50 dark:bg-geist-accent-900 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                Dividend Income
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-geist-accent-500">$</span>
                <input
                  type="number"
                  name="dividends"
                  value={formData.dividends}
                  disabled
                  className="block w-full pl-8 pr-4 py-3 bg-geist-accent-50 dark:bg-geist-accent-900 border border-geist-accent-200 dark:border-geist-accent-700 rounded-xl cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInformationPage; 