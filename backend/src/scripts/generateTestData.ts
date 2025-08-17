#!/usr/bin/env node

import { DataGeneratorAgent } from '../agents/dataGeneratorAgent.js';

interface GenerateOptions {
  count: number;
  members?: string[];
  resetFirst: boolean;
  delayMs: number;
  inboundUrl: string;
  token: string;
}

async function sendWebhook(message: {
  messageText: string;
  senderEmail: string;
  senderDisplay: string;
}, options: GenerateOptions): Promise<boolean> {
  try {
    const response = await fetch(options.inboundUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Token': options.token
      },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log(`✅ Sent message from ${message.senderDisplay}`);
      return true;
    } else {
      console.error(`❌ Failed to send message from ${message.senderDisplay}: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending message from ${message.senderDisplay}:`, error);
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
    count: 10,
    resetFirst: true,
    delayMs: 500,
    inboundUrl: 'http://localhost:8080/inbound/webhook',
    token: process.env.INBOUND_TOKEN || 'default-token'
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--count':
        options.count = parseInt(args[++i]) || 10;
        break;
      case '--members':
        options.members = args[++i].split(',');
        break;
      case '--no-reset':
        options.resetFirst = false;
        break;
      case '--delay':
        options.delayMs = parseInt(args[++i]) || 500;
        break;
      case '--url':
        options.inboundUrl = args[++i];
        break;
      case '--token':
        options.token = args[++i];
        break;
      case '--help':
        console.log(`
Usage: npm run generate:data [options]

Options:
  --count N           Number of messages to generate (default: 10)
  --members A,B,C     Comma-separated list of team members (default: all)
  --no-reset          Don't reset database before generating
  --delay N           Delay between messages in ms (default: 500)
  --url URL           Webhook URL (default: http://localhost:8080/inbound/webhook)
  --token TOKEN       Auth token (default: from INBOUND_TOKEN env var)
  --help              Show this help

Available team members: Sergio, Bayan, Kam, Rosemary

Examples:
  npm run generate:data -- --count 5 --members Sergio,Kam
  npm run generate:data -- --count 20 --no-reset
  npm run generate:data -- --count 3 --delay 1000
        `);
        process.exit(0);
    }
  }

  console.log('🚀 Starting test data generation...');
  console.log(`Options:`, options);

  const generator = new DataGeneratorAgent();
  const availableMembers = generator.getAvailableMembers();
  
  console.log(`Available team members: ${availableMembers.join(', ')}`);

  if (options.members) {
    const invalidMembers = options.members.filter(m => !availableMembers.includes(m));
    if (invalidMembers.length > 0) {
      console.error(`❌ Invalid team members: ${invalidMembers.join(', ')}`);
      console.error(`Available members: ${availableMembers.join(', ')}`);
      process.exit(1);
    }
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
  console.log(`📝 Generating ${options.count} messages...`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < options.count; i++) {
    try {
      const message = await generator.generateMessage(
        options.members 
          ? options.members[Math.floor(Math.random() * options.members.length)]
          : availableMembers[Math.floor(Math.random() * availableMembers.length)]
      );

      const success = await sendWebhook(message, options);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Add delay between messages
      if (i < options.count - 1 && options.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }

    } catch (error) {
      console.error(`❌ Error generating message ${i + 1}:`, error);
      failCount++;
    }
  }

  console.log('\n🎉 Test data generation complete!');
  console.log(`✅ Success: ${successCount} messages`);
  console.log(`❌ Failed: ${failCount} messages`);
  console.log(`📊 Total: ${successCount + failCount} attempts`);

  if (successCount > 0) {
    console.log('\n🔗 View results:');
    console.log(`• Admin Panel: ${options.inboundUrl.replace('/inbound/webhook', '/admin')}`);
    console.log(`• Dashboard: ${options.inboundUrl.replace('/inbound/webhook', '/dashboard/overview')}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main as generateTestData };
