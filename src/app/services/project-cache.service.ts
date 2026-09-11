import { effect, inject, Injectable, signal } from '@angular/core';

import { FetchService } from './fetch.service';
import { htmlProcessingResult } from './html-normalization.service';
import { ProjectStateService } from './project-state.service';
import { UserSettingsService } from './user-settings.service';

import { SourceVersion } from '../common/data.model';
import { DiffUndoStack } from '../components/compare/compare-undo.store';

export interface PageEditState {
  originalHtml: htmlProcessingResult;
  modifiedHtml: htmlProcessingResult;
  undoStack: DiffUndoStack;
}

/*
 * Use this service to cache temporary variables related to the active project
 */
@Injectable({ providedIn: 'root' })
export class ProjectCacheService {
  private readonly projectState = inject(ProjectStateService);
  private readonly fetchService = inject(FetchService);
  private readonly settingsService = inject(UserSettingsService);

  // Track availability of local and github versions (for managing UI state)

  /** Signal will be true if prototype github repo exists (updatable via effect) */
  public readonly hasGitHub = signal<boolean>(false);
  /** Signal will be true if baseline github repo exists (updatable via effect) */
  public readonly hasGitHubBL = signal<boolean>(false);
  /** Signal will be true if local index page is fetchable (updatable via user action only) */
  public readonly hasLocal = signal<boolean | null>(null);
  /** Signal will be true if local baseline index page is fetchable (updatable via user action only) */
  public readonly hasLocalBL = signal<boolean | null>(null);
  /** Signal will be true if AEM preview is fetchable (updatable via user action only) */
  public readonly hasPreview = signal<boolean | null>(null);

  private localCheckInProgress = false;
  private previewCheckInProgress = false;
  private githubCheckInProgress = false;

  // Track user choices on select buttons (for managing UI state)

  /** Signal defaults to project language if 'both' is not a valid option */
  public readonly selectedLang = signal<'en' | 'fr' | 'both'>(this.projectState.detectPrimaryLanguage());

  /** Signal can be used to display all project pages or just the inScope pages */
  public readonly selectedScope = signal<'inScope' | 'all'>('inScope');

  /** Signal can be used to access specific versions stored in AIDA. Defaults to prototype. */
  public readonly selectedVersion = signal<'prototype' | 'live' | 'baseline'>('prototype');

  /** Signal can be used to access specific versions stored outside of AIDA. Defaults to live. */
  public readonly selectedSource = signal<SourceVersion>('live');

  /** Signal for the IA diagram view. Defaults to changes. */
  public readonly selectedViewIA = signal<'baseline' | 'changes' | 'final'>('changes');

  /** Signal for the view URLs drawer. Defaults to url. */
  public readonly selectedDisplay = signal<'url' | 'title'>('url');

  constructor() {
    effect(() => {
      void this.projectState.getGitHub().owner;
      void this.projectState.getGitHub().repo;
      this.checkGitHubStatus();
    });
    effect(() => {
      void this.projectState.getGitHub().repo;
      this.hasLocal.set(null);
      this.hasLocalBL.set(null);
    });
  }

  /**
   * Checks if a local index page exists for the project so UI can be updated
   ** Updates signals {@link hasLocal} and {@link hasLocalBL}
   *
   * Call this fxn when navigating to any route that adjusts UI based on available local versions
   *
   * Use {@link checkPreviewStatus} for AEM preview and an effect for GitHub versions
   */
  public checkLocalStatus(): void {
    if (this.localCheckInProgress) return;
    if (this.hasLocal() !== null) return;
    if (!this.settingsService.includeLocal()) return;
    const owner = this.projectState.getProject().github.owner;
    const repo = this.projectState.getProject().github.repo;
    if (!owner || !repo) return;
    this.localCheckInProgress = true;
    const url = this.fetchService.generateUrl('index.html', 'protoUT', owner, repo);
    const checks: Promise<void>[] = [this.fetchService.fetchStatusViaProxy(url).then((result) => this.hasLocal.set(result))];
    if (this.settingsService.includeBaseline()) {
      const urlBL = this.fetchService.generateUrl('index.html', 'baseUT', owner, repo);
      checks.push(this.fetchService.fetchStatusViaProxy(urlBL).then((result) => this.hasLocalBL.set(result)));
    }
    Promise.all(checks).finally(() => {
      this.localCheckInProgress = false;
    });
  }

  /**
   * Checks if a github index page exists for the project so UI can be updated
   ** Updates signals {@link hasGitHub} and {@link hasGitHubBL}
   *
   * Call this fxn via effect whenever the repo or owner change
   *
   * Use {@link checkPreviewStatus} for AEM preview and an effect for GitHub versions
   */
  private checkGitHubStatus(): void {
    if (this.githubCheckInProgress) return;
    if (!this.settingsService.includeGitHub()) return;
    const owner = this.projectState.getProject().github.owner;
    const repo = this.projectState.getProject().github.repo;
    if (!owner || !repo) return;
    this.githubCheckInProgress = true;
    const url = this.fetchService.generateUrl('index.html', 'protoGH', owner, repo);
    const checks: Promise<void>[] = [this.fetchService.fetchStatus(url, 'proto', 1).then((response) => this.hasGitHub.set(response.ok))];
    if (this.settingsService.includeBaseline()) {
      const urlBL = this.fetchService.generateUrl('index.html', 'baseGH', owner, repo);
      checks.push(this.fetchService.fetchStatus(urlBL, 'proto', 1).then((response) => this.hasGitHubBL.set(response.ok)));
    }
    Promise.all(checks).finally(() => {
      this.githubCheckInProgress = false;
    });
  }

