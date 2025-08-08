import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserSession, AgentOutput } from '../../types';

interface AgentResponseProps {
  session: UserSession;
  currentAgent: string;
  streamingContent?: string;
  isAgentTyping?: boolean;
  onEdit?: (content: string) => void;
  onStartGenerating?: () => void;
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

export default function AgentResponse({ 
  session, 
  currentAgent, 
  streamingContent, 
  isAgentTyping,
  onEdit,
  onStartGenerating,
  onRegenerate,
  isGenerating = false
}: AgentResponseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const getAgentInfo = (agentId: string) => {
    const agentInfo: Record<string, { name: string; icon: string; description: string }> = {
      'gtm-consultant': {
        name: 'GTM Consultant',
        icon: '🎯',
        description: 'Market foundation & value proposition analysis'
      },
      'persona-strategist': {
        name: 'Persona Strategist',
        icon: '🧠',
        description: 'Customer psychology & behavior analysis'
      },
      'product-manager': {
        name: 'Product Manager',
        icon: '📱',
        description: 'Product-market fit & brand positioning'
      },
      'growth-manager': {
        name: 'Growth Manager',
        icon: '📈',
        description: 'Growth funnel & metrics framework'
      },
      'head-of-acquisition': {
        name: 'Head of Acquisition',
        icon: '🎣',
        description: 'Customer acquisition strategy'
      },
      'head-of-retention': {
        name: 'Head of Retention',
        icon: '🔄',
        description: 'Lifecycle & engagement strategy'
      },
      'viral-growth-architect': {
        name: 'Viral Growth Architect',
        icon: '🚀',
        description: 'Growth loops & viral mechanisms'
      },
      'growth-hacker': {
        name: 'Growth Hacker',
        icon: '🧪',
        description: 'Experimentation & testing framework'
      }
    };
    
    return agentInfo[agentId] || { name: agentId, icon: '🤖', description: 'AI Agent' };
  };

  const agentOutput = session.agentOutputs[currentAgent];
  const agentInfo = getAgentInfo(currentAgent);
  const hasError = agentOutput?.status === 'error';

  const handleStartEdit = () => {
    if (agentOutput) {
      setEditContent(agentOutput.content);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== agentOutput?.content) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleCopy = async () => {
    const contentToCopy = agentOutput?.content || streamingContent || '';
    try {
      await navigator.clipboard.writeText(contentToCopy);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getContent = () => {
    // If we have streaming content and it's actively streaming, show that
    if (streamingContent && isAgentTyping) {
      return streamingContent;
    }
    
    // If agent output exists and has content, prefer that (final state)
    if (agentOutput && agentOutput.content && agentOutput.content.trim()) {
      return agentOutput.content;
    }
    
    // If we have streaming content but no agent output yet, show streaming content
    if (streamingContent && streamingContent.trim()) {
      return streamingContent;
    }
    
    return '';
  };

  const content = getContent();

  return (
    <div className="flex-1 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Agent Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-xl">
              {agentInfo.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {agentInfo.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {agentInfo.description}
              </p>
            </div>
          </div>
          
          {/* Quality Score & Status */}
          {agentOutput && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Quality Score: {Math.round(agentOutput.qualityScore * 100)}%
                </div>
                <div className={`text-xs ${
                  agentOutput.status === 'approved' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {agentOutput.status === 'approved' ? '✓ Approved' : '⏳ Pending Review'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Response Content */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[400px]">
          {isEditing ? (
            /* Edit Mode */
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Edit Agent Response
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                  placeholder="Edit the agent response..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Display Mode */
            <div className="relative">
              {/* Copy Button */}
              {content && (
                <button
                  onClick={handleCopy}
                  className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
                  title="Copy response"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}

              {/* Content Area */}
              <div className="p-6">
                {content ? (
                  /* Content Display */
                  <div className="prose prose-lg max-w-none dark:prose-invert">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Customize link styling
                        a: ({ node, ...props }) => (
                          <a {...props} className="text-indigo-600 dark:text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" />
                        ),
                        // Customize code block styling
                        code: ({ node, className, children, ...props }: any) => {
                          const inline = !className || !className.includes('language-');
                          return inline ? (
                            <code {...props} className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <code {...props} className="bg-gray-200 dark:bg-gray-700 block p-4 rounded text-sm font-mono overflow-x-auto">
                              {children}
                            </code>
                          );
                        },
                        // Customize heading styling
                        h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold mb-4 text-gray-900 dark:text-white" />,
                        h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-semibold mb-3 text-gray-900 dark:text-white" />,
                        h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-medium mb-2 text-gray-900 dark:text-white" />,
                        // Customize list styling
                        ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-6 mb-4 space-y-2" />,
                        ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-6 mb-4 space-y-2" />,
                        li: ({ node, ...props }) => <li {...props} className="text-gray-700 dark:text-gray-300" />,
                        // Customize paragraph spacing
                        p: ({ node, ...props }) => <p {...props} className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" />,
                        // Customize blockquote styling
                        blockquote: ({ node, ...props }) => (
                          <blockquote {...props} className="border-l-4 border-indigo-500 pl-4 italic text-gray-600 dark:text-gray-400 mb-4 bg-gray-100 dark:bg-gray-800 py-2" />
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                    
                    {/* Streaming cursor */}
                    {streamingContent && (
                      <div className="typing-cursor inline-block ml-1">|</div>
                    )}
                  </div>
                ) : isAgentTyping || isGenerating ? (
                  /* Typing Indicator */
                  <div className="flex items-center space-x-3">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {agentInfo.name} is analyzing your business idea...
                    </span>
                  </div>
                ) : hasError ? (
                  /* Error State */
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
                      Agent Execution Failed
                    </h3>
                    <p className="text-red-700 dark:text-red-300 mb-2">
                      {agentOutput?.error?.message || 'An unexpected error occurred while processing your request.'}
                    </p>
                    {agentOutput?.error?.retryCount && agentOutput.error.retryCount > 0 && (
                      <p className="text-sm text-red-600 dark:text-red-400 mb-6">
                        Retry attempts: {agentOutput.error.retryCount}
                      </p>
                    )}
                    <div className="space-y-3">
                      {/* Regenerate Button */}
                      {onRegenerate && (
                        <button
                          onClick={onRegenerate}
                          disabled={isGenerating}
                          className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isGenerating ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Try Again
                            </>
                          )}
                        </button>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        This usually resolves after a moment due to temporary API connectivity issues.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Empty State */
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">{agentInfo.icon}</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Ready to analyze
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {agentInfo.name} is ready to help with {agentInfo.description.toLowerCase()}
                    </p>
                    
                    {/* Start Generating Button - only show for non-GTM agents without output */}
                    {currentAgent !== 'gtm-consultant' && onStartGenerating && (
                      <button
                        onClick={onStartGenerating}
                        className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Start Generating
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edit Button - Only available for GTM Consultant */}
        {agentOutput && !isEditing && onEdit && currentAgent === 'gtm-consultant' && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Response
            </button>
          </div>
        )}
      </div>
    </div>
  );
}