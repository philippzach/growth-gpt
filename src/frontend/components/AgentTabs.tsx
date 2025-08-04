import React from 'react';
import { UserSession } from '../../types';

interface AgentTabsProps {
  session: UserSession;
  currentAgent: string;
  viewingAgent?: string;
  onAgentClick?: (agentId: string) => void;
}

const AGENTS = [
  { id: 'gtm-consultant', name: 'GTM', icon: '🎯', fullName: 'GTM Consultant' },
  {
    id: 'persona-strategist',
    name: 'Persona',
    icon: '🧠',
    fullName: 'Persona Strategist',
  },
  {
    id: 'product-manager',
    name: 'PMF',
    icon: '📱',
    fullName: 'Product Manager',
  },
  {
    id: 'growth-manager',
    name: 'Growth',
    icon: '📈',
    fullName: 'Growth Manager',
  },
  {
    id: 'head-of-acquisition',
    name: 'Acquisition',
    icon: '🎣',
    fullName: 'Head of Acquisition',
  },
  {
    id: 'head-of-retention',
    name: 'Retention',
    icon: '🔄',
    fullName: 'Head of Retention',
  },
  {
    id: 'viral-growth-architect',
    name: 'Viral',
    icon: '🚀',
    fullName: 'Viral Growth Architect',
  },
  { id: 'growth-hacker', name: 'Hack', icon: '🧪', fullName: 'Growth Hacker' },
];

export default function AgentTabs({
  session,
  currentAgent,
  viewingAgent,
  onAgentClick,
}: AgentTabsProps) {
  const getAgentStatus = (agentId: string) => {
    const agentOutput = session.agentOutputs[agentId];

    if (agentOutput?.status === 'approved') {
      return 'completed';
    }

    if (agentOutput?.status === 'pending') {
      return 'current';
    }

    if (agentId === currentAgent) {
      return 'current';
    }

    return 'pending';
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          /* container: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300',
          icon: 'bg-green-500 text-white',
          indicator: 'bg-green-500' */
        };
      case 'current':
        return {
          container:
            'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300',
          icon: 'bg-indigo-500 text-white',
          indicator: 'bg-indigo-500 animate-pulse',
        };
      default:
        return {
          /* container: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400',
          icon: 'bg-gray-400 text-white',
          indicator: 'bg-gray-400' */
        };
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'>
      <div className='w-full'>
        <div className='grid grid-cols-8 gap-0'>
          {AGENTS.map((agent) => {
            const status = getAgentStatus(agent.id);
            const styles = getStatusStyles(status);
            const isClickable =
              onAgentClick &&
              (status !== 'pending' || agent.id === currentAgent);
            const isActive = agent.id === (viewingAgent || currentAgent);
            const isCurrentWorkflowAgent = agent.id === currentAgent;

            return (
              <button
                key={agent.id}
                className={`
                  relative flex flex-col items-center justify-center py-4 px-2 min-h-[80px] border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-all duration-200
                  ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-b-2 border-b-indigo-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                  ${status === 'completed' ? 'bg-green-50 dark:bg-green-900/10' : ''}
                `}
                onClick={isClickable ? () => onAgentClick(agent.id) : undefined}
                title={agent.fullName}
                disabled={!isClickable}
              >
                {/* Status indicator */}
                <div
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${styles.indicator}`}
                />

                {/* Current workflow agent indicator */}
                {isCurrentWorkflowAgent && !isActive && (
                  <div className='absolute top-1 left-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center'>
                    <div className='w-1.5 h-1.5 bg-white rounded-full animate-pulse'></div>
                  </div>
                )}

                {/* Agent icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-lg mb-1 ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : status === 'completed'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-400 text-white'
                  }`}
                >
                  {agent.icon}
                </div>

                {/* Agent name */}
                <span
                  className={`text-xs font-medium text-center leading-tight ${
                    isActive
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : status === 'completed'
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {agent.name}
                </span>

                {/* Completion checkmark */}
                {status === 'completed' && (
                  <div className='absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center'>
                    <svg
                      className='w-2 h-2 text-white'
                      fill='currentColor'
                      viewBox='0 0 20 20'
                    >
                      <path
                        fillRule='evenodd'
                        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
