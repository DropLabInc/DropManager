#!/usr/bin/env node

console.log('🔍 DEBUG: Starting simple test');

// Test environment variables first
console.log('🔍 DEBUG: Environment variables:');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
console.log('- INBOUND_TOKEN:', process.env.INBOUND_TOKEN ? 'SET' : 'NOT SET');

try {
  console.log('🔍 DEBUG: Testing basic import...');
  
  // Test importing GeminiNLP first
  console.log('🔍 DEBUG: Importing GeminiNLP...');
  import('./dist/services/geminiNLP.js').then(({ GeminiNLP }) => {
    console.log('✅ DEBUG: GeminiNLP imported successfully');
    
    console.log('🔍 DEBUG: Creating GeminiNLP instance...');
    const gemini = new GeminiNLP();
    console.log('✅ DEBUG: GeminiNLP instance created');
    
    console.log('✅ DEBUG: Basic test completed');
  }).catch(error => {
    console.error('❌ DEBUG: GeminiNLP import failed:', error);
    console.error('❌ DEBUG: Stack:', error.stack);
  });

} catch (error) {
  console.error('❌ DEBUG: Test failed:', error);
  console.error('❌ DEBUG: Stack:', error.stack);
}