  /**
   * Checks if preview proxy page exists for the project so UI can be updated
   ** Updates signal {@link hasPreview}
   *
   * Call this fxn when navigating to any route that adjusts UI based on availability of preview versions
   *
   * Use {@link checkLocalStatus} for local versions, an effect for GitHub versions, and statusCache for individual pages
   */
  public checkPreviewStatus(): void {
    if (this.previewCheckInProgress) return;
    if (this.hasPreview() !== null) return;
    if (!this.settingsService.includePreview()) return;
    this.previewCheckInProgress = true;
    const url = this.fetchService.generateUrl('', 'preview');
    const checks: Promise<void>[] = [this.fetchService.fetchStatusViaProxy(url).then((result) => this.hasPreview.set(result))];
    Promise.all(checks).finally(() => {
      this.previewCheckInProgress = false;
    });
  }

  // Track availability of versions at page level (for managing UI state & preventing duplicate fetches)

  /** Signal maps a url for looking up an htmlProcessingResult (used by the compare versions tools) */
  private readonly htmlCache = signal<Map<string, htmlProcessingResult>>(new Map());
  /** Signal maps a url for looking up page status so we don't offer 404's as a valid choice in the UI */
  private readonly statusCache = signal<Map<string, boolean>>(new Map());

  /**
   * Uses a URL to retrieve an HTML processing result from the cache
   */
  public getCachedHtml(url: string): htmlProcessingResult | undefined {
    return this.htmlCache().get(url);
  }

  /**
   * Saves a URL and HTML processing result to the cache
   */
  public setCachedHtml(url: string, html: htmlProcessingResult): void {
    const cache = new Map(this.htmlCache());
    cache.set(url, html);
    this.htmlCache.set(cache);
  }

  /**
   * Uses a URL to retrieve page status from the cache (true = live page, false = 404, undefined = not cached yet)
   */
  public getCachedStatus(url: string): boolean | undefined {
    return this.statusCache().get(url);
  }

  /**
   * Saves a URL and its status to the cache (true = live page, false = 404)
   */
  public setCachedStatus(url: string, status: boolean): void {
    const cache = new Map(this.statusCache());
    cache.set(url, status);
    this.statusCache.set(cache);
  }

  /** Resets HTML and status cache */
  public clearHtmlAndStatusCache(): void {
    this.htmlCache.set(new Map());
    this.statusCache.set(new Map());
  }

  /** Get list of versions to check the status of for a given page path */
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

  /**
   * Checks a versions status using {@link statusCache} or {@link fetchStatus} or {@link fetchStatusViaProxy}
   *
   * If URL status is ok, it updates the validVersions array with the {@link SourceVersion}
   */
  public async checkVersion(url: string, version: SourceVersion, validVersions: string[]): Promise<void> {
    if (!url) return;
    const cached = this.getCachedStatus(url);
    if (cached) {
      validVersions.push(version);
      return;
    }
    try {
      const result = version === 'preview' ? await this.fetchService.fetchStatusViaProxy(url) : (await this.fetchService.fetchStatus(url, 'both')).ok;
      this.setCachedStatus(url, result);
      if (result) {
        validVersions.push(version);
      }
    } catch {
      this.setCachedStatus(url, false);
    }
  }

  // Track availability of edits at page level (so user doesn't lose an AI result or half-edited page while looking around at other stuff)

  /** Signal maps a path for looking up a PageEditState (used by the compare versions tools) */
  private readonly pageEdits = signal<Map<string, PageEditState>>(new Map());

  /**
   * Uses a path to retrieve a PageEditState from the cache
   */
  public getPageEdit(path: string): PageEditState | undefined {
    return this.pageEdits().get(path);
  }

  public updatePageEdit(path: string, previousBefore: htmlProcessingResult, previousAfter: htmlProcessingResult, newBefore: htmlProcessingResult, newAfter: htmlProcessingResult): void {
    const map = new Map(this.pageEdits());
    const existing = map.get(path);
    const undoStack = existing?.undoStack ?? new DiffUndoStack();
    undoStack.push({ beforeContent: previousBefore, afterContent: previousAfter });
    map.set(path, { originalHtml: newBefore, modifiedHtml: newAfter, undoStack });
    this.pageEdits.set(map);
  }

  public undoPageEdit(path: string): PageEditState | undefined {
    const map = new Map(this.pageEdits());
    const existing = map.get(path);
    const snapshot = existing?.undoStack.pop();
    if (!existing || !snapshot) return undefined;
    const updated = { ...existing, originalHtml: snapshot.beforeContent, modifiedHtml: snapshot.afterContent };
    map.set(path, updated);
    this.pageEdits.set(map);
    return updated;
  }

  public getPageUndoStack(path: string): DiffUndoStack | undefined {
    return this.pageEdits().get(path)?.undoStack;
  }
}
