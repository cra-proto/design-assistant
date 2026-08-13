import { Component, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RouterLink } from "@angular/router";

//PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

//Custom components and services
import { ProjectStateService } from '../../../services/project-state.service';
import { IaDiagramService } from '../../../components/ia-diagram/ia-diagram.service';
import { SetupProjectComponent } from '../../../components/setup-project/setup-project.component';
import { SetupRepoComponent } from '../../../components/setup-repo/setup-repo.component';
import { AddCollaboratorsComponent } from '../../../components/add-collaborators/add-collaborators.component';
import { FindPagesComponent } from '../../../components/find-pages/find-pages.component';
import { AddUrlsComponent } from '../../../components/add-urls/add-urls.component';
import { ProjectSettingsComponent } from "../../../components/project-settings/project-settings.component";
import { ProjectCacheService } from '../../../services/project-cache.service';

@Component({
  selector: 'aida-edit-project',
  imports: [
    FormsModule, TranslatePipe, RouterLink,
    SetupProjectComponent, SetupRepoComponent, AddCollaboratorsComponent, FindPagesComponent, AddUrlsComponent, ProjectSettingsComponent,
    DrawerModule, ButtonModule, MessageModule, SelectButtonModule, TableModule, TooltipModule,
  ],
  templateUrl: './edit-project.component.html',
  styles: ``
})
export class EditProjectComponent {
  public projectState = inject(ProjectStateService);
  public projectCache = inject(ProjectCacheService);
  private translate = inject(TranslateService);
  iaDiagram = inject(IaDiagramService);

  //Check if project is named and has repo
  get hasName(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  get hasRepo(): boolean {
    const repo = this.projectState.getProject().github.repo;
    return !!repo;
  }

  //Todo: Collaborators management
  collaborators = this.projectState.getProject().collaborators;

  //UI elements
  inScopePageCount = computed(() => this.projectState.getProject().inScopePages);
  showUrls = false;
  showIA = false;
  showBreadcrumb = false;

  //URL drawer - Both languages
  pairedPagesForTable = computed(() =>
    this.projectState.getPairedPages(this.projectCache.selectedSource(), this.projectCache.selectedScope())
  );

  //URL drawer - One language
  singlePagesForList = computed(() => {
    const selectedLang = this.projectCache.selectedLang();
    const lang = selectedLang === 'both' ? this.projectState.detectPrimaryLanguage() : selectedLang;
    return this.projectState.getAllPages(lang, this.projectCache.selectedSource(), this.projectCache.selectedScope());
  });

  //URL drawer - Copy
  async copyToClipboard(lang: 'en' | 'fr' | 'both'): Promise<void> {
    const pairs = this.pairedPagesForTable();
    let text;
    if (lang === 'both') {
      text = pairs.map(pair => `${pair.en.url}\t${pair.fr.url}`).join('\r\n');
    } else {
      text = pairs.map(pair => `${pair[lang].url}`).join('\r\n');
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

}