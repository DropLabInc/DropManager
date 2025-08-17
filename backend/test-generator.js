#!/usr/bin/env node

console.log('🔍 DEBUG: Starting generator test');

// Set environment variables
process.env.GEMINI_API_KEY = "AIzaSyDkfS0kInDr066TUjbgti_rJhmX3H85DJ0";
process.env.INBOUND_TOKEN = "iD0NEkwszZwcR9EajFjpEzl4BsMD9QVJ";

console.log('🔍 DEBUG: Environment variables set');

try {
  console.log('🔍 DEBUG: Importing GeminiDataGenerator...');
  
  import('./dist/agents/geminiDataGenerator.js').then(({ GeminiDataGenerator }) => {
    console.log('✅ DEBUG: GeminiDataGenerator imported successfully');
    
    console.log('🔍 DEBUG: Creating generator instance...');
    const generator = new GeminiDataGenerator();
    console.log('✅ DEBUG: Generator instance created');
    
    console.log('🔍 DEBUG: Testing getAvailableEmployees...');
    generator.getAvailableEmployees().then(employees => {
      console.log('✅ DEBUG: Available employees:', employees);
      console.log('✅ DEBUG: Test completed successfully');
    }).catch(error => {
      console.error('❌ DEBUG: getAvailableEmployees failed:', error);
      console.error('❌ DEBUG: Stack:', error.stack);
    });
    
  }).catch(error => {
    console.error('❌ DEBUG: GeminiDataGenerator import failed:', error);
    console.error('❌ DEBUG: Stack:', error.stack);
  });

} catch (error) {
  console.error('❌ DEBUG: Test failed:', error);
  console.error('❌ DEBUG: Stack:', error.stack);
}
