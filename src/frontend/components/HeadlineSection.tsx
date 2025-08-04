import React, { useState } from 'react';
import { UserSession } from '../../types';

interface HeadlineSectionProps {
  session: UserSession;
  onEditIdea?: (newIdea: string) => void;
}

export default function HeadlineSection({ session, onEditIdea }: HeadlineSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Extract business idea from session
  const getBusinessIdea = (): string => {
    // Look for the first user message as the business idea
    const firstUserMessage = session.conversationHistory.find(msg => msg.sender === 'user');
    if (firstUserMessage) {
      return firstUserMessage.content;
    }
    
    // Fallback to userInputs if available
    if (session.userInputs.businessIdea) {
      return session.userInputs.businessIdea;
    }
    
    return "Business idea not yet provided";
  };

  const businessIdea = getBusinessIdea();

  const handleStartEdit = () => {
    setEditValue(businessIdea);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onEditIdea && editValue.trim() !== businessIdea) {
      onEditIdea(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(businessIdea);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Business Idea
              </h2>
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Describe your business idea in detail..."
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {businessIdea}
                </p>
              </div>
            )}
          </div>
          
          {!isEditing && (
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={handleCopy}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              
              {onEditIdea && (
                <button
                  onClick={handleStartEdit}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit business idea"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}