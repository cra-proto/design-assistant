import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FieldsetModule } from 'primeng/fieldset';
import { SplitButtonModule } from 'primeng/splitbutton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';

import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipModule } from 'primeng/chip';
import { TimelineModule } from 'primeng/timeline';
import { ProgressBarModule } from 'primeng/progressbar';

import { FilterService, MenuItem } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';

//Services
import { SetupProjectComponent } from '../../components/setup-project/setup-project.component';
import { AddCollaboratorsComponent } from '../../components/add-collaborators/add-collaborators.component';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { CollaboratorService } from '../../services/collaborator.service';

//Storage
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectStorageService } from '../../services/storage/project-storage.service';
import { CloudStorageService } from '../../services/storage/cloud-storage.service';
import { ProjectMetadata, ProjectPhase } from '../../common/data.model';


@Component({
  selector: 'aida-switch-project',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule,
    CardModule, ButtonModule, DialogModule, FieldsetModule, TimelineModule, ProgressBarModule, SplitButtonModule, ChipModule,
    InputTextModule, IconFieldModule, InputIconModule, SelectModule, MultiSelectModule,
    CheckboxModule, DividerModule, SelectButtonModule, TagModule, TableModule, TabsModule, BadgeModule, AvatarModule, AvatarGroupModule, TooltipModule, MessageModule,
    SetupProjectComponent, AddCollaboratorsComponent],
  templateUrl: './switch-project.component.html',
  styles: ``
})
export class SwitchProjectComponent implements OnInit {
  private translate = inject(TranslateService);
  private projectState = inject(ProjectStateService);
  public projectStorageService = inject(ProjectStorageService);
  public authService = inject(GitHubAuthService);
  private cloudStorageService = inject(CloudStorageService);
  public collaboratorService = inject(CollaboratorService);

  public router = inject(Router);
  public message = inject(MessageService);
  public filterService = inject(FilterService);

  // Project list signal
  allProjects = signal<ProjectMetadata[]>([]);

  // Project filter & search
  selectedFilter = signal<string[]>([]);
  searchTerm = signal<string>('');

  loadingKey: string | null = null;
  showSave = false;

  constructor() {
    // Watch for project list changes and reload
    effect(() => {
      this.projectStorageService.projectListChanged(); // Watch for changes
      console.log('Project list changed, reloading...');
      this.loadProjects(this.currentMode()); // Load projects
    });
  }

  async ngOnInit() {

    // Delete deleted projects after a period of time
    const deletedCount = this.projectStorageService.cleanupDeletedProjects();
    if (deletedCount > 0) {
      this.message.add({
        severity: 'info',
        summary: 'Cleanup completed',
        detail: `${deletedCount} expired project${deletedCount > 1 ? 's' : ''} automatically deleted`
      });
    }

    // Load project list
    await this.loadProjects(this.currentMode());
  }

  //Filter options
  groupedFilters: MenuItem[] = [];

  updateGroupedFilters() {
    const allCollaborators = this.allProjects().flatMap(p => p.collaborators);
    const uniqueCollaborators = Array.from(
      new Map(allCollaborators.map(c => [c.login, c])).values()
    ).sort((a, b) => a.login.localeCompare(b.login));

    this.groupedFilters = [
      {
        label: 'Storage type',
        value: 'storage',
        items: [
          { label: 'Cloud', value: 'Cloud' },
          { label: 'Local', value: 'Local' },
        ]
      },
      {
        label: 'Project Phase',
        value: 'phase',
        items: [
          { label: this.translate.instant(ProjectPhase.Draft), value: ProjectPhase.Draft },
          { label: this.translate.instant(ProjectPhase.Discover), value: ProjectPhase.Discover },
          { label: this.translate.instant(ProjectPhase.Assess), value: ProjectPhase.Assess },
          { label: this.translate.instant(ProjectPhase.Design), value: ProjectPhase.Design },
          { label: this.translate.instant(ProjectPhase.Approve), value: ProjectPhase.Approve },
          { label: this.translate.instant(ProjectPhase.Complete), value: ProjectPhase.Complete },
        ]
      },
      {
        label: 'Collaborators',
        value: 'collab',
        items: uniqueCollaborators.map(c => ({
          label: c.name || c.login,  // Use display name if available, fallback to login
          value: c.login
        }))
      },
    ];

    const myOrg = localStorage.getItem('myOrg'); // Only add Organization filter if myOrg is set
    if (myOrg) {
      this.groupedFilters.push({
        label: 'Organization',
        value: 'org',
        items: [
          { label: 'Default', value: 'DEFAULT' },
          { label: myOrg, value: myOrg },
        ]
      });
    }
  }

