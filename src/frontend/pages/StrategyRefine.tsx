import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserSession, AgentOutput } from '../../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';

interface SessionResponse {
  data: UserSession;
}

// Agent metadata for display
const AGENT_INFO = {
  'gtm-consultant': {
    name: 'GTM Consultant',
    icon: '📊',
    color: 'indigo',
    description: 'Market foundation & value proposition'
  },
  'persona-strategist': {
    name: 'Persona Strategist',
    icon: '👥',
    color: 'purple',
    description: 'Customer psychology & behavior'
  },
  'product-manager': {
    name: 'Product Manager',
    icon: '🎯',
    color: 'blue',
    description: 'Product-market fit & positioning'
  },
  'growth-manager': {
    name: 'Growth Manager',
    icon: '📈',
    color: 'green',
    description: 'Growth funnel & metrics'
  },
  'head-of-acquisition': {
    name: 'Head of Acquisition',
    icon: '🚀',
    color: 'orange',
    description: 'Customer acquisition strategy'
  },
  'head-of-retention': {
    name: 'Head of Retention',
    icon: '💎',
    color: 'pink',
    description: 'Retention & lifecycle strategy'
  },
  'viral-growth-architect': {
    name: 'Viral Growth Architect',
    icon: '🔄',
    color: 'teal',
    description: 'Viral growth & referral strategy'
  },
  'growth-hacker': {
    name: 'Growth Hacker',
    icon: '🔬',
    color: 'red',
    description: 'Experimentation framework'
  }
};

export default function StrategyRefine() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, supabase } = useAuth();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sessionId && user?.id) {
      loadSession();
    }
  }, [sessionId, user?.id]);

  const loadSession = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`/api/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.statusText}`);
      }

      const data = (await response.json()) as SessionResponse;
      
      // Verify session is completed
      if (data.data.status !== 'completed') {
        throw new Error('This session is not completed yet');
      }

      setSession(data.data);
      // Expand first agent by default
      const firstAgent = Object.keys(data.data.agentOutputs)[0];
      if (firstAgent) {
        setExpandedAgents(new Set([firstAgent]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
      teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return colorMap[color] || colorMap.indigo;
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6'>
            <h2 className='text-lg font-medium text-red-800 dark:text-red-200 mb-2'>
              Error Loading Strategy
            </h2>
            <p className='text-red-700 dark:text-red-300'>{error || 'Session not found'}</p>
            <Link
              to='/dashboard'
              className='mt-4 inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-500'
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      {/* Header */}
      <header className='bg-white dark:bg-gray-800 shadow'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='py-6'>
            <div className='flex items-center justify-between'>
              <div>
                <Link
                  to='/dashboard'
                  className='text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                >
                  ← Back to Dashboard
                </Link>
                <h1 className='mt-2 text-2xl font-bold text-gray-900 dark:text-white'>
                  Refine Your Growth Strategy
                </h1>
              </div>
              <div className='text-sm text-gray-500 dark:text-gray-400'>
                Completed: {new Date(session.lastActive).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Strategy Overview */}
        <div className='mb-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
          <h2 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
            Strategy Overview
          </h2>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>Session ID</p>
              <p className='text-sm font-mono text-gray-900 dark:text-white'>{session.id}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>Created</p>
              <p className='text-sm text-gray-900 dark:text-white'>
                {new Date(session.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>Status</p>
              <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'>
                Complete
              </span>
            </div>
          </div>
        </div>

        {/* Refinement Actions */}
        <div className='mb-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
          <h2 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
            Refinement Options
          </h2>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
            These features are coming soon. They will help you validate and improve your strategy.
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <button
              disabled
              className='px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 opacity-50 cursor-not-allowed'
            >
              <div className='flex items-center space-x-3'>
                <span className='text-2xl'>🔍</span>
                <div className='text-left'>
                  <h3 className='font-medium'>Strategy Reality Check</h3>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Validate assumptions and identify gaps
                  </p>
                </div>
              </div>
            </button>
            <button
              disabled
              className='px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 opacity-50 cursor-not-allowed'
            >
              <div className='flex items-center space-x-3'>
                <span className='text-2xl'>🎯</span>
                <div className='text-left'>
                  <h3 className='font-medium'>Success Predictor Engine</h3>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Forecast strategy success probability
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Agent Outputs */}
        <div className='space-y-4'>
          {Object.entries(session.agentOutputs)
            .filter(([_, output]) => output.status === 'approved')
            .map(([agentId, output], index) => {
              const agentInfo = AGENT_INFO[agentId as keyof typeof AGENT_INFO];
              const isExpanded = expandedAgents.has(agentId);

              return (
                <div
                  key={agentId}
                  className='bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden'
                >
                  <button
                    onClick={() => toggleAgent(agentId)}
                    className='w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
                  >
                    <div className='flex items-center space-x-3'>
                      <span className='text-2xl'>{agentInfo?.icon}</span>
                      <div className='text-left'>
                        <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                          {index + 1}. {agentInfo?.name}
                        </h3>
                        <p className='text-sm text-gray-500 dark:text-gray-400'>
                          {agentInfo?.description}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center space-x-3'>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColorClasses(agentInfo?.color || 'indigo')}`}>
                        Quality: {Math.round(output.qualityScore * 100)}%
                      </span>
                      <svg
                        className={`h-5 w-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className='px-6 py-4 border-t border-gray-200 dark:border-gray-700'>
                      <div className='prose dark:prose-invert max-w-none'>
                        <ReactMarkdown>{output.content}</ReactMarkdown>
                      </div>
                      <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                        <div className='flex items-center justify-between text-sm text-gray-500 dark:text-gray-400'>
                          <span>Generated: {new Date(output.generatedAt).toLocaleString()}</span>
                          {output.metadata && (
                            <span>Tokens used: {output.metadata.tokensUsed}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </main>
    </div>
  );
}