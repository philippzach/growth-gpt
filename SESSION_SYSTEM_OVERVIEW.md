# Session State System Overview 📊

## How the Session System Works

### 1. **Storage Architecture**

The session system uses a **hybrid storage approach** with two layers:

#### **Primary Storage: Cloudflare KV (SESSION_STORE)**
- **Purpose**: Long-term persistence of all session data
- **Key Format**: `session:${sessionId}` for individual sessions
- **Index Format**: `user:${userId}:sessions` for user session lists
- **Persistence**: Data survives system restarts and deployments

#### **Secondary Storage: Durable Objects**
- **Purpose**: Real-time session state for active WebSocket connections
- **Usage**: Temporary cache during active chat sessions
- **Auto-cleanup**: Sessions inactive for 24+ hours are cleaned up

### 2. **Session Lifecycle**

```
User Creates Session → Stored in KV → Added to User Index → Available in Dashboard
                  ↓
              Active Chat → Loaded into Durable Object → Real-time Updates
                  ↓
            Session Updates → Saved to Both KV & Durable Object Storage
                  ↓
              User Leaves → Session Persists in KV → Can Resume Later
```

### 3. **Key Features Implemented**

✅ **Session Creation**: Creates session + maintains user index  
✅ **Session Listing**: Dashboard can list all user sessions  
✅ **Session Loading**: Resume any session from dashboard  
✅ **Session Updates**: All changes saved to persistent storage  
✅ **Session Deletion**: Removes session + cleans up index  
✅ **User Authorization**: Users can only access their own sessions  

### 4. **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | POST | Create new session |
| `/api/users/:userId/sessions` | GET | List user's sessions |
| `/api/sessions/:sessionId` | GET | Load specific session |
| `/api/sessions/:sessionId` | DELETE | Delete session |
| `/api/chat/:sessionId/approve` | PUT | Update session with approval |

### 5. **Dashboard Integration**

**How to Continue a Session:**

1. **User visits Dashboard** → Frontend calls `/api/users/:userId/sessions`
2. **Backend queries user index** → `user:${userId}:sessions` from KV
3. **Loads session metadata** → Fetches each session from `session:${sessionId}`
4. **Returns sorted list** → Ordered by last activity (newest first)
5. **User clicks "Continue"** → Frontend navigates to `/chat/${sessionId}`
6. **Chat page loads session** → Calls `/api/sessions/:sessionId}`
7. **Session resumes** → Full conversation history restored

### 6. **Session Data Structure**

Each session contains:
```typescript
{
  id: string;                    // Unique session identifier
  userId: string;                // Owner of the session
  workflowId: string;           // Which workflow (master-workflow-v2)
  status: 'active' | 'paused' | 'completed';
  currentAgent: string;         // Current AI agent
  currentStep: number;          // Progress through workflow
  createdAt: string;           // Creation timestamp
  lastActive: string;          // Last interaction time
  userInputs: object;          // User's input data
  agentOutputs: object;        // AI agent responses
  conversationHistory: array;  // Complete chat history
  progress: {                  // Workflow progress tracking
    totalSteps: number;
    completedSteps: number;
    currentStepId: string;
    estimatedTimeRemaining: number;
    stageProgress: {
      foundation: number;    // 0-1 progress
      strategy: number;      // 0-1 progress
      validation: number;    // 0-1 progress
    }
  }
}
```

### 7. **User Index System**

**Index Key**: `user:${userId}:sessions`  
**Index Value**: `["session-id-1", "session-id-2", "session-id-3"]`

**Benefits:**
- ✅ Fast session lookup by user
- ✅ No need to scan all sessions
- ✅ Efficient dashboard loading
- ✅ Easy session management

### 8. **Resuming Sessions**

When a user continues a session:

1. **Session loaded from KV** → Complete state restored
2. **Conversation history** → All previous messages displayed
3. **Workflow position** → Resumes at exact step where left off
4. **Agent context** → Previous outputs available for next agent
5. **Progress tracking** → Visual progress bar shows completion
6. **Real-time updates** → WebSocket connection re-established

### 9. **Session Management Features**

**Available Now:**
- ✅ Create new sessions
- ✅ List user sessions (sorted by activity)
- ✅ Load and resume any session
- ✅ Delete unwanted sessions
- ✅ Real-time session updates

**Future Enhancements:**
- 🔄 Session titles/naming
- 🔄 Session export (PDF, MD)
- 🔄 Session sharing/collaboration
- 🔄 Session templates
- 🔄 Automated cleanup policies

### 10. **Technical Implementation**

**Key Functions Added:**
- `updateUserSessionIndex()` - Maintains user session lists
- `removeFromUserSessionIndex()` - Cleans up deleted sessions  
- `getUserSessions()` - Efficiently retrieves user sessions

**Storage Pattern:**
```
KV Store:
├── session:abc-123         → Full session data
├── session:def-456         → Full session data
├── user:user-id-1:sessions → ["abc-123", "def-456"]
└── user:user-id-2:sessions → ["ghi-789"]
```

This system provides a robust foundation for session persistence and management, enabling users to seamlessly continue their growth strategy development across multiple sessions.