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
  ceo: {
    name: 'Alexandra Sterling',
    title: 'CEO & Strategic Integration Expert',
    icon: '💼',
    color: 'violet',
    description: 'Holistic strategy integration and executive decisions',
  },
  'gtm-consultant': {
    name: 'Angelina',
    title: 'Go-To-Market Consultant',
    icon: '📊',
    color: 'indigo',
    description: 'Market foundation & value proposition',
  },
  'persona-strategist': {
    name: 'Dr. Maya Chen',
    title: 'Persona Strategist',
    icon: '👥',
    color: 'purple',
    description: 'Customer psychology & behavior',
  },
  'product-manager': {
    name: 'Alex Rodriguez',
    title: 'Product Manager',
    icon: '🎯',
    color: 'blue',
    description: 'Product-market fit & positioning',
  },
  'growth-manager': {
    name: 'Sarah Kim',
    title: 'Growth Manager',
    icon: '📈',
    color: 'green',
    description: 'Growth funnel & metrics',
  },
  'head-of-acquisition': {
    name: 'Marcus Thompson',
    title: 'Head of Acquisition',
    icon: '🚀',
    color: 'orange',
    description: 'Customer acquisition strategy',
  },
  'head-of-retention': {
    name: 'Jennifer Walsh',
    title: 'Head of Retention',
    icon: '💎',
    color: 'pink',
    description: 'Retention & lifecycle strategy',
  },
  'viral-growth-architect': {
    name: 'David Park',
    title: 'Viral Growth Architect',
    icon: '🔄',
    color: 'teal',
    description: 'Viral growth & referral strategy',
  },
  'growth-hacker': {
    name: 'Casey Morgan',
    title: 'Growth Hacker',
    icon: '🧪',
    color: 'red',
    description: 'Experimentation framework',
  },
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

      const token = (await supabase.auth.getSession()).data.session
        ?.access_token;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentExpansion = (agentId: string) => {
    setExpandedAgents((prev) => {
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
      violet:
        'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400',
      indigo:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
      purple:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      green:
        'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      orange:
        'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
      teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
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
            <p className='text-red-700 dark:text-red-300'>
              {error || 'Session not found'}
            </p>
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
                  {session.userInputs?.projectName
                    ? `Refine ${session.userInputs.projectName} Strategy`
                    : 'Refine Your Growth Strategy'}
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
        {/* Coming Soon Features */}
        <div className='mb-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Analytics MCP Server */}
            <div className='relative p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg cursor-not-allowed opacity-75'>
              <div className='absolute top-4 right-4'>
                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'>
                  Coming Soon
                </span>
              </div>
              <div className='flex items-center space-x-3 mb-4'>
                <div className='flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-lg'>
                  <span className='text-2xl'>➕</span>
                </div>
                <div className='flex-1'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Google Analytics MCP Server
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    Live Performance Monitoring
                  </p>
                </div>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Connect your analytics data for real-time performance insights
                and automated optimization recommendations.
              </p>
            </div>

            {/* Campaign Generator */}
            <div className='relative p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg cursor-not-allowed opacity-75'>
              <div className='absolute top-4 right-4'>
                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400'>
                  Coming Soon
                </span>
              </div>
              <div className='flex items-center space-x-3 mb-4'>
                <div className='flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-lg'>
                  <span className='text-2xl'>🎨</span>
                </div>
                <div className='flex-1'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Campaign Generator
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    Brand Strategy, Paid Media Ads & Design Assets
                  </p>
                </div>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Add your logos, vibes and aesthetics. Creates comprehensive
                brand strategy with ready-to-use marketing materials.
              </p>
            </div>

            {/* Product Builder */}
            <div className='relative p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-not-allowed opacity-75'>
              <div className='absolute top-4 right-4'>
                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400'>
                  Coming Soon
                </span>
              </div>
              <div className='flex items-center space-x-3 mb-4'>
                <div className='flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-lg'>
                  <span className='text-2xl'>⚡</span>
                </div>
                <div className='flex-1'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Product Builder
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    Create your MVP fast
                  </p>
                </div>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Prompt output so you can directly get to code. From strategy to
                working prototype in minutes.
              </p>
            </div>

            {/* Research Agent */}
            <div className='relative p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg cursor-not-allowed opacity-75'>
              <div className='absolute top-4 right-4'>
                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'>
                  Coming Soon
                </span>
              </div>
              <div className='flex items-center space-x-3 mb-4'>
                <div className='flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-lg'>
                  <span className='text-2xl'>🔍</span>
                </div>
                <div className='flex-1'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Research Agent
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    Market Trends, Competitor Research, SEO Keywords
                  </p>
                </div>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Powered by Perplexity AI for real-time market intelligence,
                competitive analysis, and keyword research.
              </p>
            </div>
          </div>
        </div>

        {/* Chat with Agents */}
        <div className='mb-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-medium text-gray-900 dark:text-white'>
              Chat with Your Strategy Team
            </h2>
            <div className='flex items-center space-x-4 text-sm'>
              <span className='text-gray-500 dark:text-gray-400'>
                Created: {new Date(session.createdAt).toLocaleDateString()}
              </span>
              <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'>
                Complete
              </span>
            </div>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
            Get specific guidance and actionable deliverables from each
            specialist agent. They have access to your complete strategy
            context.
          </p>

          {/* CEO Chat - Prominent placement */}
          <div className='mb-6 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-200 dark:border-violet-800 rounded-lg'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <span className='text-3xl'>💼</span>
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Chat with {AGENT_INFO['ceo'].title}
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    Holistic strategy questions, prioritization, and executive
                    guidance
                  </p>
                </div>
              </div>
              <Link
                to={`/refine/${session.id}/chat/ceo`}
                className='px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors font-medium'
              >
                Chat with CEO
              </Link>
            </div>
          </div>

          {/* Agent Specialist Cards */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {Object.entries(session.agentOutputs)
              .filter(
                ([agentId, output]) =>
                  output.status === 'approved' && agentId !== 'ceo'
              )
              .map(([agentId, output]) => {
                const agentInfo =
                  AGENT_INFO[agentId as keyof typeof AGENT_INFO];

                return (
                  <Link
                    key={agentId}
                    to={`/refine/${session.id}/chat/${agentId}`}
                    className='block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer'
                  >
                    <div className='flex items-center space-x-3 mb-3'>
                      <span className='text-2xl'>{agentInfo?.icon}</span>
                      <div className='flex-1 min-w-0'>
                        <h4 className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                          {agentInfo?.title}
                        </h4>
                        <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                          {agentInfo?.description}
                        </p>
                      </div>
                    </div>

                    <div className='flex items-center justify-between'>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColorClasses(agentInfo?.color || 'indigo')}`}
                      >
                        Quality: {Math.round(output.qualityScore * 100)}%
                      </span>
                      <span className='text-sm text-indigo-600 dark:text-indigo-400'>
                        Chat →
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>

        {/* Strategy Reference - Vertical Layout with Expansion */}
        <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
          <h2 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
            Strategy Reference
          </h2>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
            Review your completed strategy outputs. Click to expand and view
            full content, or chat with agents for implementation guidance.
          </p>

          <div className='space-y-4'>
            {Object.entries(session.agentOutputs)
              .filter(([_, output]) => output.status === 'approved')
              .map(([agentId, output], index) => {
                const agentInfo =
                  AGENT_INFO[agentId as keyof typeof AGENT_INFO];
                const isExpanded = expandedAgents.has(agentId);

                return (
                  <div
                    key={agentId}
                    className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'
                  >
                    <button
                      onClick={() => toggleAgentExpansion(agentId)}
                      className='w-full p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left'
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-3'>
                          <span className='text-xl'>{agentInfo?.icon}</span>
                          <div className='flex-1'>
                            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
                              {index + 1}. {agentInfo?.title}
                            </h4>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                              {agentInfo?.description}
                            </p>
                          </div>
                        </div>
                        <svg
                          className={`h-5 w-5 transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M19 9l-7 7-7-7'
                          />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className='p-4 border-t border-gray-200 dark:border-gray-600'>
                        <div className='prose prose-sm dark:prose-invert max-w-none'>
                          <ReactMarkdown>{output.content}</ReactMarkdown>
                        </div>
                        <div className='mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                          <span>
                            Generated:{' '}
                            {new Date(output.generatedAt).toLocaleString()}
                          </span>
                          {output.approvedAt && (
                            <span>
                              Approved:{' '}
                              {new Date(output.approvedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
            <div className='flex items-start space-x-3'>
              <svg
                className='h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0'
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
              <div>
                <h4 className='text-sm font-medium text-blue-900 dark:text-blue-300 mb-1'>
                  💡 Pro Tip
                </h4>
                <p className='text-sm text-blue-800 dark:text-blue-400'>
                  Chat with individual agents for specific implementation
                  guidance, or talk to the CEO for strategic priorities and
                  cross-functional decisions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
