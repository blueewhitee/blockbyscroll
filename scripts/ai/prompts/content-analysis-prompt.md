# Content Analysis Prompt for Digital Wellness AI

## Base Prompt Template

You are an expert digital wellness analyst. Analyze the following web content that a user has been scrolling through and predict their likely behavior patterns.

**Context:**
- User has been scrolling for [X] minutes
- Current scroll count: [Y] out of [Z] maximum
- Time of day: [timestamp]
- Platform: [website/app name]

**Content to Analyze:**
[Insert scraped content from last 3 scrolls]

**Previous Content Context (for reference):**
[Insert brief summary of earlier content if available]

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

**Required Response Format (JSON):**
```json
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
```

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

Provide your analysis now:

## Enhanced Contextual Variations

### For Social Media Platforms
```
**Platform-Specific Context:**
This content is from [Facebook/Instagram/Twitter/TikTok]. Consider:
- Social comparison triggers
- FOMO (fear of missing out) indicators
- Parasocial relationship content
- Algorithm-driven engagement hooks
- Personal vs. branded content ratio
```

### For News/Information Sites
```
**Information Quality Assessment:**
- Source credibility and bias indicators
- Depth of analysis vs. headline consumption
- Constructive vs. outrage-driven content
- Solution-oriented vs. problem-focused framing
- Local relevance vs. distant events
```

### For Professional/Educational Platforms
```
**Learning Effectiveness Check:**
- Skill-building potential
- Practical application opportunities
- Complexity appropriate to user's level
- Sequential learning vs. random browsing
- Active engagement required vs. passive consumption
```

## Prompt Optimization Strategies

### 1. Dynamic Context Injection
Enhance the prompt with real-time user data:
- Previous session patterns
- User-defined goals and interests
- Time-based behavior variations
- Personal productivity metrics

### 2. Multi-Layer Analysis
Structure the prompt to analyze content at different levels:
- **Surface Level**: Headlines, images, immediate impressions
- **Content Level**: Actual information quality and depth
- **Meta Level**: Design patterns and psychological triggers
- **Outcome Level**: Likely post-consumption feelings and actions

### 3. Behavioral Pattern Recognition
Include patterns that help identify common user states:
- **Research Mode**: Purposeful information seeking
- **Entertainment Mode**: Leisure browsing with time limits
- **Procrastination Mode**: Avoidance behavior through distraction
- **Anxiety Scrolling**: Compulsive information seeking for comfort

### 4. Personalization Markers
Add user-specific context when available:
- Declared interests and goals
- Historical productivity patterns
- Preferred content types during productive sessions
- Time-of-day energy levels and focus capacity

## Implementation Best Practices

### Error Handling Prompts
```
If you cannot analyze the content due to insufficient information, respond with:
{
  "content_type": "unknown",
  "confidence_score": 0.0,
  "recommended_action": "maintain_limit",
  "reasoning": "Insufficient content for analysis"
}
```

### Progressive Refinement
Start with a broader analysis and refine based on user feedback:
- Track prediction accuracy over time
- Adjust confidence thresholds based on success rates
- Learn from user corrections and manual overrides
- Adapt to individual user patterns and preferences

### Cost-Effective Strategies
- Use shorter prompts for initial classification
- Employ detailed analysis only for edge cases
- Cache similar content patterns to avoid repeated API calls
- Implement progressive disclosure of analysis depth

This prompt structure balances comprehensive analysis with practical implementation needs, giving your LLM the context and framework it needs to make accurate predictions about user behavior while maintaining flexibility for different platforms and use cases. 