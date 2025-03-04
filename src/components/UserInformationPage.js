import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserInformationPage = ({
  formData,
  setFormData,
  handleInputChange,
  goBackToDashboard
}) => {
  const { user: authUser } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-geist-accent-800 rounded-2xl shadow-lg border border-geist-accent-200 dark:border-geist-accent-700 p-8">
        <h1 className="text-3xl font-bold mb-6 text-geist-accent-900 dark:text-geist-foreground">
          My Account
        </h1>

        <div className="space-y-6">
          {/* Personal Information */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-geist-accent-900 dark:text-geist-foreground">
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
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
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
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                  placeholder="Enter your last name"
                />
              </div>
            </div>
          </div>

          {/* Income Information */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-geist-accent-900 dark:text-geist-foreground">
              Income Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                  Annual Salary
                </label>
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                  placeholder="Enter your annual salary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                  Stock Income
                </label>
                <input
                  type="number"
                  name="stockIncome"
                  value={formData.stockIncome}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                  placeholder="Enter your stock income"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                  Real Estate Income
                </label>
                <input
                  type="number"
                  name="realEstateIncome"
                  value={formData.realEstateIncome}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                  placeholder="Enter your real estate income"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-geist-accent-600 dark:text-geist-accent-300 mb-2">
                  Dividends
                </label>
                <input
                  type="number"
                  name="dividends"
                  value={formData.dividends}
                  onChange={handleInputChange}
                  className="block w-full px-4 py-3 bg-white dark:bg-geist-accent-800 border border-geist-accent-200 dark:border-geist-accent-600 rounded-xl focus:ring-geist-success focus:border-geist-success transition-colors"
                  placeholder="Enter your dividend income"
                />
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-geist-accent-900 dark:text-geist-foreground">
              Account Information
            </h2>
            <div className="bg-geist-accent-50 dark:bg-geist-accent-700 rounded-xl p-4">
              <p className="text-sm text-geist-accent-600 dark:text-geist-accent-300">
                Email Address
              </p>
              <p className="text-base font-medium text-geist-accent-900 dark:text-geist-foreground">
                {authUser?.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInformationPage; 