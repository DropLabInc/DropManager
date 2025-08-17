import { AgentMessage, AgentType, AgentContext } from './types.js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface TeamMemberProfile {
  name: string;
  email: string;
  displayName: string;
  role: string;
  folder: string;
  patterns: string[];
  messageTemplates: MessageTemplate[];
}

interface MessageTemplate {
  type: 'progress' | 'challenge' | 'completion' | 'planning' | 'technical';
  weight: number;
  templates: string[];
}

export class DataGeneratorAgent {
  private readonly agentType: AgentType = 'notification'; // Reusing existing type
  private teamProfiles: TeamMemberProfile[] = [];
  private storiesPath: string;

  constructor(storiesPath: string = '../Stories/Data') {
    this.storiesPath = storiesPath;
    this.initializeTeamProfiles();
  }

  private initializeTeamProfiles(): void {
    // Define team member profiles based on Stories folder structure
    this.teamProfiles = [
      {
        name: 'Sergio',
        email: 'sergio@company.com',
        displayName: 'Sergio Dhelomme',
        role: 'Hardware Engineer',
        folder: 'Sergio',
        patterns: ['hardware', 'testing', 'characterization', 'megastat', 'encoder', 'grounding'],
        messageTemplates: [
          {
            type: 'technical',
            weight: 0.4,
            templates: [
              'Current testing of {component} shows {status}. {details}',
              'Identified {issue} with {system}. {resolution_plan}',
              'Characterization of {device} reveals {findings}. Next steps: {next_steps}'
            ]
          },
          {
            type: 'challenge',
            weight: 0.3,
            templates: [
              'Waiting for {component}, delaying {task}. {impact}',
              'Ongoing concerns about {system} reliability. {details}',
              'Current {tool} has insufficient {capability}. Need {solution}'
            ]
          },
          {
            type: 'progress',
            weight: 0.3,
            templates: [
              'Completed {task}. Results show {outcome}',
              'Data collection for {project} is {status}. {metrics}',
              'Testing phase {phase} finished. Moving to {next_phase}'
            ]
          }
        ]
      },
      {
        name: 'Bayan',
        email: 'bayan@company.com',
        displayName: 'Bayan Mashrequi',
        role: 'Research Engineer',
        folder: 'Bayan',
        patterns: ['research', 'analysis', 'data', 'experiments', 'methodology'],
        messageTemplates: [
          {
            type: 'progress',
            weight: 0.4,
            templates: [
              'Completed analysis of {dataset}. Key findings: {findings}',
              'Research on {topic} progressing well. {status}',
              'Experimental setup for {project} is {completion}% complete'
            ]
          },
          {
            type: 'technical',
            weight: 0.3,
            templates: [
              'Methodology for {process} has been {action}. {details}',
              'Data processing pipeline shows {results}. {implications}',
              'Statistical analysis reveals {pattern}. Confidence: {confidence}'
            ]
          },
          {
            type: 'planning',
            weight: 0.3,
            templates: [
              'Planning next phase of {project}. Timeline: {timeline}',
              'Need to {action} before proceeding with {task}',
              'Scheduling {meeting_type} to discuss {topic}'
            ]
          }
        ]
      },
      {
        name: 'Kam',
        email: 'kam@company.com',
        displayName: 'Kam Leung',
        role: 'Software Engineer',
        folder: 'Kam',
        patterns: ['software', 'development', 'coding', 'architecture', 'deployment'],
        messageTemplates: [
          {
            type: 'progress',
            weight: 0.4,
            templates: [
              'Implemented {feature} for {project}. {status}',
              'Code review completed for {module}. {feedback}',
              'Deployment of {service} to {environment} successful'
            ]
          },
          {
            type: 'technical',
            weight: 0.4,
            templates: [
              'Refactored {component} to improve {metric}. {improvement}',
              'Integrated {service} with {system}. {outcome}',
              'Performance optimization of {feature} shows {results}'
            ]
          },
          {
            type: 'challenge',
            weight: 0.2,
            templates: [
              'Encountered {issue} with {technology}. {workaround}',
              'Dependency conflict between {lib1} and {lib2}. {resolution}',
              'Need to {action} to resolve {problem}'
            ]
          }
        ]
      },
      {
        name: 'Rosemary',
        email: 'rosemary@company.com',
        displayName: 'Rosemary Wilson',
        role: 'Project Manager',
        folder: 'Rosemary',
        patterns: ['project', 'timeline', 'coordination', 'stakeholder', 'planning'],
        messageTemplates: [
          {
            type: 'planning',
            weight: 0.4,
            templates: [
              'Sprint planning for {project} completed. {deliverables}',
              'Stakeholder meeting scheduled for {date}. Agenda: {topics}',
              'Timeline for {milestone} has been {action}. New date: {date}'
            ]
          },
          {
            type: 'progress',
            weight: 0.3,
            templates: [
              'Project {project} is {status}. {details}',
              'Team coordination meeting yielded {outcomes}',
              'Resource allocation for {task} has been {action}'
            ]
          },
          {
            type: 'challenge',
            weight: 0.3,
            templates: [
              'Risk identified in {project}: {risk}. Mitigation: {plan}',
              'Dependency blocker: {blocker}. Working with {team} to resolve',
              'Budget concerns for {project}. Need to {action}'
            ]
          }
        ]
      }
    ];
  }

