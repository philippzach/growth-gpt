import React, { useState } from 'react';
import { UserSession, AgentOutput } from '../../types';

interface ActionButtonsProps {
  session: UserSession;
  currentAgent: string;
  viewingAgent?: string;
  agentOutput?: AgentOutput;
  onApprove: (outputId: string, feedback?: string) => Promise<void>;
  onNextAgent: () => Promise<void>;
  onEditDocument?: (outputId: string) => void;
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
  onEditDocument,
  onNavigateToNextAgent,
  isProcessing = false,
  canProceed = false
}: ActionButtonsProps) {
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

  const handleEditDocument = () => {
    if (!agentOutput || !onEditDocument) return;
    onEditDocument(agentOutput.agentId);
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
                  {/* Show Edit Document button only when pending */}
                  {isPending && onEditDocument && (
                    <button
                      onClick={handleEditDocument}
                      disabled={isSubmitting || isProcessing}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Document
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
    </>
  );
}