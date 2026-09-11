import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';

import { FetchService } from '../../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { CompareService } from '../../../views/task/compare-versions/compare.service';

import { ALL_SOURCES, SourceVersion } from '../../../common/data.model';

/**
 * Reviewed: 2026-08-19 (ng21)
 *
 * Dropdown selections for page, before version, and after version for the "Compare versions" tool
 */
@Component({
  selector: 'aida-compare-select',
  imports: [FormsModule, TranslatePipe, IftaLabelModule, SelectModule],
  templateUrl: './compare-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareSelectComponent implements OnInit {
  private readonly projectState = inject(ProjectStateService);
  protected readonly compareService = inject(CompareService);
  private readonly projectCache = inject(ProjectCacheService);
  private translate = inject(TranslateService);
  private fetchService = inject(FetchService);
  private htmlNormalizationService = inject(HtmlNormalizationService);

  async ngOnInit(): Promise<void> {
    // Initialize to 1st page in project if none selected
    const options = this.pageOptions;
    if (!this.compareService.selectedPage() && options.length > 0) {
      this.compareService.selectedPage.set(options[0].path);
      await this.onPageSelectionChange(options[0].path);
    }
  }

  /** Page dropdown options */
  get pageOptions() {
    return this.projectState.getAllPages('en', 'live', 'inScope');
  }

  /** All potential "Versions" for the {@link versionOptions} dropdowns
   *
   * Updated via {@link onPageSelectionChange} to remove versions we can't fetch
   */
  allOptions: SourceVersion[] = [...ALL_SOURCES];

  /** Before & after dropdown options from filtered {@link allOptions} */
  get versionOptions() {
    return this.allOptions.map((value) => ({
      label: this.translate.instant(`common.source.${value}`),
      value: value,
    }));
  }

  /** On page change:
   ** Clears current original and modified HTML
   ** Updates {@link allOptions} with valid versions for the currently selected page
   ** Runs {@link onBeforeSelectionChange} and {@link onAfterSelectionChange} to set original and modified HTML for the currently selected page
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
      this.allOptions = validVersions; //Add valid versions to dropdown menu

      const cached = this.projectCache.getPageEdit(path);
      if (cached) {
        //Restore the comparison with cached edits if available
        this.compareService.selectedBefore.set(cached.originalHtml.version as SourceVersion);
        this.compareService.selectedAfter.set(cached.modifiedHtml.version as SourceVersion);
        this.compareService.originalHtml.set(cached.originalHtml);
        this.compareService.modifiedHtml.set(cached.modifiedHtml);
      } else {
        //Load the comparison with unedited content from cache or source
        await this.onBeforeSelectionChange(this.compareService.selectedBefore());
        await this.onAfterSelectionChange(this.compareService.selectedAfter());
      }
    } finally {
      this.compareService.loading.set(false);
    }
  }

  /** On before version change:
   ** Sets selectedBefore signal
   ** Uses {@link fetchVersion} to fetch selected version from project cache, if available, or runs fresh fetch
   ** Sets originalHtml
   */
  async onBeforeSelectionChange(version: SourceVersion) {
    console.log(version);
    this.compareService.loadingBefore.set(true);
    try {
      this.compareService.selectedBefore.set(version);
      const result = await this.fetchVersion(version);
      // Set original HTML
      this.compareService.originalHtml.set(result);
    } finally {
      this.compareService.loadingBefore.set(false);
    }
  }

  /** On after version change:
   ** Sets selectedAfter signal
   ** Uses {@link fetchVersion} to fetch selected version from project cache, if available, or runs fresh fetch
   ** Sets modifiedHtml
   */
  async onAfterSelectionChange(version: SourceVersion) {
    this.compareService.loadingAfter.set(true);
    try {
      this.compareService.selectedAfter.set(version);
      const result = await this.fetchVersion(version);
      // Set modified HTML
      this.compareService.modifiedHtml.set(result);
    } finally {
      this.compareService.loadingAfter.set(false);
    }
  }

  /** Fetches selected version from project cache, if available, or runs fresh fetch and saves to cache
   *
   * Used by {@link onBeforeSelectionChange} and {@link onAfterSelectionChange}
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
}
