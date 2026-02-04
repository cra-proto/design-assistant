import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

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
  imports: [CommonModule, FormsModule, TranslateModule,
    ButtonModule, DividerModule, ToastModule,
    GithubConnectComponent,
  ],
  template: `
<header>
  <div class="flex flex-row justify-content-between py-2 border-bottom-1 surface-border">
    <img class="opacity-70 w-30rem h-3rem hidden xl:flex"
        [src]="logoSrc"
        [alt]="'common.cra' | translate"
      />
    <img class="opacity-70 w-5rem h-3rem hidden md:flex xl:hidden"
        [src]="smallLogoSrc"
        [alt]="'common.flag' | translate"
      />
    <div class="flex flex-row align-items-center gap-3">
        @if(showSaveButton()){
        <p-button (onClick)="save()"
          [icon]="saveButtonConfig().icon" [label]="saveButtonConfig().label" [severity]="saveButtonConfig().severity"
          text rounded size="small" styleClass="white-space-nowrap" />
        <p-toast />
        <p-divider layout="vertical" styleClass="mx-2" />
        }
        <aida-github-connect />
        <p-button (onClick)="theme.toggle()" rounded outlined size="small" severity="secondary" [icon]="theme.icon()" styleClass="darkmode-toggle surface-border" ariaLabel="Toggle between dark and light mode" />
        <p-button (onClick)="selectLanguage()" rounded text styleClass="underline text-blue-600 hover:text-blue-700 nohover w-5rem" severity="secondary" [label]="'_app.oppLang' | translate" [ariaLabel]="'_app.oppLang' | translate" />
      </div>
    </div>
    <div *ngIf="!production" class="sticky top-0 z-2 border-round-bottom-lg bg-primary text-center w-full">
      {{(sandbox? '_app.env.sandbox' : '_app.env.dev') | translate}}
    </div>
  </header>
`,
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  private translate = inject(TranslateService);
  public theme = inject(ThemeService);
  private router = inject(Router);
  private title = inject(Title);
  public projectState = inject(ProjectStateService);
  public messageService = inject(MessageService);
  public production = environment.production;
  public sandbox = environment.sandbox;

  // Get save status from project state
  saveStatus = this.projectState.getSaveStatus;
  hasUnsavedChanges = computed(() => this.projectState.hasUnsavedChanges());

  // Show save button when there are unsaved changes
  showSaveButton = computed(() => {
    const status = this.saveStatus();
    return status !== 'saved';
  });

  // Configure button appearance based on status and time
  saveButtonConfig = computed(() => {
    const status = this.saveStatus();

    if (status === 'error') {
      return {
        label: 'Save failed - Retry',
        icon: 'pi pi-exclamation-circle',
        severity: 'danger' as const
      };
    }

    if (status === 'saving') {
      return {
        label: 'Saving...',
        icon: 'pi pi-spin pi-spinner',
        severity: 'info' as const
      };
    }

    if (status === 'unsaved') {
      return {
        label: 'Unsaved changes',
        icon: 'pi pi-exclamation-triangle',
        severity: 'danger' as const
      };
    }

    // Default (shouldn't show due to showSaveButton computed)
    return {
      label: 'Saved',
      icon: 'pi pi-check',
      severity: 'success' as const
    };
  });

  get logoSrc() {
    return this.theme.darkMode() ? 'cra-logo-dark.png' : 'cra-logo.png';
  }

  get smallLogoSrc() {
    return this.theme.darkMode() ? 'flag-logo-dark.png' : 'flag-logo.png';
  }

  selectLanguage(): void {
    this.theme.toggleLanguage();

    //Update title on language change
    const titleKey = this.router.routerState.snapshot.root.firstChild?.title;
    if (titleKey) {
      this.translate.get(titleKey).subscribe((translated: string) => {
        this.title.setTitle(translated);
      });
    }
  }

  async save() {
    const success = await this.projectState.saveProject();
    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Save Successful',
        detail: 'Check console for details'
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: 'Check console for errors'
      });
    }
  }

}