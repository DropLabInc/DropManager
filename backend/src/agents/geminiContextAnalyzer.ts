import { GeminiNLP } from '../services/geminiNLP.js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface GeminiEmployeeContext {
  name: string;
  email: string;
  displayName: string;
  role: string;
  expertise: string[];
  workStyle: string;
  projects: string[];
  recentActivities: string[];
  challenges: string[];
  technologies: string[];
  summary: string;
}

export class GeminiContextAnalyzer {
  private gemini: GeminiNLP;
  private storiesPath: string;
  private contextCache: Map<string, GeminiEmployeeContext> = new Map();

  constructor(storiesPath: string = '../Stories/Data') {
    this.gemini = new GeminiNLP();
    this.storiesPath = storiesPath;
  }

  async analyzeEmployeeContext(employeeName: string): Promise<GeminiEmployeeContext | null> {
    try {
      // Check cache first
      if (this.contextCache.has(employeeName)) {
        return this.contextCache.get(employeeName)!;
      }

      // Read employee's Stories files
      const employeeData = await this.readEmployeeStories(employeeName);
      if (!employeeData) {
        return null;
      }

      // Use Gemini to analyze the employee's work patterns and role
      const context = await this.generateContextWithGemini(employeeName, employeeData);
      
      // Cache the result
      this.contextCache.set(employeeName, context);
      
      return context;
    } catch (error) {
      console.error(`[GEMINI_CONTEXT] Error analyzing ${employeeName}:`, error);
      return null;
    }
  }

