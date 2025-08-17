import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface EmployeeContext {
  name: string;
  email: string;
  displayName: string;
  projects: string[];
  workPatterns: string[];
  challenges: string[];
  technologies: string[];
  recentActivities: string[];
  aiSummaries: string[];
  workStyle: string;
  expertise: string[];
}

export class ContextExtractor {
  private storiesPath: string;

  constructor(storiesPath: string = '../Stories/Data') {
    this.storiesPath = storiesPath;
  }

  async extractEmployeeContext(employeeName: string): Promise<EmployeeContext | null> {
    try {
      const employeePath = join(this.storiesPath, employeeName);
      const checkinsPath = join(employeePath, 'Check-ins 7df0923e650b408b878362d17e574008');
      
      // Read all markdown files for this employee
      const files = await readdir(checkinsPath);
      const markdownFiles = files.filter(f => f.endsWith('.md'));
      
      const projects = new Set<string>();
      const workPatterns = new Set<string>();
      const challenges = new Set<string>();
      const technologies = new Set<string>();
      const recentActivities = new Set<string>();
      const aiSummaries: string[] = [];

      // Sample up to 10 files to get context (most recent or varied)
      const samplesToRead = Math.min(10, markdownFiles.length);
      const selectedFiles = markdownFiles.slice(0, samplesToRead);

      for (const file of selectedFiles) {
        try {
          const filePath = join(checkinsPath, file);
          const content = await readFile(filePath, 'utf-8');
          
          // Extract projects from "Related Projects" line
          const projectMatch = content.match(/Related Projects: (.+)/);
          if (projectMatch) {
            const projectText = projectMatch[1];
            // Extract project names (text before parentheses with URLs)
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

          // Extract AI Summary if present
          const summaryMatch = content.match(/AI Summary: (.+?)(?:\n\n|\n###)/s);
          if (summaryMatch) {
            aiSummaries.push(summaryMatch[1].trim());
          }

          // Extract work summary content
          const workSummaryMatch = content.match(/### Work Summary\s*---\s*(.*?)(?=---|\n###|$)/s);
          if (workSummaryMatch) {
            const workContent = workSummaryMatch[1].trim();
            if (workContent && workContent !== '-' && !workContent.includes('What tasks did you work on')) {
              const activities = workContent.split('\n').map(line => line.replace(/^-\s*/, '').trim()).filter(line => line && line !== '-');
              activities.forEach(activity => {
                if (activity.length > 10) { // Filter out very short entries
                  recentActivities.add(activity);
                }
              });
            }
          }

          // Extract challenges
          const challengesMatch = content.match(/### Challenges & Roadblocks\s*---\s*(.*?)(?=---|\n###|$)/s);
          if (challengesMatch) {
            const challengeContent = challengesMatch[1].trim();
            if (challengeContent && challengeContent !== '-' && !challengeContent.includes('Did you run into any problems')) {
              const challengeItems = challengeContent.split('\n').map(line => line.replace(/^-\s*/, '').trim()).filter(line => line && line !== '-');
              challengeItems.forEach(challenge => {
                if (challenge.length > 10) {
                  challenges.add(challenge);
                }
              });
            }
          }

          // Extract technical terms and technologies
          this.extractTechnicalTerms(content, technologies, workPatterns);

        } catch (fileError) {
          console.warn(`[CONTEXT] Could not read file ${file}:`, fileError);
        }
      }

      // Determine employee profile based on extracted context
      const context = this.buildEmployeeProfile(
        employeeName,
        Array.from(projects),
        Array.from(workPatterns),
        Array.from(challenges),
        Array.from(technologies),
        Array.from(recentActivities),
        aiSummaries
      );

      return context;

    } catch (error) {
      console.error(`[CONTEXT] Error extracting context for ${employeeName}:`, error);
      return null;
    }
  }

  private extractTechnicalTerms(content: string, technologies: Set<string>, workPatterns: Set<string>): void {
    const lowerContent = content.toLowerCase();

    // Biomedical/Microfluidics terms
    const biomedicalTerms = ['fluidics', 'cytometry', 'particles', 'flow cell', 'resin', 'cartridge', 'membrane', 'pumps', 'device', 'testing', 'manufacturing', 'hydrophilic', 'laser-cut', 'jigs', 'adhesive', 'clean room', 'nitrogen sensing', 'iot stack', 'connectivity'];
    
    // Hardware/Electronics terms
    const hardwareTerms = ['encoder', 'motor', 'circuit', 'pcb', 'analog', 'digital', 'sensor', 'actuator', 'amplifier', 'oscilloscope', 'logic analyzer', 'megastat', 'grounding', 'noise', 'signal', 'voltage', 'current', 'resistance', 'capacitor', 'inductor'];
    
    // Software terms
    const softwareTerms = ['api', 'database', 'server', 'client', 'frontend', 'backend', 'algorithm', 'code', 'programming', 'deployment', 'testing', 'debugging', 'optimization', 'architecture', 'framework', 'library', 'integration'];
    
    // Research terms
    const researchTerms = ['analysis', 'data', 'experiment', 'methodology', 'statistical', 'correlation', 'regression', 'hypothesis', 'validation', 'verification', 'characterization', 'measurement', 'calibration', 'baseline'];
    
    // Project management terms
    const pmTerms = ['timeline', 'milestone', 'deliverable', 'stakeholder', 'requirement', 'specification', 'planning', 'coordination', 'resource', 'budget', 'risk', 'mitigation'];

    // Work pattern terms
    const patterns = ['testing', 'development', 'research', 'analysis', 'design', 'implementation', 'optimization', 'troubleshooting', 'documentation', 'review', 'meeting', 'presentation', 'fabrication', 'prototyping', 'validation'];

    [biomedicalTerms, hardwareTerms, softwareTerms, researchTerms, pmTerms].flat().forEach(term => {
      if (lowerContent.includes(term)) {
        technologies.add(term);
      }
    });

    patterns.forEach(pattern => {
      if (lowerContent.includes(pattern)) {
        workPatterns.add(pattern);
      }
    });
  }

  private buildEmployeeProfile(
    name: string,
    projects: string[],
    workPatterns: string[],
    challenges: string[],
    technologies: string[],
    recentActivities: string[],
    aiSummaries: string[]
  ): EmployeeContext {
    // Determine role and expertise based on technologies and patterns
    let role = 'Team Member';
    let expertise: string[] = [];
    let workStyle = 'collaborative';

    const techSet = new Set(technologies.map(t => t.toLowerCase()));
    const patternSet = new Set(workPatterns.map(p => p.toLowerCase()));
    const contentLower = [...recentActivities, ...challenges].join(' ').toLowerCase();

    // Check for biomedical/microfluidics engineering
    if (contentLower.includes('fluidics') || contentLower.includes('cytometry') || 
        contentLower.includes('particles') || contentLower.includes('flow cell') ||
        contentLower.includes('resin') || contentLower.includes('cartridge') ||
        contentLower.includes('membrane') || contentLower.includes('pumps') ||
        contentLower.includes('device') && (contentLower.includes('testing') || contentLower.includes('manufacturing'))) {
      role = 'Biomedical Engineer';
      expertise = ['microfluidics', 'device development', 'flow cell design', 'biomedical testing'];
      workStyle = 'experimental and iterative';
    } else if (techSet.has('encoder') || techSet.has('circuit') || techSet.has('motor') || techSet.has('analog') ||
               contentLower.includes('grounding') || contentLower.includes('megastat') || contentLower.includes('logic analyzer')) {
      role = 'Hardware Engineer';
      expertise = ['hardware design', 'circuit analysis', 'sensor integration', 'signal processing'];
      workStyle = 'detail-oriented and methodical';
    } else if (techSet.has('api') || techSet.has('server') || techSet.has('database') || techSet.has('code') ||
               contentLower.includes('software') || contentLower.includes('programming') || contentLower.includes('deployment')) {
      role = 'Software Engineer';
      expertise = ['software development', 'system architecture', 'database design', 'API integration'];
      workStyle = 'iterative and collaborative';
    } else if (techSet.has('analysis') || techSet.has('experiment') || techSet.has('statistical') ||
               contentLower.includes('data analysis') || contentLower.includes('methodology')) {
      role = 'Research Engineer';
      expertise = ['data analysis', 'experimental design', 'statistical modeling', 'research methodology'];
      workStyle = 'analytical and thorough';
    } else if (patternSet.has('planning') || patternSet.has('coordination') || techSet.has('timeline') ||
               contentLower.includes('stakeholder') || contentLower.includes('milestone')) {
      role = 'Project Manager';
      expertise = ['project planning', 'team coordination', 'risk management', 'stakeholder communication'];
      workStyle = 'organized and communicative';
    }

    // Generate email and display name
    const email = `${name.toLowerCase()}@company.com`;
    const displayName = this.generateDisplayName(name);

    return {
      name,
      email,
      displayName,
      projects: projects.slice(0, 5), // Limit to top 5 projects
      workPatterns: workPatterns.slice(0, 8),
      challenges: challenges.slice(0, 5),
      technologies: technologies.slice(0, 10),
      recentActivities: recentActivities.slice(0, 8),
      aiSummaries: aiSummaries.slice(0, 3), // Keep most recent summaries
      workStyle,
      expertise
    };
  }

  private generateDisplayName(name: string): string {
    // Map common names to full display names based on the Stories data
    const nameMap: { [key: string]: string } = {
      'Sergio': 'Sergio Dhelomme',
      'Kam': 'Kam Leung',
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

    return nameMap[name] || `${name} ${name}son`; // Fallback pattern
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
      console.error('[CONTEXT] Error getting available employees:', error);
      return [];
    }
  }
}
