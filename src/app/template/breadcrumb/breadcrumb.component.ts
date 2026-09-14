import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, isActive, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { filter, map, startWith } from 'rxjs/operators';

import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TagModule } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import { CollaboratorService } from '../../services/github/collaborator.service';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { ProjectStateService } from '../../services/project-state.service';
import { UserSettingsService } from '../../services/user-settings.service';

import { environment } from '../../../environments/environment';

const PROJECT: MenuItem = { label: 'nav.project', route: '/project' };
const PROJECT_DASHBOARD: MenuItem = { label: 'dashboard._title', route: '/project/dashboard' };
const TASKS: MenuItem = { label: 'nav.tasks', route: '/tasks' };
const STANDALONE: MenuItem = { label: 'standalone._title', route: '/standalone' };
const DEV: MenuItem = { label: 'dev._title', route: '/dev' };

const BREADCRUMB_ANCESTORS: Record<string, MenuItem[]> = {
  project: [PROJECT],
  'project.dashboard': [PROJECT, PROJECT_DASHBOARD],
  tasks: [TASKS],
  standalone: [STANDALONE],
  dev: [DEV],
};

@Component({
  selector: 'aida-breadcrumb',
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslatePipe, BreadcrumbModule, TagModule, Tooltip],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private projectState = inject(ProjectStateService);
  private exportGitHubService = inject(ExportGitHubService);
  private collaboratorService = inject(CollaboratorService);
  private settingsService = inject(UserSettingsService);

  protected readonly production = environment.production;
  protected readonly sandbox = environment.sandbox;

  protected readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.buildBreadcrumbs()),
    ),
    { initialValue: this.buildBreadcrumbs() },
  );

  private buildBreadcrumbs(): MenuItem[] {
    const snapshot = this.getDeepestSnapshot(this.router.routerState.snapshot.root);
    const key = snapshot.data['breadcrumbKey'] as string | undefined;
    if (!key) return []; // Don't display breadcrumb if there is no key
    const ancestors = BREADCRUMB_ANCESTORS[key] ?? [];
    if (ancestors.length === 0) return []; // Don't display breadcrumb if there are no links
    return snapshot.title ? [...ancestors, { label: snapshot.title }] : ancestors;
  }

  getDeepestSnapshot(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  // Check route information to determine if global project banner should show
  private readonly matchOptions = { paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' } as const;
  private readonly isProjectActive = isActive('/project', this.router, this.matchOptions);
  private readonly isTasksActive = isActive('/tasks', this.router, this.matchOptions);
  protected readonly isProjectRoute = computed(() => this.isProjectActive() || this.isTasksActive());

  get projectDisplay() {
    const project = this.projectState.getProject();

    const projectName = project.projectName;
    const icon = project.storageType === 'cloud' ? 'pi pi-cloud' : 'pi pi-desktop';
    const hasCollaborators = project.collaborators.length > 0;

    const user = Number.isNaN(Number(this.settingsService.userId())) ? undefined : Number(this.settingsService.userId());
    const isCollaborator = this.collaboratorService.canEditProject(project, user);
    const isSignedIn = !!this.exportGitHubService.user();

    const signInToUploadToCloud = isCollaborator && !isSignedIn && hasCollaborators ? this.translate.instant('project.global.signInToUpload') : undefined;
    const cantUploadToCloud = !isCollaborator && hasCollaborators ? this.translate.instant('project.global.cantUpload') : undefined;

    const projectLabel = projectName && cantUploadToCloud ? this.translate.instant('project.global.copyOf') + ' ' + projectName : (projectName ?? '');

    const tagLabel = signInToUploadToCloud ?? cantUploadToCloud;
    const tagSeverity = signInToUploadToCloud ? ('warn' as const) : ('danger' as const);
    const tagIcon = signInToUploadToCloud ? 'pi pi-copy' : 'pi pi-times-circle';
    const tagTooltip = signInToUploadToCloud
      ? this.translate.instant('project.global.signInToUploadWarning')
      : cantUploadToCloud
        ? this.translate.instant('project.global.cantUploadWarning')
        : undefined;
    const iconTooltip = project.storageType === 'cloud' ? this.translate.instant('project.setup.storage.cloudInfo') : this.translate.instant('project.setup.storage.localWarning');

    return { projectLabel, icon, iconTooltip, tagLabel, tagTooltip, tagSeverity, tagIcon };
  }
}
