import { inject, Injectable, signal } from '@angular/core';

import { FetchService } from '../../services/fetch.service';
import { htmlProcessingResult } from '../../services/html-normalization.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { UserSettingsService } from '../../services/user-settings.service';

import { AI_FREE_MODELS, AiFreeModelOptions, AiPaidModelOptions } from '../../common/ai-models.config';
import { CompareVersion, SourceVersion } from '../../common/data.model';
import { DiffUndoStack } from './compare-undo.store';

export type AiTaskOption = 'default' | 'models' | 'prompts';

@Injectable({
  providedIn: 'root',
})
export class CompareService {
  private readonly projectState = inject(ProjectStateService);
  private readonly projectCache = inject(ProjectCacheService);
  private readonly settingsService = inject(UserSettingsService);
  private readonly fetchService = inject(FetchService);

  // HTML content cache
  private readonly htmlCache = signal<Map<string, htmlProcessingResult>>(new Map());
  private readonly statusCache = signal<Map<string, boolean>>(new Map());
  public readonly originalHtml = signal<htmlProcessingResult | undefined>(undefined);
  public readonly modifiedHtml = signal<htmlProcessingResult | undefined>(undefined);

  // User selections & defaults: version selection
  public readonly selectedPage = signal('');
  public readonly selectedBefore = signal<SourceVersion>('live');
  public readonly selectedAfter = signal<CompareVersion>('protoGH');

  // User selections & defaults: view selection
  public readonly selectedView = signal<'original' | 'diff' | 'modified'>('diff');

  public readonly loading = signal<boolean>(false);
  public readonly loadingBefore = signal<boolean>(false);
  public readonly loadingAfter = signal<boolean>(false);
  public readonly loadingAll = signal<boolean>(false);

  public readonly hasChanges = signal<boolean>(false);

  public readonly aiDrawerVisible = signal<boolean>(false);
  public readonly selectedTask = signal<AiTaskOption>('default');
  public readonly selectedModel = signal<AiFreeModelOptions | AiPaidModelOptions>(AI_FREE_MODELS[0]);

  // Helpers to get & set HTML cache
  public getCachedHtml(url: string): htmlProcessingResult | undefined {
    return this.htmlCache().get(url);
  }

  public setCachedHtml(url: string, html: htmlProcessingResult): void {
    const cache = new Map(this.htmlCache());
    cache.set(url, html);
    this.htmlCache.set(cache);
  }

  // Helpers to get & set status cache
  private getCachedStatus(url: string): boolean | undefined {
    return this.statusCache().get(url);
  }

  private setCachedStatus(url: string, status: boolean): void {
    const cache = new Map(this.statusCache());
    cache.set(url, status);
    this.statusCache.set(cache);
    console.log('Cached status:', url, status);
  }

  // Clear HTML content cache
  public clearCache() {
    this.htmlCache.set(new Map());
    this.statusCache.set(new Map());
    this.originalHtml.set(undefined);
    this.modifiedHtml.set(undefined);
  }

  // Reset to defaults
  public resetSelections() {
    this.selectedPage.set('');
    this.selectedBefore.set('live');
    this.selectedAfter.set('protoGH');
    this.selectedView.set('diff');
    this.clearCache();
  }

  // Get list of versions to check
  public getVersionsToCheck(path: string): { url: string; version: SourceVersion }[] {
    const project = this.projectState.getProject();
    const versions: { url: string; version: SourceVersion }[] = [{ url: this.fetchService.generateUrl(path, 'live'), version: 'live' }];
    if (this.settingsService.includePreview()) {
      versions.push({ url: this.fetchService.generateUrl(path, 'preview'), version: 'preview' });
    }
    if (project.lastExported && this.settingsService.includeGitHub()) {
      versions.push({ url: this.fetchService.generateUrl(path, 'protoGH', project.github.owner, project.github.repo), version: 'protoGH' });
      if (project.github.hasBaselineRepo && this.settingsService.includeBaseline())
        versions.push({ url: this.fetchService.generateUrl(path, 'baseGH', project.github.owner, project.github.repo), version: 'baseGH' });
    }
    if (project.lastDownloaded && this.settingsService.includeLocal()) {
      versions.push({ url: this.fetchService.generateUrl(path, 'protoUT', project.github.owner, project.github.repo), version: 'protoUT' });
      if (project.github.hasBaselineRepo && this.settingsService.includeBaseline())
        versions.push({ url: this.fetchService.generateUrl(path, 'baseUT', project.github.owner, project.github.repo), version: 'baseUT' });
    }
    return versions;
  }

  // Check a versions status
  public async checkVersion(url: string, version: string, validVersions: string[]): Promise<void> {
    if (!url) return;
    const cached = this.getCachedStatus(url);
    if (cached) {
      validVersions.push(version);
      return;
    }
    try {
      let result;
      if (version === 'preview') {
        result = await this.fetchService.fetchStatusViaProxy(url);
      } else {
        result = (await this.fetchService.fetchStatus(url, 'both')).ok;
      }
      this.setCachedStatus(url, result);
      if (result) validVersions.push(version);
    } catch {
      this.setCachedStatus(url, false);
    }
  }

  public readonly undoStack = new DiffUndoStack();
}
