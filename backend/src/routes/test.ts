import { Router } from 'express';
import { ChatMessenger } from '../services/chatMessenger.js';

export const testRouter = Router();

const chatMessenger = new ChatMessenger();

// Test endpoint to verify server can generate Chat responses
testRouter.post('/chat-response', (req, res) => {
  try {
    const { message, useCard } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let chatResponse;
    
    if (useCard) {
      // Test card response
      chatResponse = chatMessenger.createCardResponse({
        title: "DropManager Test",
        subtitle: "Server Response Test",
        text: message,
        buttons: [{
          text: "View Dashboard",
          onClick: {
            openLink: { url: "https://your-dashboard-url.com" }
          }
        }]
      });
    } else {
      // Test simple text response
      chatResponse = chatMessenger.createWebhookResponse(message);
    }

    console.log('[TEST] Generated chat response:', JSON.stringify(chatResponse, null, 2));

    res.json({
      success: true,
      chatResponse,
      instructions: "This response can be sent directly to Google Chat as a webhook response"
    });

  } catch (error) {
    console.error('[TEST] Error generating chat response:', error);
    res.status(500).json({ 
      error: 'Failed to generate chat response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint to simulate task extraction and response
testRouter.post('/simulate-update', (req, res) => {
  try {
    const { messageText } = req.body;
    
    if (!messageText) {
      return res.status(400).json({ error: 'messageText is required' });
    }

    // Simulate extracted tasks
    const mockTasks = [
      {
        title: "Complete API documentation",
        status: "completed",
        priority: "high"
      },
      {
        title: "Fix login bug",
        status: "in-progress", 
        priority: "critical"
      },
      {
        title: "Review pull requests",
        status: "not-started",
        priority: "medium"
      }
    ];

    const mockProjects = ["Documentation", "Bug Fixes"];

    // Generate formatted response
    const formattedMessage = chatMessenger.formatTaskSummary(mockTasks, mockProjects);
    const chatResponse = chatMessenger.createWebhookResponse(formattedMessage);

    console.log('[TEST] Simulated task extraction for:', messageText);
    console.log('[TEST] Generated response:', formattedMessage);

    res.json({
      success: true,
      originalMessage: messageText,
      extractedTasks: mockTasks,
      assignedProjects: mockProjects,
      formattedMessage,
      chatResponse,
      instructions: "This shows how the server will respond to actual updates"
    });

  } catch (error) {
    console.error('[TEST] Error simulating update:', error);
    res.status(500).json({ 
      error: 'Failed to simulate update',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint for analytics response
testRouter.get('/analytics-response', (req, res) => {
  try {
    // Mock analytics data
    const mockAnalytics = {
      totalUpdates: 15,
      activeEmployees: 8,
      completedTasks: 23,
      blockedTasks: 3,
      projectsProgressed: 5
    };

    const formattedMessage = chatMessenger.formatAnalyticsSummary(mockAnalytics);
    const chatResponse = chatMessenger.createCardResponse({
      title: "Weekly Analytics",
      subtitle: "Team Progress Summary",
      text: formattedMessage,
      buttons: [{
        text: "View Full Dashboard",
        onClick: {
          openLink: { url: "https://your-dashboard-url.com/analytics" }
        }
      }]
    });

    console.log('[TEST] Generated analytics response');

    res.json({
      success: true,
      analytics: mockAnalytics,
      formattedMessage,
      chatResponse,
      instructions: "This shows how analytics summaries will be formatted for Chat"
    });

  } catch (error) {
    console.error('[TEST] Error generating analytics response:', error);
    res.status(500).json({ 
      error: 'Failed to generate analytics response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

