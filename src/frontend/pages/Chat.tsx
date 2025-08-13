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
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementResult, setEnhancementResult] = useState<{
    projectName: string;
    enhancedPrompt: string;
  } | null>(null);

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
    if (!messageInput?.trim() || isSending) return;

    try {
      setIsSending(true);

      if (awaitingBusinessIdea) {
        setAwaitingBusinessIdea(false);
      }

      await sendMessage(messageInput?.trim() || '');
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

  const handleEnhancePrompt = async () => {
    if (!session || !messageInput?.trim()) return;

    try {
      setIsEnhancing(true);

      const token = await supabase.auth
        .getSession()
        .then((s) => s.data.session?.access_token);
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(
        `/api/sessions/${session.id}/enhance-prompt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessIdea: messageInput?.trim() || '',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to enhance prompt: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract the actual enhancement data from the nested structure
      const enhancementData = (data as any).data || data;

      // Store the enhancement result
      setEnhancementResult({
        projectName: enhancementData.projectName,
        enhancedPrompt: enhancementData.enhancedPrompt,
      });

      // Update the message input with enhanced prompt
      setMessageInput(enhancementData.enhancedPrompt);
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
      // Show error to user if needed
    } finally {
      setIsEnhancing(false);
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
              <div className='relative'>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder='Describe your business idea in detail...'
                  rows={enhancementResult ? 8 : 6}
                  className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none'
                />

                {/* Character Counter */}
                <div className='absolute bottom-3 right-3 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-2 py-1 rounded'>
                  {(messageInput || '').length}/150
                </div>
              </div>

              {/* Enhancement Result Display */}
              {enhancementResult && (
                <div className='mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg'>
                  <div className='flex items-start space-x-3'>
                    <div className='flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center'>
                      <svg
                        className='w-5 h-5 text-green-600 dark:text-green-400'
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
                    <div className=''>
                      <h4 className='text-sm font-medium text-green-800 dark:text-green-300'>
                        ✨ Enhanced Business Description Generated
                      </h4>
                    </div>
                  </div>
                </div>
              )}

              {/* Character Requirement Message */}
              {(messageInput || '').length < 150 && !enhancementResult && (
                <div className='flex items-center space-x-2 text-sm text-amber-600 dark:text-amber-400'>
                  <svg
                    className='h-4 w-4'
                    fill='currentColor'
                    viewBox='0 0 20 20'
                  >
                    <path
                      fillRule='evenodd'
                      d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                      clipRule='evenodd'
                    />
                  </svg>
                  <span>
                    Minimum 150 characters required for comprehensive analysis{' '}
                    {/* (
                    {150 - (messageInput || '').length} remaining) */}
                  </span>
                </div>
              )}

              {/* Enhance Button */}
              <button
                onClick={handleEnhancePrompt}
                disabled={
                  !messageInput?.trim() ||
                  isEnhancing ||
                  (messageInput || '').length < 50
                }
                className='w-full flex items-center justify-center px-6 py-2 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isEnhancing ? (
                  <>
                    <LoadingSpinner size='sm' />
                    <span className='ml-2'>Enhancing with AI...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className='mr-2 h-5 w-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                      />
                    </svg>
                    Enhance with AI
                  </>
                )}
              </button>

              <button
                onClick={handleSendMessage}
                disabled={
                  !messageInput?.trim() ||
                  isSending ||
                  ((messageInput || '').length < 150 && !enhancementResult) ||
                  connectionStatus !== 'connected'
                }
                className='w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isSending ? (
                  <LoadingSpinner size='sm' />
                ) : (
                  <>
                    {enhancementResult
                      ? `Start Analysis for ${enhancementResult.projectName}`
                      : 'Start Analysis'}
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
              <h4 className='font-medium text-blue-900 dark:text-blue-300 mb-3 flex items-center'>
                <svg
                  className='h-5 w-5 mr-2'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                    clipRule='evenodd'
                  />
                </svg>
                Example Business Description
              </h4>
              <p className='text-sm text-blue-800 dark:text-blue-400 mb-4'>
                For best results, include these key elements in your
                description:
              </p>

              <div className='text-sm text-blue-800 dark:text-blue-400'>
                <div className='bg-blue-100 dark:bg-blue-900/30 p-3 rounded border-l-4 border-blue-400'>
                  "I'm launching EcoFit, a D2C sustainable activewear brand
                  using recycled ocean plastic. <br />
                  <b>Target:</b> environmentally conscious millennials (25-40)
                  who prioritize sustainability and home fitness. <br />
                  <b>Problem:</b> existing activewear isn't truly sustainable
                  and lacks transparency. <br />
                  <b>Solution:</b> fully traceable, carbon-neutral workout gear
                  with impact tracking app. <br />
                  <b>Revenue:</b> subscription model + one-time purchases.{' '}
                  <br />
                  <b>Advantage:</b> only brand with complete supply chain
                  transparency and measurable environmental impact. <br />
                  <b>Goals:</b> $1M ARR by year 2, expand to 10 product lines,
                  capture 2% of sustainable activewear market."
                </div>
              </div>
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
                  {session?.userInputs?.projectName ||
                    'Growth Strategy Session'}
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
            displayAgent === session.currentAgent ? handleRegenerate : undefined
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
