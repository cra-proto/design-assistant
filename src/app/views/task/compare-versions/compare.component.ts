import { Component, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

//Translation
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

//PrimeNG
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';

//Services
import { ProjectStateService } from '../../../services/project-state.service';
import { CompareService, COMPARE_VERSIONS, CompareVersion } from './compare.service';
import { FetchService, urlVersion } from '../../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';

//Components
import { CompareRenderedComponent } from '../../../components/compare-rendered/compare-rendered.component';
import { CompareSourceComponent } from '../../../components/compare-source/compare-source.component';



@Component({
  selector: 'aida-compare-versions',
  imports: [
    FormsModule, TranslatePipe,
    ButtonModule, TabsModule, IftaLabelModule, SelectModule, CheckboxModule,
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
        this.compareService.selectedPage.set(options[0].path);
        this.onPageSelectionChange(options[0].path);
        console.log("PAGE:")
        console.log(this.compareService.selectedPage());
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
    return this.projectState.getAllPages("en", "live", "inScope");
  }

  // Get list of versions to check
  private getVersionsToCheck(path: string): { url: string; version: urlVersion }[] {
    const project = this.projectState.getProject();
    const versions: { url: string; version: urlVersion }[] = [{ url: this.fetchService.generateUrl(path, "live"), version: "live" }];
    if (this.compareService.includePreview()) {
      versions.push({ url: this.fetchService.generateUrl(path, "preview"), version: "preview" })
    }
    if (project.lastExported) {
      versions.push({ url: this.fetchService.generateUrl(path, "protoGH", project.github.owner, project.github.repo), version: "protoGH" });
      if (project.github.hasBaselineRepo) versions.push({ url: this.fetchService.generateUrl(path, "baseGH", project.github.owner, project.github.repo), version: "baseGH" });
    }
    if (project.lastDownloaded) {
      versions.push({ url: this.fetchService.generateUrl(path, "protoUT", project.github.owner, project.github.repo), version: "protoUT" });
      if (project.github.hasBaselineRepo) versions.push({ url: this.fetchService.generateUrl(path, "baseUT", project.github.owner, project.github.repo), version: "baseUT" });
    }
    return versions;
  }

  // Check a versions status
  private async checkVersion(url: string, version: string, validVersions: string[]): Promise<void> {
    if (!url) return;
    const cached = this.compareService.getCachedStatus(url);
    if (cached) { validVersions.push(version); return; }
    try {
      let result;
      if (version === 'preview') { result = await this.fetchService.fetchStatusViaProxy(url) }
      else { result = (await this.fetchService.fetchStatus(url, 'both')).ok }
      this.compareService.setCachedStatus(url, result);
      if (result) validVersions.push(version);
    } catch {
      this.compareService.setCachedStatus(url, false);
    }
  }

  // Update dropdown with valid versions & run comparison
  async onPageSelectionChange(path: string) {
    this.compareService.loading.set(true);
    const versionsToCheck = this.getVersionsToCheck(path);
    try {
      this.compareService.selectedPage.set(path);
      if (!this.compareService.selectedPage()) return;
      // Clear current HTML (but not cache)
      this.compareService.originalHtml.set(undefined);
      this.compareService.modifiedHtml.set(undefined);
      //Check the versions
      const validVersions: CompareVersion[] = ['ai'];
      for (const { url, version } of versionsToCheck) {
        await this.checkVersion(url, version, validVersions);
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

  // Update all page dropdowns with thier valid versions (speeds up page switching)
  async setCacheForAll() {
    this.cacheAbortController = new AbortController();
    const signal = this.cacheAbortController.signal;
    this.compareService.loadingAll.set(true);
    try {
      // Get all project paths
      const lang = this.projectState.detectPrimaryLanguage()
      const allPaths = new Set(this.projectState.getAllPages(lang, "live", "inScope").map(p => p.path))
      // Check all versions
      for (const path of allPaths) {
        if (signal.aborted) break;
        const versionsToCheck = this.getVersionsToCheck(path);
        const validVersions = ['ai'];
        for (const { url, version } of versionsToCheck) {
          await this.checkVersion(url, version, validVersions);
        }
      }
    } finally {
      this.compareService.loadingAll.set(false);
    }
  }

  private cacheAbortController: AbortController | null = null;
  cancelSetCache() {
    this.cacheAbortController?.abort();
  }

  // Version dropdown options & on change
  allOptions: CompareVersion[] = [...COMPARE_VERSIONS];

  get beforeOptions() {
    return this.allOptions
      .filter(value => value !== 'ai')
      .map(value => ({
        label: this.translate.instant(`compare.pageOptions.${value}`),
        value: value,
      }));
  }

  get afterOptions() {
    return this.allOptions
      .filter(value => value !== 'live')
      .map(value => ({
        label: this.translate.instant(`compare.pageOptions.${value}`),
        value: value,
      }));
  }

  private async fetchVersion(version: CompareVersion): Promise<htmlProcessingResult | undefined> {
    if (!this.compareService.selectedPage()) return;
    if (version !== 'ai') {
      // Get URL
      const project = this.projectState.getProject();
      const url = this.fetchService.generateUrl(this.compareService.selectedPage(), version, project.github.owner, project.github.repo)
      // Check cache for content
      const cached = this.compareService.getCachedHtml(url);
      if (cached) {
        this.compareService.originalHtml.set(cached);
        return;
      }
      // Get HTML from preview (if selected)
      let previewContent;
      if (version === 'preview') {
        previewContent = await this.fetchService.fetchViaProxy(url);
      }
      // Set HTML processing result
      return {
        ...previewContent ? await this.htmlNormalizationService.normalizeHTML(previewContent, "string") : await this.htmlNormalizationService.normalizeHTML(url, "url"),
        url: url,
        version: version
      } as htmlProcessingResult;
    }
    else return;
  }

  async onBeforeSelectionChange(version: CompareVersion) {
    this.compareService.loadingBefore.set(true);
    try {
      this.compareService.selectedBefore.set(version);
      const result = await this.fetchVersion(version);
      // Save result to cache
      if (result?.url) {
        this.compareService.setCachedHtml(result.url, result);
      }
      // Set original HTML
      this.compareService.originalHtml.set(result);
    } finally {
      this.compareService.loadingBefore.set(false);
    }
  }

  async onAfterSelectionChange(version: CompareVersion) {
    this.compareService.loadingAfter.set(true);
    try {
      this.compareService.selectedAfter.set(version);
      let result = await this.fetchVersion(version);
      // Save result to cache
      if (result?.url) {
        this.compareService.setCachedHtml(result.url, result);
      }
      // Initialize AI version
      if (version === 'ai') {
        result = ({
          ...this.compareService.originalHtml(),
          version: version
        } as htmlProcessingResult);
      }
      // Set modified HTML
      this.compareService.modifiedHtml.set(result);
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