  private async readEmployeeStories(employeeName: string): Promise<{
    workSummaries: string[];
    challenges: string[];
    projects: string[];
    aiSummaries: string[];
  } | null> {
    try {
      const employeePath = join(this.storiesPath, employeeName);
      const checkinsPath = join(employeePath, 'Check-ins 7df0923e650b408b878362d17e574008');
      
      const files = await readdir(checkinsPath);
      const markdownFiles = files.filter(f => f.endsWith('.md'));
      
      // Sample up to 8 files for analysis
      const samplesToRead = Math.min(8, markdownFiles.length);
      const selectedFiles = markdownFiles.slice(0, samplesToRead);

      const workSummaries: string[] = [];
      const challenges: string[] = [];
      const projects = new Set<string>();
      const aiSummaries: string[] = [];

      for (const file of selectedFiles) {
        try {
          const filePath = join(checkinsPath, file);
          const content = await readFile(filePath, 'utf-8');
          
          // Extract projects
          const projectMatch = content.match(/Related Projects: (.+)/);
          if (projectMatch) {
            const projectText = projectMatch[1];
            const projectMatches = projectText.match(/([A-Z-]+(?:\s+[A-Z-]+)*)\s*\(/g);
            if (projectMatches) {
              projectMatches.forEach(match => {
                const projectName = match.replace(/\s*\($/, '').trim();
                if (projectName && projectName !== 'Untitled') {
                  projects.add(projectName);
                }
              });
            }
          }

          // Extract AI Summary
          const summaryMatch = content.match(/AI Summary: (.+?)(?:\n\n|\n###)/s);
          if (summaryMatch) {
            aiSummaries.push(summaryMatch[1].trim());
          }

          // Extract work summary content
          const workSummaryMatch = content.match(/### Work Summary\s*---\s*(.*?)(?=---|\n###|$)/s);
          if (workSummaryMatch) {
            const workContent = workSummaryMatch[1].trim();
            if (workContent && workContent !== '-' && !workContent.includes('What tasks did you work on')) {
              workSummaries.push(workContent);
            }
          }

          // Extract challenges
          const challengesMatch = content.match(/### Challenges & Roadblocks\s*---\s*(.*?)(?=---|\n###|$)/s);
          if (challengesMatch) {
            const challengeContent = challengesMatch[1].trim();
            if (challengeContent && challengeContent !== '-' && !challengeContent.includes('Did you run into any problems')) {
              challenges.push(challengeContent);
            }
          }

        } catch (fileError) {
          console.warn(`[GEMINI_CONTEXT] Could not read file ${file}:`, fileError);
        }
      }

      return {
        workSummaries: workSummaries.slice(0, 5),
        challenges: challenges.slice(0, 3),
        projects: Array.from(projects).slice(0, 6),
        aiSummaries: aiSummaries.slice(0, 3)
      };

    } catch (error) {
      console.error(`[GEMINI_CONTEXT] Error reading stories for ${employeeName}:`, error);
      return null;
    }
  }

  private async generateContextWithGemini(
    employeeName: string, 
    data: { workSummaries: string[]; challenges: string[]; projects: string[]; aiSummaries: string[] }
  ): Promise<GeminiEmployeeContext> {
    
    const prompt = `Analyze this employee's work history and provide a comprehensive professional profile.

EMPLOYEE: ${employeeName}

WORK SUMMARIES FROM RECENT CHECK-INS:
${data.workSummaries.map(summary => `- ${summary}`).join('\n')}

CHALLENGES & ROADBLOCKS:
${data.challenges.map(challenge => `- ${challenge}`).join('\n')}

PROJECTS INVOLVED:
${data.projects.join(', ')}

AI SUMMARIES FROM CHECK-INS:
${data.aiSummaries.map(summary => `"${summary}"`).join('\n')}

Based on this actual work history, provide a JSON response with the following structure:
{
  "role": "specific job title based on actual work (e.g., 'Biomedical Engineer', 'Hardware Engineer', 'Research Scientist', 'Manufacturing Engineer')",
  "expertise": ["array", "of", "specific", "technical", "skills", "and", "specializations"],
  "workStyle": "brief description of working approach and style",
  "technologies": ["specific", "tools", "equipment", "techniques", "used"],
  "summary": "2-3 sentence professional summary based on actual work patterns"
}

IMPORTANT GUIDELINES:
- Base the role ONLY on actual work described, not assumptions
- Be specific about technical expertise (e.g., 'microfluidics design' not 'engineering')
- Include domain-specific technologies and methods mentioned
- Make the summary reflect actual accomplishments and focus areas
- If work involves hardware/devices, specify the type (biomedical, electronics, mechanical, etc.)
- If work involves research, specify the domain (materials, biology, data analysis, etc.)

Respond with ONLY the JSON object, no additional text.`;

    try {
      const response = await this.gemini.generateText(prompt);
      
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse the JSON response
      const analysisData = JSON.parse(cleanResponse);
      
      // Generate email and display name
      const email = `${employeeName.toLowerCase()}@company.com`;
      const displayName = this.generateDisplayName(employeeName);

      return {
        name: employeeName,
        email,
        displayName,
        role: analysisData.role || 'Team Member',
        expertise: Array.isArray(analysisData.expertise) ? analysisData.expertise : [],
        workStyle: analysisData.workStyle || 'collaborative',
        projects: data.projects,
        recentActivities: data.workSummaries,
        challenges: data.challenges,
        technologies: Array.isArray(analysisData.technologies) ? analysisData.technologies : [],
        summary: analysisData.summary || 'Team member contributing to various projects.'
      };

    } catch (error) {
      console.error(`[GEMINI_CONTEXT] Error parsing Gemini response for ${employeeName}:`, error);
      
      // Fallback to basic context
      return {
        name: employeeName,
        email: `${employeeName.toLowerCase()}@company.com`,
        displayName: this.generateDisplayName(employeeName),
        role: 'Team Member',
        expertise: ['project contribution'],
        workStyle: 'collaborative',
        projects: data.projects,
        recentActivities: data.workSummaries,
        challenges: data.challenges,
        technologies: [],
        summary: 'Team member working on various technical projects.'
      };
    }
  }

  private generateDisplayName(name: string): string {
    const nameMap: { [key: string]: string } = {
      'Sergio': 'Sergio Dhelomme',
      'Kam': 'Kam Ghofrani', // Corrected based on the check-in file
      'Bayan': 'Bayan Mashrequi',
      'Rosemary': 'Rosemary Wilson',
      'Shaheer': 'Shaheer Ahmad',
      'Shahzad': 'Shahzad Khan',
      'Tyler': 'Tyler Johnson',
      'Hesam': 'Hesam Mirzaei',
      'Aliya': 'Aliya Patel',
      'Amir': 'Amir Hassan',
      'Mori': 'Mori Tanaka',
      'Nirvana': 'Nirvana Smith'
    };

    return nameMap[name] || `${name} ${name}son`;
  }

  async getAvailableEmployees(): Promise<string[]> {
    try {
      const entries = await readdir(this.storiesPath);
      const employees = [];
      
      for (const entry of entries) {
        try {
          const checkinsPath = join(this.storiesPath, entry, 'Check-ins 7df0923e650b408b878362d17e574008');
          const files = await readdir(checkinsPath);
          if (files.some(f => f.endsWith('.md'))) {
            employees.push(entry);
          }
        } catch {
          // Skip entries that don't have the expected structure
        }
      }
      
      return employees;
    } catch (error) {
      console.error('[GEMINI_CONTEXT] Error getting available employees:', error);
      return [];
    }
  }

  clearCache(): void {
    this.contextCache.clear();
  }
}
