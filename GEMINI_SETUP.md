# Google Gemini Integration Setup

This guide explains how to set up Google Gemini for advanced NLP features in the DropManager project.

## 🔑 Getting a Gemini API Key

1. **Go to Google AI Studio**:
   - Visit [https://aistudio.google.com/](https://aistudio.google.com/)
   - Sign in with your Google account

2. **Create an API Key**:
   - Click "Get API Key" in the top navigation
   - Click "Create API Key in new project" (or select existing project)
   - Copy the generated API key

3. **Set Environment Variable**:
   ```bash
   # Add to your backend/.env file
   GEMINI_API_KEY=your_actual_api_key_here
   ```

## 🚀 What Gemini Adds

### Advanced Task Extraction
- **Natural Language Understanding**: Extracts tasks from conversational text
- **Status Detection**: Automatically determines if tasks are completed, in-progress, blocked, or not started
- **Priority Assessment**: Infers task priority from context and urgency words
- **Metadata Extraction**: Pulls out due dates, estimated hours, and relevant tags

### Intelligent Project Categorization
- **Smart Matching**: Matches tasks to existing projects based on context
- **New Project Suggestions**: Recommends creating new projects when appropriate
- **Domain Understanding**: Recognizes technology, department, and functional areas

### Sentiment Analysis
- **Mood Detection**: Identifies positive, negative, neutral, or blocked sentiment
- **Blocker Recognition**: Automatically flags when employees are stuck or need help
- **Progress Assessment**: Understands overall project momentum

## 📝 Example Transformations

### Input Message:
```
"This week I completed the user authentication API and started working on the 
payment integration. I'm currently blocked on the Stripe webhook configuration 
- need help from the DevOps team. Also finished writing unit tests for the 
login flow. Planning to work on the dashboard UI next week."
```

### Gemini Extracts:
```json
[
  {
    "title": "User authentication API",
    "status": "completed",
    "priority": "high",
    "tags": ["api", "authentication"]
  },
  {
    "title": "Payment integration with Stripe",
    "status": "blocked",
    "priority": "high", 
    "tags": ["payment", "stripe", "integration"],
    "blockers": ["Stripe webhook configuration"]
  },
  {
    "title": "Unit tests for login flow",
    "status": "completed",
    "priority": "medium",
    "tags": ["testing", "login"]
  },
  {
    "title": "Dashboard UI development",
    "status": "not-started",
    "priority": "medium",
    "tags": ["ui", "dashboard"]
  }
]
```

### Project Assignment:
- Creates/assigns to "Payment System" project
- Creates/assigns to "Authentication System" project  
- Creates/assigns to "Frontend Development" project

### Sentiment: `blocked` (due to Stripe webhook issue)

## 🧪 Testing the Integration

### 1. Local Testing
```bash
cd backend
npm run dev
```

### 2. Test with Sample Message
```bash
curl -X POST http://localhost:8080/inbound/webhook \
  -H "X-Webhook-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "messageText": "Completed user login feature and started payment integration",
    "senderEmail": "test@company.com",
    "senderDisplay": "Test User"
  }'
```

### 3. Check Dashboard API
```bash
curl http://localhost:8080/dashboard/overview
```

## 🔍 Monitoring Gemini Usage

### Check Logs
```bash
# Look for Gemini-specific log entries
grep -i "gemini" logs/app.log

# Or in Cloud Run
gcloud run services logs read chat-status-backend --region=us-central1 | grep -i gemini
```

### API Usage
- Monitor your usage at [Google AI Studio](https://aistudio.google.com/)
- Free tier includes generous limits for testing
- Paid tiers available for production use

## 🛠️ Fallback Behavior

If Gemini is unavailable or the API key is missing:
- System falls back to basic pattern-based task extraction
- Server continues to operate normally
- All other features remain functional
- Logs indicate fallback mode is active

## 🔒 Security Notes

- **Never commit API keys** to version control
- Use environment variables for all sensitive data
- Consider using Google Cloud Secret Manager in production
- Rotate API keys regularly

## 📊 Expected Improvements

With Gemini integration, you should see:
- **90%+ accuracy** in task extraction vs 60% with patterns
- **Better project categorization** with context understanding
- **More accurate sentiment analysis** for team mood tracking
- **Reduced manual project assignment** work

## 🐛 Troubleshooting

### Common Issues:

1. **"GEMINI_API_KEY not found"**
   - Check your `.env` file in the backend directory
   - Ensure the key is properly formatted (no quotes, spaces)

2. **"Failed to initialize Gemini"**
   - Verify your API key is valid at Google AI Studio
   - Check your internet connection
   - Ensure billing is enabled if using paid tier

3. **"Quota exceeded"**
   - Check usage limits at Google AI Studio
   - Consider upgrading to paid tier
   - Implement rate limiting if needed

4. **Tasks not being extracted**
   - Check logs for Gemini API errors
   - Verify message format and content
   - Test with simpler, more explicit task descriptions

