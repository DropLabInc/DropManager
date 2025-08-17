#!/usr/bin/env node

console.log('🧪 Testing Enhanced Project Context Generation...');

// Set environment variables
process.env.GEMINI_API_KEY = "AIzaSyDkfS0kInDr066TUjbgti_rJhmX3H85DJ0";
process.env.INBOUND_TOKEN = "iD0NEkwszZwcR9EajFjpEzl4BsMD9QVJ";

async function testEnhancedGeneration() {
  try {
    console.log('🔄 Importing enhanced generator...');
    const { GeminiDataGenerator } = await import('./dist/agents/geminiDataGenerator.js');
    const { getProjectManager } = await import('./dist/routes/dashboard.js');
    
    // Get the active ProjectManager instance
    const projectManager = getProjectManager();
    if (!projectManager) {
      console.log('❌ No ProjectManager instance found. Start the server first.');
      return;
    }
    
    console.log('✅ ProjectManager instance found');
    console.log('📊 Current project data:');
    console.log(`• Projects: ${projectManager.getProjects().length}`);
    console.log(`• Tasks: ${projectManager.getTasks().length}`);
    console.log(`• Employees: ${projectManager.getEmployees().length}`);
    console.log(`• Updates: ${projectManager.getUpdates().length}`);
    
    // Create enhanced generator
    console.log('🧠 Creating enhanced generator with project context...');
    const generator = new GeminiDataGenerator(undefined, projectManager);
    
    // Get available employees
    const employees = await generator.getAvailableEmployees();
    console.log(`👥 Available employees: ${employees.join(', ')}`);
    
    // Test with a few employees
    const testEmployees = employees.slice(0, 2);
    
    for (const employee of testEmployees) {
      console.log(`\n🎯 Testing enhanced generation for ${employee}...`);
      
      try {
        const message = await generator.generateMessage(employee, 'progress');
        
        console.log('✅ Enhanced Message Generated:');
        console.log(`• From: ${message.senderDisplay}`);
        console.log(`• Type: ${message.messageType}`);
        console.log(`• Confidence: ${message.confidence.toFixed(3)}`);
        console.log(`• Length: ${message.messageText.length} chars`);
        console.log(`• Content: "${message.messageText}"`);
        
        // Analyze the content for project references
        const projects = projectManager.getProjects();
        const mentionedProjects = projects.filter(p => 
          message.messageText.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (mentionedProjects.length > 0) {
          console.log(`🎯 Project references found: ${mentionedProjects.map(p => p.name).join(', ')}`);
        }
        
        // Check for technical terms
        const techTerms = ['firmware', 'hardware', 'software', 'testing', 'development', 'analysis', 'optimization', 'integration'];
        const foundTerms = techTerms.filter(term => 
          message.messageText.toLowerCase().includes(term)
        );
        
        if (foundTerms.length > 0) {
          console.log(`🔧 Technical terms: ${foundTerms.join(', ')}`);
        }
        
      } catch (error) {
        console.error(`❌ Error generating for ${employee}:`, error.message);
      }
    }
    
    console.log('\n🎉 Enhanced project context testing complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEnhancedGeneration();
