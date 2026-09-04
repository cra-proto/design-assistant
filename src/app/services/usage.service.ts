import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { firstValueFrom, Observable } from 'rxjs';

import { UserSettingsService } from './user-settings.service';

import { environment } from '../../environments/environment';
import { MetadataReview } from '../common/data.model';

export interface UsageStats {
  uniqueUsersTotal: number;
  uniqueUsersGitHub: number;
  uniqueUsersAnonymous: number;

  totalGenerations: number;
  metadataGenerations: number;
  pageGenerations: number;

  uniqueProjects: number;
  localProjects: number;
  cloudProjects: number;

  uniqueUrls: number;
  enUrls: number;
  frUrls: number;

  exportCountGit: number;
  enPageCountGit: number;
  frPageCountGit: number;

  uniqueReposGit: number;
  prototypeReposGit: number;
  baselineReposGit: number;

  exportCountLocal: number;
  enPageCountLocal: number;
  frPageCountLocal: number;

  uniqueReposLocal: number;
  prototypeReposLocal: number;
  baselineReposLocal: number;

  uniqueOrgCount: number;
}

export interface UsageRecord {
  pk: string;
  sk: string;
  feature: string;
  projectId: string;
  org: string;
  userId: string;
  pageUrl: string;
  model: string;
  promptType?: string;
  promptVersion: number;
  generatedAt: string;
  statusDescEN: string;
  statusDescFR: string;
  statusKeywordsEN: string;
  statusKeywordsFR: string;
  lastUpdated: string;
}

@Injectable({ providedIn: 'root' })
export class UsageService {
  private http = inject(HttpClient);
  private settingsService = inject(UserSettingsService);

  private readonly apiUrl = environment.usageFunctionUrl;

  /** Track acceptance of generated metadata */
  async trackMetadata(
    projectId: string,
    orgId: string,
    storageType: string,
    pageUrl: string,
    originalDescEN: string | undefined,
    originalDescFR: string | undefined,
    originalKeywordsEN: string[] | undefined,
    originalKeywordsFR: string[] | undefined,
    review: MetadataReview,
    promptConfig: object,
    isUpdate = false,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(this.apiUrl, {
          isUpdate,
          feature: 'metadata',
          projectId,
          orgId,
          storageType,
          userId: this.settingsService.userId(),
          pageUrl,
          model: review.model,
          promptConfig,
          generatedAt: new Date(review.generatedAt).toISOString(),
          originalDescEN,
          originalDescFR,
          originalKeywordsEN,
          originalKeywordsFR,
          aiDescEN: review.en.description.ai,
          aiDescFR: review.fr.description.ai,
          aiKeywordsEN: review.en.keywords.ai,
          aiKeywordsFR: review.fr.keywords.ai,
          finalDescEN: review.en.description.edited ?? review.en.description.ai,
          finalDescFR: review.fr.description.edited ?? review.fr.description.ai,
          finalKeywordsEN: review.en.keywords.edited ?? review.en.keywords.ai,
          finalKeywordsFR: review.fr.keywords.edited ?? review.fr.keywords.ai,
          statusDescEN: review.en.description.status,
          statusDescFR: review.fr.description.status,
          statusKeywordsEN: review.en.keywords.status,
          statusKeywordsFR: review.fr.keywords.status,
        }),
      );
    } catch (error) {
      console.warn('Usage tracking failed silently:', error);
    }
  }

  /** Track GitHub and Local file exports */
  async trackExport(projectId: string, orgId: string, storageType: string, repoType: string, repo: string, exportTarget: string, pageCountEN: number, pageCountFR: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(this.apiUrl, {
          feature: 'export',
          projectId,
          orgId,
          storageType,
          repoType,
          userId: this.settingsService.userId(),
          repo,
          exportTarget,
          pageCountEN,
          pageCountFR,
        }),
      );
    } catch (error) {
      console.warn('Export tracking failed silently:', error);
    }
  }

  /** Get global stats */
  async loadGlobal(): Promise<UsageStats> {
    return await firstValueFrom(this.http.get<UsageStats>(this.apiUrl));
  }

  /** Get feature stats */
  async loadFeature(feature: string): Promise<UsageRecord[]> {
    const result = await firstValueFrom(this.http.get<{ items: UsageRecord[] }>(`${this.apiUrl}?feature=${feature}`));
    return result.items;
  }

  /** Update temporary userID's with GitHub userID's when user logs in */
  async updateUserId(tempUserId: string, githubUserId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(this.apiUrl, {
          feature: 'update-user',
          tempUserId,
          githubUserId,
        }),
      );
    } catch (error) {
      console.warn('User ID update failed silently:', error);
    }
  }

  /** Delete records for a specific user (intended for deleting AIDA developer records) */
  deleteUserRecords(userId: string): Observable<{ message: string; deleted: number }> {
    return this.http.post<{ message: string; deleted: number }>(this.apiUrl, { feature: 'delete-user', userId });
  }
}
