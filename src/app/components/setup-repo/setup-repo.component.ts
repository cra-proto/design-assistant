import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

//PrimeNG modules
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { KeyFilterModule } from 'primeng/keyfilter';
import { MessageModule } from 'primeng/message';

//Custom components and services
import { ProjectStateService } from '../../services/project-state.service';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'aida-setup-repo',
  imports: [
    CommonModule, FormsModule, TranslateModule,
    InputTextModule, IftaLabelModule, CheckboxModule, AutoCompleteModule, KeyFilterModule, MessageModule,
  ],
  templateUrl: './setup-repo.component.html',
  styles: ``
})
export class SetupRepoComponent implements OnInit {
  private projectState = inject(ProjectStateService);
  private exportGitHubService = inject(ExportGitHubService);
  defaultOrg = environment.defaultOrg

  constructor() {
    // Refresh gitHubRepo when there are changes to project name (for initial sync fxn)
    effect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const stateName = this.projectData.projectName; // waching for changes to project name
      this.gitHubRepo = this.projectData.github.repo;
    });
  }

  async ngOnInit(): Promise<void> {
    await this.updateRepoList();
  }

  //Project inputs
  get projectData() {
    return this.projectState.getProject();
  }

  //Text inputs
  gitHubOwner = this.projectData.github.owner;
  gitHubRepo = this.projectData.github.repo;
  gitHubBranch = this.projectData.github.branch;

  //Baseline checkbox
  get gitHubBaseline(): boolean {
    return this.projectData.github.hasBaselineRepo;
  }
  set gitHubBaseline(value: boolean) {
    this.projectState.setGitHubRepo({ hasBaselineRepo: value });
  }

  ownerFilter = /^[a-zA-Z0-9-]*$/;
  repoFilter = /^[a-zA-Z0-9-._]*$/;
  branchFilter = /^[a-zA-Z0-9-./]*$/;

  updateOwner() {
    this.gitHubOwner = this.gitHubOwner.trim().toLowerCase().replace(/^[-]+|[-]+$/g, '').replace(/[-]{2,}/g, '-');
    if (!this.gitHubOwner) { this.gitHubOwner = this.defaultOrg; }
    this.projectState.setGitHubRepo({ owner: this.gitHubOwner });
  }

  onRepoInput() {
    this.gitHubRepo = this.gitHubRepo.trim().replace(/^[-._]+|[-._]+$/g, '').replace(/(\/|\.)lock$/, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/[_]{2,}/g, '_');
  }

  private blurTimeout: ReturnType<typeof setTimeout> | undefined;
  onRepoBlur() {
    this.blurTimeout = setTimeout(() => {
      this.updateRepo();
    }, 200);
  }

  onRepoSelect(event: AutoCompleteSelectEvent) {
    this.gitHubRepo = event.value;
    this.updateRepo();
  }

  updateRepo() {
    this.projectState.setGitHubRepo({ repo: this.gitHubRepo });
  }

  updateBranch() {
    this.gitHubBranch = this.gitHubBranch.trim().replace(/^[-./]+|[-./]+$/g, '').replace(/(\/|\.)lock$/, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/\/{2,}/g, '/');
    if (!this.gitHubBranch) { this.gitHubBranch = 'main'; }
    this.projectState.setGitHubRepo({ branch: this.gitHubBranch });
  }

  //Loads repo list for filtering
  repos: string[] = [];
  ownerError: { key: string, params?: { owner: string } } | null = null;
  async updateRepoList() {
    this.ownerError = null;
    this.repos = [];

    try {
      const repos = await this.exportGitHubService.getRepoList(this.gitHubOwner);
      this.repos = repos.map(r => (r.name));
    }
    catch (error) {
      if ((error as Error).message?.includes('404')) {
        this.ownerError = { key: 'project.github.error.ownerNotFound', params: { owner: this.gitHubOwner } };
      } else {
        this.ownerError = { key: 'project.github.error.loadFailed', params: { owner: this.gitHubOwner } };
      }
    }
  }

  markForTranslation() {
    marker('project.github.error.ownerNotFound');
    marker('project.github.error.loadFailed');
  }

  //Filters repo list for autocomplete (starts with, then includes)
  filteredRepos: string[] = [];
  filterRepos(event: AutoCompleteCompleteEvent) {
    const query = event.query?.trim().toLowerCase() || '';
    const startsWith = this.repos.filter(r => r.toLowerCase().startsWith(query));
    const includes = this.repos.filter(r => r.toLowerCase().includes(query) && !r.toLowerCase().startsWith(query));
    this.filteredRepos = Array.from(new Set([...startsWith, ...includes]));
  }

}