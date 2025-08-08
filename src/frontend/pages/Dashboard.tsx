import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserSession } from '../../types';
import LoadingSpinner from '../components/LoadingSpinner';

// API Response types
interface APIResponse<T> {
  data: T;
  timestamp: string;
}

interface SessionListResponse {
  data: UserSession[];
}

interface SessionCreateResponse {
  data: UserSession;
}

export default function Dashboard() {
  const { user, signOut, supabase } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSessions();
    }
  }, [user?.id]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = (await supabase.auth.getSession()).data.session
        ?.access_token;
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`/api/users/${user?.id}/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.statusText}`);
      }

      const data = (await response.json()) as SessionListResponse;
      setSessions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      setIsCreatingSession(true);
      setError(null);

      const token = (await supabase.auth.getSession()).data.session
        ?.access_token;
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: 'master-workflow-v2',
          userInputs: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = (await response.json()) as SessionCreateResponse;
      const newSession = data.data;

      // Redirect to chat
      window.location.href = `/chat/${newSession.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setIsCreatingSession(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active:
        'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      paused:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      completed:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.active}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getProgressPercentage = (session: UserSession) => {
    return Math.round(
      (session.progress.completedSteps / session.progress.totalSteps) * 100
    );
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      {/* Header */}
      <header className='bg-white dark:bg-gray-800 shadow'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div className='flex items-center'>
              <div className='h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3'>
                <svg
                  className='h-5 w-5 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M13 10V3L4 14h7v7l9-11h-7z'
                  />
                </svg>
              </div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                GrowthGPT
              </h1>
            </div>

            <div className='flex items-center space-x-4'>
              <span className='text-sm text-gray-600 dark:text-gray-300'>
                {user?.email}
              </span>
              <button
                onClick={signOut}
                className='text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors'
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Welcome section */}
        <div className='mb-8'>
          <h2 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
            Welcome back!
          </h2>
          <p className='text-gray-600 dark:text-gray-300'>
            Continue working on your growth strategies or start a new one.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='h-5 w-5 text-red-400'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <p className='text-sm text-red-800 dark:text-red-200'>
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create new session button */}
        <div className='mb-8'>
          <button
            onClick={createNewSession}
            disabled={isCreatingSession}
            className='inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            {isCreatingSession ? (
              <>
                <LoadingSpinner size='sm' className='mr-3' />
                Creating Strategy...
              </>
            ) : (
              <>
                <svg
                  className='mr-3 h-5 w-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 4v16m8-8H4'
                  />
                </svg>
                Start New Growth Strategy
              </>
            )}
          </button>
        </div>

        {/* Projects section - Completed Strategies */}
        {sessions.filter((s) => s.status === 'completed').length > 0 && (
          <div className='mb-8 bg-white dark:bg-gray-800 shadow rounded-lg'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                Projects
              </h3>
            </div>
            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
              {sessions
                .filter((session) => session.status === 'completed')
                .map((session) => (
                  <div
                    key={session.id}
                    className='px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center space-x-3'>
                          <h4 className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                            Growth Strategy Project
                          </h4>
                          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'>
                            Completed
                          </span>
                        </div>
                        <div className='mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400'>
                          <span>
                            Completed:{' '}
                            {new Date(session.lastActive).toLocaleDateString()}
                          </span>
                          <span className='mx-2'>•</span>
                          <span>All 8 agents completed</span>
                        </div>
                      </div>
                      <div className='flex items-center space-x-3'>
                        <Link
                          to={`/refine/${session.id}`}
                          className='inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors'
                        >
                          Refine Strategy
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sessions list - Active/Paused Strategies */}
        <div className='bg-white dark:bg-gray-800 shadow rounded-lg'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Growth Strategies
            </h3>
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <LoadingSpinner size='lg' />
            </div>
          ) : sessions.filter((s) => s.status !== 'completed').length === 0 ? (
            <div className='text-center py-12'>
              <svg
                className='mx-auto h-12 w-12 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                />
              </svg>
              <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
                No strategies yet
              </h3>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                Get started by creating your first growth strategy.
              </p>
              <div className='mt-6'>
                <button
                  onClick={createNewSession}
                  disabled={isCreatingSession}
                  className='inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isCreatingSession ? (
                    <LoadingSpinner size='sm' className='mr-2' />
                  ) : (
                    <svg
                      className='mr-2 h-4 w-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                  )}
                  Create Strategy
                </button>
              </div>
            </div>
          ) : (
            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
              {sessions
                .filter((s) => s.status !== 'completed')
                .map((session) => (
                  <div
                    key={session.id}
                    className='px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center space-x-3'>
                          <h4 className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                            Growth Strategy Session
                          </h4>
                          {getStatusBadge(session.status)}
                        </div>

                        <div className='mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400'>
                          <span>
                            Progress: {getProgressPercentage(session)}% (
                            {session.progress.completedSteps}/
                            {session.progress.totalSteps} agents)
                          </span>
                          <span className='mx-2'>•</span>
                          <span>
                            Last active:{' '}
                            {new Date(session.lastActive).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className='mt-3'>
                          <div className='bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                            <div
                              className='bg-indigo-600 h-2 rounded-full progress-bar'
                              style={{
                                width: `${getProgressPercentage(session)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Current agent */}
                        {session.status === 'active' && (
                          <div className='mt-2 text-sm'>
                            <span className='text-gray-500 dark:text-gray-400'>
                              Current agent:
                            </span>
                            <span className='ml-1 font-medium text-indigo-600 dark:text-indigo-400'>
                              {session.currentAgent
                                .replace(/-/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className='flex items-center space-x-3'>
                        <Link
                          to={`/chat/${session.id}`}
                          className='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors'
                        >
                          {session.status === 'completed'
                            ? 'Review'
                            : 'Continue'}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Help section */}
        <div className='mt-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6'>
          <div className='flex items-start'>
            <div className='flex-shrink-0'>
              <svg
                className='h-6 w-6 text-indigo-600 dark:text-indigo-400'
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
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-indigo-800 dark:text-indigo-300'>
                How it works
              </h3>
              <div className='mt-2 text-sm text-indigo-700 dark:text-indigo-300'>
                <p>
                  Work through 8 specialized AI agents to build your
                  comprehensive growth strategy:
                </p>
                <ul className='mt-2 list-disc list-inside space-y-1'>
                  <li>
                    GTM Consultant - Market foundation & value proposition
                  </li>
                  <li>Persona Strategist - Customer psychology & behavior</li>
                  <li>Product Manager - Product-market fit & positioning</li>
                  <li>Growth Manager - Growth funnel & metrics</li>
                  <li>And 4 more specialized agents...</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
