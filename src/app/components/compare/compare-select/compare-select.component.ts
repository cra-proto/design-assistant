import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Params, Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';

import { AddPagesLinkComponent } from '../../add-pages/add-pages-link/add-pages-link.component';

import { FetchService } from '../../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { CompareService } from '../../../views/tasks/compare-versions/compare.service';

import { ALL_SOURCES, SourceVersion } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-19 (ng21)
 *
 * Dropdown selections for page, before version, and after version for the "Compare versions" tool
 */
@Component({
  selector: 'aida-compare-select',
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, IftaLabelModule, SelectModule, AddPagesLinkComponent],
  templateUrl: './compare-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareSelectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly projectState = inject(ProjectStateService);
  protected readonly compareService = inject(CompareService);
  private readonly projectCache = inject(ProjectCacheService);
  private translate = inject(TranslateService);
  private fetchService = inject(FetchService);
  private htmlNormalizationService = inject(HtmlNormalizationService);

  public readonly compareMode = input<boolean>(true);

  async ngOnInit(): Promise<void> {
    // Initialize to 1st page in project if none selected
    const options = this.pageOptions;
    const page = this.compareService.selectedPage();
    if (!page && options.length > 0) {
      this.compareService.selectedPage.set(options[0].path);
      await this.onPageSelectionChange(options[0].path);
    } else if (page) {
      void this.onPageSelectionChange(page);
    }
  }

  constructor() {
    effect(() => {
      const versionOptions = this.allOptions();
      if (!versionOptions.length) return;

      const firstOption = versionOptions[0];
      const hasVersion = (version: SourceVersion) => version != null && versionOptions.includes(version);

      if (!hasVersion(this.compareService.selectedBefore())) this.compareService.selectedBefore.set(firstOption);
      if (!hasVersion(this.compareService.selectedAfter())) this.compareService.selectedAfter.set(firstOption);
      if (!hasVersion(this.compareService.selectedSource())) this.compareService.selectedSource.set(firstOption);
    });
  }

  /** Page dropdown options */
  get pageOptions() {
    return this.projectState.getAllPages('en', 'live', 'inScope');
  }

  /** All potential "Versions" for the {@link versionOptions} dropdowns
   *
   * Updated via {@link onPageSelectionChange} to remove versions we can't fetch
   */
  private readonly allOptions = signal<SourceVersion[]>([...ALL_SOURCES]);

  /** Before & after dropdown options from filtered {@link allOptions} */
  get versionOptions() {
    return this.allOptions().map((value) => ({
      label: this.translate.instant(`common.source.${value}`),
      value: value,
    }));
  }

  /** On page change:
   ** Clears current original and modified HTML
   ** Updates {@link allOptions} with valid versions for the currently selected page
   ** Runs {@link onVersionSelectionChange} to set original and modified HTML for the currently selected page
   */
  async onPageSelectionChange(path: string) {
    this.compareService.loading.set(true);
    try {
      this.compareService.selectedPage.set(path);
      if (!this.compareService.selectedPage()) return;
      // Clear current HTML (but not cache)
      this.compareService.originalHtml.set(undefined);
      this.compareService.modifiedHtml.set(undefined);
      //Check the versions
      const versionsToCheck = this.projectCache.getVersionsToCheck(path);
      const validVersions: SourceVersion[] = [];
      for (const { url, version } of versionsToCheck) {
        await this.projectCache.checkVersion(url, version, validVersions);
      }
      this.allOptions.set(validVersions); //Add valid versions to dropdown menu

      const cached = this.projectCache.getPageEdit(path);
      if (cached) {
        //Restore the comparison with cached edits if available
        this.compareService.selectedBefore.set(cached.originalHtml.version as SourceVersion);
        this.compareService.selectedAfter.set(cached.modifiedHtml.version as SourceVersion);
        this.compareService.originalHtml.set(cached.originalHtml);
        this.compareService.modifiedHtml.set(cached.modifiedHtml);
      } else {
        //Load the comparison with unedited content from cache or source
        if (this.compareMode()) {
          await this.onVersionSelectionChange(this.compareService.selectedBefore(), 'before');
          await this.onVersionSelectionChange(this.compareService.selectedAfter(), 'after');
        } else {
          this.onVersionSelectionChange(this.compareService.selectedSource(), 'source');
        }
      }
    } finally {
      this.compareService.loading.set(false);
    }
  }

  /** On version change:
   ** Sets selectedBefore, selectedAfter, or selectedSource signal
   ** Uses {@link fetchVersion} to fetch selected version from project cache, if available, or runs fresh fetch
   ** Sets originalHtml or modifiedHtml or both
   */
  async onVersionSelectionChange(version: SourceVersion, mode: 'before' | 'after' | 'source') {
    switch (mode) {
      case 'before':
        this.compareService.loadingBefore.set(true);
        try {
          this.compareService.selectedBefore.set(version);
          const result = await this.fetchVersion(version);
          // Set original HTML
          this.compareService.originalHtml.set(result);
        } finally {
          this.compareService.loadingBefore.set(false);
        }
        break;
      case 'after':
        this.compareService.loadingAfter.set(true);
        try {
          this.compareService.selectedAfter.set(version);
          const result = await this.fetchVersion(version);
          // Set modified HTML
          this.compareService.modifiedHtml.set(result);
        } finally {
          this.compareService.loadingAfter.set(false);
        }
        break;
      case 'source':
        this.compareService.loadingSource.set(true);
        try {
          this.compareService.selectedSource.set(version);
          const result = await this.fetchVersion(version);
          // Set original and modified HTML
          this.compareService.originalHtml.set(result);
          this.compareService.modifiedHtml.set(result);
        } finally {
          this.compareService.loadingSource.set(false);
        }
        break;
    }
  }

  protected isLoading(mode: 'before' | 'after' | 'source'): boolean {
    switch (mode) {
      case 'before':
        return this.compareService.loading() || this.compareService.loadingAll() || this.compareService.loadingBefore();
      case 'after':
        return this.compareService.loading() || this.compareService.loadingAll() || this.compareService.loadingAfter();
      case 'source':
        return this.compareService.loading() || this.compareService.loadingAll() || this.compareService.loadingSource();
    }
  }

  /** Fetches selected version from project cache, if available, or runs fresh fetch and saves to cache
   *
   * Used by {@link onVersionSelectionChange}
   */
  private async fetchVersion(version: SourceVersion): Promise<htmlProcessingResult | undefined> {
    if (!this.compareService.selectedPage()) return;
    // Get URL
    const project = this.projectState.getProject();
    const url = this.fetchService.generateUrl(this.compareService.selectedPage(), version, project.github.owner, project.github.repo);

    // Check cache for content
    const cachedContent = this.projectCache.getCachedHtml(url);
    if (cachedContent) return { ...cachedContent, version };

    // Fetch HTML content
    const fetchType = version === 'preview' || version.endsWith('UT') ? 'proxy' : 'url';
    const htmlContent = await this.htmlNormalizationService.normalizeHTML(url, fetchType);

    // Save HTML content to cache
    if (htmlContent?.url) this.projectCache.setCachedHtml(htmlContent.url, htmlContent);

    // Set HTML processing result
    return {
      ...htmlContent,
      version,
    } as htmlProcessingResult;
  }

  /** Copies share link to clipboard */
  shareLink() {
    const beforeUrl = this.compareService.originalHtml()?.url;
    const afterUrl = this.compareService.modifiedHtml()?.url;
    if (!beforeUrl || !afterUrl) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.copyError'),
        detail: this.translate.instant('compare.tools.noShareURL'),
        life: 5000,
      });
      return;
    }
    const params: Params = { before: beforeUrl, after: afterUrl };
    const treeLink = this.router.createUrlTree(['/standalone/compare'], { queryParams: params });
    const shareLink = `${window.location.origin}${this.router.serializeUrl(treeLink)}`;

    navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.copiedToClipboard'),
          detail: `${shareLink}`,
          life: 2000,
        });
      })
      .catch((err) => console.error('Clipboard copy failed:', err));
  }
}
