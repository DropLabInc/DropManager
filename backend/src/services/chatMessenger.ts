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

  constructor() {
    // For now, we'll use a simple approach without service account
    // In production, you'd want to use proper service account authentication
    console.log('[CHAT_MESSENGER] Initialized (webhook response mode)');
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
    console.log('[CHAT_MESSENGER] Proactive messaging not yet implemented');
    console.log('[CHAT_MESSENGER] Would send to space:', message.spaceName);
    console.log('[CHAT_MESSENGER] Message:', message.text);
    
    // TODO: Implement with service account authentication
    // This would require:
    // 1. Service account key with Chat API permissions
    // 2. JWT token generation
    // 3. POST to Chat API with proper authentication
    
    return false;
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

