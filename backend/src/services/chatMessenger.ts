// Service for sending messages back to Google Chat spaces

export interface ChatMessage {
  text: string;
  spaceName: string;
  threadName?: string;
}

export interface ChatCard {
  title: string;
  subtitle?: string;
  text: string;
  buttons?: Array<{
    text: string;
    onClick: {
      openLink?: { url: string };
      action?: { function: string; parameters?: any };
    };
  }>;
}

export class ChatMessenger {
  private serviceAccountKey: any;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private appsScriptUrl: string | null = null;
  private appsScriptSendToken: string | null = null;
  private chatServiceAccountKeyJson: string | null = null;

  constructor() {
    // For now, we'll use a simple approach without service account
    // In production, you'd want to use proper service account authentication
    console.log('[CHAT_MESSENGER] Initialized (webhook response mode)');
    this.appsScriptUrl = process.env.APPS_SCRIPT_URL || null;
    this.appsScriptSendToken = process.env.APPS_SCRIPT_SEND_TOKEN || null;
    this.chatServiceAccountKeyJson = process.env.CHAT_SA_KEY_JSON || null;
  }

  // Method to send message via webhook response (immediate reply)
  public createWebhookResponse(text: string, isCard: boolean = false): any {
    if (isCard) {
      return {
        cardsV2: [{
          card: {
            header: {
              title: "DropManager Update",
              imageUrl: "https://developers.google.com/workspace/chat/images/quickstart-app-avatar.png"
            },
            sections: [{
              widgets: [{
                textParagraph: {
                  text: text
                }
              }]
            }]
          }
        }]
      };
    }

    return {
      text: text
    };
  }

  // Method to create rich card response
  public createCardResponse(card: ChatCard): any {
    const cardWidgets: any[] = [{
      textParagraph: {
        text: card.text
      }
    }];

    if (card.buttons && card.buttons.length > 0) {
      cardWidgets.push({
        buttonList: {
          buttons: card.buttons.map(button => ({
            text: button.text,
            onClick: button.onClick
          }))
        }
      });
    }

    return {
      cardsV2: [{
        card: {
          header: {
            title: card.title,
            subtitle: card.subtitle,
            imageUrl: "https://developers.google.com/workspace/chat/images/quickstart-app-avatar.png"
          },
          sections: [{
            widgets: cardWidgets
          }]
        }
      }]
    };
  }

  // Method to send proactive messages (requires service account - for future implementation)
  public async sendProactiveMessage(message: ChatMessage): Promise<boolean> {
    // Option A (lightweight): forward to Apps Script doPost with op=send
    if (this.appsScriptUrl && this.appsScriptSendToken) {
      try {
        const resp = await fetch(this.appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'send',
            sendToken: this.appsScriptSendToken,
            spaceName: message.spaceName,
            threadName: message.threadName || '',
            text: message.text
          })
        });
        const ok = resp.ok;
        const body = await resp.text();
        console.log('[CHAT_MESSENGER] Apps Script proactive send status:', resp.status, body.slice(0, 300));
        return ok;
      } catch (err) {
        console.error('[CHAT_MESSENGER] Apps Script proactive send failed:', err);
        return false;
      }
    }

    console.warn('[CHAT_MESSENGER] Proactive messaging not configured (set APPS_SCRIPT_URL and APPS_SCRIPT_SEND_TOKEN)');
    // Option B: Direct Google Chat REST API with service account
    if (this.chatServiceAccountKeyJson) {
      try {
        const ok = await this.sendViaChatApi(message);
        return ok;
      } catch (err) {
        console.error('[CHAT_MESSENGER] Chat API proactive send failed:', err);
        return false;
      }
    }

    return false;
  }

  private async sendViaChatApi(message: ChatMessage): Promise<boolean> {
    // Minimal JWT-based auth using google-auth-library
    const {JWT} = await import('google-auth-library');
    const key = JSON.parse(this.chatServiceAccountKeyJson as string);
    const scopes = ['https://www.googleapis.com/auth/chat.bot'];
    const client = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes
    });
    const token = await client.getAccessToken();
    if (!token || !token.token) throw new Error('Failed to acquire access token for Chat bot');

    const urlBase = 'https://chat.googleapis.com/v1';
    const url = `${urlBase}/${encodeURI(message.spaceName)}/messages`;
    const body: any = { text: message.text };
    if (message.threadName) {
      body.thread = { name: message.threadName };
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const txt = await resp.text();
    console.log('[CHAT_MESSENGER] Chat API status:', resp.status, txt.slice(0, 300));
    return resp.ok;
  }

  // Helper method to format task summary for Chat
  public formatTaskSummary(tasks: any[], projectNames: string[]): string {
    if (tasks.length === 0) {
      return "Thanks for your update! I've logged your message.";
    }

    let message = `Great! I've extracted ${tasks.length} task${tasks.length > 1 ? 's' : ''} from your update:\n\n`;
    
    tasks.forEach((task: any, index: number) => {
      const statusEmoji = this.getStatusEmoji(task.status);
      const priorityText = task.priority !== 'medium' ? ` (${task.priority})` : '';
      message += `${statusEmoji} ${task.title}${priorityText}\n`;
    });

    if (projectNames.length > 0) {
      message += `\n📂 Assigned to: ${projectNames.join(', ')}`;
    }

    return message;
  }

  // Helper method to format analytics for Chat
  public formatAnalyticsSummary(analytics: any): string {
    return `📊 **Weekly Summary**\n\n` +
           `• ${analytics.totalUpdates} updates received\n` +
           `• ${analytics.activeEmployees} team members active\n` +
           `• ${analytics.completedTasks} tasks completed\n` +
           `• ${analytics.blockedTasks} tasks blocked\n` +
           `• ${analytics.projectsProgressed} projects progressed`;
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'blocked': return '⚠️';
      case 'not-started': return '📋';
      case 'cancelled': return '❌';
      default: return '📝';
    }
  }
}

