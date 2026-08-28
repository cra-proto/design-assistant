import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { KeyFilterModule } from 'primeng/keyfilter';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';

import { ExportGitHubService } from '../../services/github/export-github.service';
import { ProjectStateService } from '../../services/project-state.service';
import { UserSettingsService } from '../../services/user-settings.service';

import { environment } from '../../../environments/environment';

type RepoMode = 'default' | 'baseline';

@Component({
  selector: 'aida-setup-repo',
  imports: [CommonModule, FormsModule, TranslatePipe, AutoCompleteModule, CheckboxModule, IftaLabelModule, InputTextModule, KeyFilterModule, MessageModule, SelectButtonModule],
  templateUrl: './setup-repo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupRepoComponent implements OnInit {
  private projectState = inject(ProjectStateService);
  private exportGitHubService = inject(ExportGitHubService);
  private settingsService = inject(UserSettingsService);
  private translate = inject(TranslateService);

  defaultOrg = environment.defaultOrg;

  public readonly mode = input<RepoMode>('default');

  //Local or GitHub content repository
  get projectRepo(): 'local' | 'github' {
    return this.projectData.repoType ?? 'github';
  }
  set projectRepo(value: 'local' | 'github') {
    this.projectState.setRepoType(value);
    this.settingsService.includeLocal.set(value === 'local');
    this.settingsService.includeGitHub.set(value === 'github');
  }
  repoOptions = [
    { name: 'project.repo.storage.github', value: 'github' as const, icon: 'pi pi-github' },
    { name: 'project.repo.storage.local', value: 'local' as const, icon: 'pi pi-folder' },
  ];

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
    this.settingsService.includeBaseline.set(value);
  }

  ownerFilter = /^[a-zA-Z0-9-]*$/;
  repoFilter = /^[a-zA-Z0-9-._]*$/;
  branchFilter = /^[a-zA-Z0-9-./]*$/;

  updateOwner() {
    this.gitHubOwner = this.gitHubOwner
      .trim()
      .toLowerCase()
      .replace(/^[-]+|[-]+$/g, '')
      .replace(/[-]{2,}/g, '-');
    if (!this.gitHubOwner) {
      this.gitHubOwner = this.defaultOrg;
    }
    this.projectState.setGitHubRepo({ owner: this.gitHubOwner });
  }

  onRepoInput() {
    this.gitHubRepo = this.gitHubRepo
      .trim()
      .replace(/^[-._]+|[-._]+$/g, '')
      .replace(/(\/|\.)lock$/, '')
      .replace(/[-]{2,}/g, '-')
      .replace(/[.]{2,}/g, '.')
      .replace(/[_]{2,}/g, '_');
  }

  private blurTimeout: ReturnType<typeof setTimeout> | undefined;
  onRepoBlur() {
    //Add year to new repos
    if (this.gitHubRepo.trim() !== '' && !this.repos.includes(this.gitHubRepo)) {
      const currentYear = new Date().getFullYear().toString();
      if (!/[-_]?\d{4}$/.test(this.gitHubRepo)) {
        this.gitHubRepo = `${this.gitHubRepo}-${currentYear}`;
      }
    }
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
    this.gitHubBranch = this.gitHubBranch
      .trim()
      .replace(/^[-./]+|[-./]+$/g, '')
      .replace(/(\/|\.)lock$/, '')
      .replace(/[-]{2,}/g, '-')
      .replace(/[.]{2,}/g, '.')
      .replace(/\/{2,}/g, '/');
    if (!this.gitHubBranch) {
      this.gitHubBranch = 'main';
    }
    this.projectState.setGitHubRepo({ branch: this.gitHubBranch });
  }

  //Loads repo list for filtering
  repos: string[] = [];
  ownerError: { key: string; params?: { owner: string } } | null = null;
  async updateRepoList() {
    this.ownerError = null;
    this.repos = [];

    try {
      const repos = await this.exportGitHubService.getRepoList(this.gitHubOwner);
      this.repos = repos.map((r) => r.name);
    } catch (error) {
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
    marker('project.repo.storage.local');
    marker('project.repo.storage.github');
  }

  //Filters repo list for autocomplete (starts with, then includes)
  filteredRepos: string[] = [];
  filterRepos(event: AutoCompleteCompleteEvent) {
    const query = event.query?.trim().toLowerCase() || '';
    const startsWith = this.repos.filter((r) => r.toLowerCase().startsWith(query));
    const includes = this.repos.filter((r) => r.toLowerCase().includes(query) && !r.toLowerCase().startsWith(query));
    this.filteredRepos = Array.from(new Set([...startsWith, ...includes]));
  }
}
