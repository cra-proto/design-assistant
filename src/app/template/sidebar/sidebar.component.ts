import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService } from 'primeng/api';
import { ConfirmPopupModule } from 'primeng/confirmpopup';

import { MailtoService } from '../../services/mailto.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectStorageService } from '../../services/storage/project-storage.service';

import { environment } from '../../../environments/environment';

/**
 * Reviewed: 2026-08-13 (ng21)
 *
 * Left side navigation links. Collapses in mobile view.
 */
@Component({
  selector: 'aida-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, ConfirmPopupModule],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private router = inject(Router);
  private translate = inject(TranslateService);
  private confirmationService = inject(ConfirmationService);
  private projectState = inject(ProjectStateService);
  private projectCache = inject(ProjectCacheService);
  private projectStorageService = inject(ProjectStorageService);
  private mailtoService = inject(MailtoService);

  protected production = environment.production;
  protected sandbox = environment.sandbox;

  protected get projectLoaded(): boolean {
    const name = this.projectState.getProject().projectName;
    return !!name;
  }

  protected get hasPages(): boolean {
    const count = this.projectState.getProject().baselinePages;
    return !!count;
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
    if (!this.projectLoaded) {
      this.confirmationService.confirm({
        target: event?.target as EventTarget,
        message: this.translate.instant('project.new.confirmMessage'),
        icon: 'pi pi-exclamation-circle text-red-500',
        acceptButtonProps: {
          label: this.translate.instant('common.overwrite'),
          severity: 'danger',
        },
        accept: () => {
          this.projectStorageService.clearActiveProject();
          this.projectState.resetProject();
          this.router.navigate(['/project/new']);
        },
        rejectButtonProps: {
          label: this.translate.instant('common.cancel'),
          severity: 'secondary',
          outlined: true,
          styleClass: 'secondary-outline',
        },
        reject: () => {
          return;
        },
      });
    } else {
      this.projectStorageService.clearActiveProject();
      this.projectState.resetProject();
      this.router.navigate(['/project/new']);
    }
  };

  protected readonly mailTo = () => {
    this.mailtoService.openMailto(this.mailtoService.generateFeedbackMailto());
  };
  protected readonly checkStatus = () => {
    this.projectCache.checkLocalStatus();
    this.projectCache.checkPreviewStatus();
  };
  protected readonly checkLocalStatus = () => {
    this.projectCache.checkLocalStatus();
  };
}
