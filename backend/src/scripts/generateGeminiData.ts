#!/usr/bin/env node

import { GeminiDataGenerator, GeneratedMessage } from '../agents/geminiDataGenerator.js';

interface GenerateOptions {
  count: number;
  members?: string[];
  resetFirst: boolean;
  delayMs: number;
  inboundUrl: string;
  token: string;
  messageType?: 'progress' | 'challenge' | 'completion' | 'planning' | 'technical' | 'update';
  showContext: boolean;
  minConfidence: number;
}

async function sendWebhook(message: GeneratedMessage, options: GenerateOptions): Promise<boolean> {
  try {
    const payload = {
      messageText: message.messageText,
      senderEmail: message.senderEmail,
      senderDisplay: message.senderDisplay
    };

    console.log(`🔄 [DEBUG] Sending webhook to: ${options.inboundUrl}`);
    console.log(`🔄 [DEBUG] Token: ${options.token ? options.token.slice(0, 8) + '...' : 'NONE'}`);
    console.log(`🔄 [DEBUG] Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(options.inboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Token': options.token
      },
      body: JSON.stringify(payload)
    });

    console.log(`🔄 [DEBUG] Response status: ${response.status}`);
    console.log(`🔄 [DEBUG] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const responseText = await response.text();
      console.log(`🔄 [DEBUG] Response body: ${responseText}`);
      console.log(`✅ [${message.confidence.toFixed(2)}] ${message.senderDisplay} (${message.messageType})`);
      console.log(`   "${message.messageText}"`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed to send message from ${message.senderDisplay}: ${response.status}`);
      console.error(`❌ Error response: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending message from ${message.senderDisplay}:`, error);
    console.error(`❌ Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return false;
  }
}

async function resetDatabase(options: GenerateOptions): Promise<boolean> {
  try {
    const resetUrl = options.inboundUrl.replace('/inbound/webhook', '/dashboard/reset');
    const response = await fetch(resetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('🔄 Database reset successful');
      return true;
    } else {
      console.error(`❌ Failed to reset database: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const options: GenerateOptions = {
    count: 5,
    resetFirst: true,
    delayMs: 1000, // Longer delay for Gemini API
    inboundUrl: 'http://localhost:8080/inbound/webhook',
    token: process.env.INBOUND_TOKEN || 'default-token',
    showContext: false,
    minConfidence: 0.3
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--count':
        options.count = parseInt(args[++i]) || 5;
        break;
      case '--members':
        options.members = args[++i].split(',');
        break;
      case '--type':
        const type = args[++i];
        if (['progress', 'challenge', 'completion', 'planning', 'technical', 'update'].includes(type)) {
          options.messageType = type as any;
        }
        break;
      case '--no-reset':
        options.resetFirst = false;
        break;
      case '--delay':
        options.delayMs = parseInt(args[++i]) || 1000;
        break;
      case '--url':
        options.inboundUrl = args[++i];
        break;
      case '--token':
        options.token = args[++i];
        break;
      case '--show-context':
        options.showContext = true;
        break;
      case '--min-confidence':
        options.minConfidence = parseFloat(args[++i]) || 0.3;
        break;
      case '--help':
        console.log(`
Usage: npm run generate:gemini [options]

Options:
  --count N           Number of messages to generate (default: 5)
  --members A,B,C     Comma-separated list of team members (default: all available)
  --type TYPE         Message type: progress|challenge|completion|planning|technical|update
  --no-reset          Don't reset database before generating
  --delay N           Delay between messages in ms (default: 1000)
  --url URL           Webhook URL (default: http://localhost:8080/inbound/webhook)
  --token TOKEN       Auth token (default: from INBOUND_TOKEN env var)
  --show-context      Show employee context before generating
  --min-confidence N  Minimum confidence threshold (default: 0.3)
  --help              Show this help

Message Types:
  progress    - Work accomplishments and milestones
  technical   - Technical details and findings
  challenge   - Problems and roadblocks
  planning    - Future work and coordination
  completion  - Finished tasks and deliverables
  update      - General status updates (default)

Examples:
  npm run generate:gemini -- --count 3 --members Sergio,Kam
  npm run generate:gemini -- --count 5 --type technical --show-context
  npm run generate:gemini -- --count 10 --no-reset --min-confidence 0.5
        `);
        process.exit(0);
    }
  }

  console.log('🤖 [DEBUG] Starting Gemini-powered test data generation...');
  console.log(`🔄 [DEBUG] Environment variables:`, {
    INBOUND_TOKEN: process.env.INBOUND_TOKEN ? `${process.env.INBOUND_TOKEN.slice(0, 8)}...` : 'NOT SET',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 8)}...` : 'NOT SET'
  });
  console.log(`🔄 [DEBUG] Options:`, {
    ...options,
    token: options.token ? `${options.token.slice(0, 8)}...` : 'none'
  });

  console.log(`🧠 [DEBUG] Creating GeminiDataGenerator with project context...`);
  
  // Get ProjectManager instance from the server (for project context)
  // Note: In production, this would be properly injected
  let projectManager = null;
  try {
    const { getProjectManager } = await import('../routes/dashboard.js');
    projectManager = getProjectManager();
    if (projectManager) {
      console.log(`✅ [DEBUG] ProjectManager instance found for enhanced context`);
    } else {
      console.log(`⚠️ [DEBUG] No ProjectManager instance available, using basic context`);
    }
  } catch (error) {
    console.log(`⚠️ [DEBUG] Could not access ProjectManager, using basic context`);
  }
  
  const generator = new GeminiDataGenerator(undefined, projectManager || undefined);
  
  console.log(`📁 [DEBUG] Getting available employees...`);
  const availableMembers = await generator.getAvailableEmployees();
  
  console.log(`📁 [DEBUG] Found ${availableMembers.length} employees with Stories data: ${availableMembers.join(', ')}`);

  if (options.members) {
    console.log(`🔄 [DEBUG] Filtering to requested members: ${options.members.join(', ')}`);
    const invalidMembers = options.members.filter(m => !availableMembers.includes(m));
    if (invalidMembers.length > 0) {
      console.error(`❌ [DEBUG] Invalid team members: ${invalidMembers.join(', ')}`);
      console.error(`❌ [DEBUG] Available members: ${availableMembers.join(', ')}`);
      process.exit(1);
    }
  }

  const membersToUse = options.members || availableMembers;
  console.log(`👥 [DEBUG] Members to use: ${membersToUse.join(', ')}`);

  // Test server connectivity first
  console.log(`🔗 [DEBUG] Testing server connectivity to ${options.inboundUrl}...`);
  try {
    const healthUrl = options.inboundUrl.replace('/inbound/webhook', '/healthz');
    console.log(`🔗 [DEBUG] Checking health endpoint: ${healthUrl}`);
    const healthResponse = await fetch(healthUrl);
    console.log(`🔗 [DEBUG] Health check status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      console.log(`✅ [DEBUG] Server is accessible`);
    } else {
      console.warn(`⚠️  [DEBUG] Health check failed but continuing...`);
    }
  } catch (error) {
    console.error(`❌ [DEBUG] Server connectivity test failed:`, error instanceof Error ? error.message : String(error));
    console.error(`❌ [DEBUG] Make sure server is running on localhost:8080`);
  }

  // Show context if requested
  if (options.showContext) {
    console.log('\n📋 Employee Context Summary:');
    for (const member of membersToUse.slice(0, 3)) { // Show first 3 to avoid clutter
      const context = await generator.getEmployeeContext(member);
      if (context) {
        console.log(`\n👤 ${context.displayName}:`);
        console.log(`   Role: ${context.expertise.join(', ')}`);
        console.log(`   Projects: ${context.projects.slice(0, 3).join(', ')}`);
        console.log(`   Technologies: ${context.technologies.slice(0, 5).join(', ')}`);
        console.log(`   Recent: ${context.recentActivities.slice(0, 2).join('; ')}`);
      }
    }
    console.log('');
  }

  // Reset database if requested
  if (options.resetFirst) {
    console.log('🔄 Resetting database...');
    const resetSuccess = await resetDatabase(options);
    if (!resetSuccess) {
      console.error('❌ Failed to reset database, continuing anyway...');
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait after reset
  }

  // Generate and send messages
  console.log(`\n🧠 Generating ${options.count} AI-powered messages...`);
  let successCount = 0;
  let failCount = 0;
  let lowConfidenceCount = 0;

  for (let i = 0; i < options.count; i++) {
    try {
      const selectedMember = membersToUse[Math.floor(Math.random() * membersToUse.length)];
      
      console.log(`\n📝 [DEBUG] Starting message ${i + 1}/${options.count} from ${selectedMember}...`);
      console.log(`🔄 [DEBUG] Available members: ${membersToUse.join(', ')}`);
      console.log(`🔄 [DEBUG] Selected member: ${selectedMember}`);
      console.log(`🔄 [DEBUG] Message type: ${options.messageType || 'random'}`);
      
      console.log(`🧠 [DEBUG] Calling generator.generateMessage()...`);
      const message = await generator.generateMessage(selectedMember, options.messageType);
      console.log(`🧠 [DEBUG] Generated message:`, {
        senderEmail: message.senderEmail,
        senderDisplay: message.senderDisplay,
        messageType: message.messageType,
        confidence: message.confidence,
        messageLength: message.messageText.length,
        messagePreview: message.messageText.substring(0, 100) + '...'
      });

      if (message.confidence < options.minConfidence) {
        console.log(`⚠️  [DEBUG] Low confidence (${message.confidence.toFixed(2)} < ${options.minConfidence}), skipping message`);
        lowConfidenceCount++;
        continue;
      }

      console.log(`🌐 [DEBUG] Sending webhook request...`);
      const success = await sendWebhook(message, options);
      if (success) {
        successCount++;
        console.log(`✅ [DEBUG] Message ${i + 1} sent successfully`);
      } else {
        failCount++;
        console.log(`❌ [DEBUG] Message ${i + 1} failed to send`);
      }

      // Add delay between messages
      if (i < options.count - 1 && options.delayMs > 0) {
        console.log(`⏳ [DEBUG] Waiting ${options.delayMs}ms before next message...`);
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }

    } catch (error) {
      console.error(`❌ [DEBUG] Error generating message ${i + 1}:`, error);
      console.error(`❌ [DEBUG] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      failCount++;
    }
  }

  console.log('\n🎉 Gemini data generation complete!');
  console.log(`✅ Success: ${successCount} messages`);
  console.log(`❌ Failed: ${failCount} messages`);
  console.log(`⚠️  Low confidence: ${lowConfidenceCount} messages`);
  console.log(`📊 Total attempts: ${successCount + failCount + lowConfidenceCount}`);

  if (successCount > 0) {
    console.log('\n🔗 View results:');
    console.log(`• Admin Panel: ${options.inboundUrl.replace('/inbound/webhook', '/admin')}`);
    console.log(`• Dashboard: ${options.inboundUrl.replace('/inbound/webhook', '/dashboard/overview')}`);
    
    console.log('\n💡 The generated messages use:');
    console.log('• Real employee work history from Stories folder');
    console.log('• AI-powered natural language generation');
    console.log('• Domain-specific terminology and context');
    console.log('• Authentic project references and technical details');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main as generateGeminiData };
