import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

//Translation
import { TranslateModule, TranslateService } from '@ngx-translate/core';

//PrimeNG
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { CompareService } from './compare.service';
import { FetchService } from '../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../services/html-normalization.service';

//Components
import { CompareRenderedComponent } from '../../components/compare-rendered/compare-rendered.component';
import { CompareSourceComponent } from '../../components/compare-source/compare-source.component';

@Component({
  selector: 'aida-page-assistant-compare',
  imports: [
    CommonModule, FormsModule, TranslateModule,
    ButtonModule, TabsModule, IftaLabelModule, SelectModule,
    CompareRenderedComponent, CompareSourceComponent
  ],
  templateUrl: './compare.component.html',
  styles: '',
})
export class CompareComponent {
  private translate = inject(TranslateService);
  private projectState = inject(ProjectStateService);
  public compareService = inject(CompareService);
  private fetchService = inject(FetchService);
  private htmlNormalizationService = inject(HtmlNormalizationService)

  constructor() {
    // Initialize to 1st page in project if none selected
    effect(() => {
      const options = this.pageOptions;
      if (!this.compareService.selectedPage() && options.length > 0) {
        this.compareService.selectedPage.set(options[0].value);
        this.onPageSelectionChange(options[0].value);
      }
    });
  }

  markForTranslation() {
    marker('compare.pageOptions.live');
    marker('compare.pageOptions.prototype');
    marker('compare.pageOptions.baseline');
    marker('compare.pageOptions.preview');
    marker('compare.pageOptions.ai');
    marker('compare.view.comparison');
    marker('compare.view.linebyline');
    marker('compare.view.sidebyside');
  }

  // Page dropdown options & on change
  get pageOptions() {
    return this.projectState.getAllPages().map(page => ({
      label: page.title,
      value: page.url,
    }));
  }

