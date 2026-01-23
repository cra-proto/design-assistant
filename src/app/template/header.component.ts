import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { ApiResetComponent } from '../components/ai-api/api-reset.component';
import { LocalStorageService } from '../services/storage/local-storage.service';
import { ThemeService } from '../services/theme.service';
import { GithubConnectComponent } from "../components/sign-in/github-connect.component";

import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { ToastModule } from 'primeng/toast';

import { environment } from '../../environments/environment';
import { ProjectStateService } from '../services/project-state.service';
import { MessageService } from 'primeng/api'

@Component({
  selector: 'aida-header',
  imports: [CommonModule, FormsModule, TranslateModule, ToolbarModule, ButtonModule, ToggleButtonModule, ApiResetComponent, GithubConnectComponent,
    DividerModule, TagModule, MenuModule, BadgeModule, ToastModule
  ],
  template: `
   <header id="header" class="pb-2">
  <p-toolbar class="transparent">
    <div class="flex align-items-center hidden md:block">
      <img
        id="cra-logo"
        class="img-fluid fip-colour w-28rem"
        [src]="logoSrc"
        [alt]="'CRA' | translate"
        priority="true"
      />
    </div>
    <div class="flex align-items-center gap-3">
      <!-- Save status button - shown conditionally based on status and time -->
      <p-button
        *ngIf="showSaveButton()"
        (onClick)="save()"
        [icon]="saveButtonConfig().icon"
        [label]="saveButtonConfig().label"
        [severity]="saveButtonConfig().severity"
        text rounded
        size="small"
        styleClass="white-space-nowrap">
      </p-button>
      <p-toast></p-toast>

      <!--p-button (onClick)="goToProject()" rounded outlined severity="primary" styleClass="border-dashed surface-border" [label]="project | translate"></p-button-->
      <p-divider *ngIf="showSaveButton()" layout="vertical" styleClass="mx-2"></p-divider>

      <aida-github-connect></aida-github-connect>

      <aida-api-reset
        *ngIf="this.localStore.getData('apiKey') !== null && !production">
      </aida-api-reset>

      <p-button (onClick)="theme.toggle()" rounded outlined size="small" severity="secondary" [icon]="theme.icon()" styleClass="darkmode-toggle surface-border"  ariaLabel="Toggle between dark and light mode"></p-button>

      <p-button (onClick)="selectLanguage()" rounded text styleClass="underline text-blue-600 hover:text-blue-700 nohover w-5rem" severity="secondary" [label]="'opp.lang' | translate" [ariaLabel]="'opp.lang' | translate"></p-button>

    </div>
  </p-toolbar>
</header>
<div *ngIf="!production" class="sticky top-0 z-2 border-round-bottom-lg bg-primary text-center w-full">
  {{'app.dev' | translate}}
</div>
`,
  styles: `
  header {
      border-bottom-style: solid;
      border-bottom-color: var(--p-gray-400);
      border-width: 1px;
      margin-top: -4rem;
    }
    
  ::ng-deep .darkmode-toggle:hover .p-button-icon {
    color: var(--p-cyan-400) !important;
  }

  ::ng-deep html.dark-mode .darkmode-toggle:hover .p-button-icon {
    color: var(--p-amber-400) !important;
  }
    `
})
export class HeaderComponent {
  private translate = inject(TranslateService);
  public localStore = inject(LocalStorageService);
  public theme = inject(ThemeService);
  private router = inject(Router);
  private title = inject(Title);
  public production = environment.production;
  public projectState = inject(ProjectStateService);
  public messageService = inject(MessageService);

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

  get project(): string {
    const repo = this.projectState.getProject().github.repo;
    const display = repo
      ? repo.replace(/-/g, " ").replace(/^\w/, char => char.toUpperCase())
      : this.translate.instant("project.save");
    return `${this.translate.instant("project.display")} ${display}`;
  }

  get logoSrc() {
    return this.theme.darkMode() ? 'cra-logo-dark.png' : 'cra-logo.png';
  }

  // constructor(public langToggle: LangToggleService){} //putting the code below into a service works but we aren't calling it anywhere else
  constructor() {
    const curLang = this.localStore.getData('lang') || this.translate.getBrowserLang() || 'en';
    console.log(this.translate.getBrowserLang());
    this.translate.addLangs(['en', 'fr']);
    this.translate.setDefaultLang('en');
    this.translate.use(curLang);
  }

  selectLanguage(): void {
    let oppLang = ""
    if (this.translate.currentLang == "en") { oppLang = "fr" }
    else { oppLang = "en" }
    this.translate.use(oppLang);
    this.localStore.saveData('lang', oppLang);

    //Update title on language change
    const titleKey = this.router.routerState.snapshot.root.firstChild?.title;
    if (titleKey) {
      this.translate.get(titleKey).subscribe((translated: string) => {
        this.title.setTitle(translated);
      });
    }
  }

  goToProject() {
    //this.iaState.saveToLocalStorage();
    this.router.navigate(['']);
  }

  async save() {
    await this.projectState.saveProject();
  }

  async testSave() {
    console.log('=== TEST SAVE TRIGGERED ===');
    const currentProject = this.projectState.getProject();
    console.log('Current project before save:', currentProject.projectName);

    const success = await this.projectState.saveProject();

    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Test Save Successful',
        detail: 'Check console for details'
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Test Save Failed',
        detail: 'Check console for errors'
      });
    }
  }

}