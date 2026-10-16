import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';

import { ProjectStateService } from '../../services/project-state.service';

@Component({
  selector: 'aida-save-button',
  imports: [ButtonModule, DividerModule],
  templateUrl: './save-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveButtonComponent {
  private readonly translate = inject(TranslateService);
  private readonly projectState = inject(ProjectStateService);
  protected readonly messageService = inject(MessageService);

  // Get save status from project state
  private readonly saveStatus = this.projectState.getSaveStatus;

  // Show save button when there are unsaved changes
  protected readonly showSaveButton = computed(() => {
    const status = this.saveStatus();
    return status !== 'saved';
  });

  // Configure save button appearance based on status
  protected readonly saveButtonConfig = computed(() => {
    const status = this.saveStatus();
    if (status === 'error') {
      return {
        label: this.translate.instant('save.error'),
        icon: 'pi pi-times-circle',
        severity: 'danger' as const,
      };
    }
    if (status === 'saving') {
      return {
        label: this.translate.instant('save.saving'),
        icon: 'pi pi-spin pi-spinner',
        severity: 'info' as const,
      };
    }
    if (status === 'unsaved') {
      return {
        label: this.translate.instant('save.unsaved'),
        icon: 'pi pi-exclamation-triangle',
        severity: 'danger' as const,
      };
    }
    // Default (shouldn't show due to showSaveButton)
    return {
      label: this.translate.instant('save.saved'),
      icon: 'pi pi-check',
      severity: 'success' as const,
    };
  });

  // Manual save
  protected async save() {
    const success = await this.projectState.saveProject();
    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('save.toast.success'),
        detail: this.translate.instant('save.toast.success.details'),
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('save.toast.fail'),
        detail: this.translate.instant('save.toast.fail.details'),
        sticky: true,
      });
    }
  }
}
