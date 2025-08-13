import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useParams } from 'react-router-dom';
import { UserSession, ChatMessage, AgentConfig } from '../../types';
import { useAuth } from './AuthContext';

export interface AgentChatMessage extends ChatMessage {
  agentPersonality?: string;
}

export interface AgentChatSession {
  id: string;
  sessionId: string; // Reference to the main strategy session
  agentId: string;
  agentConfig: AgentConfig | null;
  messages: AgentChatMessage[];
  strategyContext: UserSession | null; // Full strategy session context
  createdAt: string;
  lastActive: string;
}

interface AgentChatContextType {
  chatSession: AgentChatSession | null;
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  isAgentTyping: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  streamingMessages: Record<string, string>;
  quickPrompts: QuickPrompt[];
}

interface QuickPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
  description?: string;
}

const AgentChatContext = createContext<AgentChatContextType | undefined>(undefined);

export function AgentChatProvider({ children }: { children: React.ReactNode }) {
  const { sessionId, agentId } = useParams<{ sessionId: string; agentId: string }>();
  const { user, supabase } = useAuth();

  const [chatSession, setChatSession] = useState<AgentChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'connecting' | 'disconnected'
  >('connecting');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [streamingMessages, setStreamingMessages] = useState<Record<string, string>>({});

  // Initialize chat session and WebSocket connection
  useEffect(() => {
    if (!sessionId || !agentId || !user) return;

    let isMounted = true;

    const initializeChatSession = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) {
          throw new Error('No authentication token');
        }

        // Get or create agent chat session
        const response = await fetch(`/api/refine/${sessionId}/chat/${agentId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load agent chat session: ${response.statusText}`);
        }

        const data = await response.json();

        if (isMounted) {
          const sessionData = (data as any).data;
          // Ensure messages array is initialized
          if (!sessionData.messages) {
            sessionData.messages = [];
          }
          setChatSession(sessionData);
          // Initialize WebSocket connection for this agent chat
          initializeWebSocket(sessionId, agentId, token);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load chat session');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeChatSession();

    return () => {
      isMounted = false;
      if (websocket) {
        websocket.close();
      }
    };
  }, [sessionId, agentId, user, supabase]);

  const initializeWebSocket = useCallback((sessionId: string, agentId: string, token: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/refine/${sessionId}/chat/${agentId}/ws`;

    console.log('Connecting to Agent Chat WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('Agent Chat WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse Agent Chat WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      console.log('Agent Chat WebSocket disconnected');

      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (sessionId && agentId && user) {
          setConnectionStatus('connecting');
          initializeWebSocket(sessionId, agentId, token);
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('Agent Chat WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    setWebsocket(ws);
  }, []);

  const handleWebSocketMessage = useCallback((data: Record<string, any>) => {
    switch (data.type) {
      case 'chat_session_state':
        const sessionState = data.data as any;
        // Ensure messages array is initialized
        if (!sessionState.messages) {
          sessionState.messages = [];
        }
        setChatSession(sessionState);
        break;

      case 'new_message':
        setChatSession((prev) => {
          if (!prev) return prev;
          const messages = prev.messages || [];
          return {
            ...prev,
            messages: [...messages, data.data as any],
          };
        });
        break;

      case 'agent_typing':
        setIsAgentTyping(true);
        break;

      case 'streaming_start':
        setIsAgentTyping(true);
        setStreamingMessages(prev => ({
          ...prev,
          [data.messageId]: '',
        }));
        break;

      case 'content_chunk':
        setStreamingMessages(prev => {
          const messageIds = Object.keys(prev);
          if (messageIds.length === 0) return prev;
          
          const lastMessageId = messageIds[messageIds.length - 1];
          return {
            ...prev,
            [lastMessageId]: (prev[lastMessageId] || '') + data.chunk,
          };
        });
        break;

      case 'streaming_complete':
        setIsAgentTyping(false);
        
        // Add the completed message to chat session
        setChatSession((prev) => {
          if (!prev) return prev;
          const messages = prev.messages || [];
          return {
            ...prev,
            messages: [...messages, data.message as any],
            lastActive: new Date().toISOString(),
          };
        });
        
        // Clear streaming messages after a small delay
        setTimeout(() => {
          setStreamingMessages(prev => {
            const newStreamingMessages = { ...prev };
            delete newStreamingMessages[data.messageId];
            return newStreamingMessages;
          });
        }, 100);
        break;

      case 'pong':
        // Keep-alive response
        break;

      default:
        console.log('Unknown Agent Chat WebSocket message type:', data.type);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!chatSession || !websocket || connectionStatus !== 'connected') {
        throw new Error('Not connected to agent chat session');
      }

      const message: AgentChatMessage = {
        id: crypto.randomUUID(),
        sessionId: chatSession.id,
        sender: 'user',
        type: 'text',
        content,
        timestamp: new Date().toISOString(),
      };

      // Add message to local state immediately
      setChatSession((prev) => {
        if (!prev) return prev;
        const messages = prev.messages || [];
        return {
          ...prev,
          messages: [...messages, message],
          lastActive: new Date().toISOString(),
        };
      });

      // Send via WebSocket
      websocket.send(
        JSON.stringify({
          type: 'message',
          payload: { content },
        })
      );
    },
    [chatSession, websocket, connectionStatus]
  );

  // Keep WebSocket alive with periodic pings
  useEffect(() => {
    if (websocket && connectionStatus === 'connected') {
      const pingInterval = setInterval(() => {
        websocket.send(JSON.stringify({ type: 'ping' }));
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [websocket, connectionStatus]);

  // Get quick prompts for the current agent
  const quickPrompts = getQuickPromptsForAgent(agentId || '');

  const value = {
    chatSession,
    loading,
    error,
    sendMessage,
    isAgentTyping,
    connectionStatus,
    streamingMessages,
    quickPrompts,
  };

  return (
    <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>
  );
}

export function useAgentChat() {
  const context = useContext(AgentChatContext);
  if (context === undefined) {
    throw new Error('useAgentChat must be used within an AgentChatProvider');
  }
  return context;
}

// Quick prompts configuration for each agent
function getQuickPromptsForAgent(agentId: string): QuickPrompt[] {
  const promptsMap: Record<string, QuickPrompt[]> = {
    'ceo': [
      // Strategic Planning (4 prompts)
      {
        id: 'strategic-risk',
        category: 'Strategic Planning',
        title: 'Strategic Risk Assessment & Mitigation',
        prompt: "Based on our complete 8-agent growth strategy context, conduct a comprehensive strategic risk assessment. Analyze market, competitive, operational, and financial risks. Provide a risk matrix with probability/impact scoring, specific mitigation strategies for each risk, early warning indicators, contingency plans, and resource allocation for risk management. Include scenario-based stress testing and create a quarterly risk review framework.",
        description: 'Executive-level risk management with strategic context'
      },
      {
        id: 'execution-roadmap',
        category: 'Strategic Planning', 
        title: 'Strategic Execution Roadmap',
        prompt: "Create a comprehensive 90-day strategic execution roadmap leveraging our complete growth strategy from all 8 agents. Prioritize initiatives using the Eisenhower Matrix, define clear milestones with SMART goals, allocate resources across GTM, product, growth, acquisition, retention, and viral initiatives. Include cross-functional dependencies, risk mitigation plans, success metrics, and weekly executive review framework.",
        description: 'Cross-functional strategic execution plan'
      },
      {
        id: 'scenario-planning',
        category: 'Strategic Planning',
        title: 'Multi-Scenario Strategic Planning',
        prompt: "Develop comprehensive scenario planning for bull market, bear market, and recession conditions using our complete strategy context. For each scenario, adapt our GTM approach, customer acquisition strategy, retention programs, product roadmap, team scaling, and financial planning. Create scenario-specific KPIs, resource allocation models, strategic pivots, and contingency activation triggers.",
        description: 'Strategic adaptability across market conditions'
      },
      {
        id: 'competitive-positioning',
        category: 'Strategic Planning',
        title: 'Strategic Competitive Positioning',
        prompt: "Using our GTM consultant's competitive analysis and all agent strategies, develop an advanced competitive positioning framework. Create a competitive battle card system, differentiation strategy, competitive response playbooks, market positioning maps, and strategic moats. Include competitive intelligence gathering processes, pricing strategy vs competitors, and long-term competitive advantage building.",
        description: 'Executive competitive strategy framework'
      },
      
      // Financial Strategy (3 prompts)
      {
        id: 'investor-pitch',
        category: 'Financial Strategy',
        title: 'Investor Pitch Deck & Narrative',
        prompt: "Generate a comprehensive Series A/B investor pitch deck leveraging our complete 8-agent strategy. Include market opportunity analysis, business model validation, traction metrics, competitive differentiation, team strengths, financial projections, use of funds allocation across growth initiatives, and risk mitigation strategies. Provide pitch narrative, FAQ preparation, and investor meeting framework.",
        description: 'Investment-ready presentation with strategic integration'
      },
      {
        id: 'financial-modeling',
        category: 'Financial Strategy',
        title: 'Strategic Financial Model & Projections',
        prompt: "Build a comprehensive 5-year financial model integrating our acquisition, retention, and viral growth strategies. Include unit economics modeling, cohort-based revenue projections, CAC/LTV optimization scenarios, seasonal adjustments, scenario-based sensitivity analysis, cash flow projections, and funding requirement planning. Create executive financial dashboard with key financial KPIs.",
        description: 'Executive financial planning with growth integration'
      },
      {
        id: 'valuation-optimization',
        category: 'Financial Strategy',
        title: 'Valuation Optimization Strategy',
        prompt: "Develop a valuation optimization strategy for our next funding round or exit using our complete growth strategy context. Analyze comparable companies, identify value drivers, create growth multiple expansion opportunities, optimize unit economics presentation, develop strategic partnership opportunities that increase valuation, and create a pre-due diligence preparation checklist.",
        description: 'Strategic valuation enhancement framework'
      },
      
      // Organizational Design (3 prompts)
      {
        id: 'hiring-roadmap',
        category: 'Organizational Design',
        title: 'Strategic Hiring & Organizational Roadmap', 
        prompt: "Create a comprehensive 18-month hiring roadmap based on our growth strategy needs across all functions. Define organizational structure evolution, key role priorities for GTM, product, growth, and operations. Include competency frameworks, cultural fit criteria, compensation benchmarking, diversity & inclusion targets, and leadership development pathways. Create executive hiring scorecards and interview frameworks.",
        description: 'Strategic team scaling with growth alignment'
      },
      {
        id: 'leadership-development',
        category: 'Organizational Design',
        title: 'Executive Leadership Development',
        prompt: "Design a leadership development program for our executive team and key managers aligned with our growth strategy execution needs. Include leadership competency frameworks, 360-degree feedback systems, executive coaching programs, succession planning, and leadership performance metrics. Create board-level leadership assessment criteria and development investment allocation.",
        description: 'Strategic leadership capability building'
      },
      {
        id: 'organizational-structure',
        category: 'Organizational Design',
        title: 'Scalable Organizational Architecture',
        prompt: "Design an organizational structure that optimally supports our growth strategy across all 8 functional areas. Define reporting structures, cross-functional collaboration frameworks, decision-making authorities, communication flows, and performance management systems. Include organizational scaling milestones, cultural integration strategies, and change management processes.",
        description: 'Growth-aligned organizational design'
      },
      
      // Operations Excellence (3 prompts)
      {
        id: 'outsource-decisions',
        category: 'Operations Excellence',
        title: 'Strategic Build vs Buy Framework',
        prompt: "Create a comprehensive build vs buy decision framework for all growth initiatives across our strategy. Analyze core competencies, strategic importance, cost structures, time-to-market considerations, quality control requirements, and vendor management capabilities. Include outsourcing partner evaluation criteria, SLA frameworks, and in-house capability development roadmap.",
        description: 'Strategic resource allocation optimization'
      },
      {
        id: 'process-optimization',
        category: 'Operations Excellence',
        title: 'Executive Process Optimization',
        prompt: "Design executive-level process optimization across all growth functions using our complete strategy context. Create standardized workflows, decision-making frameworks, performance management systems, and cross-functional collaboration processes. Include automation opportunities, efficiency metrics, and continuous improvement methodologies with quarterly review cycles.",
        description: 'Operational excellence for growth execution'
      },
      {
        id: 'crisis-management',
        category: 'Operations Excellence',
        title: 'Strategic Crisis Management Playbook',
        prompt: "Develop a comprehensive crisis management playbook covering market downturns, competitive threats, operational failures, and reputation crises. Include crisis response team structure, communication frameworks, stakeholder management protocols, business continuity plans, and strategic pivot capabilities. Create crisis severity assessment matrix and recovery strategy templates.",
        description: 'Executive crisis response and business continuity'
      },
      
      // Stakeholder Management (3 prompts)
      {
        id: 'board-presentation',
        category: 'Stakeholder Management',
        title: 'Strategic Board Presentation & Governance',
        prompt: "Create a comprehensive board presentation template integrating our complete growth strategy performance. Include executive dashboard with key strategic KPIs, progress against strategic initiatives, resource allocation efficiency, competitive positioning updates, and strategic decision requests. Develop board meeting agenda framework and quarterly governance review process.",
        description: 'Strategic board communication and governance'
      },
      {
        id: 'investor-relations',
        category: 'Stakeholder Management',
        title: 'Investor Relations & Communication Strategy',
        prompt: "Develop a comprehensive investor relations strategy aligned with our growth execution. Include investor update templates, performance storytelling frameworks, strategic milestone communication, funding timeline planning, and investor engagement protocols. Create investor-specific communication strategies and relationship management systems.",
        description: 'Strategic investor relationship management'
      },
      {
        id: 'partnership-strategy',
        category: 'Stakeholder Management',
        title: 'Strategic Partnership Framework',
        prompt: "Design a strategic partnership evaluation and management framework leveraging our complete business strategy. Include partnership opportunity assessment, strategic value analysis, partnership structures (equity/non-equity), integration planning, performance measurement, and partnership portfolio management. Create partnership negotiation frameworks and governance structures.",
        description: 'Executive partnership strategy and management'
      },
      
      // Growth Orchestration (2 prompts)
      {
        id: 'metrics-dashboard',
        category: 'Growth Orchestration',
        title: 'Executive Strategic Dashboard',
        prompt: "Design a comprehensive executive dashboard integrating all 8 growth function metrics into a strategic performance management system. Include North Star metrics, leading/lagging indicators, cross-functional performance tracking, strategic initiative progress, resource allocation efficiency, and predictive analytics. Create automated reporting systems and executive review frameworks.",
        description: 'Strategic performance monitoring across all functions'
      },
      {
        id: 'strategic-prioritization',
        category: 'Growth Orchestration',
        title: 'Strategic Initiative Prioritization',
        prompt: "Create a strategic initiative prioritization framework for managing our complete growth strategy portfolio. Use frameworks like ICE scoring, strategic impact assessment, resource requirement analysis, and strategic fit evaluation. Include quarterly strategic reviews, initiative sunset criteria, resource reallocation triggers, and strategic pivot decision frameworks.",
        description: 'Executive strategic portfolio management'
      }
    ],
    'gtm-consultant': [
      // Market Intelligence (4 prompts)
      {
        id: 'market-sizing',
        category: 'Market Intelligence',
        title: 'Comprehensive Market Sizing & Opportunity Analysis',
        prompt: "Conduct a comprehensive market sizing analysis integrating our persona strategist's customer insights and product manager's positioning. Calculate TAM/SAM/SOM using multiple methodologies (top-down, bottom-up, value theory). Include market growth projections, competitive landscape sizing, geographic expansion opportunities, and market timing analysis. Provide data sources, calculation methodology, market entry barriers, and opportunity prioritization framework.",
        description: 'Strategic market opportunity quantification with multi-agent context'
      },
      {
        id: 'competitive-intelligence',
        category: 'Market Intelligence',
        title: 'Advanced Competitive Intelligence Framework',
        prompt: "Build a comprehensive competitive intelligence system leveraging our complete business strategy context. Create competitor battle cards, SWOT analysis matrix, competitive positioning maps, feature gap analysis, pricing comparison frameworks, and go-to-market strategy comparison. Include competitive monitoring systems, response playbooks, differentiation strategies, and competitive advantage development roadmap.",
        description: 'Strategic competitive analysis and response system'
      },
      {
        id: 'category-creation',
        category: 'Market Intelligence', 
        title: 'Market Category Creation Strategy',
        prompt: "Develop a category creation strategy using our unique value proposition and market positioning. Define new market category boundaries, create category-defining messaging, identify category adoption stages, design thought leadership content strategy, and build category evangelism programs. Include category validation methodology, market education campaigns, and category leadership measurement framework.",
        description: 'Blue ocean strategy and market category design'
      },
      {
        id: 'market-trends',
        category: 'Market Intelligence',
        title: 'Strategic Market Trend Analysis & Forecasting',
        prompt: "Analyze macro and micro market trends affecting our business using our complete strategy context. Identify technology trends, consumer behavior shifts, regulatory changes, economic factors, and competitive landscape evolution. Create trend impact assessment, strategic opportunity identification, threat mitigation strategies, and trend-based product roadmap alignment. Include trend monitoring systems and strategic pivot triggers.",
        description: 'Predictive market analysis for strategic planning'
      },
      
      // Go-to-Market Strategy (3 prompts)
      {
        id: 'launch-sequence',
        category: 'Go-to-Market Strategy',
        title: 'Comprehensive Go-to-Market Launch Framework',
        prompt: "Design a comprehensive go-to-market launch strategy integrating our persona insights, product positioning, and acquisition channels. Create pre-launch market preparation, launch sequence timeline, channel activation strategy, messaging rollout plan, partnership coordination, and success measurement framework. Include launch risk mitigation, contingency planning, and post-launch optimization strategies.",
        description: 'Integrated launch strategy with cross-functional coordination'
      },
      {
        id: 'market-entry',
        category: 'Go-to-Market Strategy',
        title: 'Strategic Market Entry & Expansion Playbook',
        prompt: "Create a market entry playbook for new geographic or demographic segments using our complete strategy context. Include market assessment methodology, entry strategy selection (direct, partnership, acquisition), localization requirements, competitive positioning adaptation, and success metrics. Develop market entry resource allocation, timeline planning, and expansion sequence optimization.",
        description: 'Systematic market expansion with strategic context'
      },
      {
        id: 'gtm-optimization',
        category: 'Go-to-Market Strategy',
        title: 'Go-to-Market Performance Optimization',
        prompt: "Optimize our go-to-market performance using insights from our acquisition, retention, and growth strategies. Analyze channel performance, message-market fit, sales funnel efficiency, and customer acquisition cost optimization. Create GTM performance dashboard, optimization playbooks, A/B testing frameworks for GTM elements, and continuous improvement processes.",
        description: 'Data-driven GTM performance enhancement'
      },
      
      // Positioning & Messaging (3 prompts)
      {
        id: 'value-proposition',
        category: 'Positioning & Messaging',
        title: 'Strategic Value Proposition Development',
        prompt: "Develop a comprehensive value proposition framework using our persona insights and competitive analysis. Create value proposition canvas, benefit hierarchy, proof points validation, and messaging architecture. Include persona-specific value propositions, competitive differentiation messaging, and value communication frameworks across all customer touchpoints. Design value proposition testing and optimization methodology.",
        description: 'Strategic value proposition with persona integration'
      },
      {
        id: 'messaging-framework',
        category: 'Positioning & Messaging',
        title: 'Integrated Messaging & Brand Framework', 
        prompt: "Create a comprehensive messaging framework integrating our brand positioning, customer psychology insights, and competitive differentiation. Develop messaging hierarchy, brand voice guidelines, persona-specific messaging variations, and channel-specific message adaptation. Include message testing methodology, brand consistency guidelines, and messaging evolution framework.",
        description: 'Strategic brand messaging with psychological integration'
      },
      {
        id: 'positioning-strategy',
        category: 'Positioning & Messaging',
        title: 'Strategic Market Positioning & Differentiation',
        prompt: "Design strategic market positioning leveraging our competitive analysis and customer insights. Create positioning statement framework, differentiation strategy, market perception analysis, and positioning validation methodology. Include positioning evolution roadmap, competitive response strategies, and market leadership positioning tactics. Develop positioning measurement and optimization systems.",
        description: 'Competitive positioning with strategic differentiation'
      },
      
      // Pricing Strategy (3 prompts)
      {
        id: 'pricing-strategy',
        category: 'Pricing Strategy',
        title: 'Advanced Pricing Strategy & Optimization',
        prompt: "Develop a comprehensive pricing strategy using our customer psychology insights, competitive analysis, and value proposition framework. Create value-based pricing models, competitive pricing analysis, psychological pricing tactics, and pricing tier optimization. Include pricing testing methodology, dynamic pricing considerations, and pricing evolution strategy. Design pricing dashboard and optimization framework.",
        description: 'Strategic pricing with psychological and competitive context'
      },
      {
        id: 'monetization-model',
        category: 'Pricing Strategy',
        title: 'Business Model & Monetization Strategy',
        prompt: "Design optimal business model and monetization strategy integrating our customer journey insights and market positioning. Analyze subscription vs transaction models, freemium strategies, usage-based pricing, and hybrid monetization approaches. Include revenue stream diversification, monetization optimization, and business model evolution planning. Create monetization performance measurement framework.",
        description: 'Strategic monetization with customer journey integration'
      },
      {
        id: 'pricing-psychology',
        category: 'Pricing Strategy',
        title: 'Pricing Psychology & Behavioral Economics',
        prompt: "Apply pricing psychology and behavioral economics using our persona strategist's customer psychology insights. Implement anchoring, decoy effects, loss aversion, social proof, and scarcity tactics in pricing strategy. Create psychological pricing testing framework, pricing presentation optimization, and behavioral trigger integration. Develop pricing psychology measurement and optimization system.",
        description: 'Behavioral economics in pricing with persona insights'
      },
      
      // Channel Development (3 prompts)
      {
        id: 'channel-strategy',
        category: 'Channel Development',
        title: 'Multi-Channel Distribution Strategy',
        prompt: "Create a comprehensive channel strategy integrating our customer acquisition and retention insights. Analyze direct vs indirect channels, digital vs traditional distribution, partnership channel opportunities, and channel conflict management. Include channel partner evaluation, channel economics modeling, and channel performance optimization. Design channel mix optimization and expansion strategy.",
        description: 'Strategic channel optimization with acquisition context'
      },
      {
        id: 'partner-program',
        category: 'Channel Development',
        title: 'Strategic Channel Partner Program',
        prompt: "Design a channel partner program leveraging our competitive positioning and value proposition. Create partner recruitment strategy, partner enablement programs, partner performance management, and partner relationship optimization. Include partner economics, conflict resolution frameworks, and strategic partnership development. Build partner ecosystem strategy and management systems.",
        description: 'Partner ecosystem development with strategic alignment'
      },
      {
        id: 'sales-enablement',
        category: 'Channel Development',
        title: 'Sales Enablement & Channel Support Framework',
        prompt: "Build comprehensive sales enablement integrating our messaging framework, competitive analysis, and customer psychology insights. Create sales playbooks, objection handling frameworks, competitive battle cards, and sales training programs. Include sales process optimization, CRM integration, sales performance measurement, and continuous sales improvement systems.",
        description: 'Sales effectiveness with strategic messaging integration'
      },
      
      // Launch Execution (2 prompts)
      {
        id: 'launch-campaign',
        category: 'Launch Execution',
        title: 'Integrated Launch Campaign Strategy',
        prompt: "Design an integrated launch campaign leveraging our acquisition channels, viral mechanics, and retention strategies. Create omnichannel campaign strategy, launch event planning, media relations, influencer partnerships, and community activation. Include launch momentum building, buzz generation tactics, and launch success amplification. Develop launch campaign measurement and optimization framework.",
        description: 'Cross-functional launch campaign with growth integration'
      },
      {
        id: 'market-penetration',
        category: 'Launch Execution',
        title: 'Market Penetration & Adoption Strategy',
        prompt: "Create market penetration strategy using our persona insights, viral growth mechanics, and retention programs. Design early adopter targeting, product adoption acceleration, market share capture tactics, and network effect activation. Include penetration measurement, adoption optimization, and market dominance strategy. Build market penetration dashboard and scaling framework.",
        description: 'Market share capture with viral and retention integration'
      }
    ],
    'persona-strategist': [
      // Behavioral Psychology (4 prompts)
      {
        id: 'behavioral-triggers',
        category: 'Behavioral Psychology',
        title: 'Psychology-Based Conversion Optimization',
        prompt: "Analyze our target personas using advanced behavioral psychology principles and integrate with our GTM and acquisition strategies. Apply Cialdini's influence principles (reciprocity, commitment, social proof, authority, liking, scarcity), Kahneman's System 1/System 2 thinking, loss aversion, cognitive biases, and decision-making heuristics. Create behavioral trigger frameworks, conversion optimization strategies, and psychological testing methodology for each customer touchpoint.",
        description: 'Advanced behavioral psychology for conversion optimization'
      },
      {
        id: 'decision-psychology',
        category: 'Behavioral Psychology',
        title: 'Customer Decision-Making Psychology',
        prompt: "Map the psychological decision-making process for each persona using our complete customer journey insights. Analyze emotional vs rational decision factors, cognitive biases affecting purchase decisions, social influence mechanisms, and decision confidence drivers. Create decision facilitation frameworks, objection handling psychology, and decision acceleration tactics integrated with our acquisition and retention strategies.",
        description: 'Decision psychology for customer journey optimization'
      },
      {
        id: 'behavioral-economics',
        category: 'Behavioral Psychology',
        title: 'Behavioral Economics in Customer Strategy',
        prompt: "Apply behavioral economics principles to our customer strategy using insights from our pricing and monetization approach. Implement nudge theory, choice architecture, mental accounting, endowment effects, and anchoring principles. Create behavioral intervention strategies, choice optimization frameworks, and behavioral A/B testing methodology. Integrate with pricing psychology and retention tactics.",
        description: 'Behavioral economics integration across customer lifecycle'
      },
      {
        id: 'persuasion-framework',
        category: 'Behavioral Psychology',
        title: 'Integrated Persuasion & Influence Strategy',
        prompt: "Develop a comprehensive persuasion framework leveraging our messaging strategy and competitive positioning. Create influence pathway mapping, persuasion sequence optimization, resistance reduction strategies, and credibility building frameworks. Include social proof systems, authority positioning tactics, and commitment escalation ladders. Integrate with viral growth mechanisms and referral psychology.",
        description: 'Strategic persuasion with messaging and viral integration'
      },
      
      // Research Methodology (3 prompts)
      {
        id: 'interview-scripts',
        category: 'Research Methodology',
        title: 'Advanced Customer Research Framework',
        prompt: "Design comprehensive customer research methodology integrating qualitative and quantitative approaches with our complete business context. Create persona validation interview scripts, ethnographic observation protocols, in-depth interview guides, and focus group facilitation frameworks. Include research sample design, bias mitigation strategies, data collection systems, and insight synthesis methodologies. Integrate findings with GTM and product strategies.",
        description: 'Comprehensive customer research with strategic integration'
      },
      {
        id: 'validation-surveys',
        category: 'Research Methodology', 
        title: 'Statistical Persona Validation System',
        prompt: "Create a statistically rigorous persona validation system using our market sizing and segmentation insights. Design survey methodology with statistical significance requirements, sampling strategies, question design principles, and response bias mitigation. Include persona validation metrics, segmentation validation, behavioral prediction modeling, and continuous persona evolution tracking. Integrate with growth experimentation framework.",
        description: 'Scientific persona validation with statistical rigor'
      },
      {
        id: 'research-automation',
        category: 'Research Methodology',
        title: 'Automated Customer Insight Generation',
        prompt: "Build automated customer insight generation systems using our analytics and growth stack. Implement behavioral data analysis, social listening automation, feedback collection systems, and predictive persona modeling. Create insight dashboard, automated reporting systems, persona evolution tracking, and real-time customer psychology monitoring. Integrate with product analytics and growth metrics.",
        description: 'Automated customer intelligence with growth integration'
      },
      
      // Journey Mapping (3 prompts)
      {
        id: 'journey-wireframes',
        category: 'Journey Mapping',
        title: 'Comprehensive Customer Journey Architecture',
        prompt: "Map complete customer journey architecture integrating our acquisition, retention, and viral strategies. Create detailed journey stages, emotional progression mapping, touchpoint optimization, friction analysis, and moment-of-truth identification. Include cross-channel journey integration, personalization opportunities, and journey performance measurement. Design journey testing methodology and continuous optimization framework.",
        description: 'Strategic journey mapping with cross-functional integration'
      },
      {
        id: 'empathy-maps',
        category: 'Journey Mapping',
        title: 'Advanced Empathy Mapping & Emotional Intelligence',
        prompt: "Create comprehensive empathy maps for each persona integrating psychological insights with our complete customer strategy. Map emotional states, cognitive processes, environmental influences, social contexts, and behavioral patterns throughout the customer lifecycle. Include empathy-driven design principles, emotional journey optimization, and empathy measurement frameworks. Integrate with retention psychology and viral sharing motivations.",
        description: 'Deep empathy mapping with emotional journey integration'
      },
      {
        id: 'touchpoint-optimization',
        category: 'Journey Mapping',
        title: 'Customer Touchpoint Psychology & Optimization',
        prompt: "Optimize all customer touchpoints using behavioral psychology and our complete customer experience strategy. Analyze touchpoint emotional impact, cognitive load, decision influence, and experience cohesion. Create touchpoint psychology optimization, micro-moment strategy, experience continuity frameworks, and touchpoint performance measurement. Integrate with acquisition channels and retention touchpoints.",
        description: 'Psychological touchpoint optimization across customer lifecycle'
      },
      
      // Segmentation Strategy (3 prompts)
      {
        id: 'psychographic-segmentation',
        category: 'Segmentation Strategy',
        title: 'Advanced Psychographic Segmentation',
        prompt: "Develop sophisticated psychographic segmentation using our market analysis and customer insights. Create personality-based segments, values-driven clustering, lifestyle segmentation, and behavioral pattern grouping. Include segment validation methodology, segment-specific strategy development, and dynamic segmentation systems. Integrate with acquisition targeting, retention personalization, and viral sharing psychology.",
        description: 'Advanced segmentation with psychological and strategic integration'
      },
      {
        id: 'behavioral-clustering',
        category: 'Segmentation Strategy',
        title: 'Behavioral Pattern Analysis & Clustering',
        prompt: "Analyze customer behavioral patterns using our growth analytics and create predictive behavioral segments. Implement behavioral clustering algorithms, usage pattern analysis, engagement behavior modeling, and lifecycle stage progression patterns. Create behavioral prediction systems, segment migration tracking, and behavioral intervention strategies. Integrate with growth experimentation and retention optimization.",
        description: 'Predictive behavioral segmentation with growth integration'
      },
      {
        id: 'micro-targeting',
        category: 'Segmentation Strategy',
        title: 'Precision Targeting & Micro-Segmentation',
        prompt: "Create precision targeting frameworks using our acquisition strategy and customer psychology insights. Develop micro-segmentation strategies, hyper-personalization frameworks, contextual targeting systems, and predictive targeting models. Include targeting optimization methodology, segment performance tracking, and dynamic targeting adjustment systems. Integrate with paid acquisition and conversion optimization.",
        description: 'Precision targeting with acquisition and psychology integration'
      },
      
      // Cultural Intelligence (3 prompts)
      {
        id: 'cultural-adaptation',
        category: 'Cultural Intelligence',
        title: 'Global Persona Localization Strategy',
        prompt: "Adapt our persona strategy for global markets using cultural psychology and our international expansion plans. Analyze cultural dimensions (Hofstede, Trompenaars), cultural values impact on customer behavior, communication style preferences, and cultural decision-making patterns. Create localization frameworks, cultural sensitivity guidelines, and culturally-adapted customer strategies. Integrate with global GTM and acquisition strategies.",
        description: 'Cultural persona adaptation for global expansion'
      },
      {
        id: 'demographic-insights',
        category: 'Cultural Intelligence',
        title: 'Generational & Demographic Psychology',
        prompt: "Analyze generational and demographic psychology using our persona insights and market segmentation. Create generational behavior profiles, demographic preference patterns, life-stage influence analysis, and socioeconomic impact assessment. Include demographic-specific strategies, cross-generational communication approaches, and demographic trend integration. Align with acquisition channels and retention approaches.",
        description: 'Demographic psychology with generational strategy integration'
      },
      {
        id: 'inclusive-design',
        category: 'Cultural Intelligence',
        title: 'Inclusive Customer Experience Design',
        prompt: "Design inclusive customer experiences using our persona insights and accessibility considerations. Create inclusive design principles, accessibility psychology analysis, diverse persona representation, and inclusive communication frameworks. Include bias mitigation strategies, inclusive testing methodology, and diversity impact measurement. Integrate with product design and customer experience optimization.",
        description: 'Inclusive design with accessibility and diversity integration'
      },
      
      // Customer Co-Creation (2 prompts)
      {
        id: 'advisory-board',
        category: 'Customer Co-Creation',
        title: 'Customer Advisory Board & Community Strategy',
        prompt: "Establish customer advisory board and community co-creation programs using our retention and viral growth strategies. Design advisory board structure, community engagement frameworks, customer co-creation methodologies, and feedback integration systems. Include community psychology principles, engagement gamification, and co-creation value exchange models. Integrate with retention programs and viral community building.",
        description: 'Customer co-creation with community and retention integration'
      },
      {
        id: 'feedback-systems',
        category: 'Customer Co-Creation',
        title: 'Advanced Customer Feedback & Insight Systems',
        prompt: "Build comprehensive customer feedback systems using our customer psychology insights and growth measurement framework. Create feedback collection optimization, sentiment analysis systems, insight prioritization frameworks, and feedback-driven strategy evolution. Include feedback psychology optimization, response rate improvement, and customer involvement strategies. Integrate with product development and growth experimentation.",
        description: 'Customer feedback systems with psychological optimization'
      }
    ],
    'product-manager': [
      // Product Strategy (4 prompts)
      {
        id: 'product-roadmap',
        category: 'Product Strategy',
        title: 'Strategic Product Roadmap & Vision',
        prompt: "Create a comprehensive product roadmap integrating our GTM strategy, customer persona insights, and growth objectives. Define product vision, strategic themes, quarterly milestones, feature prioritization using RICE/ICE methodologies, and cross-functional alignment. Include market opportunity mapping, competitive feature analysis, resource allocation planning, and strategic pivot triggers. Integrate with acquisition, retention, and viral growth requirements.",
        description: 'Strategic product planning with growth and market integration'
      },
      {
        id: 'feature-prioritization',
        category: 'Product Strategy',
        title: 'Advanced Feature Prioritization Framework',
        prompt: "Develop sophisticated feature prioritization using our persona psychology, market positioning, and growth metrics. Implement RICE, ICE, KANO model, and value vs effort matrices. Include persona impact scoring, revenue potential analysis, competitive differentiation assessment, and technical complexity evaluation. Create prioritization automation, stakeholder alignment frameworks, and continuous reprioritization methodology. Integrate with growth experimentation and retention optimization.",
        description: 'Data-driven feature prioritization with psychological and growth context'
      },
      {
        id: 'competitive-analysis',
        category: 'Product Strategy',
        title: 'Product Competitive Analysis & Positioning',
        prompt: "Conduct comprehensive product competitive analysis using our market intelligence and positioning strategy. Create feature gap analysis, competitive benchmarking, product differentiation mapping, and competitive response strategies. Include competitive monitoring systems, feature parity analysis, and unique value proposition strengthening. Design competitive product intelligence gathering and strategic product positioning optimization.",
        description: 'Competitive product strategy with market intelligence integration'
      },
      {
        id: 'market-fit-validation',
        category: 'Product Strategy',
        title: 'Product-Market Fit Validation & Optimization',
        prompt: "Validate and optimize product-market fit using our customer psychology insights and market analysis. Implement PMF measurement frameworks, customer satisfaction surveys, usage analytics, retention cohort analysis, and Net Promoter Score systems. Create PMF optimization strategies, feature-market fit analysis, and product iteration methodology. Integrate with growth metrics and customer feedback systems.",
        description: 'PMF validation with customer psychology and growth integration'
      },
      
      // Development Process (3 prompts)
      {
        id: 'prd-template',
        category: 'Development Process',
        title: 'Comprehensive PRD & Requirements Framework',
        prompt: "Create advanced Product Requirements Document framework integrating our persona insights, technical architecture, and growth objectives. Include user story mapping, acceptance criteria templates, technical specifications, design system requirements, and cross-functional alignment protocols. Design requirement validation methodology, stakeholder sign-off processes, and requirement evolution management. Integrate with development workflows and quality assurance.",
        description: 'Advanced PRD framework with strategic and technical integration'
      },
      {
        id: 'user-story-backlog',
        category: 'Development Process',
        title: 'Advanced User Story & Backlog Management', 
        prompt: "Build comprehensive user story and backlog management system using our persona psychology and customer journey insights. Create epic decomposition frameworks, story estimation methodologies, acceptance criteria optimization, and backlog prioritization automation. Include persona-specific user stories, edge case coverage, and quality assurance integration. Design backlog grooming processes and sprint planning optimization.",
        description: 'User story excellence with persona psychology integration'
      },
      {
        id: 'agile-optimization',
        category: 'Development Process',
        title: 'Product Development Process Optimization',
        prompt: "Optimize product development processes integrating our cross-functional growth strategies and technical requirements. Design Agile/Scrum optimization, cross-functional collaboration frameworks, stakeholder communication protocols, and development velocity improvement. Include process automation, quality gates, and continuous improvement methodology. Integrate with growth experimentation cycles and market feedback loops.",
        description: 'Development process optimization with growth and quality integration'
      },
      
      // User Experience (3 prompts)
      {
        id: 'ux-research',
        category: 'User Experience',
        title: 'User Experience Research & Optimization',
        prompt: "Design comprehensive UX research methodology using our persona psychology and customer journey insights. Create user testing protocols, usability optimization frameworks, interaction design principles, and experience measurement systems. Include user behavior analysis, friction point identification, and user satisfaction optimization. Integrate with conversion optimization and retention psychology.",
        description: 'UX research excellence with persona psychology integration'
      },
      {
        id: 'user-testing',
        category: 'User Experience',
        title: 'Advanced User Testing & Validation',
        prompt: "Build advanced user testing and validation systems integrating our customer psychology insights and growth metrics. Design A/B testing for UX elements, user journey optimization, prototype validation methodology, and user feedback integration. Include usability testing automation, user behavior prediction, and experience personalization strategies. Integrate with growth experimentation and conversion optimization.",
        description: 'User testing with psychology and growth optimization integration'
      },
      {
        id: 'interface-optimization',
        category: 'User Experience',
        title: 'Interface Design & Conversion Optimization',
        prompt: "Optimize product interface design using our behavioral psychology insights and conversion optimization strategies. Apply UI/UX principles, cognitive load optimization, visual hierarchy design, and interaction pattern optimization. Include accessibility compliance, responsive design excellence, and conversion-focused interface design. Integrate with growth experiments and psychological trigger optimization.",
        description: 'Interface optimization with psychology and conversion focus'
      },
      
      // Technical Architecture (3 prompts)
      {
        id: 'technical-architecture',
        category: 'Technical Architecture',
        title: 'Scalable Product Architecture & Technical Strategy',
        prompt: "Design scalable product architecture integrating our growth projections, user behavior patterns, and feature roadmap requirements. Create technical architecture planning, scalability assessment, performance optimization strategies, and technical debt management. Include cloud infrastructure design, API strategy, data architecture, and integration planning. Design technical architecture evolution and scaling strategies.",
        description: 'Technical architecture with growth and scalability focus'
      },
      {
        id: 'performance-optimization',
        category: 'Technical Architecture',
        title: 'Product Performance & Scalability Optimization',
        prompt: "Optimize product performance and scalability using our growth metrics and user behavior insights. Implement performance monitoring, load testing frameworks, database optimization, and caching strategies. Create performance benchmarking, scalability testing, and performance issue resolution protocols. Include mobile optimization, API performance, and user experience performance impact analysis.",
        description: 'Performance optimization with growth and user experience focus'
      },
      {
        id: 'technical-debt',
        category: 'Technical Architecture',
        title: 'Technical Debt Management & Code Quality',
        prompt: "Manage technical debt and code quality using our development velocity and product quality requirements. Create technical debt assessment, refactoring prioritization, code quality standards, and technical debt reduction strategies. Include code review processes, automated testing frameworks, and technical debt impact analysis. Design technical debt communication and stakeholder alignment strategies.",
        description: 'Technical debt management with development velocity optimization'
      },
      
      // Product Analytics (3 prompts)
      {
        id: 'analytics-plan',
        category: 'Product Analytics',
        title: 'Comprehensive Product Analytics & Measurement',
        prompt: "Design comprehensive product analytics system integrating our growth metrics, customer psychology insights, and business objectives. Create event tracking frameworks, user behavior analysis, funnel optimization, and product performance measurement. Include predictive analytics, user segmentation, and product usage optimization. Design analytics automation, reporting systems, and data-driven decision frameworks.",
        description: 'Product analytics with growth and psychology integration'
      },
      {
        id: 'ab-testing-framework',
        category: 'Product Analytics',
        title: 'Product Experimentation & A/B Testing Framework',
        prompt: "Build advanced product experimentation framework integrating our growth experimentation strategy and behavioral psychology insights. Design A/B testing methodology, statistical significance requirements, experiment design principles, and result interpretation frameworks. Include feature flag systems, personalization testing, and experimentation automation. Integrate with growth metrics and user psychology optimization.",
        description: 'Product experimentation with statistical rigor and psychology focus'
      },
      {
        id: 'performance-monitoring',
        category: 'Product Analytics',
        title: 'Product Performance Monitoring & KPI Framework',
        prompt: "Create product performance monitoring system using our growth KPIs and customer success metrics. Design product health dashboards, user engagement tracking, feature adoption analysis, and product-market fit measurement. Include automated alerting, performance trend analysis, and predictive product analytics. Integrate with business metrics and customer satisfaction measurement.",
        description: 'Product performance monitoring with business and customer integration'
      },
      
      // Product-Led Growth (2 prompts)
      {
        id: 'plg-strategy',
        category: 'Product-Led Growth',
        title: 'Product-Led Growth Strategy & Implementation',
        prompt: "Design product-led growth strategy integrating our acquisition, retention, and viral growth mechanisms. Create in-product growth loops, feature-driven acquisition, user activation optimization, and expansion revenue strategies. Include PLG metrics framework, self-service optimization, and product virality enhancement. Design PLG experimentation and optimization methodology.",
        description: 'PLG strategy with acquisition, retention, and viral integration'
      },
      {
        id: 'growth-loops',
        category: 'Product-Led Growth',
        title: 'In-Product Growth Loops & Viral Mechanics',
        prompt: "Build in-product growth loops and viral mechanics using our viral growth architect insights and customer psychology understanding. Create feature-based referral systems, social sharing integration, network effect optimization, and user-generated growth mechanisms. Include growth loop measurement, optimization strategies, and viral coefficient improvement. Integrate with retention psychology and community building strategies.",
        description: 'In-product growth loops with viral and retention psychology integration'
      }
    ],
    'growth-manager': [
      // Growth Modeling (4 prompts)
      {
        id: 'predictive-model',
        category: 'Growth Modeling',
        title: 'ML-Driven Predictive Growth Model',
        prompt: "Build a machine learning-driven predictive growth model integrating our customer psychology insights, acquisition channels, and retention strategies. Create predictive user behavior modeling, growth forecasting algorithms, scenario-based growth projections, and model validation frameworks. Include feature engineering from customer data, model performance monitoring, and predictive analytics automation. Integrate with business planning and resource allocation optimization.",
        description: 'Advanced ML growth forecasting with multi-agent data integration'
      },
      {
        id: 'growth-model',
        category: 'Growth Modeling',
        title: 'Mathematical Growth Model & Simulation',
        prompt: "Create comprehensive mathematical growth model integrating our acquisition, retention, and viral strategies. Design growth equation modeling, loop dynamics simulation, sensitivity analysis, and Monte Carlo scenario planning. Include growth driver identification, coefficient optimization, bottleneck analysis, and growth lever prioritization. Build model automation, real-time calibration, and strategic decision simulation framework.",
        description: 'Mathematical growth modeling with strategic simulation'
      },
      {
        id: 'cohort-analysis',
        category: 'Growth Modeling',
        title: 'Advanced Cohort Analysis & LTV Optimization',
        prompt: "Design sophisticated cohort analysis framework using our customer psychology insights and retention strategies. Create cohort segmentation methodologies, lifetime value calculations, retention curve modeling, and behavioral cohort clustering. Include predictive cohort analytics, cohort optimization strategies, and cohort-based growth planning. Integrate with customer success metrics and revenue forecasting.",
        description: 'Advanced cohort analytics with psychology and retention integration'
      },
      {
        id: 'attribution-modeling',
        category: 'Growth Modeling',
        title: 'Multi-Touch Attribution & Growth Attribution',
        prompt: "Build advanced multi-touch attribution model integrating our acquisition channels, customer journey insights, and conversion psychology. Create attribution modeling methodologies, cross-channel attribution, incrementality testing, and attribution optimization. Include media mix modeling, attribution decay functions, and attribution-based budget optimization. Design attribution automation and strategic attribution insights generation.",
        description: 'Advanced attribution modeling with channel and psychology integration'
      },
      
      // Funnel Optimization (3 prompts)
      {
        id: 'funnel-optimization',
        category: 'Funnel Optimization',
        title: 'Growth Funnel Analysis & Optimization',
        prompt: "Optimize complete growth funnel using our customer psychology insights, acquisition strategies, and retention mechanisms. Create funnel analysis methodologies, conversion rate optimization, bottleneck identification, and user flow enhancement. Include psychological funnel optimization, persona-specific funnel design, and funnel personalization strategies. Design funnel experimentation framework and continuous optimization processes.",
        description: 'Comprehensive funnel optimization with psychology and personalization'
      },
      {
        id: 'conversion-optimization',
        category: 'Funnel Optimization',
        title: 'Advanced Conversion Rate Optimization',
        prompt: "Design advanced conversion rate optimization strategy integrating our behavioral psychology insights and customer journey mapping. Create CRO testing frameworks, psychological trigger optimization, conversion barrier removal, and user experience enhancement. Include multivariate testing, conversion psychology application, and conversion funnel personalization. Integrate with A/B testing infrastructure and user behavior analytics.",
        description: 'CRO excellence with psychology and behavioral optimization'
      },
      {
        id: 'user-flow',
        category: 'Funnel Optimization',
        title: 'User Flow Design & Friction Reduction',
        prompt: "Optimize user flows and reduce friction using our persona psychology insights and customer journey optimization. Create user flow mapping, friction point identification, flow optimization methodologies, and user experience enhancement. Include psychological flow design, cognitive load optimization, and flow personalization strategies. Design flow testing frameworks and continuous user experience improvement.",
        description: 'User flow optimization with psychology and friction analysis'
      },
      
      // Experimentation (3 prompts)
      {
        id: 'experiment-prioritization',
        category: 'Experimentation',
        title: 'Growth Experiment Portfolio Management',
        prompt: "Create comprehensive growth experiment portfolio management using our growth strategy and resource allocation insights. Design experiment prioritization frameworks (ICE, RICE), resource allocation optimization, experiment pipeline management, and testing capacity planning. Include experiment ROI modeling, statistical power analysis, and portfolio risk management. Integrate with growth objectives and strategic experimentation alignment.",
        description: 'Experiment portfolio optimization with strategic resource allocation'
      },
      {
        id: 'testing-framework',
        category: 'Experimentation',
        title: 'Advanced A/B Testing & Statistical Framework',
        prompt: "Build advanced A/B testing and statistical framework integrating our growth experimentation strategy and behavioral psychology insights. Create statistical testing methodologies, power analysis, significance testing, and result interpretation frameworks. Include Bayesian testing, sequential testing, and multivariate testing strategies. Design testing automation, statistical monitoring, and experiment lifecycle management.",
        description: 'Statistical experimentation excellence with automation integration'
      },
      {
        id: 'experiment-automation',
        category: 'Experimentation',
        title: 'Growth Experimentation Automation & Optimization',
        prompt: "Design growth experimentation automation using our growth stack and analytics infrastructure. Create automated experiment setup, result monitoring, statistical analysis automation, and experiment scaling frameworks. Include auto-stopping criteria, result interpretation automation, and experiment recommendation engines. Build experiment performance dashboards and automated reporting systems.",
        description: 'Experimentation automation with intelligent optimization systems'
      },
      
      // Metrics & Analytics (3 prompts)
      {
        id: 'metrics-dashboard',
        category: 'Metrics & Analytics',
        title: 'Growth Metrics Dashboard & KPI Framework',
        prompt: "Design comprehensive growth metrics dashboard integrating all growth functions and strategic objectives. Create North Star metrics definition, growth KPI hierarchies, leading/lagging indicator frameworks, and performance monitoring systems. Include automated alerting, predictive metrics, and cross-functional metrics alignment. Build executive growth reporting and strategic metrics communication frameworks.",
        description: 'Strategic growth metrics with cross-functional KPI integration'
      },
      {
        id: 'quarterly-okrs',
        category: 'Metrics & Analytics',
        title: 'Growth OKRs & Strategic Goal Framework',
        prompt: "Create growth-focused OKR framework integrating our strategic objectives and cross-functional growth initiatives. Design objective setting methodology, key result measurement, OKR alignment across teams, and progress tracking systems. Include OKR prioritization, resource allocation alignment, and strategic goal cascading. Build OKR automation, progress monitoring, and strategic alignment optimization.",
        description: 'Strategic OKR framework with growth and cross-functional alignment'
      },
      {
        id: 'performance-analytics',
        category: 'Metrics & Analytics',
        title: 'Growth Performance Analytics & Intelligence',
        prompt: "Build growth performance analytics and business intelligence system using our complete growth strategy context. Create performance analysis frameworks, growth intelligence generation, trend identification, and strategic insight automation. Include performance benchmarking, competitive performance analysis, and growth opportunity identification. Design analytics automation and strategic intelligence reporting.",
        description: 'Growth intelligence with automated insight generation'
      },
      
      // Growth Stack (3 prompts)
      {
        id: 'growth-stack',
        category: 'Growth Stack',
        title: 'Growth Technology Stack Architecture',
        prompt: "Design comprehensive growth technology stack integrating our analytics, experimentation, and automation requirements. Create growth tool evaluation, stack architecture planning, integration optimization, and tool performance management. Include growth automation workflows, data pipeline design, and stack scalability planning. Build stack monitoring, performance optimization, and technology investment prioritization.",
        description: 'Growth stack architecture with automation and integration optimization'
      },
      {
        id: 'automation-workflows',
        category: 'Growth Stack',
        title: 'Growth Automation & Workflow Optimization',
        prompt: "Build growth automation workflows using our growth processes and technology stack. Create automated growth processes, workflow optimization, trigger-based automation, and process scaling frameworks. Include growth task automation, reporting automation, and decision-making automation. Design automation monitoring, optimization strategies, and automated growth system management.",
        description: 'Growth automation with intelligent workflow optimization'
      },
      {
        id: 'data-infrastructure',
        category: 'Growth Stack',
        title: 'Growth Data Infrastructure & Analytics Pipeline',
        prompt: "Design growth data infrastructure using our analytics requirements and measurement frameworks. Create data pipeline architecture, analytics data modeling, real-time data processing, and growth data warehouse design. Include data quality management, data governance, and analytics automation. Build data infrastructure monitoring, optimization strategies, and scalable analytics architecture.",
        description: 'Growth data infrastructure with real-time analytics optimization'
      },
      
      // Cross-Channel Strategy (2 prompts)
      {
        id: 'cross-channel',
        category: 'Cross-Channel Strategy',
        title: 'Integrated Cross-Channel Growth Strategy',
        prompt: "Create integrated cross-channel growth strategy leveraging our acquisition, retention, and viral growth insights. Design channel coordination frameworks, cross-channel attribution, channel synergy optimization, and integrated campaign management. Include channel performance optimization, budget allocation across channels, and cross-channel user journey optimization. Build channel portfolio management and strategic channel coordination.",
        description: 'Cross-channel growth optimization with integrated strategy coordination'
      },
      {
        id: 'budget-optimization',
        category: 'Cross-Channel Strategy',
        title: 'Growth Budget Optimization & Resource Allocation',
        prompt: "Optimize growth budget allocation using our channel performance insights and strategic growth objectives. Create budget allocation methodologies, ROI optimization, resource allocation frameworks, and investment prioritization strategies. Include dynamic budget reallocation, performance-based budgeting, and strategic investment optimization. Design budget monitoring, allocation automation, and financial performance optimization.",
        description: 'Strategic budget optimization with performance-driven resource allocation'
      }
    ],
    'head-of-acquisition': [
      // Paid Advertising (4 prompts)
      {
        id: 'paid-ads-strategy',
        category: 'Paid Advertising',
        title: 'Multi-Platform Advertising Strategy & Optimization',
        prompt: "Create comprehensive multi-platform advertising strategy integrating our customer psychology insights, competitive positioning, and budget allocation. Design Google Ads, Facebook/Meta, LinkedIn, TikTok, and emerging platform strategies with persona-specific targeting, creative optimization, and budget distribution. Include attribution modeling, cross-platform audience syncing, and performance optimization frameworks. Build automated bidding strategies, audience expansion, and creative testing systems.",
        description: 'Advanced multi-platform advertising with psychology and attribution integration'
      },
      {
        id: 'creative-optimization',
        category: 'Paid Advertising',
        title: 'Creative Testing Laboratory & Optimization',
        prompt: "Build systematic creative optimization framework using our behavioral psychology insights and brand messaging strategy. Create creative testing methodologies, ad copy optimization, visual creative testing, and creative performance analysis. Include psychological creative principles, persona-specific creative variations, and creative automation systems. Design creative performance prediction, creative lifecycle management, and creative ROI optimization.",
        description: 'Creative optimization with psychological triggers and systematic testing'
      },
      {
        id: 'audience-targeting',
        category: 'Paid Advertising',
        title: 'Advanced Audience Targeting & Segmentation',
        prompt: "Design advanced audience targeting strategy leveraging our persona insights and customer psychology analysis. Create lookalike audience optimization, custom audience segmentation, behavioral targeting strategies, and intent-based targeting. Include audience expansion methodologies, targeting optimization, and audience performance analysis. Build targeting automation, audience overlap optimization, and targeting ROI measurement systems.",
        description: 'Precision targeting with persona psychology and behavioral insights'
      },
      {
        id: 'budget-allocation',
        category: 'Paid Advertising',
        title: 'Advertising Budget Optimization & Allocation',
        prompt: "Optimize advertising budget allocation using our growth modeling insights and channel performance data. Create budget allocation methodologies, dynamic budget reallocation, performance-based budgeting, and ROI optimization strategies. Include budget automation, seasonal budget adjustments, and competitive budget response. Design budget performance monitoring, allocation optimization algorithms, and strategic budget planning.",
        description: 'Dynamic budget optimization with performance-driven allocation'
      },
      
      // Content Marketing (3 prompts)
      {
        id: 'content-calendar',
        category: 'Content Marketing',
        title: 'Strategic Content Marketing & SEO Framework',
        prompt: "Create comprehensive content marketing strategy integrating our persona insights, competitive positioning, and SEO objectives. Design content calendar planning, topic research methodologies, content optimization frameworks, and distribution strategies. Include content performance measurement, SEO optimization, and content personalization strategies. Build content automation, performance tracking, and content ROI optimization systems.",
        description: 'Content marketing excellence with SEO and persona integration'
      },
      {
        id: 'thought-leadership',
        category: 'Content Marketing',
        title: 'Thought Leadership & Brand Authority Strategy',
        prompt: "Develop thought leadership strategy using our competitive differentiation and market positioning insights. Create authority building content, industry leadership positioning, expert content frameworks, and brand credibility enhancement. Include thought leadership measurement, industry influence tracking, and authority monetization strategies. Design thought leadership automation, expert positioning, and industry leadership optimization.",
        description: 'Thought leadership with competitive differentiation and authority building'
      },
      {
        id: 'content-distribution',
        category: 'Content Marketing',
        title: 'Content Distribution & Amplification Strategy',
        prompt: "Design content distribution and amplification strategy leveraging our acquisition channels and viral growth mechanisms. Create omnichannel distribution, content syndication, social amplification, and earned media strategies. Include content performance optimization, distribution automation, and amplification measurement. Build distribution optimization, viral content strategies, and content reach maximization systems.",
        description: 'Content distribution with viral amplification and channel integration'
      },
      
      // Email Marketing (3 prompts)
      {
        id: 'email-sequences',
        category: 'Email Marketing',
        title: 'Advanced Email Marketing Automation & Personalization',
        prompt: "Build advanced email marketing automation using our customer psychology insights and journey mapping analysis. Create personalized email sequences, behavioral trigger campaigns, lifecycle email automation, and conversion optimization workflows. Include email psychology optimization, personalization strategies, and segmentation automation. Design email performance optimization, deliverability enhancement, and email ROI maximization.",
        description: 'Email automation with psychology and personalization optimization'
      },
      {
        id: 'email-segmentation',
        category: 'Email Marketing',
        title: 'Email Segmentation & Behavioral Targeting',
        prompt: "Design sophisticated email segmentation strategy using our persona insights and behavioral analytics. Create dynamic segmentation, behavioral trigger segmentation, psychographic email targeting, and personalization automation. Include segmentation performance analysis, segment optimization, and targeting refinement. Build segmentation automation, behavioral prediction, and email targeting optimization systems.",
        description: 'Email segmentation with behavioral psychology and targeting precision'
      },
      {
        id: 'email-optimization',
        category: 'Email Marketing',
        title: 'Email Performance Optimization & Testing',
        prompt: "Optimize email performance using our conversion psychology insights and testing frameworks. Create email A/B testing, subject line optimization, email design testing, and send time optimization. Include email psychology principles, conversion optimization, and engagement enhancement. Design email testing automation, performance prediction, and email optimization systems.",
        description: 'Email optimization with psychology and systematic testing integration'
      },
      
      // Partnership Marketing (3 prompts)
      {
        id: 'influencer-outreach',
        category: 'Partnership Marketing',
        title: 'Influencer Marketing & Creator Economy Strategy',
        prompt: "Create comprehensive influencer marketing strategy integrating our brand positioning and target audience insights. Design influencer identification, outreach automation, collaboration frameworks, and performance measurement systems. Include micro-influencer strategies, creator economy participation, and influencer ROI optimization. Build influencer relationship management, campaign automation, and influencer performance tracking.",
        description: 'Influencer marketing with brand alignment and performance optimization'
      },
      {
        id: 'affiliate-program',
        category: 'Partnership Marketing',
        title: 'Affiliate Program & Partner Network Development',
        prompt: "Build affiliate program and partner network using our channel strategy and partnership frameworks. Create affiliate recruitment, commission structures, partner enablement, and performance management systems. Include affiliate optimization, partnership automation, and network scaling strategies. Design affiliate tracking, performance optimization, and partner relationship management systems.",
        description: 'Affiliate program development with partner network optimization'
      },
      {
        id: 'strategic-partnerships',
        category: 'Partnership Marketing',
        title: 'Strategic Partnership & Co-Marketing Framework',
        prompt: "Develop strategic partnership and co-marketing strategy leveraging our competitive positioning and market opportunities. Create partnership identification, collaboration frameworks, co-marketing campaigns, and mutual value creation. Include partnership performance measurement, strategic alignment optimization, and partnership scaling strategies. Build partnership automation, relationship management, and co-marketing optimization systems.",
        description: 'Strategic partnerships with co-marketing and mutual value optimization'
      },
      
      // Conversion Optimization (3 prompts)
      {
        id: 'landing-page-guide',
        category: 'Conversion Optimization',
        title: 'Landing Page Psychology & Conversion Optimization',
        prompt: "Optimize landing page performance using our behavioral psychology insights and conversion optimization strategies. Create landing page psychology frameworks, conversion element optimization, user experience enhancement, and testing methodologies. Include psychological conversion principles, persona-specific landing pages, and conversion automation. Design landing page performance prediction, optimization systems, and conversion rate maximization.",
        description: 'Landing page optimization with psychology and systematic testing'
      },
      {
        id: 'cro-testing',
        category: 'Conversion Optimization',
        title: 'Conversion Rate Optimization & User Experience',
        prompt: "Design comprehensive CRO strategy integrating our customer psychology insights and user journey optimization. Create CRO testing frameworks, user experience optimization, conversion barrier removal, and psychological trigger implementation. Include CRO automation, testing prioritization, and conversion prediction. Build CRO performance monitoring, optimization systems, and conversion intelligence generation.",
        description: 'CRO excellence with psychology and user experience optimization'
      },
      {
        id: 'funnel-conversion',
        category: 'Conversion Optimization',
        title: 'Acquisition Funnel & Conversion Psychology',
        prompt: "Optimize acquisition funnel using our customer psychology insights and funnel optimization strategies. Create acquisition funnel analysis, psychological funnel design, conversion optimization, and user flow enhancement. Include funnel personalization, conversion psychology implementation, and funnel automation. Design funnel performance prediction, optimization systems, and acquisition conversion maximization.",
        description: 'Acquisition funnel with psychology and conversion optimization'
      },
      
      // Emerging Channels (2 prompts)
      {
        id: 'emerging-channels',
        category: 'Emerging Channels',
        title: 'Emerging Platform Strategy & Innovation',
        prompt: "Develop emerging platform acquisition strategy using our innovation framework and early adopter insights. Create TikTok marketing, Clubhouse engagement, Web3 marketing, NFT strategies, and emerging platform optimization. Include early platform adoption, innovative acquisition tactics, and emerging channel performance measurement. Build platform experimentation, innovation tracking, and emerging channel optimization systems.",
        description: 'Emerging platform strategy with innovation and early adoption focus'
      },
      {
        id: 'growth-tactics',
        category: 'Emerging Channels',
        title: 'Innovative Acquisition Tactics & Creative Growth',
        prompt: "Create innovative acquisition tactics using our creative growth insights and unconventional strategy frameworks. Design guerrilla marketing, viral acquisition tactics, creative channel strategies, and innovative growth mechanisms. Include acquisition innovation, creative testing, and unconventional channel optimization. Build innovation measurement, creative acquisition tracking, and innovative growth optimization systems.",
        description: 'Innovative acquisition with creative tactics and unconventional strategies'
      }
    ],
    'head-of-retention': [
      // Customer Onboarding (4 prompts)  
      {
        id: 'onboarding-flow',
        category: 'Customer Onboarding',
        title: 'Advanced Customer Onboarding & Activation',
        prompt: "Design comprehensive customer onboarding strategy using our persona psychology insights and product experience optimization. Create personalized onboarding journeys, activation milestone design, success metric frameworks, and onboarding optimization strategies. Include psychological onboarding principles, friction reduction, and engagement enhancement. Build onboarding automation, performance tracking, and activation rate optimization systems.",
        description: 'Onboarding excellence with psychology and personalization optimization'
      },
      {
        id: 'activation-optimization',
        category: 'Customer Onboarding',
        title: 'Customer Activation & First Value Optimization',
        prompt: "Optimize customer activation using our customer psychology insights and product-market fit analysis. Create first-value optimization, activation funnel design, time-to-value reduction, and activation psychology frameworks. Include activation personalization, behavioral activation triggers, and activation automation. Design activation measurement, optimization systems, and activation rate maximization strategies.",
        description: 'Activation optimization with psychology and time-to-value focus'
      },
      {
        id: 'onboarding-personalization',
        category: 'Customer Onboarding',
        title: 'Personalized Onboarding & Customer Journey',
        prompt: "Create personalized onboarding experiences using our persona insights and customer journey mapping. Design dynamic onboarding paths, persona-specific experiences, behavioral onboarding adaptation, and journey personalization. Include onboarding segmentation, experience optimization, and personalization automation. Build onboarding intelligence, adaptive experiences, and personalization performance systems.",
        description: 'Onboarding personalization with persona and journey integration'
      },
      {
        id: 'success-metrics',
        category: 'Customer Onboarding',
        title: 'Onboarding Success Metrics & Optimization',
        prompt: "Design onboarding success measurement using our growth metrics and customer success insights. Create onboarding KPIs, success milestone tracking, completion optimization, and performance measurement systems. Include predictive onboarding analytics, success prediction, and optimization automation. Build onboarding dashboards, performance monitoring, and success optimization systems.",
        description: 'Onboarding measurement with predictive analytics and optimization'
      },
      
      // Lifecycle Marketing (3 prompts)
      {
        id: 'lifecycle-automation',
        category: 'Lifecycle Marketing',
        title: 'Advanced Lifecycle Marketing Automation',
        prompt: "Build sophisticated lifecycle marketing automation using our customer psychology insights and behavioral analytics. Create behavioral trigger campaigns, lifecycle stage automation, personalized messaging sequences, and engagement optimization workflows. Include lifecycle personalization, behavioral prediction, and automation optimization. Design lifecycle performance tracking, optimization systems, and engagement maximization strategies.",
        description: 'Lifecycle automation with behavioral psychology and personalization'
      },
      {
        id: 'retention-campaigns',
        category: 'Lifecycle Marketing',
        title: 'Retention Campaign Strategy & Optimization',
        prompt: "Create comprehensive retention campaign strategy integrating our customer psychology insights and engagement optimization. Design retention email sequences, engagement campaigns, milestone celebrations, and retention optimization workflows. Include retention psychology principles, campaign personalization, and engagement enhancement. Build retention automation, performance tracking, and retention rate optimization systems.",
        description: 'Retention campaigns with psychology and engagement optimization'
      },
      {
        id: 'behavioral-triggers',
        category: 'Lifecycle Marketing',
        title: 'Behavioral Trigger Campaigns & Automation',
        prompt: "Design behavioral trigger campaigns using our customer behavior insights and automation frameworks. Create trigger identification, automated campaign responses, behavioral segmentation, and trigger optimization strategies. Include psychological trigger design, response optimization, and trigger performance measurement. Build trigger automation, behavioral monitoring, and trigger effectiveness optimization systems.",
        description: 'Behavioral triggers with psychology and automation optimization'
      },
      
      // Churn Prevention (3 prompts)
      {
        id: 'churn-prevention',
        category: 'Churn Prevention',
        title: 'Predictive Churn Prevention & Intervention',
        prompt: "Build predictive churn prevention system using our customer psychology insights and behavioral analytics. Create churn prediction modeling, early warning systems, intervention strategies, and prevention automation. Include churn psychology analysis, intervention optimization, and prevention personalization. Design churn monitoring, prediction accuracy improvement, and intervention effectiveness optimization.",
        description: 'Predictive churn prevention with ML and intervention optimization'
      },
      {
        id: 'win-back-campaigns',
        category: 'Churn Prevention',
        title: 'Customer Win-Back & Reactivation Strategy',
        prompt: "Create customer win-back strategy using our customer psychology insights and retention optimization frameworks. Design win-back campaign sequences, reactivation strategies, incentive optimization, and re-engagement workflows. Include win-back psychology principles, campaign personalization, and reactivation automation. Build win-back performance tracking, optimization systems, and reactivation rate maximization.",
        description: 'Win-back strategies with psychology and reactivation optimization'
      },
      {
        id: 'intervention-strategies',
        category: 'Churn Prevention',
        title: 'Churn Intervention & Risk Mitigation',
        prompt: "Design churn intervention strategies using our customer success insights and risk management frameworks. Create intervention protocols, risk mitigation strategies, proactive outreach systems, and intervention optimization. Include intervention psychology, personalized intervention, and automated intervention workflows. Build intervention tracking, effectiveness measurement, and intervention optimization systems.",
        description: 'Churn intervention with proactive risk mitigation and optimization'
      },
      
      // Customer Success (3 prompts)
      {
        id: 'customer-success',
        category: 'Customer Success',
        title: 'Customer Success Program & Health Scoring',
        prompt: "Create comprehensive customer success program using our customer psychology insights and success measurement frameworks. Design health scoring systems, success milestone tracking, proactive outreach strategies, and success optimization workflows. Include success psychology principles, personalized success paths, and success automation. Build success monitoring, optimization systems, and customer success maximization.",
        description: 'Customer success with health scoring and proactive optimization'
      },
      {
        id: 'expansion-revenue',
        category: 'Customer Success',
        title: 'Customer Expansion & Revenue Optimization',
        prompt: "Design customer expansion strategy using our customer psychology insights and revenue optimization frameworks. Create upselling strategies, cross-selling optimization, expansion opportunity identification, and revenue growth automation. Include expansion psychology principles, opportunity personalization, and expansion automation. Build expansion tracking, optimization systems, and revenue expansion maximization.",
        description: 'Customer expansion with psychology and revenue optimization'
      },
      {
        id: 'success-automation',
        category: 'Customer Success',
        title: 'Customer Success Automation & Optimization',
        prompt: "Build customer success automation using our customer behavior insights and success optimization frameworks. Create automated success workflows, proactive success interventions, success personalization, and optimization automation. Include success psychology automation, behavioral success triggers, and success intelligence systems. Design success automation monitoring, optimization, and success rate maximization.",
        description: 'Success automation with behavioral intelligence and optimization'
      },
      
      // Loyalty & Engagement (3 prompts)
      {
        id: 'loyalty-program',
        category: 'Loyalty & Engagement',
        title: 'Customer Loyalty Program & Gamification',
        prompt: "Create comprehensive loyalty program using our customer psychology insights and engagement optimization strategies. Design loyalty tier structures, reward optimization, gamification elements, and engagement enhancement systems. Include loyalty psychology principles, program personalization, and loyalty automation. Build loyalty tracking, optimization systems, and loyalty program performance maximization.",
        description: 'Loyalty programs with gamification and psychology optimization'
      },
      {
        id: 'engagement-optimization',
        category: 'Loyalty & Engagement',
        title: 'Customer Engagement & Community Building',
        prompt: "Design customer engagement strategy using our community building insights and engagement psychology frameworks. Create engagement optimization, community building strategies, social engagement systems, and engagement automation workflows. Include engagement psychology principles, community personalization, and engagement intelligence. Build engagement monitoring, optimization systems, and engagement rate maximization.",
        description: 'Engagement optimization with community building and psychology'
      },
      {
        id: 'advocacy-program',
        category: 'Loyalty & Engagement',
        title: 'Customer Advocacy & Referral Psychology',
        prompt: "Build customer advocacy program using our viral growth insights and advocacy psychology frameworks. Create advocacy identification, referral optimization, advocacy automation, and advocacy reward systems. Include advocacy psychology principles, referral personalization, and advocacy intelligence systems. Design advocacy tracking, optimization strategies, and advocacy program performance maximization.",
        description: 'Customer advocacy with viral psychology and referral optimization'
      },
      
      // Customer Psychology (2 prompts)
      {
        id: 'retention-psychology',
        category: 'Customer Psychology',
        title: 'Retention Psychology & Behavioral Economics',
        prompt: "Apply retention psychology using our behavioral economics insights and customer psychology frameworks. Create retention psychology principles, behavioral retention strategies, psychological retention triggers, and retention optimization systems. Include psychological retention personalization, behavioral retention automation, and retention psychology intelligence. Build retention psychology monitoring, optimization, and retention rate maximization.",
        description: 'Retention psychology with behavioral economics and optimization'
      },
      {
        id: 'customer-psychology',
        category: 'Customer Psychology',
        title: 'Customer Psychology & Lifecycle Optimization',
        prompt: "Optimize customer lifecycle using our customer psychology insights and lifecycle optimization frameworks. Create lifecycle psychology principles, psychological lifecycle strategies, customer psychology automation, and lifecycle intelligence systems. Include psychology-driven personalization, behavioral lifecycle optimization, and psychological automation. Build psychology monitoring, lifecycle optimization, and customer psychology maximization.",
        description: 'Customer psychology with lifecycle optimization and automation'
      }
    ],
    'viral-growth-architect': [
      // Viral Loops (4 prompts)
      {
        id: 'viral-loops',
        category: 'Viral Loops',
        title: 'Advanced Viral Loop Design & Optimization',
        prompt: "Design sophisticated viral loops integrating our customer psychology insights, product features, and sharing behaviors. Create viral loop architecture, friction reduction strategies, sharing trigger optimization, and viral coefficient maximization. Include psychological sharing motivations, viral loop personalization, and loop automation systems. Build viral loop tracking, optimization frameworks, and viral growth acceleration strategies.",
        description: 'Viral loop optimization with psychology and friction reduction'
      },
      {
        id: 'loop-measurement',
        category: 'Viral Loops',
        title: 'Viral Loop Measurement & Analytics',
        prompt: "Build viral loop measurement systems using our growth analytics and viral psychology insights. Create viral coefficient tracking, loop performance analysis, sharing behavior measurement, and viral attribution systems. Include predictive viral analytics, loop optimization measurement, and viral intelligence generation. Design viral dashboards, performance monitoring, and viral growth optimization systems.",
        description: 'Viral loop analytics with coefficient optimization and intelligence'
      },
      {
        id: 'loop-automation',
        category: 'Viral Loops',
        title: 'Viral Loop Automation & Optimization',
        prompt: "Create viral loop automation using our behavioral insights and growth automation frameworks. Design automated sharing triggers, viral loop optimization, sharing personalization, and viral automation workflows. Include viral psychology automation, behavioral sharing triggers, and viral intelligence systems. Build viral automation monitoring, optimization strategies, and viral loop performance maximization.",
        description: 'Viral loop automation with behavioral triggers and optimization'
      },
      {
        id: 'sharing-psychology',
        category: 'Viral Loops',
        title: 'Sharing Psychology & Viral Triggers',
        prompt: "Apply sharing psychology using our customer psychology insights and viral behavior frameworks. Create psychological sharing triggers, viral motivation analysis, sharing behavior optimization, and viral psychology systems. Include sharing personalization, psychological viral triggers, and sharing intelligence generation. Design sharing psychology monitoring, optimization, and viral sharing maximization strategies.",
        description: 'Sharing psychology with viral triggers and behavior optimization'
      },
      
      // Referral Programs (3 prompts)
      {
        id: 'referral-program',
        category: 'Referral Programs',
        title: 'Advanced Referral Program & Incentive Design',
        prompt: "Create sophisticated referral program using our customer psychology insights and retention optimization strategies. Design referral incentive structures, reward optimization, referral psychology frameworks, and program automation systems. Include referral personalization, incentive psychology, and referral intelligence systems. Build referral tracking, optimization strategies, and referral program performance maximization.",
        description: 'Referral programs with psychology and incentive optimization'
      },
      {
        id: 'referral-optimization',
        category: 'Referral Programs',
        title: 'Referral Program Optimization & Performance',
        prompt: "Optimize referral program performance using our viral growth insights and referral psychology frameworks. Create referral optimization strategies, performance enhancement systems, referral automation workflows, and optimization intelligence. Include referral personalization, performance prediction, and referral optimization automation. Design referral monitoring, optimization systems, and referral performance maximization.",
        description: 'Referral optimization with performance enhancement and automation'
      },
      {
        id: 'referral-automation',
        category: 'Referral Programs',
        title: 'Referral Program Automation & Intelligence',
        prompt: "Build referral program automation using our automation insights and referral optimization frameworks. Create automated referral workflows, intelligent referral systems, referral personalization automation, and referral intelligence generation. Include referral psychology automation, behavioral referral triggers, and referral optimization systems. Design referral automation monitoring, optimization, and referral automation maximization.",
        description: 'Referral automation with intelligence and behavioral optimization'
      },
      
      // Social Sharing (3 prompts)
      {
        id: 'social-sharing',
        category: 'Social Sharing',
        title: 'Social Sharing Strategy & Platform Optimization',
        prompt: "Create comprehensive social sharing strategy using our social psychology insights and platform optimization frameworks. Design platform-specific sharing strategies, social sharing optimization, content sharing enhancement, and social amplification systems. Include social psychology principles, sharing personalization, and social intelligence generation. Build social sharing monitoring, optimization systems, and social sharing performance maximization.",
        description: 'Social sharing with platform optimization and psychology integration'
      },
      {
        id: 'viral-content',
        category: 'Social Sharing',
        title: 'Viral Content Strategy & Amplification',
        prompt: "Design viral content strategy using our content insights and viral psychology frameworks. Create viral content frameworks, content virality optimization, sharing content enhancement, and content amplification systems. Include content psychology principles, viral content personalization, and content intelligence generation. Build viral content monitoring, optimization systems, and content virality maximization.",
        description: 'Viral content with amplification and psychology optimization'
      },
      {
        id: 'social-amplification',
        category: 'Social Sharing',
        title: 'Social Media Amplification & Viral Distribution',
        prompt: "Build social media amplification using our social media insights and distribution optimization frameworks. Create amplification strategies, viral distribution systems, social media optimization, and amplification automation workflows. Include amplification personalization, social media intelligence, and distribution optimization. Design amplification monitoring, optimization systems, and social amplification maximization.",
        description: 'Social amplification with distribution and optimization systems'
      },
      
      // Network Effects (3 prompts)
      {
        id: 'network-effects',
        category: 'Network Effects',
        title: 'Network Effects Design & Marketplace Dynamics',
        prompt: "Design network effects using our platform insights and marketplace optimization frameworks. Create network effect architecture, marketplace dynamics optimization, user interaction enhancement, and network value creation systems. Include network psychology principles, network personalization, and network intelligence generation. Build network monitoring, optimization systems, and network effect maximization strategies.",
        description: 'Network effects with marketplace dynamics and value creation'
      },
      {
        id: 'platform-effects',
        category: 'Network Effects',
        title: 'Platform Network Effects & User Value Creation',
        prompt: "Build platform network effects using our platform strategy insights and user value optimization frameworks. Create platform effect systems, user value enhancement, network optimization workflows, and platform intelligence generation. Include platform personalization, network effect automation, and platform optimization. Design platform monitoring, optimization systems, and platform network effect maximization.",
        description: 'Platform effects with user value creation and optimization'
      },
      {
        id: 'network-optimization',
        category: 'Network Effects',
        title: 'Network Effect Optimization & Intelligence',
        prompt: "Optimize network effects using our network insights and optimization intelligence frameworks. Create network optimization strategies, effect enhancement systems, network automation workflows, and network intelligence generation. Include network personalization, effect prediction, and network optimization automation. Design network monitoring, optimization systems, and network effect performance maximization.",
        description: 'Network optimization with intelligence and performance enhancement'
      },
      
      // Community Building (3 prompts)
      {
        id: 'community-strategy',
        category: 'Community Building',
        title: 'Community Building Strategy & Engagement',
        prompt: "Create comprehensive community strategy using our community insights and engagement optimization frameworks. Design community building systems, engagement enhancement strategies, community optimization workflows, and community intelligence generation. Include community psychology principles, engagement personalization, and community automation. Build community monitoring, optimization systems, and community engagement maximization.",
        description: 'Community building with engagement optimization and psychology'
      },
      {
        id: 'ugc-strategy',
        category: 'Community Building',
        title: 'User-Generated Content & Community Growth',
        prompt: "Design user-generated content strategy using our content insights and community growth frameworks. Create UGC optimization systems, content generation enhancement, community content strategies, and UGC intelligence generation. Include content psychology principles, UGC personalization, and content automation. Build UGC monitoring, optimization systems, and user-generated content maximization.",
        description: 'UGC strategy with community growth and content optimization'
      },
      {
        id: 'community-automation',
        category: 'Community Building',
        title: 'Community Automation & Growth Intelligence',
        prompt: "Build community automation using our automation insights and community optimization frameworks. Create automated community workflows, intelligent community systems, community personalization automation, and community intelligence generation. Include community psychology automation, behavioral community triggers, and community optimization systems. Design community automation monitoring, optimization, and community automation maximization.",
        description: 'Community automation with intelligence and growth optimization'
      },
      
      // Gamification (2 prompts)
      {
        id: 'gamification-framework',
        category: 'Gamification',
        title: 'Gamification Strategy & Behavioral Design',
        prompt: "Create gamification strategy using our behavioral psychology insights and engagement optimization frameworks. Design gamification systems, behavioral game design, engagement gamification, and gamification intelligence generation. Include game psychology principles, gamification personalization, and game automation. Build gamification monitoring, optimization systems, and gamification engagement maximization.",
        description: 'Gamification with behavioral psychology and engagement optimization'
      },
      {
        id: 'engagement-mechanics',
        category: 'Gamification',
        title: 'Engagement Mechanics & Behavioral Systems',
        prompt: "Design engagement mechanics using our engagement insights and behavioral system frameworks. Create engagement optimization systems, behavioral engagement design, mechanics enhancement strategies, and engagement intelligence generation. Include engagement psychology principles, mechanics personalization, and engagement automation. Build engagement monitoring, optimization systems, and engagement mechanics maximization.",
        description: 'Engagement mechanics with behavioral systems and optimization'
      }
    ],
    'growth-hacker': [
      // Experimentation Framework (4 prompts)
      {
        id: 'experiment-design-advanced',
        category: 'Experimentation Framework',
        title: 'Advanced Growth Experiment Design',
        prompt: "Based on our complete 8-agent growth strategy context, design a comprehensive experimentation framework with specific A/B tests prioritized by ICE score (Impact, Confidence, Ease). Include statistical significance requirements, sample size calculations, and testing methodologies for our funnel optimization, acquisition channels, and retention experiments. Provide a detailed 90-day testing roadmap with specific hypotheses and success metrics.",
        description: 'Strategic experiment design with full growth context integration'
      },
      {
        id: 'hypothesis-framework',
        category: 'Experimentation Framework',
        title: 'Growth Hypothesis Generation System',
        prompt: "Using insights from our persona strategy, product positioning, and growth funnel analysis, create a systematic hypothesis generation framework. Develop 20 testable hypotheses across acquisition, activation, retention, and revenue optimization. For each hypothesis, provide the underlying assumption, expected outcome, measurement criteria, and connection to our North Star metrics from the Growth Manager's framework.",
        description: 'Data-driven hypothesis creation with strategic alignment'
      },
      {
        id: 'statistical-testing',
        category: 'Experimentation Framework',
        title: 'Statistical Rigor & Test Validity',
        prompt: "Design a statistical testing methodology that ensures experiment validity and actionable insights. Include power analysis, significance testing, multiple testing corrections, and approaches for handling novelty effects, selection bias, and confounding variables. Provide templates for experiment documentation, results interpretation, and decision-making frameworks that align with our growth strategy priorities.",
        description: 'Scientific rigor in growth experimentation'
      },
      {
        id: 'experiment-prioritization',
        category: 'Experimentation Framework',
        title: 'Strategic Experiment Prioritization',
        prompt: "Create a comprehensive experiment prioritization system that balances quick wins with strategic bets. Using our complete growth strategy context, prioritize experiments across the full customer journey - from awareness (GTM strategy) through activation (product strategy) to retention (lifecycle strategy). Include resource allocation, timeline management, and cross-functional coordination with our agent team's recommendations.",
        description: 'Strategic experiment roadmap with resource optimization'
      },
      
      // Conversion Optimization (4 prompts)
      {
        id: 'funnel-optimization',
        category: 'Conversion Optimization',
        title: 'Advanced Funnel Conversion Optimization',
        prompt: "Using our Growth Manager's funnel analysis and customer journey insights from the Persona Strategist, design specific conversion optimization experiments for each funnel stage. Focus on micro-conversions, friction reduction, and psychological triggers from Cialdini's principles. Provide detailed wireframes, copy variations, and behavioral psychology applications that align with our target personas' decision-making patterns.",
        description: 'Psychology-driven conversion optimization with funnel context'
      },
      {
        id: 'landing-page-experiments',
        category: 'Conversion Optimization',
        title: 'Landing Page Experimentation Strategy',
        prompt: "Create a comprehensive landing page optimization strategy using our brand positioning and value proposition from the Product Manager and GTM Consultant. Design experiments for headline variations, social proof placement, CTA optimization, and page flow based on our customer personas' behavioral patterns. Include mobile optimization, loading speed tests, and personalization experiments for different traffic sources.",
        description: 'Strategic landing page optimization with brand alignment'
      },
      {
        id: 'checkout-optimization',
        category: 'Conversion Optimization',
        title: 'Revenue Conversion & Checkout Optimization',
        prompt: "Using insights from our retention strategy and pricing analysis, design experiments to optimize the purchase/signup process. Focus on form optimization, payment friction reduction, trust signals, urgency creation, and offer presentation based on our customer psychology analysis. Include cart abandonment recovery experiments and pricing psychology tests that align with our revenue goals.",
        description: 'Revenue-focused conversion experiments with customer psychology'
      },
      {
        id: 'personalization-experiments',
        category: 'Conversion Optimization',
        title: 'Dynamic Personalization Testing',
        prompt: "Design personalization experiments using our detailed persona segments and behavioral insights. Create dynamic content experiments for different user types, traffic sources, and journey stages. Include AI-powered personalization strategies, behavioral triggers, and content adaptation based on user actions. Provide implementation guidance for personalization engines and real-time optimization systems.",
        description: 'Advanced personalization with AI-driven optimization'
      },
      
      // Growth Analytics (3 prompts)
      {
        id: 'analytics-architecture',
        category: 'Growth Analytics',
        title: 'Comprehensive Growth Analytics System',
        prompt: "Design a complete growth analytics architecture that tracks our North Star metrics, funnel performance, cohort behavior, and experiment results. Include event tracking specifications, dashboard design, attribution modeling, and real-time monitoring systems. Connect analytics to our complete growth strategy - from acquisition channels through retention programs to viral mechanics - ensuring every strategic initiative is measurable.",
        description: 'End-to-end analytics system with strategic measurement alignment'
      },
      {
        id: 'cohort-experimentation',
        category: 'Growth Analytics',
        title: 'Advanced Cohort Analysis & Testing',
        prompt: "Create sophisticated cohort analysis methodologies that reveal actionable growth insights from our user segments. Design experiments within cohorts, longitudinal studies, and behavioral segmentation tests that inform our retention strategy and lifecycle marketing. Include predictive cohort modeling, churn forecasting, and lifetime value optimization experiments based on our customer journey mapping.",
        description: 'Strategic cohort analysis with predictive modeling'
      },
      {
        id: 'attribution-modeling',
        category: 'Growth Analytics',
        title: 'Multi-Touch Attribution & Channel Optimization',
        prompt: "Develop advanced attribution modeling that accurately measures the impact of our acquisition channels, content marketing, and referral programs. Create experiments to test different attribution models, optimize channel mix, and improve ROI measurement across the complete customer journey. Include incrementality testing, media mix modeling, and cross-channel interaction analysis aligned with our acquisition strategy.",
        description: 'Advanced attribution with cross-channel optimization'
      },
      
      // Creative Growth Tactics (4 prompts)
      {
        id: 'viral-experiments',
        category: 'Creative Growth Tactics',
        title: 'Viral Growth Experimentation',
        prompt: "Using our Viral Growth Architect's strategy and social sharing mechanisms, design creative experiments to amplify viral coefficient and referral rates. Create tests for sharing incentives, social proof displays, network effects optimization, and community-driven growth. Include gamification experiments, user-generated content strategies, and viral loop optimization that align with our brand personality and customer motivations.",
        description: 'Viral growth experiments with strategic amplification'
      },
      {
        id: 'partnership-experiments',
        category: 'Creative Growth Tactics',
        title: 'Strategic Partnership & Cross-Promotion Tests',
        prompt: "Design partnership and cross-promotion experiments that leverage our market positioning and customer insights. Create tests for co-marketing campaigns, integration partnerships, affiliate programs, and strategic alliances. Include partner onboarding experiments, revenue sharing optimization, and cross-pollination strategies that expand our reach while maintaining brand integrity and customer experience quality.",
        description: 'Partnership-driven growth with strategic alignment'
      },
      {
        id: 'content-growth',
        category: 'Creative Growth Tactics',
        title: 'Content-Driven Growth Experiments',
        prompt: "Create content marketing experiments that drive sustainable growth using our SEO strategy, thought leadership positioning, and customer education needs. Design tests for content formats, distribution channels, engagement mechanisms, and conversion optimization. Include interactive content experiments, user-generated content campaigns, and educational series that build authority while driving acquisition and retention.",
        description: 'Content marketing growth with thought leadership positioning'
      },
      {
        id: 'community-experiments',
        category: 'Creative Growth Tactics',
        title: 'Community-Powered Growth Strategy',
        prompt: "Design community-building experiments that create sustainable growth engines using our customer personas and engagement strategies. Create tests for community platforms, user onboarding, content creation incentives, and peer-to-peer learning systems. Include community gamification, expert programs, and advocacy development that transforms customers into growth drivers while enhancing product value and retention.",
        description: 'Community-driven growth with customer advocacy'
      },
      
      // Growth Technology (3 prompts)
      {
        id: 'growth-stack-optimization',
        category: 'Growth Technology',
        title: 'Advanced Growth Technology Stack',
        prompt: "Design a comprehensive growth technology stack that supports our complete experimentation framework, analytics needs, and automation requirements. Include tools for A/B testing, personalization, marketing automation, analytics, customer data platforms, and integration systems. Provide cost-benefit analysis, implementation timelines, and team training requirements that align with our growth strategy execution needs.",
        description: 'Strategic technology stack with ROI optimization'
      },
      {
        id: 'automation-experiments',
        category: 'Growth Technology',
        title: 'Growth Automation & AI Integration',
        prompt: "Create experiments with growth automation, AI-powered optimization, and machine learning applications using our customer data and behavioral insights. Design tests for automated personalization, predictive recommendations, intelligent segmentation, and dynamic pricing. Include chatbot optimization, automated email sequences, and AI-driven content creation that scale our growth efforts while maintaining personalization quality.",
        description: 'AI-powered growth automation with intelligent optimization'
      },
      {
        id: 'integration-testing',
        category: 'Growth Technology',
        title: 'Cross-Platform Integration Optimization',
        prompt: "Design integration experiments that optimize data flow, user experience, and conversion tracking across our complete technology ecosystem. Create tests for API performance, data synchronization, cross-platform user journeys, and tool consolidation. Include implementation of growth data warehouses, real-time decision engines, and unified customer profiles that support our multi-channel growth strategy execution.",
        description: 'Technology integration with unified growth operations'
      }
    ]
  };

  return promptsMap[agentId] || [];
}