import { effect, inject, Injectable, signal } from '@angular/core';

import { FetchService } from './fetch.service';
import { ProjectStateService } from './project-state.service';
import { UserSettingsService } from './user-settings.service';

import { SourceVersion } from '../common/data.model';

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
   * Call this fxn OnInit and via effect whenever the repo or owner change
   *
   * Use {@link checkPreviewStatus} for AEM preview and an effect for GitHub versions
   */
  public checkGitHubStatus(): void {
    if (this.githubCheckInProgress) return;
    if (!this.settingsService.includeGitHub()) return;
    const owner = this.projectState.getProject().github.owner;
    const repo = this.projectState.getProject().github.repo;
    if (!owner || !repo) return;
    this.githubCheckInProgress = true;
    const url = this.fetchService.generateUrl('index.html', 'protoGH', owner, repo);
    const checks: Promise<void>[] = [this.fetchService.fetchStatus(url).then((response) => this.hasGitHub.set(response.ok))];
    if (this.settingsService.includeBaseline()) {
      const urlBL = this.fetchService.generateUrl('index.html', 'baseGH', owner, repo);
      checks.push(this.fetchService.fetchStatus(urlBL).then((response) => this.hasGitHubBL.set(response.ok)));
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

  //TODO: move statusCache from compare.service.ts to here (it has status's mapped to different versions of project URLs)
}
