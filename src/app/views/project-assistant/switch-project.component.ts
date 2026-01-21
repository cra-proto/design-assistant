import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
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

import { FilterService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';

//Services
import { SetupProjectComponent } from '../../components/setup-project/setup-project.component';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { CollaboratorService } from '../../services/collaborator.service';

//Storage
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectStorageService } from '../../services/storage/project-storage.service';
import { CloudStorageService } from '../../services/storage/cloud-storage.service';
import { LocalStorageService } from '../../services/storage/local-storage.service';
import { Project, ProjectMetadata, GitHubUser } from '../../common/data.model';


@Component({
  selector: 'aida-switch-project',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule,
    CardModule, ButtonModule, DialogModule, FieldsetModule, TimelineModule, ProgressBarModule, SplitButtonModule, ChipModule,
    InputTextModule, IconFieldModule, InputIconModule, SelectModule, MultiSelectModule,
    CheckboxModule, DividerModule, SelectButtonModule, TagModule, TableModule, TabsModule, BadgeModule, AvatarModule, AvatarGroupModule, TooltipModule, MessageModule,
    SetupProjectComponent],
  templateUrl: './switch-project.component.html',
  styles: ``
})
export class SwitchProjectComponent implements OnInit {
  public projectState = inject(ProjectStateService);
  public projectStorage = inject(ProjectStorageService);
  public authService = inject(GitHubAuthService);
  private cloudStorage = inject(CloudStorageService);
  public collaboratorService = inject(CollaboratorService);
  public exportGitHubService = inject(ExportGitHubService);

  public router = inject(Router);
  public message = inject(MessageService);
  public filterService = inject(FilterService);

  // Project list signal
  allProjects = signal<ProjectMetadata[]>([]);
  loadingKey: string | null = null;
  showSave = false;

  constructor() {
    // Watch for project list changes and reload
    effect(() => {
      this.projectStorage.projectListChanged(); // Watch for changes
      console.log('Project list changed, reloading...');
      this.loadProjects(); // Load projects
    });
  }

  async ngOnInit() {
    await this.loadProjects();
  }

  //Load all projects
  async loadProjects() {
    const projects = this.projectStorage.getProjectList();
    this.allProjects.set(projects);
  }

  // Get projects for display
  get projects() {
    return this.allProjects();
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
      const project = await this.projectStorage.loadProject(this.loadingKey, storageType);

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


  newProject() {
    this.projectStorage.clearActiveProject();
    this.projectState.resetProject();
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

    const success = await this.projectStorage.deleteProject(key, project.storageType);

    if (success) {
      // Refresh project list
      await this.loadProjects();

      // Check if we deleted the active project
      const active = this.projectStorage.getActiveProject();
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

    if (!this.authService.isAuthenticated()) {
      this.showSave = true;
      return;
    }

    // Load the full project from local storage
    const fullProject = await this.projectStorage.loadProject(project.key, 'local');
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
    const success = await this.projectStorage.saveProject(fullProject);

    if (success) {
      // Optionally delete from local storage
      // await this.projectStorage.deleteProject(project.key, 'local');

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

  //Filter
  selectedFilter = signal<string>('');
  groupedFilters = [
    {
      label: 'Storage type',
      value: 'storage',
      items: [
        { label: 'Cloud', value: 'Cloud' },
        { label: 'Local', value: 'Local' },
      ]
    },
    {
      label: 'Collaborators',
      value: 'collab',
      items: [
        { label: 'Amber', value: 'Amber' },
        { label: 'Miguel', value: 'Miguel' },
        { label: 'Naomi', value: 'Naomi' },
        { label: 'Marvin', value: 'Marvin' }
      ]
    },
    {
      label: 'Project Phase',
      value: 'phase',
      items: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Discover', value: 'Discover' },
        { label: 'Design', value: 'Design' },
        { label: 'Assess', value: 'Assess' },
        { label: 'Approve', value: 'Approve' },
        { label: 'Complete', value: 'Complete' },
      ]
    },
  ];

  getPhaseIcon(phase: string | undefined): string {
    const iconMap: { [key: string]: string } = {
      'Discover': 'search',
      'Design': 'pencil',
      'Assess': 'chart-line',
      'Approve': 'check-circle',
      'Complete': 'verified'
    };
    return iconMap[phase || 'Draft'] || 'pencil';
  }






  async loadCloudProject(cloudId: string) {
    const project = await this.cloudStorage.getProject(cloudId);
    if (!project || !project.projectData) return;

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
    const success = await this.cloudStorage.deleteProject(cloudId);
    if (success) {
      console.log('Cloud project deleted');
    }
  }













}

