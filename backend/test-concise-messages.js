#!/usr/bin/env node

console.log('🎯 Testing Concise Message Generation...');

// Set environment variables
process.env.GEMINI_API_KEY = "AIzaSyDkfS0kInDr066TUjbgti_rJhmX3H85DJ0";
process.env.INBOUND_TOKEN = "iD0NEkwszZwcR9EajFjpEzl4BsMD9QVJ";

async function testConciseMessages() {
  try {
    console.log('🔄 Importing generator...');
    const { GeminiDataGenerator } = await import('./dist/agents/geminiDataGenerator.js');
    
    console.log('🧠 Creating generator...');
    const generator = new GeminiDataGenerator();
    
    // Get available employees
    const employees = await generator.getAvailableEmployees();
    console.log(`👥 Available employees: ${employees.slice(0, 3).join(', ')}`);
    
    // Test with one employee for different message types
    const testEmployee = employees[0];
    const messageTypes = ['progress', 'technical', 'challenge'];
    
    console.log(`\n🎯 Testing concise messages for ${testEmployee}...`);
    
    for (const messageType of messageTypes) {
      try {
        const message = await generator.generateMessage(testEmployee, messageType);
        
        console.log(`\n📝 ${messageType.toUpperCase()} MESSAGE:`);
        console.log(`• From: ${message.senderDisplay}`);
        console.log(`• Content: "${message.messageText}"`);
        console.log(`• Length: ${message.messageText.length} characters`);
        console.log(`• Sentences: ${message.messageText.split('.').filter(s => s.trim().length > 0).length}`);
        
        // Check for conversational elements that should be removed
        const conversationalElements = [
          'hey team', 'hi team', 'hello team', 'hey everyone', 'hi everyone',
          'hope everyone', 'good morning', 'good afternoon', 'let me know',
          'any questions', 'thanks for reading', 'best regards', 'looking forward'
        ];
        
        const foundElements = conversationalElements.filter(element => 
          message.messageText.toLowerCase().includes(element)
        );
        
        if (foundElements.length > 0) {
          console.log(`⚠️  Found conversational elements: ${foundElements.join(', ')}`);
        } else {
          console.log(`✅ No conversational fluff detected`);
        }
        
      } catch (error) {
        console.error(`❌ Error generating ${messageType}:`, error.message);
      }
    }
    
    console.log('\n🎉 Concise message testing complete!');
    console.log('\n📋 Expected message format:');
    console.log('• Start directly with work content');
    console.log('• No greetings or conversational elements');
    console.log('• Focus on facts, progress, and technical details');
    console.log('• 2-3 sentences maximum');
    console.log('• Direct and professional tone');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConciseMessages();
