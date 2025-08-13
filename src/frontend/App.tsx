import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import { AgentChatProvider } from './contexts/AgentChatContext';
import AuthGuard from './components/AuthGuard';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Login from './pages/Login';
import StrategyRefine from './pages/StrategyRefine';
import AgentChat from './pages/AgentChat';

function App() {
  return (
    <AuthProvider>
      <div className='min-h-screen bg-background'>
        <Routes>
          <Route path='/login' element={<Login />} />
          <Route path='/' element={<Navigate to='/dashboard' replace />} />
          <Route
            path='/dashboard'
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path='/chat/:sessionId'
            element={
              <AuthGuard>
                <SessionProvider>
                  <Chat />
                </SessionProvider>
              </AuthGuard>
            }
          />
          <Route
            path='/refine/:sessionId'
            element={
              <AuthGuard>
                <StrategyRefine />
              </AuthGuard>
            }
          />
          <Route
            path='/refine/:sessionId/chat/:agentId'
            element={
              <AuthGuard>
                <AgentChatProvider>
                  <AgentChat />
                </AgentChatProvider>
              </AuthGuard>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