  public async generateMessage(memberName: string, messageType?: 'progress' | 'challenge' | 'completion' | 'planning' | 'technical'): Promise<{
    messageText: string;
    senderEmail: string;
    senderDisplay: string;
  }> {
    const profile = this.teamProfiles.find(p => p.name === memberName);
    if (!profile) {
      throw new Error(`Team member ${memberName} not found`);
    }

    // Select message template based on type or weight
    let selectedTemplate: MessageTemplate;
    if (messageType) {
      selectedTemplate = profile.messageTemplates.find(t => t.type === messageType) || profile.messageTemplates[0];
    } else {
      // Weighted random selection
      const totalWeight = profile.messageTemplates.reduce((sum, t) => sum + t.weight, 0);
      let random = Math.random() * totalWeight;
      selectedTemplate = profile.messageTemplates[0];
      
      for (const template of profile.messageTemplates) {
        random -= template.weight;
        if (random <= 0) {
          selectedTemplate = template;
          break;
        }
      }
    }

    // Generate message from template
    const templateText = selectedTemplate.templates[Math.floor(Math.random() * selectedTemplate.templates.length)];
    const messageText = this.fillTemplate(templateText, profile);

    return {
      messageText,
      senderEmail: profile.email,
      senderDisplay: profile.displayName
    };
  }

  private fillTemplate(template: string, profile: TeamMemberProfile): string {
    const placeholders = template.match(/\{([^}]+)\}/g) || [];
    let result = template;

    for (const placeholder of placeholders) {
      const key = placeholder.slice(1, -1); // Remove { }
      const value = this.generatePlaceholderValue(key, profile);
      result = result.replace(placeholder, value);
    }

    return result;
  }

  private generatePlaceholderValue(key: string, profile: TeamMemberProfile): string {
    const valueMap: { [key: string]: string[] } = {
      // Technical components
      component: ['parallel processes', 'megastat', 'encoder system', 'logic analyzer', 'test cards', 'motor assembly'],
      system: ['grounding system', 'communication protocol', 'data collection', 'measurement system', 'control loop'],
      device: ['megastat', 'encoder', 'logic analyzer', 'test bench', 'measurement device'],
      tool: ['logic analyzer', 'oscilloscope', 'test equipment', 'measurement tools'],
      
      // Status and outcomes
      status: ['consistent', 'improved', 'stable', 'optimized', 'calibrated', 'validated'],
      outcome: ['20% improvement', 'better accuracy', 'reduced noise', 'faster response', 'cleaner data'],
      results: ['positive trends', 'expected values', 'improved metrics', 'stable performance'],
      
      // Issues and challenges
      issue: ['noise problems', 'grounding issues', 'communication errors', 'timing problems', 'calibration drift'],
      problem: ['hardware instability', 'software bugs', 'integration issues', 'performance bottlenecks'],
      blocker: ['missing components', 'hardware failure', 'software dependency', 'resource constraints'],
      
      // Actions and plans
      action: ['updated', 'modified', 'optimized', 'reconfigured', 'redesigned'],
      next_steps: ['characterize offset and noise', 'improve communication protocol', 'enhance stability', 'validate results'],
      resolution_plan: ['ordering replacement parts', 'implementing workaround', 'redesigning circuit', 'updating software'],
      
      // Projects and tasks
      project: ['LS-SOL-HRD', 'LS-SOL-FRM', 'hardware validation', 'system integration', 'performance optimization'],
      task: ['data collection', 'system characterization', 'component testing', 'calibration procedure'],
      feature: ['user authentication', 'data visualization', 'API endpoint', 'dashboard component'],
      module: ['authentication service', 'data processor', 'user interface', 'integration layer'],
      
      // Metrics and measurements
      metrics: ['99.5% accuracy', '15ms response time', '0.1% error rate', '40% performance improvement'],
      improvement: ['25% faster execution', '50% reduced memory usage', '30% better accuracy'],
      confidence: ['95%', '90%', '85%', '99%'],
      
      // Dates and timelines
      date: ['next Friday', 'end of week', 'Monday morning', 'by Thursday'],
      timeline: ['2 weeks', '1 month', 'end of sprint', 'by milestone'],
      phase: ['initial testing', 'validation', 'integration', 'deployment'],
      next_phase: ['production testing', 'field validation', 'deployment prep', 'user acceptance']
    };

    const values = valueMap[key];
    if (values) {
      return values[Math.floor(Math.random() * values.length)];
    }

    // Fallback for unknown placeholders
    return `[${key}]`;
  }

  public async generateBatchMessages(count: number, memberNames?: string[]): Promise<Array<{
    messageText: string;
    senderEmail: string;
    senderDisplay: string;
  }>> {
    const messages = [];
    const availableMembers = memberNames || this.teamProfiles.map(p => p.name);

    for (let i = 0; i < count; i++) {
      const randomMember = availableMembers[Math.floor(Math.random() * availableMembers.length)];
      const message = await this.generateMessage(randomMember);
      messages.push(message);
    }

    return messages;
  }

  public getAvailableMembers(): string[] {
    return this.teamProfiles.map(p => p.name);
  }

  public getMemberProfile(name: string): TeamMemberProfile | undefined {
    return this.teamProfiles.find(p => p.name === name);
  }
}
