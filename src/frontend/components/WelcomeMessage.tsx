import React from 'react';

interface WelcomeMessageProps {
  onGetStarted: () => void;
}

export default function WelcomeMessage({ onGetStarted }: WelcomeMessageProps) {
  return (
    <div className='max-w-2xl mx-auto text-center py-12'>
      {/* Welcome Header */}
      <div className='mb-8'>
        <div className='w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4'>
          <span className='text-2xl'>🚀</span>
        </div>
        <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
          Welcome to Your GrowthGPT Strategy Session
        </h1>
        <p className='text-lg text-gray-600 dark:text-gray-300'>
          Let's build a comprehensive growth strategy for your business
        </p>
      </div>

      {/* Process Overview */}
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-sm border border-gray-200 dark:border-gray-700'>
        <h2 className='text-xl font-semibold text-gray-900 dark:text-white mb-4'>
          Here's how it works:
        </h2>

        <div className='grid md:grid-cols-3 gap-4 text-left'>
          <div className='flex items-start space-x-3'>
            <div className='flex-shrink-0'>
              <div className='w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center'>
                <span className='text-indigo-600 dark:text-indigo-400 font-semibold text-sm'>
                  1
                </span>
              </div>
            </div>
            <div>
              <h3 className='font-medium text-gray-900 dark:text-white mb-1'>
                Share Your Idea
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-300'>
                Tell us about your business concept and goals
              </p>
            </div>
          </div>

          <div className='flex items-start space-x-3'>
            <div className='flex-shrink-0'>
              <div className='w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center'>
                <span className='text-indigo-600 dark:text-indigo-400 font-semibold text-sm'>
                  2
                </span>
              </div>
            </div>
            <div>
              <h3 className='font-medium text-gray-900 dark:text-white mb-1'>
                AI Analysis
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-300'>
                Our GTM expert creates your strategy foundation
              </p>
            </div>
          </div>

          <div className='flex items-start space-x-3'>
            <div className='flex-shrink-0'>
              <div className='w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center'>
                <span className='text-indigo-600 dark:text-indigo-400 font-semibold text-sm'>
                  3
                </span>
              </div>
            </div>
            <div>
              <h3 className='font-medium text-gray-900 dark:text-white mb-1'>
                Review & Refine
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-300'>
                Approve, edit, or ask for improvements
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Time Estimate */}
      <div className='flex items-center justify-center space-x-2 mb-8 text-gray-600 dark:text-gray-300'>
        <svg
          className='w-5 h-5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
        <span className='text-sm'>
          Estimated time: <strong>30-45 minutes</strong>
        </span>
      </div>

      {/* Get Started Button */}
      <button
        onClick={onGetStarted}
        className='inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors'
      >
        Get Started
        <svg
          className='ml-2 -mr-1 w-5 h-5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 7l5 5m0 0l-5 5m5-5H6'
          />
        </svg>
      </button>

      {/* Additional Info */}
      <div className='mt-8 text-xs text-gray-500 dark:text-gray-400'>
        <p>
          💡 <strong>Tip:</strong> Be as specific as possible about your
          business idea, target market, and goals for the best results.
        </p>
      </div>
    </div>
  );
}
