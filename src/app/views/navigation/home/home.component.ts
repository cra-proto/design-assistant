import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';

import { DoormatKey, DoormatsComponent } from '../../../components/doormats/doormats.component';

import { CollaboratorService } from '../../../services/github/collaborator.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { ProjectStorageService } from '../../../services/storage/project-storage.service';
import { UserSettingsService } from '../../../services/user-settings.service';

import { AidaLinks } from '../../../common/aidaLinks.config';

@Component({
  selector: 'aida-home',
  imports: [CommonModule, RouterLink, TranslatePipe, ButtonModule, DoormatsComponent],
  templateUrl: 'home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly translate = inject(TranslateService);
  private readonly projectState = inject(ProjectStateService);
  private readonly settingsService = inject(UserSettingsService);
  private readonly collaboratorService = inject(CollaboratorService);
  protected readonly projectStorageService = inject(ProjectStorageService);
  protected readonly AidaLinks = AidaLinks;

  protected readonly title = signal<string>(this.translate.instant('home._title', { org: '' }));
  protected readonly taskDoormats: DoormatKey[] = ['dashboard', 'editProject', 'addPages', 'search', 'problems', 'iaDiagram', 'inventory', 'metadata', 'exportPages', 'editPages', 'compare'];
  protected readonly helpDoormats: DoormatKey[] = ['help', 'contact'];

  protected readonly showProject = computed(() => this.projectStorageService.hasActiveProject('session') || this.projectStorageService.hasActiveProject('local'));

  protected readonly projectInfo = resource({
    params: () => this.projectStorageService.currentActive() ?? this.projectStorageService.lastActive() ?? undefined,
    loader: async ({ params: project }) => {
      const data = await this.projectStorageService.loadProjectData(project.key, project.storageType);
      if (!data) {
        this.projectStorageService.clearActiveProject();
        return undefined;
      }
      const projectName = data.projectName || 'common.autosave';
      return { title: projectName, lastModified: data.lastModified };
    },
  });

  // Load previously active project
  async loadProject() {
    const active = this.projectStorageService.getActiveProject('local');
    if (!active) return;
    console.log(`Attempting to load active project: ${active.key} from ${active.storageType}`);
    try {
      const project = await this.projectStorageService.loadProject(active.key, active.storageType);
      if (project) {
        await this.projectState.setProject(project, 'load'); // Update the project state
        console.log(`Project loaded successfully: ${active.key}`);
      } else {
        console.error(`Failed to load project: ${active.key}`); // Show error message
        this.projectStorageService.clearActiveProject();
      }
    } catch (error) {
      console.error(`Error loading active project: ${active.key}`, error);
      this.projectStorageService.clearActiveProject();
    }
  }

  constructor() {
    effect(() => {
      void this.settingsService.userId();
      void this.settingsService.org();
      this.getTitle();
    });
  }

  protected async getTitle() {
    const user = await this.collaboratorService.getLogin(this.settingsService.userId());
    const org = this.settingsService.org();
    if (Number.isNaN(Number(user)) && !user.startsWith('user_')) {
      this.title.set(this.translate.instant('home._title.user', { user: user }));
    } else this.title.set(this.translate.instant('home._title', { org: org }));
  }
}
