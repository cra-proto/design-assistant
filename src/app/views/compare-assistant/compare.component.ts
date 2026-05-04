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

      // Checks if live, prototype, and baseline urls are valid & then updates version dropdown options
      const validVersions = ['ai'];
      // Check live URL
      try {
        const liveResponse = await this.fetchService.fetchStatus(this.compareService.selectedPage(), 'prod');
        if (liveResponse.ok) {
          validVersions.push('live');
        }
      } catch (error) {
        console.warn('Live URL not accessible:', error);
      }
      // Check preview URL
      const previewUrl = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'preview');
      try {
        const previewExists = await this.fetchService.fetchPreviewStatus(previewUrl);
        if (previewExists) {
          validVersions.push('preview');
        }
      } catch (error) {
        console.warn('Preview URL not accessible:', error);
      }
      // Check prototype URL
      const prototypeUrl = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'current');
      if (prototypeUrl) {
        try {
          const protoResponse = await this.fetchService.fetchStatus(prototypeUrl, 'proto');
          if (protoResponse.ok) {
            validVersions.push('prototype');
          }
        } catch (error) {
          console.warn('Prototype URL not accessible:', error);
        }
      }
      // Check baseline URL (only if hasBaseline is true)
      if (this.projectState.getProject().github.hasBaselineRepo) {
        const baselineUrl = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'baseline');
        if (baselineUrl) {
          try {
            const baselineResponse = await this.fetchService.fetchStatus(baselineUrl, 'proto');
            if (baselineResponse.ok) {
              validVersions.push('baseline');
            }
          } catch (error) {
            console.warn('Baseline URL not accessible:', error);
          }
        }
      }
      this.allOptions = validVersions;
      this.onBeforeSelectionChange(this.compareService.selectedBefore());
      this.onAfterSelectionChange(this.compareService.selectedAfter());
    } finally {
      this.compareService.loading.set(false);
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
        const previewContent = await this.fetchService.fetchPreview(url);
        const normalizedContent = await this.htmlNormalizationService.normalizeHTML(previewContent, "string")
        this.compareService.originalHtml.set({
          ...normalizedContent,
          url: url,
          version: this.compareService.selectedBefore()
        } as htmlProcessingResult);
      }
      // Get HTML from live page or github
      else {
        let url = this.compareService.selectedPage();
        if (this.compareService.selectedBefore() === 'baseline') { url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'baseline'); }
        else if (this.compareService.selectedBefore() === 'prototype') { url = this.projectState.generatePrototypeUrl(this.compareService.selectedPage(), 'current'); }
        this.compareService.originalHtml.set({
          ...await this.htmlNormalizationService.normalizeHTML(url, "url"),
          version: this.compareService.selectedBefore()
        } as htmlProcessingResult);
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
        const previewContent = await this.fetchService.fetchPreview(url);
        const normalizedContent = await this.htmlNormalizationService.normalizeHTML(previewContent, "string")
        this.compareService.modifiedHtml.set({
          ...normalizedContent,
          url: url,
          version: this.compareService.selectedAfter()
        } as htmlProcessingResult);
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
        this.compareService.modifiedHtml.set({
          ...await this.htmlNormalizationService.normalizeHTML(url, "url"),
          version: this.compareService.selectedAfter()
        } as htmlProcessingResult);
      }
    } finally {
      this.compareService.loadingAfter.set(false);
    }
  }

}