  async onPageSelectionChange(page: string) {
    this.compareService.loading.set(true);
    try {
      this.compareService.selectedPage.set(page);
      if (!this.compareService.selectedPage) return;
      // Clear current HTML (but not cache)
      this.compareService.originalHtml.set(undefined);
      this.compareService.modifiedHtml.set(undefined);

      // Checks if live, prototype, and baseline urls are valid & then updates version dropdown options
      const validVersions = ['ai'];
      // Check live URL
      const cachedLive = this.compareService.getCachedStatus(this.compareService.selectedPage());
      if (cachedLive !== undefined) {
        if (cachedLive) validVersions.push('live');
      } else {
        try {
          const liveResponse = await this.fetchService.fetchStatus(this.compareService.selectedPage(), 'prod');
          this.compareService.setCachedStatus(this.compareService.selectedPage(), liveResponse.ok);
          if (liveResponse.ok) {
            validVersions.push('live');
          }
        } catch (error) {
          this.compareService.setCachedStatus(this.compareService.selectedPage(), false);
        }
      }
      // Check preview URL
      const previewUrl = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'preview');
      const cachedPreview = this.compareService.getCachedStatus(previewUrl);
      if (cachedPreview !== undefined) {
        if (cachedPreview) validVersions.push('preview');
      } else if (previewUrl) {
        try {
          const previewExists = await this.fetchService.fetchPreviewStatus(previewUrl);
          this.compareService.setCachedStatus(previewUrl, previewExists);
          if (previewExists) {
            validVersions.push('preview');
          }
        } catch (error) {
          this.compareService.setCachedStatus(previewUrl, false);
        }
      }
      // Check prototype URL
      const prototypeUrl = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'current');
      const cachedPrototype = this.compareService.getCachedStatus(prototypeUrl);
      if (cachedPrototype !== undefined) {
        if (cachedPrototype) validVersions.push('prototype');
      } else if (prototypeUrl) {
        try {
          const protoResponse = await this.fetchService.fetchStatus(prototypeUrl, 'proto');
          this.compareService.setCachedStatus(prototypeUrl, protoResponse.ok);
          if (protoResponse.ok) {
            validVersions.push('prototype');
          }
        } catch (error) {
          this.compareService.setCachedStatus(prototypeUrl, false);
        }
      }
      // Check baseline URL (only if hasBaseline is true)
      if (this.projectState.getProject().github.hasBaselineRepo) {
        const baselineUrl = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'baseline');
        const cachedBaseline = this.compareService.getCachedStatus(baselineUrl);
        if (cachedBaseline !== undefined) {
          if (cachedBaseline) validVersions.push('baseline');
        } else if (baselineUrl) {
          try {
            const baselineResponse = await this.fetchService.fetchStatus(baselineUrl, 'proto');
            this.compareService.setCachedStatus(baselineUrl, baselineResponse.ok);
            if (baselineResponse.ok) {
              validVersions.push('baseline');
            }
          } catch (error) {
            this.compareService.setCachedStatus(baselineUrl, false);
          }
        }
      }
      this.allOptions = validVersions;
      await this.onBeforeSelectionChange(this.compareService.selectedBefore());
      await this.onAfterSelectionChange(this.compareService.selectedAfter());
    } finally {
      this.compareService.loading.set(false);
    }
  }

  async setCacheForAll() {
    this.compareService.loadingAll.set(true);

    try {
      // Get all project urls
      const allUrls = this.projectState.getAllUrls('inScope', 'primary');

      for (const url of allUrls) {
        // Check live
        if (!this.compareService.getCachedStatus(url)) {
          try {
            const liveResponse = await this.fetchService.fetchStatus(url, 'prod', 1, 0);
            this.compareService.setCachedStatus(url, liveResponse.ok);
          } catch {
            this.compareService.setCachedStatus(url, false);
          }
        }

        // Check preview
        const previewUrl = this.projectState.generatePrototypeUrl(url, 'preview');
        if (previewUrl && !this.compareService.getCachedStatus(previewUrl)) {
          try {
            const previewExists = await this.fetchService.fetchPreviewStatus(previewUrl);
            this.compareService.setCachedStatus(previewUrl, previewExists);
          } catch {
            this.compareService.setCachedStatus(previewUrl, false);
          }
        }

        // Check prototype
        const prototypeUrl = this.projectState.generatePrototypeUrl(url, 'current');
        if (prototypeUrl && !this.compareService.getCachedStatus(prototypeUrl)) {
          try {
            const protoResponse = await this.fetchService.fetchStatus(prototypeUrl, 'proto', 1, 0);
            this.compareService.setCachedStatus(prototypeUrl, protoResponse.ok);
          } catch {
            this.compareService.setCachedStatus(prototypeUrl, false);
          }
        }

        // Check baseline (if applicable)
        if (this.projectState.getProject().github.hasBaselineRepo) {
          const baselineUrl = this.projectState.generatePrototypeUrl(url, 'baseline');
          if (baselineUrl && !this.compareService.getCachedStatus(baselineUrl)) {
            try {
              const baselineResponse = await this.fetchService.fetchStatus(baselineUrl, 'proto', 1, 0);
              this.compareService.setCachedStatus(baselineUrl, baselineResponse.ok);
            } catch {
              this.compareService.setCachedStatus(baselineUrl, false);
            }
          }
        }
      }
    } finally {
      this.compareService.loadingAll.set(false);
    }
  }

  // Version dropdown options & on change
  allOptions = ['live', 'preview', 'prototype', 'baseline', 'ai'];

  get beforeOptions() {
    return this.allOptions
      .filter(value =>
        value !== 'ai' &&
        (value !== 'baseline' || this.projectState.getProject().github.hasBaselineRepo)
      )
      .map(value => ({
        label: this.translate.instant(`compare.pageOptions.${value}`),
        value: value,
      }));
  }

  get afterOptions() {
    return this.allOptions
      .filter(value =>
        value !== 'live' &&
        (value !== 'baseline' || this.projectState.getProject().github.hasBaselineRepo)
      )
      .map(value => ({
        label: this.translate.instant(`compare.pageOptions.${value}`),
        value: value,
      }));
  }

  async onBeforeSelectionChange(version: 'live' | 'preview' | 'prototype' | 'baseline' | 'ai') {
    this.compareService.loadingBefore.set(true);
    try {
      this.compareService.selectedBefore.set(version);
      if (!this.compareService.selectedPage) return;
      // Get HTML from preview
      if (this.compareService.selectedBefore() === 'preview') {
        const url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'preview');
        // Check cache first
        const cached = this.compareService.getCachedHtml(url);
        if (cached) {
          this.compareService.originalHtml.set(cached);
          return;
        }
        // Fetch, cache & set content
        const previewContent = await this.fetchService.fetchPreview(url);
        const normalizedContent = await this.htmlNormalizationService.normalizeHTML(previewContent, "string")
        const result = {
          ...normalizedContent,
          url: url,
          version: version
        } as htmlProcessingResult;
        this.compareService.setCachedHtml(url, result);
        this.compareService.originalHtml.set(result);
      }
      // Get HTML from live page or github
      else {
        let url = this.compareService.selectedPage();
        if (this.compareService.selectedBefore() === 'baseline') { url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'baseline'); }
        else if (this.compareService.selectedBefore() === 'prototype') { url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'current'); }
        // Check cache first
        const cached = this.compareService.getCachedHtml(url);
        if (cached) {
          this.compareService.originalHtml.set(cached);
          return;
        }
        // Fetch, cache & set content
        const result = {
          ...await this.htmlNormalizationService.normalizeHTML(url, "url"),
          version: version
        } as htmlProcessingResult;
        this.compareService.setCachedHtml(url, result);
        this.compareService.originalHtml.set(result);
      }
    } finally {
      this.compareService.loadingBefore.set(false);
    }
  }

  async onAfterSelectionChange(version: 'live' | 'preview' | 'prototype' | 'baseline' | 'ai') {
    this.compareService.loadingAfter.set(true);
    try {
      this.compareService.selectedAfter.set(version);
      if (!this.compareService.selectedPage) return;
      // Get HTML from preview
      if (this.compareService.selectedAfter() === 'preview') {
        const url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'preview');
        // Check cache first
        const cached = this.compareService.getCachedHtml(url);
        if (cached) {
          this.compareService.modifiedHtml.set(cached);
          return;
        }
        // Fetch, cache & set content
        const previewContent = await this.fetchService.fetchPreview(url);
        const normalizedContent = await this.htmlNormalizationService.normalizeHTML(previewContent, "string")
        const result = {
          ...normalizedContent,
          url: url,
          version: version
        } as htmlProcessingResult;
        this.compareService.setCachedHtml(url, result);
        this.compareService.modifiedHtml.set(result);
      }
      // Initialize HTML to original for AI edits
      else if (this.compareService.selectedAfter() === 'ai') {
        this.compareService.modifiedHtml.set({
          ...this.compareService.originalHtml(),
          version: this.compareService.selectedAfter()
        } as htmlProcessingResult);
      }
      // Get HTML from live page of GitHub
      else {
        let url = this.compareService.selectedPage();
        if (this.compareService.selectedAfter() === 'baseline') { url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'baseline'); }
        else if (this.compareService.selectedAfter() === 'prototype') { url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'current'); }
        // Check cache first
        const cached = this.compareService.getCachedHtml(url);
        if (cached) {
          this.compareService.modifiedHtml.set(cached);
          return;
        }
        // Fetch, cache & set content
        const result = {
          ...await this.htmlNormalizationService.normalizeHTML(url, "url"),
          version: version
        } as htmlProcessingResult;
        this.compareService.setCachedHtml(url, result);
        this.compareService.modifiedHtml.set(result);
      }
    } finally {
      this.compareService.loadingAfter.set(false);
    }
  }

  // Handle accept/reject changes
  onContentChanged(event: { beforeContent: htmlProcessingResult; afterContent: htmlProcessingResult }): void {
    // Update your signals
    this.compareService.originalHtml.set(event.beforeContent);
    this.compareService.modifiedHtml.set(event.afterContent);

    // TODO: Update cache so user doesn't lose progress when navigating to other pages in project
    // this.compareService.setDiffCache(pageId, event.beforeContent, event.afterContent);
  }

}
