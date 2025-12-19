import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

//PrimeNG modules
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { IftaLabelModule } from 'primeng/iftalabel';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectButton } from 'primeng/selectbutton';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { KeyFilterModule } from 'primeng/keyfilter';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { TreeNode } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';

//Custom components and services
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectPhase, ProjectTreeNodeData } from '../../common/data.model';
import { ExportGitHubService } from '../ia-assistant/services/export-github.service';
import { GitHubAuthService } from '../../services/github-auth.service';
import { AddPagesComponent } from '../add-pages/add-pages.component';
import { IaDiagramComponent } from '../../components/ia-diagram/ia-diagram.component';

@Component({
  selector: 'aida-edit-project',
  imports: [
    CommonModule, FormsModule, TranslateModule, RouterLink,
    AddPagesComponent, IaDiagramComponent,
    InputTextModule, TextareaModule, SelectModule, IftaLabelModule, SelectButton, CheckboxModule, AutoCompleteModule, KeyFilterModule, MessageModule,
    DrawerModule, ButtonModule, OrganizationChartModule, TooltipModule
  ],
  templateUrl: './edit-project.component.html',
  styles: ``
})
export class EditProjectComponent implements OnInit {
  projectState = inject(ProjectStateService);
  exportGitHubService = inject(ExportGitHubService);
  authService = inject(GitHubAuthService);

  //Check if project is loaded
  get projectLoaded(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  async ngOnInit(): Promise<void> {
    await this.updateRepoList();
  }

  //Project inputs
  get projectData() {
    return this.projectState.getProject();
  }

  //Text inputs
  projectName = this.projectData.projectName;
  gitHubOwner = this.projectData.github.owner;
  gitHubRepo = this.projectData.github.repo;
  gitHubBranch = this.projectData.github.branch;

  //Phase dropdown
  get projectPhase(): ProjectPhase {
    return this.projectData.phase;
  }
  set projectPhase(value: ProjectPhase) {
    this.projectState.setProjectPhase(value);
  }
  //Storage select button
  get projectStorage(): 'browser' | 'cloud' {
    return this.projectData.storageLocation;
  }
  set projectStorage(value: 'browser' | 'cloud') {
    this.projectState.setStorageLocation(value);
  }
  //Baseline checkbox
  get gitHubBaseline(): boolean {
    return this.projectData.github.hasBaselineRepo;
  }
  set gitHubBaseline(value: boolean) {
    this.projectState.setGitHubRepo({ hasBaselineRepo: value });
  }

  //Input options and filters
  phaseOptions = [
    { name: ProjectPhase.Draft, value: ProjectPhase.Draft },
    { name: ProjectPhase.Discover, value: ProjectPhase.Discover },
    { name: ProjectPhase.Assess, value: ProjectPhase.Assess },
    { name: ProjectPhase.Design, value: ProjectPhase.Design },
    { name: ProjectPhase.Approve, value: ProjectPhase.Approve },
    { name: ProjectPhase.Complete, value: ProjectPhase.Complete },
  ];

  storageOptions = [
    { name: 'storage.browser', value: 'browser' as const, icon: 'pi pi-desktop' },
    { name: 'storage.cloud', value: 'cloud' as const, icon: 'pi pi-cloud', disabled: !this.authService.isAuthenticated() }
  ];

  nameFilter = /^[a-zA-Z0-9-._ :']*$/;
  ownerFilter = /^[a-zA-Z0-9-]*$/;
  repoFilter = /^[a-zA-Z0-9-._]*$/;
  branchFilter = /^[a-zA-Z0-9-./]*$/;

  updateName() {
    this.projectName = this.projectName.trim().replace(/^[-._ :']+|[-._ :']+$/g, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/[_]{2,}/g, '_').replace(/\s+/g, ' ').replace(/[:]{2,}/g, ':').replace(/[']{2,}/g, '\'');
    this.projectState.setProjectName(this.projectName);
  }

  updateOwner() {
    this.gitHubOwner = this.gitHubOwner.trim().toLowerCase().replace(/^[-]+|[-]+$/g, '').replace(/[-]{2,}/g, '-');
    if (!this.gitHubOwner) { this.gitHubOwner = 'cra-design'; }
    this.projectState.setGitHubRepo({ owner: this.gitHubOwner });
  }

  updateRepo() {
    this.gitHubRepo = this.gitHubRepo.trim().replace(/^[-._]+|[-._]+$/g, '').replace(/(\/|\.)lock$/, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/[_]{2,}/g, '_');
    this.projectState.setGitHubRepo({ repo: this.gitHubRepo });
  }

  updateBranch() {
    this.gitHubBranch = this.gitHubBranch.trim().replace(/^[-./]+|[-./]+$/g, '').replace(/(\/|\.)lock$/, '').replace(/[-]{2,}/g, '-').replace(/[.]{2,}/g, '.').replace(/\/{2,}/g, '/');
    if (!this.gitHubBranch) { this.gitHubBranch = 'main'; }
    this.projectState.setGitHubRepo({ branch: this.gitHubBranch });
  }

  //Autocompletes project or repo name based on the other if one is empty
  syncName() {
    if (!this.projectName && this.gitHubRepo) { this.projectName = this.gitHubRepo.replace(/-/g, ' ').replace(/^./, char => char.toUpperCase()); this.updateName(); }
    if (this.projectName && !this.gitHubRepo) { this.gitHubRepo = this.projectName.replace(/[:']/g, '').replace(/\s+/g, '-').toLowerCase(); this.updateRepo(); }
  }

  //Loads repo list for filtering
  repos: string[] = [];
  ownerError = '';
  async updateRepoList() {
    this.ownerError = '';
    this.repos = [];

    try {
      const repos = await this.exportGitHubService.getRepoList(this.gitHubOwner);
      this.repos = repos.map(r => (r.name));
    }
    catch (error) {
      if ((error as Error).message?.includes('404')) {
        this.ownerError = `GitHub owner "${this.gitHubOwner}" not found.`;
      } else {
        this.ownerError = `Failed to load repositories for "${this.gitHubOwner}".`;
      }
    }
  }

  //Filters repo list for autocomplete
  filteredRepos: string[] = [];
  filterRepos(event: AutoCompleteCompleteEvent) {
    const query = event.query?.trim().toLowerCase() || '';
    const startsWith = this.repos.filter(r => r.toLowerCase().startsWith(query));
    const includes = this.repos.filter(r => r.toLowerCase().includes(query) && !r.toLowerCase().startsWith(query));
    this.filteredRepos = Array.from(new Set([...startsWith, ...includes]));
  }

  //Todo: Collaborators management
  collaborators = this.projectData.collaborators;

  //Toggles for showing different displays of current in-scope pages
  get inScopePageCount(): Number {
    return this.projectState.getProject().inScopePages;
  }

  projectTree = this.projectState.getProjectTree();

  showUrls = false;
  showIA = false;
  showBreadcrumb = false;

}