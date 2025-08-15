# Quick Test: Simple Server Response

The issue is that our current backend has complex Gemini integration that's causing deployment failures.

Let's test the basic server-to-Chat communication with a simple response:

## What We'll Test:
1. Apps Script sends message to backend
2. Backend extracts messageText and senderEmail  
3. Backend returns `{ text: "Echo: [your message]" }`
4. Apps Script detects the `text` property and forwards it to Chat
5. You see "Echo: [your message]" instead of "BEEPBEEPBOOP"

This will prove the communication pipeline works, then we can add Gemini back.

## The Test:
Send any message to your bot. If you see:
- "BEEPBEEPBOOP" → Server communication still broken
- "Echo: [your message]" → Server communication working! 🎉

Ready to try this approach?

