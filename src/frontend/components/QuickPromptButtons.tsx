import React, { useState } from 'react';

interface QuickPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
  description?: string;
}

interface AgentInfo {
  name: string;
  title: string;
  icon: string;
  color: string;
  description: string;
}

interface QuickPromptButtonsProps {
  quickPrompts: QuickPrompt[];
  agentInfo: AgentInfo;
  onPromptClick: (prompt: string) => void;
}

export default function QuickPromptButtons({
  quickPrompts,
  agentInfo,
  onPromptClick,
}: QuickPromptButtonsProps) {

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      violet: { 
        bg: 'bg-violet-50 dark:bg-violet-900/10',
        border: 'border-violet-200 dark:border-violet-800',
        text: 'text-violet-700 dark:text-violet-400'
      },
      indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/10',
        border: 'border-indigo-200 dark:border-indigo-800',
        text: 'text-indigo-700 dark:text-indigo-400'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/10',
        border: 'border-purple-200 dark:border-purple-800',
        text: 'text-purple-700 dark:text-purple-400'
      },
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/10',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-400'
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-900/10',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-700 dark:text-green-400'
      },
      orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/10',
        border: 'border-orange-200 dark:border-orange-800',
        text: 'text-orange-700 dark:text-orange-400'
      },
      pink: {
        bg: 'bg-pink-50 dark:bg-pink-900/10',
        border: 'border-pink-200 dark:border-pink-800',
        text: 'text-pink-700 dark:text-pink-400'
      },
      teal: {
        bg: 'bg-teal-50 dark:bg-teal-900/10',
        border: 'border-teal-200 dark:border-teal-800',
        text: 'text-teal-700 dark:text-teal-400'
      },
      red: {
        bg: 'bg-red-50 dark:bg-red-900/10',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-400'
      }
    };
    return colorMap[color] || colorMap.indigo;
  };

  const colors = getColorClasses(agentInfo.color);

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className={`${colors.bg} ${colors.border} border-b p-4`}>
        <div className='flex items-center space-x-2 mb-2'>
          <span className='text-lg'>{agentInfo.icon}</span>
          <h3 className={`font-semibold ${colors.text}`}>
            Quick Prompts
          </h3>
        </div>
        <p className='text-xs text-gray-600 dark:text-gray-400'>
          Click any prompt to add it to your message
        </p>
      </div>

      {/* Prompt cards - Grid layout with 2 per row */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onPromptClick(prompt.prompt)}
              className={`w-full text-left p-3 rounded-lg border ${colors.border} ${colors.bg} hover:shadow-md transition-all group`}
            >
              <div className='space-y-2'>
                <div className='flex items-start justify-between'>
                  <h4 className={`text-xs font-semibold ${colors.text} group-hover:underline`}>
                    {prompt.title}
                  </h4>
                  <span className='text-xs text-gray-500 dark:text-gray-400 ml-1 flex-shrink-0'>
                    {prompt.category}
                  </span>
                </div>
                {prompt.description && (
                  <p className='text-xs text-gray-600 dark:text-gray-400'>
                    {prompt.description}
                  </p>
                )}
                <div className='text-xs text-gray-500 dark:text-gray-500 line-clamp-2 italic'>
                  "{prompt.prompt.length > 100
                    ? prompt.prompt.substring(0, 100) + '...'
                    : prompt.prompt}"
                </div>
              </div>
            </button>
          ))}
        </div>

        {quickPrompts.length === 0 && (
          <div className='p-4 text-center text-gray-500 dark:text-gray-400'>
            <svg
              className='h-8 w-8 mx-auto mb-2 opacity-50'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
              />
            </svg>
            <p className='text-sm'>No quick prompts available</p>
          </div>
        )}
      </div>

      {/* Footer tip */}
      <div className='border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50'>
        <div className='flex items-start space-x-2'>
          <svg
            className='h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <p className='text-xs text-gray-600 dark:text-gray-400'>
            These prompts are tailored to {agentInfo.title}'s expertise and your strategy context
          </p>
        </div>
      </div>
    </div>
  );
}