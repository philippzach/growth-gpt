import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSession } from '../contexts/SessionContext';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage as ChatMessageType, AgentOutput } from '../../types';
import LoadingSpinner from '../components/LoadingSpinner';
import WelcomeMessage from '../components/WelcomeMessage';

export default function Chat() {
  const { session, loading, error, sendMessage, approveOutput, editOutput, regenerateOutput, isAgentTyping, connectionStatus, streamingMessages } = useSession();
  const { signOut } = useAuth();
  
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingOutput, setEditingOutput] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [regenerateFeedback, setRegenerateFeedback] = useState('');
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [awaitingBusinessIdea, setAwaitingBusinessIdea] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);

  // Check if user is at the bottom of the chat
  const checkIfAtBottom = useCallback(() => {
    if (!chatContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const threshold = 100; // 100px threshold
    return scrollTop + clientHeight >= scrollHeight - threshold;
  }, []);

  // Handle scroll events to track user position
  const handleScroll = useCallback(() => {
    setIsUserAtBottom(checkIfAtBottom());
  }, [checkIfAtBottom]);

  // Only auto-scroll when user is at bottom and new messages arrive (not streaming)
  useEffect(() => {
    if (isUserAtBottom && !Object.keys(streamingMessages).length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.conversationHistory, isUserAtBottom, streamingMessages]);

  // Auto-scroll when streaming starts (if user was at bottom)
  useEffect(() => {
    if (isUserAtBottom && Object.keys(streamingMessages).length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [Object.keys(streamingMessages).length, isUserAtBottom]);

  // Focus input on load and check if session has user messages
  useEffect(() => {
    if (session && !loading) {
      // Check if there are any user messages (not just system messages)
      const hasUserMessages = session.conversationHistory.some(message => message.sender === 'user');
      
      if (hasUserMessages) {
        // Session has existing user conversation, skip welcome
        setShowWelcome(false);
        setAwaitingBusinessIdea(false);
      } else {
        // New session or only system messages, show welcome
        setShowWelcome(true);
        setAwaitingBusinessIdea(false);
      }
    }
  }, [session, loading]);

  // Focus input when appropriate
  useEffect(() => {
    if (!showWelcome && !loading) {
      inputRef.current?.focus();
    }
  }, [showWelcome, loading]);

  const handleGetStarted = () => {
    setShowWelcome(false);
    setAwaitingBusinessIdea(true);
    // Focus on input after transition
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
      setIsSending(true);
      
      // If this is the first message (business idea), transition out of welcome state
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

  const handleEdit = async (outputId: string) => {
    if (!editContent.trim()) return;
    
    try {
      await editOutput(outputId, editContent);
      setEditingOutput(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit output:', error);
    }
  };

  const handleRegenerate = async (outputId: string) => {
    if (!regenerateFeedback.trim()) return;
    
    try {
      await regenerateOutput(outputId, regenerateFeedback);
      setShowRegenerateDialog(null);
      setRegenerateFeedback('');
    } catch (error) {
      console.error('Failed to regenerate output:', error);
    }
  };

  const startEdit = (outputId: string, currentContent: string) => {
    setEditingOutput(outputId);
    setEditContent(currentContent);
  };

  const getAgentName = (agentId: string) => {
    const names: Record<string, string> = {
      'gtm-consultant': 'GTM Consultant',
      'persona-strategist': 'Persona Strategist',
      'product-manager': 'Product Manager',
      'growth-manager': 'Growth Manager',
      'head-of-acquisition': 'Head of Acquisition',
      'head-of-retention': 'Head of Retention',
      'viral-growth-architect': 'Viral Growth Architect',
      'growth-hacker': 'Growth Hacker'
    };
    return names[agentId] || agentId;
  };

  const getAgentAvatar = (agentId: string) => {
    const emojis: Record<string, string> = {
      'gtm-consultant': '🎯',
      'persona-strategist': '🧠',
      'product-manager': '📱',
      'growth-manager': '📈',
      'head-of-acquisition': '🎣',
      'head-of-retention': '🔄',
      'viral-growth-architect': '🚀',
      'growth-hacker': '🧪'
    };
    return emojis[agentId] || '🤖';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Session</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/dashboard" className="text-indigo-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!session && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Not Found</h2>
          <Link to="/dashboard" className="text-indigo-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link 
                to="/dashboard" 
                className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Growth Strategy Session
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  {session && (
                    <>
                      <span>
                        Step {session.currentStep + 1} of {session.progress.totalSteps}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      connectionStatus === 'connected' ? 'bg-green-500' : 
                      connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Progress indicator */}
              {session && (
                <div className="hidden sm:block">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-32">
                    <div
                      className="bg-indigo-600 h-2 rounded-full progress-bar"
                      style={{ width: `${(session.progress.completedSteps / session.progress.totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={signOut}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-hidden relative">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6"
          >
            {(() => {
              if (showWelcome) {
                return <WelcomeMessage onGetStarted={handleGetStarted} />;
              } else if (awaitingBusinessIdea) {
                return (
                  <div className="max-w-2xl mx-auto text-center py-12">
                    <div className="mb-8">
                      <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🎯</span>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Tell us about your business idea
                      </h2>
                      <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Be as specific as possible about your product, target market, and goals. Our GTM Consultant will analyze your idea and create a comprehensive strategy foundation.
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Example:</h3>
                        <p className="text-sm text-blue-800 dark:text-blue-400">
                          "I want to sell solid perfumes made from natural ingredients only. Starting with 3 scents: Plumeria, Jasmine, and Tuberose, made with high-quality floral absolutes from India. We want to market as a premium natural product targeting eco-conscious consumers aged 25-40."
                        </p>
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="space-y-6">
                    {session?.conversationHistory?.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    session={session}
                    onApprove={handleApprove}
                    onEdit={startEdit}
                    onRegenerate={(outputId) => setShowRegenerateDialog(outputId)}
                    editingOutput={editingOutput}
                    editContent={editContent}
                    setEditContent={setEditContent}
                    onSaveEdit={handleEdit}
                    onCancelEdit={() => {
                      setEditingOutput(null);
                      setEditContent('');
                    }}
                    getAgentName={getAgentName}
                    getAgentAvatar={getAgentAvatar}
                  />
                ))}
                
                {/* Streaming message display */}
                {Object.entries(streamingMessages).map(([messageId, content]) => (
                  <div key={messageId} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm">
                        🤖
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                          </ReactMarkdown>
                          <div className="typing-cursor">|</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Agent typing indicator */}
                {isAgentTyping && Object.keys(streamingMessages).length === 0 && (
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm">
                        🤖
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">GTM Consultant is analyzing your business idea...</div>
                      </div>
                    </div>
                  </div>
                )}
                
                    <div ref={messagesEndRef} />
                  </div>
                );
              }
            })()}
          </div>

          {/* Scroll to bottom button */}
          {!isUserAtBottom && (
            <div className="absolute bottom-20 right-6 z-10">
              <button
                onClick={() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  setIsUserAtBottom(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105"
                title="Scroll to bottom"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
          )}

          {/* Message input - only show after welcome */}
          {!showWelcome && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={awaitingBusinessIdea ? "Describe your business idea in detail..." : "Type your message..."}
                    rows={awaitingBusinessIdea ? 3 : 1}
                    className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    style={{ minHeight: awaitingBusinessIdea ? '80px' : '40px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending || connectionStatus !== 'connected'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? (
                    <LoadingSpinner size="sm" />
                  ) : awaitingBusinessIdea ? (
                    <>
                      Start Analysis
                      <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Regenerate dialog */}
      {showRegenerateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Regenerate Output
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              What would you like the agent to improve or change?
            </p>
            <textarea
              value={regenerateFeedback}
              onChange={(e) => setRegenerateFeedback(e.target.value)}
              placeholder="Please make it more specific..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowRegenerateDialog(null);
                  setRegenerateFeedback('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRegenerate(showRegenerateDialog)}
                disabled={!regenerateFeedback.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Chat message component
interface ChatMessageProps {
  message: ChatMessageType;
  session: any;
  onApprove: (outputId: string, feedback?: string) => void;
  onEdit: (outputId: string, content: string) => void;
  onRegenerate: (outputId: string) => void;
  editingOutput: string | null;
  editContent: string;
  setEditContent: (content: string) => void;
  onSaveEdit: (outputId: string) => void;
  onCancelEdit: () => void;
  getAgentName: (agentId: string) => string;
  getAgentAvatar: (agentId: string) => string;
}

function ChatMessage({
  message,
  session,
  onApprove,
  onEdit,
  onRegenerate,
  editingOutput,
  editContent,
  setEditContent,
  onSaveEdit,
  onCancelEdit,
  getAgentName,
  getAgentAvatar
}: ChatMessageProps) {
  const isUser = message.sender === 'user';
  const isOutput = message.type === 'output';
  const agentOutput = message.metadata?.outputId ? session.agentOutputs[message.metadata.outputId] : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} message-enter`}>
      <div className={`flex items-start space-x-3 max-w-3xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
            isUser 
              ? 'bg-gray-500 text-white' 
              : message.sender === 'system'
              ? 'bg-blue-500 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            {isUser ? '👤' : message.sender === 'system' ? '🔔' : getAgentAvatar(message.agentId || '')}
          </div>
        </div>

        {/* Message content */}
        <div className="flex-1">
          {/* Header */}
          <div className={`flex items-center space-x-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {isUser ? 'You' : message.sender === 'system' ? 'System' : getAgentName(message.agentId || '')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Message bubble */}
          <div className={`rounded-lg px-4 py-3 ${
            isUser 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700'
          }`}>
            {editingOutput === message.metadata?.outputId ? (
              // Edit mode
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <div className="flex justify-end space-x-2 mt-3">
                  <button
                    onClick={onCancelEdit}
                    className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onSaveEdit(message.metadata?.outputId!)}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              // Display mode
              <div className="prose prose-sm max-w-none dark:prose-invert" style={{maxHeight: 'none', overflow: 'visible'}}>
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
                        <code {...props} className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">
                          {children}
                        </code>
                      ) : (
                        <code {...props} className="bg-gray-100 dark:bg-gray-700 block p-2 rounded text-sm overflow-x-auto">
                          {children}
                        </code>
                      );
                    },
                    // Customize heading styling
                    h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-bold mb-3 text-gray-900 dark:text-white" />,
                    h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-semibold mb-2 text-gray-900 dark:text-white" />,
                    h3: ({ node, ...props }) => <h3 {...props} className="text-base font-medium mb-2 text-gray-900 dark:text-white" />,
                    // Customize list styling
                    ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 mb-3 space-y-1" />,
                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 mb-3 space-y-1" />,
                    li: ({ node, ...props }) => <li {...props} className="text-gray-700 dark:text-gray-300" />,
                    // Customize paragraph spacing
                    p: ({ node, ...props }) => <p {...props} className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed" />,
                    // Customize blockquote styling
                    blockquote: ({ node, ...props }) => (
                      <blockquote {...props} className="border-l-4 border-indigo-500 pl-4 italic text-gray-600 dark:text-gray-400 mb-3" />
                    ),
                    // Customize table styling
                    table: ({ node, ...props }) => (
                      <table {...props} className="w-full border-collapse border border-gray-300 dark:border-gray-600 mb-3" />
                    ),
                    th: ({ node, ...props }) => (
                      <th {...props} className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-700 font-semibold" />
                    ),
                    td: ({ node, ...props }) => (
                      <td {...props} className="border border-gray-300 dark:border-gray-600 px-3 py-2" />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Output actions */}
          {isOutput && agentOutput && agentOutput.status === 'pending' && editingOutput !== message.metadata?.outputId && (
            <div className="flex items-center space-x-3 mt-3">
              <button
                onClick={() => onApprove(message.metadata?.outputId!)}
                className="inline-flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => onEdit(message.metadata?.outputId!, message.content)}
                className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => onRegenerate(message.metadata?.outputId!)}
                className="inline-flex items-center px-3 py-1 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                🔄 Regenerate
              </button>
            </div>
          )}

          {/* Quality score */}
          {agentOutput && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Quality Score: {Math.round(agentOutput.qualityScore * 100)}%
              {agentOutput.status === 'approved' && (
                <span className="ml-2 text-green-600 dark:text-green-400">✓ Approved</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}