  // Toggle between saved and deleted projects
  currentMode = signal<'saved' | 'deleted'>('saved');

  toggleProjectView() {
    const newMode = this.currentMode() === 'saved' ? 'deleted' : 'saved';
    this.currentMode.set(newMode);
    this.loadProjects(newMode);
  }

  //Load all projects
  async loadProjects(mode: 'saved' | 'deleted' = 'saved') {
    const projects = mode === 'deleted'
      ? this.projectStorageService.getLocalProjectList('deleted')
      : await this.projectStorageService.getProjectList();
    this.allProjects.set(projects);
  }

  // Get projects for display
  get projects() {
    const all = this.allProjects();
    const sort = this.selectedSort();
    const filters = this.selectedFilter();
    const search = this.searchTerm();

    let filtered = all;

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.projectName?.toLowerCase().includes(searchLower) ||
        p.id?.toLowerCase().includes(searchLower) ||
        p.key?.toLowerCase().includes(searchLower) ||
        p.phase?.toLowerCase().includes(searchLower) ||
        p.storageType?.toLowerCase().includes(searchLower) ||
        p.github?.owner?.toLowerCase().includes(searchLower) ||
        p.github?.repo?.toLowerCase().includes(searchLower) ||
        p.github?.branch?.toLowerCase().includes(searchLower) ||
        p.collaborators?.some(c => c.login?.toLowerCase().includes(searchLower)) ||
        p.collaborators?.some(c => c.name?.toLowerCase().includes(searchLower)) ||
        p.collaborators?.some(c => c.email?.toLowerCase().includes(searchLower))
      );
    }

    // Apply filters
    if (filters.length > 0) {
      filtered = filtered.filter(p => {
        return filters.some(filterValue => {
          // Storage type
          if (filterValue === 'Cloud') return p.storageType === 'cloud';
          if (filterValue === 'Local') return p.storageType === 'local';

          // Collaborators
          if (p.collaborators.some(c => c.login === filterValue)) {
            return true;
          }

          // Project Phase
          if (Object.values(ProjectPhase).includes(filterValue as ProjectPhase)) {
            return p.phase === filterValue;
          }

          // Organization
          const projectOrg = p.org || localStorage.getItem('myOrg') || 'DEFAULT';
          if (filterValue === 'DEFAULT') return projectOrg === 'DEFAULT';
          const myOrg = localStorage.getItem('myOrg');
          if (filterValue === myOrg && myOrg) return projectOrg === myOrg;

          return false;
        });
      });
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'date_desc':
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        case 'date_asc':
          return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
        case 'name_asc':
          return a.projectName.localeCompare(b.projectName);
        case 'name_desc':
          return b.projectName.localeCompare(a.projectName);
        default:
          return 0;
      }
    });

    return sorted;
  }

  // Project File Actions - load, new, delete, save to cloud & save autosave

  async loadProject(key: string, id: string, storageType: 'local' | 'cloud' = 'local') {

    // Show loading state on card
    this.loadingKey = key;
    if (storageType === 'cloud') {
      this.loadingKey = id;
    }

    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      const project = await this.projectStorageService.loadProject(this.loadingKey, storageType);

      if (project) {
        this.projectState.setProject(project); // Update the project state
      } else {
        console.error('Failed to load project'); // Show error message
      }
    } finally {
      this.loadingKey = null;
      this.router.navigate(['/']);
    }
  }


  async newProject() {
    this.projectStorageService.clearActiveProject();
    await this.projectState.resetProject();
    this.router.navigate(['/new-project']);
  }

  async saveProject() {
    const success = await this.projectState.saveProject();
    if (success) {
      // Refresh project list
      await this.loadProjects();

      this.message.add({
        severity: 'success',
        summary: 'Project saved',
        detail: 'Your project has been saved successfully'
      });
    } else {
      this.message.add({
        severity: 'error',
        summary: 'Save failed',
        detail: 'Could not save the project'
      });
    }
  }

  async deleteProject(project: ProjectMetadata, event?: Event) {
    event?.stopPropagation();

    let key = project.key;
    if (project.storageType === 'cloud') { key = project.id }

    const success = await this.projectStorageService.deleteProject(key, project.storageType);

    // Refresh project list
    if (success) {
      // Toggle mode first if no more deleted projects
      if (this.currentMode() === 'deleted') {
        if (this.projectStorageService.getLocalProjectList('deleted').length === 0) {
          this.currentMode.set('saved');
        }
      }
      await this.loadProjects(this.currentMode());

      // Check if we deleted the active project
      const active = this.projectStorageService.getActiveProject();
      if (active?.key === key) {
        this.newProject();
      }

      this.message.add({
        severity: 'success',
        summary: 'Project deleted',
        detail: 'The project has been removed'
      });
    } else {
      this.message.add({
        severity: 'error',
        summary: 'Delete failed',
        detail: 'Could not delete the project'
      });
    }
  }

  // Upload local project to cloud
  async uploadToCloud(project: ProjectMetadata, event?: Event) {
    event?.stopPropagation();

    if (!this.collaboratorService.canEditProject(project)) { return; }

    // Load the full project from local storage
    const fullProject = await this.projectStorageService.loadProject(project.key, 'local');
    if (!fullProject) {
      this.message.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: 'Could not load project data'
      });
      return;
    }

    // Update storage type to cloud
    fullProject.storageType = 'cloud';

    // Save to cloud
    const success = await this.projectStorageService.saveProject(fullProject);

    if (success) {
      // Delete from local storage
      await this.projectStorageService.deleteProject(project.key, 'local');

      // Refresh project list
      await this.loadProjects();

      this.message.add({
        severity: 'success',
        summary: 'Uploaded to cloud',
        detail: 'Your project is now available in the cloud'
      });
    } else {
      this.message.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: 'Could not upload project to cloud'
      });
    }
  }

  // End of Actions

  //testing

  //Sort
  selectedSort = signal<string>('date_desc');
  sortOptions = [
    { label: 'Date (newest first)', value: 'date_desc' },
    { label: 'Date (oldest first)', value: 'date_asc' },
    { label: 'Name (A-Z)', value: 'name_asc' },
    { label: 'Name (Z-A)', value: 'name_desc' },
  ];

  getPhaseIcon(phase: string | undefined): string {
    const iconMap: Record<string, string> = {
      'Discover': 'search',
      'Design': 'pencil',
      'Assess': 'chart-line',
      'Approve': 'check-circle',
      'Complete': 'verified'
    };
    return iconMap[phase || 'Draft'] || 'pencil';
  }






  async loadCloudProject(cloudId: string) {
    const project = await this.cloudStorageService.getProject(cloudId);
    if (!project?.projectData) return;

    /* Parse the content and load it into the state
    const state = JSON.parse(project.content);
    this.projectState.setActiveStep(state.activeStep);
    this.projectState.setUrlData(state.urlData);
    this.projectState.setBreadcrumbData(state.breadcrumbData);
    this.projectState.setSearchData(state.searchData);
    this.projectState.setIaData(state.iaData);
    this.projectState.setGitHubData(state.gitHubData);
*/
    // Navigate to the project
    this.router.navigate(['/']);
  }

  async deleteCloudProject(cloudId: string) {
    const success = await this.cloudStorageService.deleteProject(cloudId);
    if (success) {
      console.log('Cloud project deleted');
    }
  }













}

