import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';

import { FetchService } from '../../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { CompareService } from '../compare.service';

import { ALL_SOURCES, CompareVersion, SourceVersion } from '../../../common/data.model';

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

  markForTranslation() {
    marker('common.source.ai');
  }

  /** Page dropdown options */
  get pageOptions() {
    return this.projectState.getAllPages('en', 'live', 'inScope');
  }

  /** All potential "Versions" for the {@link beforeOptions} and {@link afterOptions} version dropdowns
   *
   * Updated via {@link onPageSelectionChange} to remove versions we can't fetch
   */
  allOptions: CompareVersion[] = [...ALL_SOURCES, 'ai'];

  /** Before dropdown options from filtered {@link allOptions} (removes AI) */
  get beforeOptions() {
    return this.allOptions
      .filter((value) => value !== 'ai')
      .map((value) => ({
        label: this.translate.instant(`common.source.${value}`),
        value: value,
      }));
  }

  /** After dropdown options from filtered {@link allOptions} (removes LIVE) */
  get afterOptions() {
    return this.allOptions
      .filter((value) => value !== 'live')
      .map((value) => ({
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
    const versionsToCheck = this.compareService.getVersionsToCheck(path);
    try {
      this.compareService.selectedPage.set(path);
      if (!this.compareService.selectedPage()) return;
      // Clear current HTML (but not cache)
      this.compareService.originalHtml.set(undefined);
      this.compareService.modifiedHtml.set(undefined);
      //Check the versions
      const validVersions: CompareVersion[] = ['ai'];
      for (const { url, version } of versionsToCheck) {
        await this.compareService.checkVersion(url, version, validVersions);
      }
      //Add valid versions to dropdown menu
      this.allOptions = validVersions;
      //Load the comparison
      await this.onBeforeSelectionChange(this.compareService.selectedBefore());
      await this.onAfterSelectionChange(this.compareService.selectedAfter());
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
  async onAfterSelectionChange(version: CompareVersion) {
    this.compareService.loadingAfter.set(true);
    try {
      this.compareService.selectedAfter.set(version);
      const result = version !== 'ai' ? await this.fetchVersion(version) : ({ ...this.compareService.originalHtml(), version } as htmlProcessingResult);
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
    const cachedContent = this.compareService.getCachedHtml(url);
    if (cachedContent) return cachedContent;

    // Fetch HTML content
    const fetchType = version === 'preview' || version.endsWith('UT') ? 'proxy' : 'url';
    const htmlContent = await this.htmlNormalizationService.normalizeHTML(url, fetchType);

    // Save HTML content to cache
    if (htmlContent?.url) this.compareService.setCachedHtml(htmlContent.url, htmlContent);

    // Set HTML processing result
    return {
      ...htmlContent,
      version: version,
    } as htmlProcessingResult;
  }
}
