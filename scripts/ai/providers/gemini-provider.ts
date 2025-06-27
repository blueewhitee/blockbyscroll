/**
 * Google Gemini API provider for content analysis
 */

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AIAnalysisResponse {
  content_type: 'productive' | 'neutral' | 'entertainment' | 'doomscroll' | 'unknown';
  confidence_score: number;
  educational_value: number;
  addiction_risk: number;
  recommended_action: 'bonus_scrolls' | 'maintain_limit' | 'show_warning' | 'immediate_break';
  bonus_scrolls: number;
  reasoning: string;
  break_suggestion?: string;
}

export interface AIAnalysisRequest {
  content: string;
  context: {
    scrollCount: number;
    maxScrolls: number;
    domain: string;
    timestamp: number;
    timeOfDay: string;
    scrollTime: number; // minutes spent scrolling
  };
}

export class GeminiProvider {
  private config: GeminiConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: GeminiConfig) {
    this.config = {
      apiKey: config.apiKey || 'AIzaSyCYsgshv7TI7I2y5o6O6jvsaiB6PRRa30E',
      model: config.model || 'gemini-2.5-flash',
      temperature: config.temperature || 0.3,
      maxTokens: config.maxTokens || 1000
    };
  }

  /**
   * Analyze content using Gemini API
   */
  public async analyzeContent(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const prompt = this.buildPrompt(request);
      const response = await this.callGeminiAPI(prompt);
      return this.parseResponse(response);
    } catch (error) {
      console.error('GEMINI: Error analyzing content:', error);
      return this.getFallbackResponse(error);
    }
  }

  /**
   * Build the complete prompt with context
   */
  private buildPrompt(request: AIAnalysisRequest): string {
    const { content, context } = request;
    const scrollsRemaining = context.maxScrolls - context.scrollCount;
    
    // Load the base prompt template
    const basePrompt = this.getBasePromptTemplate();
    
    // Replace placeholders with actual values
    return basePrompt
      .replace('[X]', context.scrollTime.toString())
      .replace('[Y]', context.scrollCount.toString())
      .replace('[Z]', context.maxScrolls.toString())
      .replace('[timestamp]', context.timeOfDay)
      .replace('[website/app name]', context.domain)
      .replace('[Insert scraped content from last 3 scrolls]', content)
      .replace('[scrolls_remaining]', scrollsRemaining.toString());
  }

  /**
   * Get the base prompt template
   */
  private getBasePromptTemplate(): string {
    return `You are an expert digital wellness analyst. Analyze the following web content that a user has been scrolling through and predict their likely behavior patterns.

**Context:**
- User has been scrolling for [X] minutes
- Current scroll count: [Y] out of [Z] maximum
- Scrolls remaining: [scrolls_remaining]
- Time of day: [timestamp]
- Platform: [website/app name]

**Content to Analyze:**
[Insert scraped content from last 3 scrolls]

**Analysis Framework:**
Please evaluate this content across these dimensions:

1. **Content Value Assessment**
   - Educational/informational value (0-10)
   - Entertainment vs. productive learning ratio
   - Depth vs. superficial engagement level
   - Actionable insights provided

2. **Behavioral Trigger Analysis**
   - Addictive design patterns present (infinite scroll, cliffhangers, etc.)
   - Emotional manipulation indicators
   - Time-wasting potential
   - Cognitive load required

3. **User Engagement Prediction**
   - Likely to continue scrolling mindlessly (high/medium/low)
   - Probability of gaining meaningful value
   - Risk of entering "doomscroll" state
   - Potential for productive outcome

**Required Response Format (JSON only, no other text):**
{
  "content_type": "productive|neutral|entertainment|doomscroll",
  "confidence_score": 0.0-1.0,
  "educational_value": 0-10,
  "addiction_risk": 0-10,
  "recommended_action": "bonus_scrolls|maintain_limit|show_warning|immediate_break",
  "bonus_scrolls": 0-15,
  "reasoning": "Brief explanation of your assessment",
  "break_suggestion": "Specific alternative activity if break recommended"
}

**Decision Guidelines:**
- **Productive** (bonus_scrolls: 8-15): Educational content, tutorials, research, professional development
- **Neutral** (bonus_scrolls: 3-5): News, general interest, mixed value content  
- **Entertainment** (bonus_scrolls: 0-2): Social media, memes, celebrity content
- **Doomscroll** (immediate_break): Highly repetitive, rage-inducing, or mindless content

**Additional Considerations:**
- Factor in time spent vs. value gained ratio
- Consider if content builds on previous knowledge or is repetitive
- Assess whether user is likely learning or just consuming
- Evaluate if content encourages active thinking vs. passive consumption

Respond with ONLY the JSON object, no additional text:`;
  }

  /**
   * Call the Gemini API
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  }

  /**
   * Parse the AI response into structured format
   */
  private parseResponse(responseText: string): AIAnalysisResponse {
    try {
      // Clean up the response text in case there's extra whitespace or formatting
      const cleanedText = responseText.trim();
      const parsed = JSON.parse(cleanedText);
      
      // Validate the response structure
      return {
        content_type: parsed.content_type || 'unknown',
        confidence_score: Math.max(0, Math.min(1, parsed.confidence_score || 0)),
        educational_value: Math.max(0, Math.min(10, parsed.educational_value || 0)),
        addiction_risk: Math.max(0, Math.min(10, parsed.addiction_risk || 5)),
        recommended_action: parsed.recommended_action || 'maintain_limit',
        bonus_scrolls: Math.max(0, Math.min(15, parsed.bonus_scrolls || 0)),
        reasoning: parsed.reasoning || 'Analysis completed',
        break_suggestion: parsed.break_suggestion
      };
    } catch (error) {
      console.error('GEMINI: Error parsing response:', error);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Get fallback response when API fails
   */
  private getFallbackResponse(error: any): AIAnalysisResponse {
    console.error('GEMINI: Using fallback response due to error:', error);
    
    return {
      content_type: 'unknown',
      confidence_score: 0.0,
      educational_value: 5,
      addiction_risk: 5,
      recommended_action: 'maintain_limit',
      bonus_scrolls: 0,
      reasoning: 'AI analysis unavailable, maintaining original scroll limit',
      break_suggestion: 'Take a 5-minute break to rest your eyes'
    };
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testRequest: AIAnalysisRequest = {
        content: 'Test content for API validation',
        context: {
          scrollCount: 1,
          maxScrolls: 30,
          domain: 'test.com',
          timestamp: Date.now(),
          timeOfDay: new Date().toLocaleTimeString(),
          scrollTime: 1
        }
      };
      
      await this.analyzeContent(testRequest);
      return true;
    } catch (error) {
      console.error('GEMINI: Connection test failed:', error);
      return false;
    }
  }

  /**
   * Update API configuration
   */
  public updateConfig(newConfig: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
} 