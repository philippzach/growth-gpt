import React, { useState } from 'react';
import { UserSession, AgentOutput } from '../../types';

interface ActionButtonsProps {
  session: UserSession;
  currentAgent: string;
  viewingAgent?: string;
  agentOutput?: AgentOutput;
  onApprove: (outputId: string, feedback?: string) => Promise<void>;
  onNextAgent: () => Promise<void>;
  onRegenerate: (outputId: string, feedback: string) => Promise<void>;
  onNavigateToNextAgent?: (agentId: string) => void;
  isProcessing?: boolean;
  canProceed?: boolean;
}

export default function ActionButtons({
  session,
  currentAgent,
  viewingAgent,
  agentOutput,
  onApprove,
  onNextAgent,
  onRegenerate,
  onNavigateToNextAgent,
  isProcessing = false,
  canProceed = false
}: ActionButtonsProps) {
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateFeedback, setRegenerateFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!agentOutput) return;
    
    try {
      setIsSubmitting(true);
      await onApprove(agentOutput.agentId);
      
      // After approval, navigate to the next agent tab
      if (onNavigateToNextAgent && session.currentAgent) {
        const agentSequence = [
          'gtm-consultant',
          'persona-strategist',
          'product-manager',
          'growth-manager',
          'head-of-acquisition',
          'head-of-retention',
          'viral-growth-architect',
          'growth-hacker'
        ];
        
        const currentIndex = agentSequence.indexOf(session.currentAgent);
        if (currentIndex >= 0 && currentIndex < agentSequence.length - 1) {
          const nextAgent = agentSequence[currentIndex + 1];
          onNavigateToNextAgent(nextAgent);
        }
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextAgent = async () => {
    try {
      setIsSubmitting(true);
      await onNextAgent();
    } catch (error) {
      console.error('Failed to proceed to next agent:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!agentOutput || !regenerateFeedback.trim()) return;

    try {
      setIsSubmitting(true);
      await onRegenerate(agentOutput.agentId, regenerateFeedback.trim());
      setShowRegenerateDialog(false);
      setRegenerateFeedback('');
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isWorkflowComplete = session.status === 'completed';
  const hasOutput = agentOutput && agentOutput.content;
  const isApproved = agentOutput?.status === 'approved';
  const isPending = agentOutput?.status === 'pending';
  const isViewingCurrentAgent = !viewingAgent || viewingAgent === currentAgent;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sticky bottom-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Status info */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Step {session.currentStep + 1} of {session.progress.totalSteps}
              </div>
              
              {isApproved && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Approved
                  </span>
                </div>
              )}
              
              {isPending && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                    Pending Review
                  </span>
                </div>
              )}
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center space-x-3">
              {/* Only show action buttons for current workflow agent */}
              {hasOutput && isViewingCurrentAgent && (
                <>
                  {/* Show Regenerate button only when pending */}
                  {isPending && (
                    <button
                      onClick={() => setShowRegenerateDialog(true)}
                      disabled={isSubmitting || isProcessing}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                  )}

                  {/* Approve/Next Agent Button - transforms after approval */}
                  {isPending ? (
                    /* Approve Button */
                    <button
                      onClick={handleApprove}
                      disabled={isSubmitting || isProcessing}
                      className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isSubmitting ? 'Approving...' : 'Approve'}
                    </button>
                  ) : isApproved && !isWorkflowComplete ? (
                    /* Next Agent Button */
                    <button
                      onClick={handleNextAgent}
                      disabled={isSubmitting || isProcessing}
                      className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Processing...' : 'Next Agent'}
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  ) : null}
                </>
              )}

              {/* Workflow Complete */}
              {isWorkflowComplete && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Strategy Complete!
                  </span>
                </div>
              )}

              {/* Show status for non-current agents */}
              {!isViewingCurrentAgent && isApproved && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Completed
                  </span>
                </div>
              )}

              {/* Processing Spinner */}
              {(isProcessing && !hasOutput && isViewingCurrentAgent) && (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Processing...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate Dialog */}
      {showRegenerateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Regenerate Response
              </h3>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              What would you like the agent to improve or change in their response?
            </p>
            
            <textarea
              value={regenerateFeedback}
              onChange={(e) => setRegenerateFeedback(e.target.value)}
              placeholder="Please make it more specific and actionable..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowRegenerateDialog(false);
                  setRegenerateFeedback('');
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={!regenerateFeedback.trim() || isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}