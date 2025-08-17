export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class AnalysisCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs
    });
    
    console.log(`[ANALYSIS_CACHE] Cached: ${key} (expires in ${ttlMs/1000}s)`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      console.log(`[ANALYSIS_CACHE] Expired: ${key}`);
      return null;
    }

    console.log(`[ANALYSIS_CACHE] Hit: ${key}`);
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
    console.log(`[ANALYSIS_CACHE] Deleted: ${key}`);
  }

  clear(): void {
    this.cache.clear();
    console.log('[ANALYSIS_CACHE] Cleared all entries');
  }

  invalidatePattern(pattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    console.log(`[ANALYSIS_CACHE] Invalidated ${keysToDelete.length} entries matching: ${pattern}`);
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`[ANALYSIS_CACHE] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  getStats(): { size: number; entries: Array<{key: string; age: number; ttl: number}> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.expiresAt - now
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  // Cache key generators
  static summaryKey(type: string, projectId?: string): string {
    return `summary:${type}${projectId ? `:${projectId}` : ''}`;
  }

  static gapsKey(projectId?: string): string {
    return `gaps${projectId ? `:${projectId}` : ''}`;
  }
}
