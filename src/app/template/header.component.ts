import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { marker } from '@colsen1991/ngx-translate-extract-marker';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api'

// Custom
import { GithubConnectComponent } from "../components/sign-in/github-connect.component";
import { ProjectStateService } from '../services/project-state.service';
import { ThemeService } from '../services/theme.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'aida-header',
  imports: [CommonModule, TranslateModule,
    ButtonModule, DividerModule, ToastModule,
    GithubConnectComponent,
  ],
  template: `
<header>
  <div class="flex flex-row justify-content-end py-2 border-bottom-1 surface-border">
    <img class="opacity-70 w-22rem h-2rem hidden lg:flex mr-auto"
        [src]="logoSrc"
        [alt]="'common.cra' | translate"
      />
      <img class="opacity-70 w-13rem h-2rem hidden md:flex lg:hidden mr-auto"
        [src]="medLogoSrc"
        [alt]="'common.flag' | translate"
      />
    <img class="opacity-70 w-4rem h-2rem hidden sm:flex md:hidden mr-auto"
        [src]="smallLogoSrc"
        [alt]="'common.flag' | translate"
      />
    <div class="flex flex-row align-items-center gap-2 lg:gap-3">
        @if(showSaveButton()){
        <p-button (onClick)="save()"
          [icon]="saveButtonConfig().icon" [label]="saveButtonConfig().label | translate" [severity]="saveButtonConfig().severity"
          text rounded size="small" styleClass="white-space-nowrap -mr-2" />
        <p-divider layout="vertical" styleClass="mx-0" />
        }
        <aida-github-connect />
        <p-button (onClick)="theme.toggle()" rounded outlined size="small" severity="secondary" [icon]="theme.icon()" styleClass="darkmode-toggle secondary-outline" ariaLabel="Toggle between dark and light mode" />
        <p-button (onClick)="theme.toggleLanguage();" rounded text styleClass="underline text-blue-500 hover:text-blue-400 nohover -ml-2" severity="secondary" [ariaLabel]="'_app.oppLang' | translate" >
          <span class="hidden sm:inline w-3rem">{{ '_app.oppLang' | translate }}</span>
          <span class="inline sm:hidden uppercase w-1rem">{{ ('_app.oppLang' | translate | slice:0:2) }}</span>
        </p-button>
      </div>
    </div>
    @if(!production){
    <div class="sticky top-0 z-2 border-round-bottom-lg bg-primary text-center w-full">
      {{(sandbox? '_app.env.sandbox' : '_app.env.dev') | translate}}
    </div>
    }
    <p-toast />
  </header>
`,
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  private translate = inject(TranslateService);
  public theme = inject(ThemeService);
  public projectState = inject(ProjectStateService);
  public messageService = inject(MessageService);
  public production = environment.production;
  public sandbox = environment.sandbox;

  // Get save status from project state
  saveStatus = this.projectState.getSaveStatus;

  // Show save button when there are unsaved changes
  showSaveButton = computed(() => {
    const status = this.saveStatus();
    return status !== 'saved';
  });

  markForTranslation() {
    marker("save.error");
    marker("save.unsaved");
    marker("save.saving");
    marker("save.saved");
  }
  // Configure save button appearance based on status
  saveButtonConfig = computed(() => {
    const status = this.saveStatus();
    if (status === 'error') {
      return {
        label: 'save.error',
        icon: 'pi pi-times-circle',
        severity: 'danger' as const
      };
    }
    if (status === 'saving') {
      return {
        label: 'save.saving',
        icon: 'pi pi-spin pi-spinner',
        severity: 'info' as const
      };
    }
    if (status === 'unsaved') {
      return {
        label: 'save.unsaved',
        icon: 'pi pi-exclamation-triangle',
        severity: 'danger' as const
      };
    }
    // Default (shouldn't show due to showSaveButton)
    return {
      label: 'save.saved',
      icon: 'pi pi-check',
      severity: 'success' as const
    };
  });

  // Manual save
  async save() {
    const success = await this.projectState.saveProject();
    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('save.toast.success'),
        detail: this.translate.instant('save.toast.success.details')
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('save.toast.fail'),
        detail: this.translate.instant('save.toast.fail.details')
      });
    }
  }

  // Dark/Light logos for different breakpoints
  get logoSrc() {
    return this.theme.darkMode() ? 'cra-logo-dark.png' : 'cra-logo.png';
  }

  get medLogoSrc() {
    return this.theme.darkMode() ? 'cra-logo-short-dark.png' : 'cra-logo-short.png';
  }

  get smallLogoSrc() {
    return this.theme.darkMode() ? 'flag-logo-dark.png' : 'flag-logo.png';
  }

}