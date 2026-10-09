import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, isActive, NavigationEnd, Router, RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { filter, map, startWith } from 'rxjs/operators';

import { ConfirmationService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MenuModule } from 'primeng/menu';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { CollaboratorService } from '../../services/github/collaborator.service';
import { ProjectStateService } from '../../services/project-state.service';

import { environment } from '../../../environments/environment';
import { AidaLinks } from '../../common/aidaLinks.config';

const HOME: MenuItem = { label: 'home._nav', route: AidaLinks.Home, icon: 'pi pi-home' };
const DASHBOARD: MenuItem = { label: 'dashboard._title', route: AidaLinks.ProjectDashboard };
const STANDALONE: MenuItem = { label: 'standalone._title', route: AidaLinks.Standalone };
const DEV: MenuItem = { label: 'dev._title', route: AidaLinks.Dev };

const BREADCRUMB_ANCESTORS: Record<string, MenuItem[]> = {
  home: [HOME],
  dashboard: [HOME, DASHBOARD],
  standalone: [HOME, STANDALONE],
  dev: [HOME, DEV],
};

@Component({
  selector: 'aida-breadcrumb',
  imports: [CommonModule, RouterLink, TranslatePipe, BreadcrumbModule, ConfirmDialogModule, MenuModule, TagModule, TooltipModule],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly projectState = inject(ProjectStateService);
  private readonly collaboratorService = inject(CollaboratorService);

  protected readonly production = environment.production;
  protected readonly sandbox = environment.sandbox;
  protected readonly isEditActive = isActive(AidaLinks.ProjectEdit, this.router);

  protected readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.buildBreadcrumbs()),
    ),
    { initialValue: this.buildBreadcrumbs() },
  );

  get removeMargin() {
    return this.projectDisplay.projectLabel && this.isProjectRoute() && this.production;
  }

  home = HOME;
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
  private readonly isProjectActive = isActive(AidaLinks.ProjectDashboard, this.router, this.matchOptions);
  protected readonly isProjectRoute = computed(() => this.isProjectActive());

  get projectDisplay() {
    const project = this.projectState.getProject();

    const projectName = project.projectName;
    const icon = project.storageType === 'cloud' ? 'pi pi-cloud' : 'pi pi-desktop';

    const { isSignedIn, isCollaborator, hasCollaborators, isLocked } = this.collaboratorService.getUploadAccessInfo(project);

    const signInToUploadToCloud = isCollaborator && !isSignedIn && hasCollaborators ? this.translate.instant('project.global.signInToUpload') : undefined;
    const cantUploadToCloud = !isCollaborator && hasCollaborators ? this.translate.instant('project.global.cantUpload') : undefined;

    const projectLabel = projectName ?? '';

    const tagLabel = signInToUploadToCloud ?? cantUploadToCloud;
    const tagSeverity = signInToUploadToCloud ? ('warn' as const) : ('danger' as const);
    const tagIcon = signInToUploadToCloud ? 'pi pi-copy' : 'pi pi-times-circle';
    const tagTooltip = signInToUploadToCloud
      ? this.translate.instant('project.global.signInToUploadWarning')
      : cantUploadToCloud
        ? this.translate.instant('project.global.cantUploadWarning')
        : undefined;
    const iconTooltip = project.storageType === 'cloud' ? this.translate.instant('project.setup.storage.cloudInfo') : this.translate.instant('project.setup.storage.localWarning');

    const lockedLabel = isLocked === 'byMe' ? this.translate.instant('project.global.lockedByMe') : isLocked ? this.translate.instant('project.global.lockedBy') + isLocked : undefined;
    const lockedSeverity = isLocked === 'byMe' ? ('secondary' as const) : isLocked ? ('danger' as const) : undefined;

    return { projectLabel, icon, iconTooltip, tagLabel, tagTooltip, tagSeverity, tagIcon, lockedLabel, lockedSeverity };
  }

  protected get items(): MenuItem[] {
    const { isSignedIn, isCollaborator, isLocked } = this.collaboratorService.getUploadAccessInfo(this.projectState.getProject());
    const dropdownOptions = [
      {
        label: this.translate.instant('project.global.myProject'),
        items: [
          {
            label: this.translate.instant('project._nav.edit'),
            icon: 'pi pi-pencil',
            command: () => {
              this.router.navigate([AidaLinks.ProjectEdit]);
            },
          },
        ],
      },
    ];
    if (isSignedIn && isCollaborator) {
      if (!isLocked && this.projectState.getProject().storageType === 'cloud') {
        dropdownOptions[0].items.push({
          label: this.translate.instant('project.global.lockProject'),
          icon: 'pi pi-lock',
          command: () => {
            this.projectState.setLockedBy();
          },
        });
      } else if (isLocked) {
        dropdownOptions[0].items.push({
          label: this.translate.instant('project.global.unlockProject'),
          icon: 'pi pi-unlock',
          command: () => {
            this.unlockProject(isLocked);
          },
        });
      }
    }

    return dropdownOptions;
  }

  private unlockProject(user: string) {
    if (user === 'byMe') {
      this.projectState.removeLockedBy();
    } else {
      this.confirmationService.confirm({
        key: 'unlock',
        message: this.translate.instant('project.global.unlockMessage', { user: user }),
        header: this.translate.instant('project.global.unlockHeader'),
        icon: 'pi pi-exclamation-circle text-red-500',
        rejectButtonProps: {
          label: this.translate.instant('common.cancel'),
          severity: 'secondary',
          outlined: true,
          styleClass: 'secondary-outline',
        },
        acceptButtonProps: {
          label: this.translate.instant('common.unlock'),
          severity: 'danger',
        },
        accept: () => {
          this.projectState.removeLockedBy();
        },
      });
    }
  }
}
