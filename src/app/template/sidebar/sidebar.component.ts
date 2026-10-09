import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { filter, map } from 'rxjs/operators';

import { ConfirmationService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';

import { MailtoService } from '../../services/mailto.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';

import { environment } from '../../../environments/environment';
import { AidaLinks } from '../../common/aidaLinks.config';
import { TooltipDirective } from '../../common/tooltip.directive';

/**
 * Reviewed: 2026-08-13 (ng21)
 *
 * Left side navigation links. Collapses in mobile view.
 */
@Component({
  selector: 'aida-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, ConfirmPopupModule, TooltipDirective],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);
  protected readonly projectState = inject(ProjectStateService);
  private readonly projectCache = inject(ProjectCacheService);
  private readonly mailtoService = inject(MailtoService);

  protected production = environment.production;
  protected sandbox = environment.sandbox;
  protected AidaLinks = AidaLinks;

  protected readonly isSmall = signal(false);

  constructor() {
    const mq = window.matchMedia('(max-width: 767.98px)');
    this.isSmall.set(mq.matches);
    const listener = (e: MediaQueryListEvent) => this.isSmall.set(e.matches);
    mq.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', listener));
  }

  protected get hasName(): boolean {
    return !!this.projectState.getProject().projectName;
  }

  protected get hasPages(): boolean {
    return !!this.projectState.getProject().baselinePages;
  }

  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.split(/[?#;]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#;]/)[0] },
  );

  protected isActive(path?: string): boolean {
    return !!path && this.currentPath() === path;
  }

  // Section toggle state
  protected isExpanded = {
    project: true,
    tasks: false,
  };

  protected toggleSection(section: keyof typeof this.isExpanded) {
    this.isExpanded[section] = !this.isExpanded[section];
  }

  protected toggleOnEnter(event: KeyboardEvent, section: keyof typeof this.isExpanded) {
    if (event.key === 'Enter' || event.key === ' ') {
      this.toggleSection(section);
    }
  }

  protected readonly newProject = (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    if (this.hasPages && !this.hasName) {
      this.confirmationService.confirm({
        target: event?.target as EventTarget,
        message: this.translate.instant('project.new.confirmMessage'),
        icon: 'pi pi-exclamation-circle text-red-500',
        acceptButtonProps: {
          acceptLabel: this.translate.instant('common.overwrite'),
          severity: 'danger',
        },
        accept: () => {
          this.router.navigate([AidaLinks.NewProject]);
        },
        rejectButtonProps: {
          rejectLabel: this.translate.instant('common.cancel'),
          severity: 'secondary',
          outlined: true,
          styleClass: 'secondary-outline',
        },
        reject: () => {
          this.router.navigate([AidaLinks.ProjectSettings]);
        },
      });
    } else {
      this.router.navigate([AidaLinks.NewProject]);
    }
  };

  protected readonly mailTo = () => {
    this.mailtoService.openMailto(this.mailtoService.generateFeedbackMailto());
  };
  protected readonly compareVersions = () => {
    this.projectCache.checkLocalStatus();
    this.projectCache.checkPreviewStatus();
    this.router.navigate([AidaLinks.ProjectCompare]);
  };
  protected readonly editPages = () => {
    this.projectCache.checkLocalStatus();
    this.projectCache.checkPreviewStatus();
    this.router.navigate([AidaLinks.ProjectEdit]);
  };
  protected readonly exportPages = () => {
    this.projectCache.checkLocalStatus();
    this.router.navigate([AidaLinks.ProjectExport]);
  };
}
