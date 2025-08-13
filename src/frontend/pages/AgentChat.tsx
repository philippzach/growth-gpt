import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAgentChat } from '../contexts/AgentChatContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AgentChatInterface from '../components/AgentChatInterface';
import QuickPromptButtons from '../components/QuickPromptButtons';

// Agent metadata for display
const AGENT_INFO = {
  'ceo': {
    name: 'Alexandra Sterling',
    title: 'CEO & Strategic Integration Expert',
    icon: '💼',
    color: 'violet',
    description: 'Holistic strategy integration and executive decisions'
  },
  'gtm-consultant': {
    name: 'Angelina',
    title: 'Go-To-Market Consultant', 
    icon: '📊',
    color: 'indigo',
    description: 'Market foundation & value proposition'
  },
  'persona-strategist': {
    name: 'Dr. Maya Chen',
    title: 'Persona Strategist',
    icon: '👥', 
    color: 'purple',
    description: 'Customer psychology & behavior'
  },
  'product-manager': {
    name: 'Alex Rodriguez',
    title: 'Product Manager',
    icon: '🎯',
    color: 'blue',
    description: 'Product-market fit & positioning'
  },
  'growth-manager': {
    name: 'Sarah Kim',
    title: 'Growth Manager',
    icon: '📈',
    color: 'green',
    description: 'Growth funnel & metrics'
  },
  'head-of-acquisition': {
    name: 'Marcus Thompson',
    title: 'Head of Acquisition',
    icon: '🚀',
    color: 'orange',
    description: 'Customer acquisition strategy'
  },
  'head-of-retention': {
    name: 'Jennifer Walsh',
    title: 'Head of Retention', 
    icon: '💎',
    color: 'pink',
    description: 'Retention & lifecycle strategy'
  },
  'viral-growth-architect': {
    name: 'David Park',
    title: 'Viral Growth Architect',
    icon: '🔄',
    color: 'teal',
    description: 'Viral growth & referral strategy'
  },
  'growth-hacker': {
    name: 'Casey Morgan',
    title: 'Growth Hacker',
    icon: '🧪',
    color: 'red',
    description: 'Experimentation framework'
  }
};

export default function AgentChat() {
  const { sessionId, agentId } = useParams<{ sessionId: string; agentId: string }>();
  const { signOut } = useAuth();
  const {
    chatSession,
    loading,
    error,
    sendMessage,
    isAgentTyping,
    connectionStatus,
    streamingMessages,
    quickPrompts,
  } = useAgentChat();

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Smart auto-scroll behavior
  useEffect(() => {
    // Only auto-scroll when new complete messages arrive (not during streaming)
    if (!isAgentTyping && Object.keys(streamingMessages).length === 0) {
      const scrollTimer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100); // Small delay to ensure content is rendered
      
      return () => clearTimeout(scrollTimer);
    }
  }, [chatSession?.messages]);

  // No aggressive scrolling during streaming - let user control their position
  // Only scroll if user is already at the bottom
  useEffect(() => {
    if ((isAgentTyping || Object.keys(streamingMessages).length > 0) && messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
        
        if (isAtBottom) {
          const gentleScrollTimer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }, 1000); // Only scroll every second during streaming, and only if user is at bottom
          
          return () => clearTimeout(gentleScrollTimer);
        }
      }
    }
  }, [streamingMessages]);

  // Reset isSending when agent starts typing or streaming
  useEffect(() => {
    if (isSending && (isAgentTyping || Object.keys(streamingMessages).length > 0)) {
      setIsSending(false);
    }
  }, [isSending, isAgentTyping, streamingMessages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
      setIsSending(true);
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

  const handleQuickPrompt = (prompt: string) => {
    setMessageInput(prompt);
    // Focus on the input after setting the prompt
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    }, 100);
  };

  const agentInfo = AGENT_INFO[agentId as keyof typeof AGENT_INFO];

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400',
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

  if (error || !chatSession) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6'>
            <h2 className='text-lg font-medium text-red-800 dark:text-red-200 mb-2'>
              Error Loading Agent Chat
            </h2>
            <p className='text-red-700 dark:text-red-300'>{error || 'Chat session not found'}</p>
            <Link
              to={`/refine/${sessionId}`}
              className='mt-4 inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-500'
            >
              ← Back to Strategy
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden'>
      {/* Header - Fixed height */}
      <header className='bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-4'>
            <div className='flex items-center'>
              <Link
                to={`/refine/${sessionId}`}
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

              <div className='flex items-center space-x-3'>
                <span className='text-2xl'>{agentInfo?.icon}</span>
                <div>
                  <h1 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Chat with {agentInfo?.title}
                  </h1>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {agentInfo?.description}
                  </p>
                </div>
              </div>
            </div>

            <div className='flex items-center space-x-4'>
              {/* Connection status */}
              <div className='flex items-center text-sm text-gray-500 dark:text-gray-400'>
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
              </div>

              {/* Strategy context indicator */}
              {chatSession.strategyContext && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColorClasses(agentInfo?.color || 'indigo')}`}>
                  Strategy Context Available
                </span>
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

      {/* Main content - 2 column layout with 50/50 split */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Chat column - 50% width - Contains its own scroll */}
        <div className='w-1/2 flex flex-col bg-white dark:bg-gray-800 overflow-hidden'>
          {/* Chat interface - Scrollable */}
          <div className='flex-1 overflow-y-auto'>
            <AgentChatInterface
              chatSession={chatSession}
              agentInfo={agentInfo}
              streamingContent={Object.values(streamingMessages)[0]}
              isAgentTyping={isAgentTyping}
            />
          </div>

          {/* Message input - Fixed at bottom */}
          <div className='border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex-shrink-0'>
            <div className='flex space-x-3'>
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask ${agentInfo?.title} anything about your strategy...`}
                rows={3}
                className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none'
              />
              <button
                onClick={handleSendMessage}
                disabled={
                  !messageInput.trim() ||
                  isSending ||
                  connectionStatus !== 'connected'
                }
                className='px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isSending ? (
                  <LoadingSpinner size='sm' />
                ) : (
                  <svg
                    className='h-5 w-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick prompts sidebar - 50% width - Its own scroll container */}
        <div className='w-1/2 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-hidden'>
          <QuickPromptButtons
            quickPrompts={quickPrompts}
            agentInfo={agentInfo}
            onPromptClick={handleQuickPrompt}
          />
        </div>
      </div>
    </div>
  );
}