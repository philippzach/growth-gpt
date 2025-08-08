import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import WelcomeMessage from '../components/WelcomeMessage';
import AgentTabs from '../components/AgentTabs';
import HeadlineSection from '../components/HeadlineSection';
import AgentResponse from '../components/AgentResponse';
import ActionButtons from '../components/ActionButtons';

export default function Chat() {
  const {
    session,
    loading,
    error,
    sendMessage,
    approveOutput,
    editOutput,
    regenerateOutput,
    isAgentTyping,
    connectionStatus,
    streamingMessages,
  } = useSession();
  const { signOut, supabase } = useAuth();

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [awaitingBusinessIdea, setAwaitingBusinessIdea] = useState(false);
  const [viewingAgent, setViewingAgent] = useState<string | null>(null);

  // Check if session has existing conversation
  useEffect(() => {
    if (session && !loading) {
      const hasUserMessages = session.conversationHistory.some(
        (message) => message.sender === 'user'
      );

      if (hasUserMessages) {
        setShowWelcome(false);
        setAwaitingBusinessIdea(false);
      } else {
        setShowWelcome(true);
        setAwaitingBusinessIdea(false);
      }
    }
  }, [session, loading]);

  // Reset isSending when we get actual streaming content or when agent starts typing
  useEffect(() => {
    if (
      isSending &&
      (isAgentTyping || Object.keys(streamingMessages).length > 0)
    ) {
      setIsSending(false);
    }
  }, [isSending, isAgentTyping, streamingMessages]);

  const handleGetStarted = () => {
    setShowWelcome(false);
    setAwaitingBusinessIdea(true);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
      setIsSending(true);

      if (awaitingBusinessIdea) {
        setAwaitingBusinessIdea(false);
      }

      await sendMessage(messageInput.trim());
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleApprove = async (outputId: string, feedback?: string) => {
    try {
      await approveOutput(outputId, feedback);
    } catch (error) {
      console.error('Failed to approve output:', error);
    }
  };

  const handleEditResponse = async (content: string) => {
    if (!session?.currentAgent) return;

    try {
      await editOutput(session.currentAgent, content);
    } catch (error) {
      console.error('Failed to edit output:', error);
    }
  };

  const handleRegenerate = async () => {
    if (!session?.currentAgent) return;

    try {
      await regenerateOutput(session.currentAgent);
    } catch (error) {
      console.error('Failed to regenerate output:', error);
    }
  };

  const handleStartGenerating = async () => {
    if (!session) return;

    console.log('🚀 handleStartGenerating called');
    console.log('Session state before:', {
      currentAgent: session.currentAgent,
      hasOutput: !!session.agentOutputs[session.currentAgent],
      outputStatus: session.agentOutputs[session.currentAgent]?.status,
    });

    try {
      setIsSending(true);
      console.log('🔄 setIsSending(true) called');

      // Send a trigger message to start the agent processing
      console.log('📤 Calling sendMessage...');
      await sendMessage(
        'Continue with the analysis based on the previous approved outputs.'
      );
      console.log('✅ sendMessage completed');

      // Don't reset isSending here - let it reset when agent starts typing or responds
    } catch (error) {
      console.error('❌ Failed to start generating:', error);
      setIsSending(false);
    }
  };

  const handleNextAgent = async () => {
    if (!session) return;

    try {
      setIsSending(true);

      const token = await supabase.auth
        .getSession()
        .then((s) => s.data.session?.access_token);
      if (!token) {
        throw new Error('No authentication token');
      }

      // Move to next agent
      const response = await fetch(`/api/sessions/${session.id}/next-agent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to proceed to next agent: ${response.statusText}`
        );
      }

      // Wait a moment for the session to update, then automatically trigger the next agent
      setTimeout(() => {
        sendMessage(
          'Continue with the analysis based on the previous approved outputs.'
        );
      }, 1000);
    } catch (error) {
      console.error('Failed to proceed to next agent:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const getCurrentStreamingContent = () => {
    const streamingEntries = Object.entries(streamingMessages);
    if (streamingEntries.length > 0) {
      return streamingEntries[0][1]; // Return first streaming message content
    }
    return undefined;
  };

  const handleAgentNavigation = (agentId: string) => {
    if (!session) return;

    // Only allow navigation to completed agents or current agent
    const agentOutput = session.agentOutputs[agentId];
    const isCurrentAgent = agentId === session.currentAgent;
    const isCompleted = agentOutput?.status === 'approved';

    if (isCurrentAgent || isCompleted) {
      setViewingAgent(agentId);
    }
  };

  // Get the agent we're currently viewing (for display purposes)
  const displayAgent =
    viewingAgent || session?.currentAgent || 'gtm-consultant';

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-xl font-semibold text-red-600 mb-2'>
            Error Loading Session
          </h2>
          <p className='text-gray-600 mb-4'>{error}</p>
          <Link to='/dashboard' className='text-indigo-600 hover:underline'>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!session && !loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-xl font-semibold text-gray-900 mb-2'>
            Session Not Found
          </h2>
          <Link to='/dashboard' className='text-indigo-600 hover:underline'>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Show welcome screen
  if (showWelcome) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col'>
        {/* Header */}
        <header className='bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='flex justify-between items-center py-4'>
              <div className='flex items-center'>
                <Link
                  to='/dashboard'
                  className='mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                >
                  <svg
                    className='h-6 w-6'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M15 19l-7-7 7-7'
                    />
                  </svg>
                </Link>

                <h1 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  GrowthGPT Strategy Session
                </h1>
              </div>

              <button
                onClick={signOut}
                className='text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors'
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className='flex-1 flex items-center justify-center'>
          <WelcomeMessage onGetStarted={handleGetStarted} />
        </div>
      </div>
    );
  }

  // Show business idea input
  if (awaitingBusinessIdea) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col'>
        {/* Header */}
        <header className='bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='flex justify-between items-center py-4'>
              <div className='flex items-center'>
                <Link
                  to='/dashboard'
                  className='mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                >
                  <svg
                    className='h-6 w-6'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M15 19l-7-7 7-7'
                    />
                  </svg>
                </Link>

                <h1 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  GrowthGPT Strategy Session
                </h1>
              </div>

              <button
                onClick={signOut}
                className='text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors'
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className='flex-1 flex items-center justify-center'>
          <div className='max-w-2xl mx-auto text-center p-8'>
            <div className='w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6'>
              <span className='text-2xl'>🎯</span>
            </div>
            <h2 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>
              Tell us about your business idea
            </h2>
            <p className='text-gray-600 dark:text-gray-300 mb-8'>
              Be as specific as possible about your{' '}
              <span className='font-bold'>
                product, target market, and goals.
              </span>
              Our GTM Consultant will analyze your idea and create a
              comprehensive strategy foundation.
            </p>

            <div className='space-y-4'>
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder='Describe your business idea in detail...'
                rows={6}
                className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none'
              />

              <button
                onClick={handleSendMessage}
                disabled={
                  !messageInput.trim() ||
                  isSending ||
                  connectionStatus !== 'connected'
                }
                className='w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isSending ? (
                  <LoadingSpinner size='sm' />
                ) : (
                  <>
                    Start Analysis
                    <svg
                      className='ml-2 h-5 w-5'
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
                  </>
                )}
              </button>
            </div>

            <div className='mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left'>
              <p className='text-sm text-blue-800 dark:text-blue-400'>
                <h4 className='font-medium text-blue-900 dark:text-blue-300 mb-2'>
                  {' '}
                  E-commerce/D2C Example
                </h4>
                "I want to launch a direct-to-consumer brand selling sustainable
                workout gear made from recycled ocean plastic. My target
                customers are environmentally conscious millennials who work out
                at home..."
              </p>
              <p className='text-sm text-blue-800 dark:text-blue-400 mt-2'>
                <h4 className='font-medium text-blue-900 dark:text-blue-300 mb-2'>
                  {' '}
                  B2C Mobile App Example
                </h4>
                "I'm developing a mobile app called 'MoodTrack' that helps
                people with anxiety and depression track their mental health
                patterns and connect with peer support groups..."
              </p>
              <p className='text-sm text-blue-800 dark:text-blue-400 mt-2'>
                <h4 className='font-medium text-blue-900 dark:text-blue-300 mb-2'>
                  {' '}
                  Local Service Business Example
                </h4>
                "I'm planning to start a premium dog walking and pet care
                service in Austin, Texas, targeting busy professionals who want
                app-based booking and real-time updates..."
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface with new layout
  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col'>
      {/* Header */}
      <header className='bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-4'>
            <div className='flex items-center'>
              <Link
                to='/dashboard'
                className='mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              >
                <svg
                  className='h-6 w-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 19l-7-7 7-7'
                  />
                </svg>
              </Link>

              <div>
                <h1 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  Growth Strategy Session
                </h1>
                <div className='flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400'>
                  {session && (
                    <>
                      <span>
                        Step {session.currentStep + 1} of{' '}
                        {session.progress.totalSteps}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span className='flex items-center'>
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        connectionStatus === 'connected'
                          ? 'bg-green-500'
                          : connectionStatus === 'connecting'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className='flex items-center space-x-4'>
              {/* Progress indicator */}
              {session && (
                <div className='hidden sm:block'>
                  <div className='bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-32'>
                    <div
                      className='bg-indigo-600 h-2 rounded-full transition-all duration-300'
                      style={{
                        width: `${(session.progress.completedSteps / session.progress.totalSteps) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

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

      {/* Agent Tabs */}
      {session && (
        <AgentTabs
          session={session}
          currentAgent={session.currentAgent}
          viewingAgent={displayAgent}
          onAgentClick={handleAgentNavigation}
        />
      )}

      {/* Headline Section */}
      {session && <HeadlineSection session={session} />}

      {/* Agent Response */}
      {session && (
        <AgentResponse
          session={session}
          currentAgent={displayAgent}
          streamingContent={
            displayAgent === session.currentAgent
              ? getCurrentStreamingContent()
              : undefined
          }
          isAgentTyping={
            displayAgent === session.currentAgent ? isAgentTyping : false
          }
          onEdit={handleEditResponse}
          onStartGenerating={
            displayAgent === session.currentAgent
              ? handleStartGenerating
              : undefined
          }
          onRegenerate={
            displayAgent === session.currentAgent
              ? handleRegenerate
              : undefined
          }
          isGenerating={isSending}
        />
      )}

      {/* Action Buttons */}
      {session && (
        <ActionButtons
          session={session}
          currentAgent={session.currentAgent}
          viewingAgent={displayAgent}
          agentOutput={session.agentOutputs[displayAgent]}
          onApprove={handleApprove}
          onNextAgent={handleNextAgent}
          onNavigateToNextAgent={handleAgentNavigation}
          onRegenerate={regenerateOutput}
          isProcessing={isAgentTyping}
          canProceed={
            session.agentOutputs[session.currentAgent]?.status === 'approved'
          }
        />
      )}
    </div>
  );
}
