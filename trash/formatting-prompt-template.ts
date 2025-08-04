// Formatting Prompt Template for Two-Stage LLM Processing
// This prompt takes raw strategic content and formats it into a professional document

export interface FormattingContext {
  rawContent: string;
  agentName: string;
  agentRole: string;
  userBusinessConcept?: string;
  sessionDate: string;
}

export function generateFormattingPrompt(context: FormattingContext): string {
  return `You are a professional document formatter and strategic communication expert. Your task is to take the raw strategic content provided and format it into a beautifully structured, professional GTM strategy document.

**Your Role:** Document Formatting Specialist
**Agent:** ${context.agentName} (${context.agentRole})
**Date:** ${context.sessionDate}

**FORMATTING INSTRUCTIONS:**

ke recommendations clear and specific

**OUTPUT FORMAT:**


**CONTENT TO FORMAT:**

${context.rawContent}

**IMPORTANT GUIDELINES:**

`;
}

export function generateExecutiveSummaryPrompt(
  context: FormattingContext
): string {
  return `
  
  

**Strategic Content:**
${context.rawContent}

**Executive Summary Format:**
• **Key Insight 1:** [Brief description]
• **Key Insight 2:** [Brief description]  
• **Key Insight 3:** [Brief description]
• **Recommended Next Step:** [Action item]

Keep it concise, actionable, and focused on the highest-impact elements.`;
}

export function generateActionPlanPrompt(context: FormattingContext): string {
  return `

**Strategic Content:**
${context.rawContent}

**Action Plan Format:**

## 🎯 Immediate Actions (Next 30 Days)
1. **[Action]** - [Brief description and rationale]
2. **[Action]** - [Brief description and rationale]

## 📈 Short-term Goals (30-90 Days)  
1. **[Goal]** - [Success criteria and key activities]
2. **[Goal]** - [Success criteria and key activities]

## 🚀 Long-term Objectives (90+ Days)
1. **[Objective]** - [Vision and major milestones]
2. **[Objective]** - [Vision and major milestones]

Focus on actionable, specific items with clear timelines and success criteria.`;
}
