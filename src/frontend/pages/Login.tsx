import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Login() {
  const { user, loading, signInWithEmail, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if Supabase is configured
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_project_url_here';

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (user) {
    return <Navigate to='/dashboard' replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await signUp(email, password);
        setSuccess('Check your email for a verification link!');
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccess('Password reset email sent! Check your inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signin':
        return 'Sign In to GrowthGPT';
      case 'signup':
        return 'Create Your Account';
      case 'forgot':
        return 'Reset Your Password';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signin':
        return 'Welcome back! Sign in to continue building your growth strategy.';
      case 'signup':
        return 'Join us to start building comprehensive growth strategies with AI agents.';
      case 'forgot':
        return "Enter your email address and we'll send you a link to reset your password.";
    }
  };

  const getButtonText = () => {
    if (isSubmitting) return 'Please wait...';
    switch (mode) {
      case 'signin':
        return 'Sign In';
      case 'signup':
        return 'Create Account';
      case 'forgot':
        return 'Send Reset Link';
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
      <div className='max-w-md w-full mx-4'>
        <div className='bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8'>
          <div className='text-center mb-8'>
            <div className='mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4'>
              <svg
                className='h-8 w-8 text-white'
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
              {getTitle()}
            </h1>
            <p className='text-gray-600 dark:text-gray-300 mt-2'>
              {getSubtitle()}
            </p>
          </div>

          {/* Configuration Warning */}
          {!isSupabaseConfigured && (
            <div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
              <div className='flex'>
                <div className='flex-shrink-0'>
                  <svg
                    className='h-5 w-5 text-yellow-400'
                    viewBox='0 0 20 20'
                    fill='currentColor'
                  >
                    <path
                      fillRule='evenodd'
                      d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='ml-3'>
                  <h3 className='text-sm font-medium text-yellow-800'>
                    Supabase Configuration Required
                  </h3>
                  <div className='mt-2 text-sm text-yellow-700'>
                    <p>
                      Please configure your Supabase credentials in the{' '}
                      <code>.env</code> file to enable authentication.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {success && (
            <div className='mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg'>
              <div className='flex'>
                <div className='flex-shrink-0'>
                  <svg
                    className='h-5 w-5 text-green-400'
                    viewBox='0 0 20 20'
                    fill='currentColor'
                  >
                    <path
                      fillRule='evenodd'
                      d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='ml-3'>
                  <p className='text-sm text-green-800 dark:text-green-200'>
                    {success}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label
                htmlFor='email'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
              >
                Email address
              </label>
              <input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                placeholder='Enter your email'
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label
                  htmlFor='password'
                  className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
                >
                  Password
                </label>
                <input
                  id='password'
                  type='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  placeholder='Enter your password'
                  minLength={6}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor='confirmPassword'
                  className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
                >
                  Confirm Password
                </label>
                <input
                  id='confirmPassword'
                  type='password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  placeholder='Confirm your password'
                  minLength={6}
                />
              </div>
            )}

            <button
              type='submit'
              disabled={isSubmitting}
              className='w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
            >
              {isSubmitting ? (
                <div className='flex items-center justify-center'>
                  <LoadingSpinner size='sm' className='mr-2' />
                  {getButtonText()}
                </div>
              ) : (
                getButtonText()
              )}
            </button>
          </form>

          <div className='mt-6 text-center space-y-2'>
            {mode === 'signin' && (
              <>
                <button
                  onClick={() => setMode('forgot')}
                  className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline'
                >
                  Forgot your password?
                </button>
                <div>
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    Don't have an account?{' '}
                  </span>
                  <button
                    onClick={() => setMode('signup')}
                    className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium'
                  >
                    Sign up
                  </button>
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Already have an account?{' '}
                </span>
                <button
                  onClick={() => setMode('signin')}
                  className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium'
                >
                  Sign in
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <div>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Remember your password?{' '}
                </span>
                <button
                  onClick={() => setMode('signin')}
                  className='text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium'
                >
                  Sign in
                </button>
              </div>
            )}
          </div>

          <div className='mt-8 text-center'>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              By continuing, you agree to our{' '}
              <a
                href='#'
                className='text-indigo-600 dark:text-indigo-400 hover:underline'
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href='#'
                className='text-indigo-600 dark:text-indigo-400 hover:underline'
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <div className='mt-8 text-center'>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            🚀 Start building your growth strategy in minutes
          </p>
          <div className='mt-4 flex items-center justify-center space-x-6 text-xs text-gray-500 dark:text-gray-400'>
            <span>✓ 8 Specialized Agents</span>
            <span>✓ Real-time Collaboration</span>
            <span>✓ Export & Share</span>
          </div>
        </div>
      </div>
    </div>
  );
}
