import fs from 'fs';
import path from 'path';

export interface PersistentData {
  employees: Record<string, any>;
  projects: Record<string, any>;
  tasks: Record<string, any>;
  updates: Record<string, any>;
}

export class SimplePersistence {
  private dataFile: string;
  private backupFile: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('[PERSISTENCE] Created data directory:', dataDir);
    }

    this.dataFile = path.join(dataDir, 'dropmanager-data.json');
    this.backupFile = path.join(dataDir, 'dropmanager-data.backup.json');
    
    console.log('[PERSISTENCE] Initialized with file:', this.dataFile);
  }

  async save(data: PersistentData): Promise<void> {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      
      // Create backup of existing data
      if (fs.existsSync(this.dataFile)) {
        fs.copyFileSync(this.dataFile, this.backupFile);
      }
      
      // Write new data
      fs.writeFileSync(this.dataFile, jsonData, 'utf8');
      console.log('[PERSISTENCE] Data saved successfully');
      
    } catch (error: any) {
      console.error('[PERSISTENCE] Save failed:', error.message);
      throw error;
    }
  }

  async load(): Promise<PersistentData | null> {
    try {
      if (!fs.existsSync(this.dataFile)) {
        console.log('[PERSISTENCE] No existing data file found');
        return null;
      }

      const jsonData = fs.readFileSync(this.dataFile, 'utf8');
      const data = JSON.parse(jsonData) as PersistentData;
      
      console.log('[PERSISTENCE] Data loaded successfully');
      console.log(`[PERSISTENCE] Loaded: ${Object.keys(data.employees || {}).length} employees, ${Object.keys(data.updates || {}).length} updates`);
      
      return data;
      
    } catch (error: any) {
      console.error('[PERSISTENCE] Load failed:', error.message);
      
      // Try backup file
      if (fs.existsSync(this.backupFile)) {
        try {
          console.log('[PERSISTENCE] Attempting to load from backup...');
          const backupData = fs.readFileSync(this.backupFile, 'utf8');
          return JSON.parse(backupData) as PersistentData;
        } catch (backupError: any) {
          console.error('[PERSISTENCE] Backup load also failed:', backupError.message);
        }
      }
      
      return null;
    }
  }

  getDataPath(): string {
    return this.dataFile;
  }
}
