import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentChatSession } from '../contexts/AgentChatContext';

interface AgentInfo {
  name: string;
  title: string;
  icon: string;
  color: string;
  description: string;
}

interface AgentChatInterfaceProps {
  chatSession: AgentChatSession | null;
  agentInfo: AgentInfo;
  streamingContent?: string;
  isAgentTyping: boolean;
}

export default function AgentChatInterface({
  chatSession,
  agentInfo,
  streamingContent,
  isAgentTyping,
}: AgentChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // No auto-scroll here - let parent component handle scrolling behavior

  // Show loading state if no chat session or messages array not initialized
  if (!chatSession || !chatSession.messages) {
    return (
      <div className='h-full flex items-center justify-center'>
        <div className='text-center text-gray-500 dark:text-gray-400'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2'></div>
          <p>Loading chat session...</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (message: any, index: number) => {
    const isUser = message.sender === 'user';
    
    return (
      <div
        key={message.id || index}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`max-w-3xl ${isUser ? 'order-2' : 'order-1'}`}>
          <div
            className={`rounded-lg px-4 py-3 ${
              isUser
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
            }`}
          >
            {isUser ? (
              <p className='whitespace-pre-wrap'>{message.content}</p>
            ) : (
              <div className='prose dark:prose-invert max-w-none prose-sm'>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
          <div
            className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {isUser ? 'You' : agentInfo.title} • {formatTime(message.timestamp)}
          </div>
        </div>
        
        {!isUser && (
          <div className='order-0 mr-3 flex-shrink-0'>
            <div className='w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm'>
              {agentInfo.icon}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWelcomeMessage = () => (
    <div className='flex justify-start mb-4'>
      <div className='order-1 max-w-3xl'>
        <div className='rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'>
          <div className='prose dark:prose-invert max-w-none prose-sm'>
            <h4>Hello! I'm the {agentInfo.title}</h4>
            <p>
              I have access to your complete growth strategy and I'm here to help you with detailed questions about{' '}
              <strong>{agentInfo.description.toLowerCase()}</strong>.
            </p>
            {chatSession.strategyContext && (
              <p>
                I can see all 8 agent outputs from your strategy session and I'm ready to provide specific, 
                actionable guidance based on your business context.
              </p>
            )}
            <p>
              <strong>Try one of the quick prompts on the right →</strong> or ask me anything!
            </p>
          </div>
        </div>
        <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
          {agentInfo.title} • System
        </div>
      </div>
      
      <div className='order-0 mr-3 flex-shrink-0'>
        <div className='w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm'>
          {agentInfo.icon}
        </div>
      </div>
    </div>
  );

  const renderStreamingMessage = () => (
    <div className='flex justify-start mb-4'>
      <div className='order-1 max-w-3xl'>
        <div className='rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'>
          <div className='prose dark:prose-invert max-w-none prose-sm'>
            <ReactMarkdown>{streamingContent || ''}</ReactMarkdown>
          </div>
          {isAgentTyping && (
            <div className='flex items-center mt-2'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }}></div>
                <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }}></div>
                <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
                {agentInfo.title} is typing...
              </span>
            </div>
          )}
        </div>
        <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
          {agentInfo.title} • Now
        </div>
      </div>
      
      <div className='order-0 mr-3 flex-shrink-0'>
        <div className='w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm'>
          {agentInfo.icon}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Strategy Context Banner */}
      {chatSession.strategyContext && (
        <div className='bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-3'>
          <div className='flex items-center space-x-2'>
            <svg className='h-4 w-4 text-blue-600 dark:text-blue-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
            </svg>
            <span className='text-sm text-blue-800 dark:text-blue-300'>
              Strategy context available - I have access to all your completed agent outputs
            </span>
          </div>
        </div>
      )}

      {/* Messages area - No scrolling here, parent handles it */}
      <div className='p-4 space-y-4'>
        {/* Welcome message if no chat history */}
        {(chatSession.messages.length === 0) && renderWelcomeMessage()}
        
        {/* Chat messages */}
        {chatSession.messages.map((message, index) => renderMessage(message, index))}
        
        {/* Streaming message */}
        {(streamingContent || isAgentTyping) && renderStreamingMessage()}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}