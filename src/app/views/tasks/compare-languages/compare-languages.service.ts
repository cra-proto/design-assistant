import { Injectable, signal } from '@angular/core';

export type AiJobStatus = 'pending' | 'done' | 'error';

export interface LanguageDifference {
  english: string;
  french: string;
  issue: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewLanguagesService {
  // Track AI jobs
  private readonly aiResponses = signal<Map<string, LanguageDifference[]>>(new Map());
  private static readonly NO_DIFFS: LanguageDifference[] = [];

  public getAiResponse(path: string): LanguageDifference[] {
    return this.aiResponses().get(path) ?? ReviewLanguagesService.NO_DIFFS;
  }

  public setAiResponse(path: string, differences: LanguageDifference[]): void {
    const map = new Map(this.aiResponses());
    map.set(path, differences);
    this.aiResponses.set(map);
  }

  private readonly aiJobs = signal<Map<string, AiJobStatus>>(new Map());

  public getAiJobStatus(path: string): AiJobStatus | undefined {
    return this.aiJobs().get(path);
  }

  public setAiJobStatus(path: string, status: AiJobStatus): void {
    const map = new Map(this.aiJobs());
    map.set(path, status);
    this.aiJobs.set(map);
  }

  public clearAiJobStatus(path: string): void {
    const map = new Map(this.aiJobs());
    map.delete(path);
    this.aiJobs.set(map);
  }
}
