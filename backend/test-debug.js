#!/usr/bin/env node

console.log('🔍 DEBUG: Script started');

try {
  console.log('🔍 DEBUG: Importing GeminiDataGenerator...');
  const { GeminiDataGenerator } = require('./dist/agents/geminiDataGenerator.js');
  console.log('✅ DEBUG: Import successful');

  async function test() {
    console.log('🔍 DEBUG: Creating generator instance...');
    const generator = new GeminiDataGenerator();
    console.log('✅ DEBUG: Generator created');

    console.log('🔍 DEBUG: Getting available employees...');
    const employees = await generator.getAvailableEmployees();
    console.log('✅ DEBUG: Available employees:', employees);

    console.log('🔍 DEBUG: Test completed successfully');
  }

  test().catch(error => {
    console.error('❌ DEBUG: Test failed:', error);
    console.error('❌ DEBUG: Stack:', error.stack);
  });

} catch (error) {
  console.error('❌ DEBUG: Import failed:', error);
  console.error('❌ DEBUG: Stack:', error.stack);
}
