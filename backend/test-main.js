#!/usr/bin/env node

console.log('🔍 DEBUG: Testing main function execution');

// Set environment variables
process.env.GEMINI_API_KEY = "AIzaSyDkfS0kInDr066TUjbgti_rJhmX3H85DJ0";
process.env.INBOUND_TOKEN = "iD0NEkwszZwcR9EajFjpEzl4BsMD9QVJ";

console.log('🔍 DEBUG: Environment variables set');

try {
  console.log('🔍 DEBUG: Importing generateGeminiData main function...');
  
  import('./dist/scripts/generateGeminiData.js').then(({ generateGeminiData }) => {
    console.log('✅ DEBUG: Main function imported successfully');
    
    console.log('🔍 DEBUG: Calling main function directly...');
    
    // Override process.argv to simulate command line args
    process.argv = ['node', 'generateGeminiData.js', '--count', '1'];
    
    generateGeminiData().then(() => {
      console.log('✅ DEBUG: Main function completed successfully');
    }).catch(error => {
      console.error('❌ DEBUG: Main function failed:', error);
      console.error('❌ DEBUG: Stack:', error.stack);
    });
    
  }).catch(error => {
    console.error('❌ DEBUG: Import failed:', error);
    console.error('❌ DEBUG: Stack:', error.stack);
  });

} catch (error) {
  console.error('❌ DEBUG: Test failed:', error);
  console.error('❌ DEBUG: Stack:', error.stack);
}
