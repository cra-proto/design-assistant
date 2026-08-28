import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';

import { SignInButtonComponent } from '../components/sign-in/sign-in-button/sign-in-button.component';

import { ProjectStateService } from '../services/project-state.service';
import { UserSettingsService } from '../services/user-settings.service';

import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-header',
  imports: [CommonModule, TranslatePipe, ButtonModule, DividerModule, ToastModule, SignInButtonComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly translate = inject(TranslateService);
  protected readonly settingsService = inject(UserSettingsService);
  private readonly projectState = inject(ProjectStateService);
  protected readonly messageService = inject(MessageService);
  protected readonly production = environment.production;
  protected readonly sandbox = environment.sandbox;

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
      });
    }
  }

  // Dark/Light logos for different breakpoints
  protected get logoSrc() {
    return this.settingsService.darkMode() ? 'images/sig-wht-en.svg' : 'images/sig-blk-en.svg';
  }
}
