import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { IconFieldModule } from 'primeng/iconfield';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';

import { AddCollaboratorsComponent } from '../../../components/add-collaborators/add-collaborators.component';
import { SetupProjectComponent } from '../../../components/setup-project/setup-project.component';
import { SignInBannerComponent } from '../../../components/sign-in/sign-in-banner/sign-in-banner.component';
import { SignInButtonComponent } from '../../../components/sign-in/sign-in-button/sign-in-button.component';

import { CollaboratorService } from '../../../services/github/collaborator.service';
import { ExportGitHubService } from '../../../services/github/export-github.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { ProjectStorageService } from '../../../services/storage/project-storage.service';
import { UserSettingsService } from '../../../services/user-settings.service';

import { environment } from '../../../../environments/environment';
import { ProjectMetadata, ProjectPhase } from '../../../common/data.model';
import { TooltipDirective } from '../../../common/tooltip.directive';

//TODO: FIX HARDCODED TRANSLATIONS

@Component({
  selector: 'aida-switch-project',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    DividerModule,
    IconFieldModule,
    IftaLabelModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    SelectButtonModule,
    SelectModule,
    TagModule,
    AddCollaboratorsComponent,
    SetupProjectComponent,
    SignInBannerComponent,
    SignInButtonComponent,
    TooltipDirective,
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
  private readonly settingsService = inject(UserSettingsService);
  private readonly confirmationService = inject(ConfirmationService);

  private readonly router = inject(Router);
  private readonly message = inject(MessageService);

  // Project list signal
  private readonly allProjects = signal<ProjectMetadata[]>([]);

  // Project filter & search
  protected readonly selectedFilter = signal<string[]>([]);
  protected readonly searchTerm = signal<string>('');

  protected readonly projectId = this.projectState.getProject().id;
  protected loadingKey: string | null = null;
  protected showSave = false;
  private presetFilterApplied = false;

  protected readonly projectName = this.projectState.getProject().projectName;
  /** For disabling save to local button */
  protected get hasName() {
    return !!this.projectState.getProject().projectName;
  }

  constructor() {
    console.log('SwitchProjectComponent constructor entered');
    // Watch for project list changes and reload
    effect(() => {
      this.projectStorageService.projectListChanged(); // Watch for changes
      console.log('Project list changed, reloading...');
      this.loadProjects(this.currentMode()); // Load projects
    });
    effect(() => {
      const projects = this.allProjects();
      if (this.presetFilterApplied || projects.length === 0) return;

      this.updateGroupedFilters();

      if (this.applyMyProjectsFilter()) {
        this.presetFilterApplied = true;
      }
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

  /** Detects which card is the active project */
  protected isActiveProject(project: ProjectMetadata): boolean {
    const active = this.projectStorageService.currentActive();
    if (!active) return false;
    return project.storageType === 'local' ? active.key === project.key : active.key === project.id;
  }

  protected getCardClasses(project: ProjectMetadata): string {
    const isDark = this.settingsService.darkMode();
    const border =
      this.projectId === project.id ? 'border-3 border-primary hover:shadow-4' : this.currentMode() === 'deleted' ? 'border-2 border-red-500 hover:shadow-4' : 'border-1 surface-border hover:shadow-3';

    const background = this.isActiveProject(project) && !isDark ? 'bg-primary-50' : this.isActiveProject(project) ? 'bg-primary-800' : '';

    return `${border} ${background}`.trim();
  }

  protected getCollabStatus(project: ProjectMetadata): 'sign-in' | 'read-only' | undefined {
    const { isSignedIn, isCollaborator, hasCollaborators } = this.collaboratorService.getUploadAccessInfo(project);
    const signInToUploadToCloud = isCollaborator && !isSignedIn && hasCollaborators ? this.translate.instant('project.global.signInToUpload') : undefined;
    const cantUploadToCloud = !isCollaborator && hasCollaborators ? this.translate.instant('project.global.cantUpload') : undefined;
    if (signInToUploadToCloud) return 'sign-in';
    else if (cantUploadToCloud) return 'read-only';
    else return undefined;
  }

  //Filter options
  protected groupedFilters: MenuItem[] = [];

  protected updateGroupedFilters() {
    const allCollaborators = this.allProjects().flatMap((p) => p.collaborators);
    const uniqueCollaborators = Array.from(new Map(allCollaborators.map((c) => [c.login, c])).values()).sort((a, b) => a.login.localeCompare(b.login));

    this.groupedFilters = [
      {
        label: this.translate.instant('common.storageType'),
        value: 'storage',
        items: [
          { label: this.translate.instant('project.setup.storage.cloud'), value: 'Cloud' },
          { label: this.translate.instant('project.setup.storage.local'), value: 'Local' },
        ],
      },
      {
        label: this.translate.instant('project.setup.label.phase'),
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
        label: this.translate.instant('common.collaborators'),
        value: 'collab',
        items: uniqueCollaborators.map((c) => ({
          label: c.name || c.login, // Use display name if available, fallback to login
          value: c.login,
        })),
      },
    ];

    const myOrg = localStorage.getItem('myOrg') || environment.myOrg; // Only add Organization filter if myOrg is set
    if (myOrg) {
      this.groupedFilters.push({
        label: this.translate.instant('common.organization'),
        value: 'org',
        items: [
          { label: this.translate.instant('common.default'), value: 'DEFAULT' },
          { label: myOrg, value: myOrg },
        ],
      });
    }
  }

  /** Preset options for project filter buttons */
  protected readonly filterPresets = computed(() => [
    { label: this.translate.instant('switch.viewAll'), value: 'all' },
    { label: this.translate.instant('switch.viewMine'), value: 'mine' },
  ]);

  /** Change handler for project filter buttons  */
  protected onPresetChange(preset: 'all' | 'mine'): void {
    if (preset === 'all') {
      this.selectedFilter.set([]);
    } else {
      this.applyMyProjectsFilter();
    }
  }

  /** Compares 2 filter arrays to determine if they are equal regardless of order */
  private sameFilterSet(a: string[], b: string[]): boolean {
    return a.length === b.length && b.every((v) => a.includes(v));
  }

  /** Current selected option for project filter buttons */
  protected readonly selectedPreset = computed<'all' | 'mine' | null>(() => {
    const current = this.selectedFilter();
    if (current.length === 0) return 'all';

    const mineValue = this.myProjectsFilterValue();
    if (mineValue && this.sameFilterSet(current, mineValue)) return 'mine';

    return null; // unselect button if anything other than a preset is chosen
  });

  /** Value of the my projects filter */
  private readonly myProjectsFilterValue = computed<string[] | null>(() => {
    const userId = Number(this.settingsService.userId());
    if (Number.isNaN(userId)) return null;
    const match = this.allProjects()
      .flatMap((p) => p.collaborators)
      .find((c) => c.id === userId);
    return match ? [match.login, 'Local'] : null;
  });

  /** Filter projects to userId and local */
  private applyMyProjectsFilter(): boolean {
    const value = this.myProjectsFilterValue();
    if (!value) return false;
    this.selectedFilter.set(value);
    return true;
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
          const projectOrg = p.org || localStorage.getItem('myOrg') || environment.myOrg || 'DEFAULT';
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

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const project = await this.projectStorageService.loadProject(this.loadingKey, storageType);

      if (project) {
        this.projectState.setProject(project); // Update the project state
        //Refresh live data if project is missing properties (for patching legacy data)
        const [major, minor] = String(project.version ?? '0.0.0')
          .split('.')
          .map(Number);
        const onlyMissing = major > 0 || (major === 0 && minor >= 6);
        await this.projectState.refreshAll(project.projectData, 'live', true);
        await this.projectState.refreshAll(project.projectData, 'baseGH', true, true, onlyMissing);
        await this.projectState.refreshAll(project.projectData, 'protoGH', true, true, true);
      } else {
        console.error('Failed to load project'); // Show error message
      }
    } finally {
      this.loadingKey = null;
      this.router.navigate(['/']);
    }
  }

  protected async newProject() {
    this.router.navigate(['/project/new']);
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

  protected confirmDelete(project: ProjectMetadata, event?: Event) {
    event?.stopPropagation();

    if (project.storageType === 'cloud') {
      this.confirmationService.confirm({
        key: 'delete',
        icon: 'pi pi-exclamation-triangle text-red-500',
        header: this.translate.instant('switch.confirmDelete.header'),
        message: this.translate.instant('switch.confirmDelete.message'),
        acceptButtonProps: {
          label: this.translate.instant('switch.confirmDelete.accept'),
          severity: 'danger',
        },
        rejectButtonProps: {
          label: this.translate.instant('common.cancel'),
          severity: 'secondary',
          outlined: true,
        },
        accept: () => {
          this.deleteProject(project);
          console.warn('User approved delete action');
        },
      });
    } else {
      this.deleteProject(project);
    }
  }

  private async deleteProject(project: ProjectMetadata) {
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
  protected get sortOptions() {
    return [
      { label: this.translate.instant('common.sort.dateDesc'), value: 'date_desc' },
      { label: this.translate.instant('common.sort.dateAsc'), value: 'date_asc' },
      { label: this.translate.instant('common.sort.nameAZ'), value: 'name_asc' },
      { label: this.translate.instant('common.sort.nameZA'), value: 'name_desc' },
    ];
  }

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

  //Upload to cloud dialog
  protected readonly showUpload = signal<{ project: ProjectMetadata; isSignedIn: boolean; isCollaborator: boolean; hasCollaborators: boolean; cloudIsNewer: boolean } | null>(null);
  protected handleUploadClick(project: ProjectMetadata, event?: Event): void {
    event?.stopPropagation();
    const { isSignedIn, isCollaborator, hasCollaborators } = this.collaboratorService.getUploadAccessInfo(project);
    const cloudIsNewer = this.isCloudNewer(project);

    if (isSignedIn && isCollaborator && !cloudIsNewer) {
      this.uploadToCloud(project, event);
      return;
    }

    this.showUpload.set({ project, isSignedIn, isCollaborator, hasCollaborators, cloudIsNewer });
  }
  protected closeShowUpload(): void {
    this.showUpload.set(null);
  }

  /** Find the cloud equivalent of a local project (if any) */
  protected getCloudCounterpart(localProject: ProjectMetadata): ProjectMetadata | undefined {
    if (localProject.storageType !== 'local') return undefined;
    return this.allProjects().find((p) => p.storageType === 'cloud' && p.key === localProject.key);
  }

  /** True if a cloud version exists and was modified more recently than the local one */
  protected isCloudNewer(localProject: ProjectMetadata): boolean {
    const cloudProject = this.getCloudCounterpart(localProject);
    if (!cloudProject) return false;
    return new Date(cloudProject.lastModified).getTime() > new Date(localProject.lastModified).getTime();
  }
}
