import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { ProjectSettingsComponent } from '../project-settings/project-settings.component';

import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from '../ia-diagram/ia-diagram.service';

@Component({
  selector: 'aida-view-pages',
  imports: [RouterLink, TranslatePipe, ButtonModule, DrawerModule, TableModule, TooltipModule, ProjectSettingsComponent],
  templateUrl: './view-pages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewPagesComponent {
  private readonly projectState = inject(ProjectStateService);
  protected readonly projectCache = inject(ProjectCacheService);
  protected readonly iaDiagram = inject(IaDiagramService);

  //UI elements
  protected readonly inScopePageCount = computed(() => this.projectState.getProject().inScopePages);
  protected showUrls = false;

  //URL drawer - Both languages
  protected readonly pairedPagesForTable = computed(() => this.projectState.getPairedPages(this.projectCache.selectedSource(), this.projectCache.selectedScope()));

  //URL drawer - One language
  protected readonly singlePagesForList = computed(() => {
    const selectedLang = this.projectCache.selectedLang();
    const lang = selectedLang === 'both' ? this.projectState.detectPrimaryLanguage() : selectedLang;
    return this.projectState.getAllPages(lang, this.projectCache.selectedSource(), this.projectCache.selectedScope());
  });

  //URL drawer - Copy
  protected async copyToClipboard(lang: 'en' | 'fr' | 'both'): Promise<void> {
    const pairs = this.pairedPagesForTable();
    let text;
    if (lang === 'both') {
      text = pairs.map((pair) => `${pair.en.url}\t${pair.fr.url}`).join('\r\n');
    } else {
      text = pairs.map((pair) => `${pair[lang].url}`).join('\r\n');
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }
}
