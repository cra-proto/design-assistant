import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { AddCollaboratorsComponent } from '../../../components/add-collaborators/add-collaborators.component';
import { SetupProjectComponent } from '../../../components/setup-project/setup-project.component';

import { CollaboratorService } from '../../../services/github/collaborator.service';
import { ExportGitHubService } from '../../../services/github/export-github.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { ProjectStorageService } from '../../../services/storage/project-storage.service';

import { ProjectMetadata, ProjectPhase } from '../../../common/data.model';

//TODO: FIX HARDCODED TRANSLATIONS

@Component({
  selector: 'aida-switch-project',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CardModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    SelectModule,
    TagModule,
    TooltipModule,
    AddCollaboratorsComponent,
    SetupProjectComponent,
  ],
  templateUrl: './switch-project.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwitchProjectComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly projectState = inject(ProjectStateService);
  protected readonly projectStorageService = inject(ProjectStorageService);
  protected readonly exportGitHubService = inject(ExportGitHubService);
  protected readonly collaboratorService = inject(CollaboratorService);

  private readonly router = inject(Router);
  private readonly message = inject(MessageService);

  // Project list signal
  private readonly allProjects = signal<ProjectMetadata[]>([]);

  // Project filter & search
  protected readonly selectedFilter = signal<string[]>([]);
  protected readonly searchTerm = signal<string>('');

  protected loadingKey: string | null = null;
  protected showSave = false;

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
        detail: `${deletedCount} expired project${deletedCount > 1 ? 's' : ''} automatically deleted`,
      });
    }

    // Load project list
    await this.loadProjects(this.currentMode());
  }

  //Filter options
  protected groupedFilters: MenuItem[] = [];

  protected updateGroupedFilters() {
    const allCollaborators = this.allProjects().flatMap((p) => p.collaborators);
    const uniqueCollaborators = Array.from(new Map(allCollaborators.map((c) => [c.login, c])).values()).sort((a, b) => a.login.localeCompare(b.login));

    this.groupedFilters = [
      {
        label: 'Storage type',
        value: 'storage',
        items: [
          { label: 'Cloud', value: 'Cloud' },
          { label: 'Local', value: 'Local' },
        ],
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
        ],
      },
      {
        label: 'Collaborators',
        value: 'collab',
        items: uniqueCollaborators.map((c) => ({
          label: c.name || c.login, // Use display name if available, fallback to login
          value: c.login,
        })),
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
        ],
      });
    }
  }

  // Toggle between saved and deleted projects
  protected readonly currentMode = signal<'saved' | 'deleted'>('saved');

  protected toggleProjectView() {
    const newMode = this.currentMode() === 'saved' ? 'deleted' : 'saved';
    this.currentMode.set(newMode);
    this.loadProjects(newMode);
  }

  //Load all projects
  private async loadProjects(mode: 'saved' | 'deleted' = 'saved') {
    const projects = mode === 'deleted' ? this.projectStorageService.getLocalProjectList('deleted') : await this.projectStorageService.getProjectList();
    this.allProjects.set(projects);
  }

  // Get projects for display
  protected get projects() {
    const all = this.allProjects();
    const sort = this.selectedSort();
    const filters = this.selectedFilter();
    const search = this.searchTerm();

    let filtered = all;

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.projectName.toLowerCase().includes(searchLower) ||
          p.id.toLowerCase().includes(searchLower) ||
          p.key.toLowerCase().includes(searchLower) ||
          p.phase.toLowerCase().includes(searchLower) ||
          p.storageType.toLowerCase().includes(searchLower) ||
          p.github.owner.toLowerCase().includes(searchLower) ||
          p.github.repo.toLowerCase().includes(searchLower) ||
          p.github.branch.toLowerCase().includes(searchLower) ||
          p.collaborators.some((c) => c.login?.toLowerCase().includes(searchLower)) ||
          p.collaborators.some((c) => c.name?.toLowerCase().includes(searchLower)) ||
          p.collaborators.some((c) => c.email?.toLowerCase().includes(searchLower)),
      );
    }

    // Apply filters
    if (filters.length > 0) {
      filtered = filtered.filter((p) => {
        return filters.some((filterValue) => {
          // Storage type
          if (filterValue === 'Cloud') return p.storageType === 'cloud';
          if (filterValue === 'Local') return p.storageType === 'local';

          // Collaborators
          if (p.collaborators.some((c) => c.login === filterValue)) {
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

  protected async loadProject(key: string, id: string, storageType: 'local' | 'cloud' = 'local') {
    // Show loading state on card
    this.loadingKey = key;
    if (storageType === 'cloud') {
      this.loadingKey = id;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const project = await this.projectStorageService.loadProject(this.loadingKey, storageType);

      if (project) {
        this.projectState.setProject(project); // Update the project state
        //Refresh live data if project is missing properties (for patching legacy data)
        await this.projectState.refreshAll(project.projectData, 'live', true);
        await this.projectState.refreshAll(project.projectData, 'baseGH', true, true);
      } else {
        console.error('Failed to load project'); // Show error message
      }
    } finally {
      this.loadingKey = null;
      this.router.navigate(['/']);
    }
  }

  protected async newProject() {
    this.projectStorageService.clearActiveProject();
    await this.projectState.resetProject();
    this.router.navigate(['/new-project']);
  }

  protected async saveProject() {
    const success = await this.projectState.saveProject();
    if (success) {
      // Refresh project list
      await this.loadProjects();

      this.message.add({
        severity: 'success',
        summary: 'Project saved',
        detail: 'Your project has been saved successfully',
      });
    } else {
      this.message.add({
        severity: 'error',
        summary: 'Save failed',
        detail: 'Could not save the project',
      });
    }
  }

  protected async deleteProject(project: ProjectMetadata, event?: Event) {
    event?.stopPropagation();

    let key = project.key;
    if (project.storageType === 'cloud') {
      key = project.id;
    }

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
        detail: 'The project has been removed',
      });
    } else {
      this.message.add({
        severity: 'error',
        summary: 'Delete failed',
        detail: 'Could not delete the project',
      });
    }
  }

  // Upload local project to cloud
  protected async uploadToCloud(project: ProjectMetadata, event?: Event) {
    event?.stopPropagation();

    if (!this.collaboratorService.canEditProject(project)) {
      return;
    }

    // Load the full project from local storage
    const fullProject = await this.projectStorageService.loadProject(project.key, 'local');
    if (!fullProject) {
      this.message.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: 'Could not load project data',
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
        detail: 'Your project is now available in the cloud',
      });
    } else {
      this.message.add({
        severity: 'error',
        summary: 'Upload failed',
        detail: 'Could not upload project to cloud',
      });
    }
  }

  // End of Actions

  //testing

  //Sort
  protected readonly selectedSort = signal<string>('date_desc');
  protected readonly sortOptions = [
    { label: 'Date (newest first)', value: 'date_desc' },
    { label: 'Date (oldest first)', value: 'date_asc' },
    { label: 'Name (A-Z)', value: 'name_asc' },
    { label: 'Name (Z-A)', value: 'name_desc' },
  ];

  protected getPhaseIcon(phase: string | undefined): string {
    const iconMap: Record<string, string> = {
      Discover: 'search',
      Design: 'pencil',
      Assess: 'chart-line',
      Approve: 'check-circle',
      Complete: 'verified',
    };
    return iconMap[phase || 'Draft'] || 'pencil';
  }
}
