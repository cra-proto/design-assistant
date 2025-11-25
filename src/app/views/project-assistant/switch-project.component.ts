import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FieldsetModule } from 'primeng/fieldset';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
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

import { IaStateService, SavedProject } from '../ia-assistant/services/ia-state.service';
import { ExportGithubComponent } from '../ia-assistant/components/export-github.component';
import { GitHubAuthService } from '../../services/github-auth.service';
import { CloudStorageService, CloudProject } from '../../services/cloud-storage.service';

export interface Project {
  key: string;
  name: string;
  description?: string;
  pages: number;
  timestamp: Date;
  storageType: 'local' | 'cloud';
  githubRepo?: string;
  githubUrl?: string;
  collaborators?: Array<{ name: string; initials: string; color: string }>;
  isEditable?: boolean;
}

@Component({
  selector: 'aida-switch-project',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule,
    CardModule, ButtonModule, DialogModule, FieldsetModule, TimelineModule, ProgressBarModule, SplitButtonModule, ChipModule,
    InputTextModule, IconFieldModule, InputIconModule, SelectModule, MultiSelectModule,
    CheckboxModule, DividerModule, SelectButtonModule, TagModule, TableModule, TabsModule, BadgeModule, AvatarModule, MessageModule,
    ExportGithubComponent],
  templateUrl: './switch-project.component.html',
  styles: ``
})
export class SwitchProjectComponent implements OnInit {
  public authService = inject(GitHubAuthService);
  private cloudStorage = inject(CloudStorageService);
  public iaState = inject(IaStateService);
  public router = inject(Router);
  public message = inject(MessageService);
  public filterService = inject(FilterService);


  constructor() {
    this.loadProjects();
  }

  //Load all projects
  allProjects = signal<SavedProject[]>([]);
  loadProjects() {
    const projects = JSON.parse(localStorage.getItem('savedProjects') || '[]');
    this.allProjects.set(projects);
  }

  //Track active project
  activeProject = computed(() => {
    const projects = this.allProjects();
    return projects.length ? projects[0] : null;
  });

  //Other saved projects
  savedProjects = computed(() => {
    const active = this.activeProject();
    return this.allProjects().filter(p => p.key !== active?.key);
  });

  //Display formats
  get projects() {
    return this.savedProjects() || [];
  }

  getDisplayName(project: SavedProject): string {
    return project.key
      .replace(/-/g, " ")
      .replace(/^\w/, char => char.toUpperCase());
  }

  formatDate(dateString: number): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', ' at');
  }

  //Actions - load saved project, start new project, save autosave as project, delete a project

  loadingKey: string | null = null;
  async loadProject(key: string) {
    // Show loading state on card
    this.loadingKey = key;
    await new Promise(resolve => setTimeout(resolve, 600));
    //Saves current active project and loads clicked project
    try {
      this.iaState.saveToLocalStorage();
      this.iaState.loadFromLocalStorage(key);
      this.iaState.updateProjectList(key);
      this.loadProjects();
    }
    finally {
      this.loadingKey = null; //end of loading state
    }
  }

  newProject() {
    this.iaState.saveToLocalStorage();
    this.iaState.setActiveStep(1);
    this.iaState.resetIaFlow();
    this.iaState.saveToLocalStorage();
    this.loadProjects(); // refresh reactive state
  }

  showSave = false;
  saveProject() {
    console.log(this.iaState.getGitHubData().repo)
    let savedAutoSave = false;
    if (this.activeProject()?.key === "autosave" && this.iaState.getGitHubData().repo != "autosave") { savedAutoSave = true }
    this.iaState.saveToLocalStorage();
    this.loadProjects(); // refresh reactive state
    if (savedAutoSave) { this.deleteProject("autosave") } //remove autosave after saving it as a project

  }

  deleteProject(key: string, event?: Event) {
    event?.stopPropagation();
    const all = this.allProjects();
    const isActive = key === this.activeProject()?.key;
    // Remove key from localStorage
    localStorage.removeItem(key);
    // Remove from savedProjects key
    const updatedProjects = all.filter(p => p.key !== key);
    localStorage.setItem('savedProjects', JSON.stringify(updatedProjects));
    this.allProjects.set(updatedProjects);
    // Start new project if active project is deleted
    if (isActive) {
      console.warn("Deleted the active project");
      this.newProject();
    }
  }



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

  //more testing
  // Combined projects (local + cloud)
  combinedProjects = computed(() => {
    const local = this.savedProjects().map(p => ({
      ...p,
      storageType: 'local' as const,
      canEdit: true
    }));

    const cloud = this.cloudStorage.projects().map(p => ({
      key: p.key,
      timestamp: p.timestamp,
      pages: p.pages,
      phase: p.phase,
      local: false,
      storageType: 'cloud' as const,
      cloudId: p.id,
      collaborators: p.collaborators,
      canEdit: this.cloudStorage.canEdit(p)
    }));

    return [...local, ...cloud].sort((a, b) => b.timestamp - a.timestamp);
  });

  async ngOnInit() {
    this.loadProjects();
    await this.cloudStorage.loadProjects();
  }

  async uploadToCloud(project: SavedProject) {
    if (!this.authService.isAuthenticated()) {
      this.showSave = true;
      return;
    }

    // Load the project state from localStorage
    const projectState = localStorage.getItem(project.key);
    if (!projectState) return;

    const state = JSON.parse(projectState);
    const cloudId = await this.cloudStorage.saveProject(state);

    if (cloudId) {
      // Optional: Remove from local storage after successful upload
      // this.deleteProject(project.key);

      // Show success message
      console.log('Project uploaded to cloud with ID:', cloudId);
    }
  }

  async loadCloudProject(cloudId: string) {
    const project = await this.cloudStorage.getProject(cloudId);
    if (!project || !project.content) return;

    // Parse the content and load it into the state
    const state = JSON.parse(project.content);
    this.iaState.setActiveStep(state.activeStep);
    this.iaState.setUrlData(state.urlData);
    this.iaState.setBreadcrumbData(state.breadcrumbData);
    this.iaState.setSearchData(state.searchData);
    this.iaState.setIaData(state.iaData);
    this.iaState.setGitHubData(state.gitHubData);

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

