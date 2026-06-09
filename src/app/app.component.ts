import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslateModule } from "@ngx-translate/core";
import { HeaderComponent } from './template/header.component';
import { SidebarComponent } from './template/sidebar.component';
import { FooterComponent } from './template/footer.component';
import { CustomTitleStrategy } from './common/custom-title-strategy';
import { PrimeNG } from 'primeng/config';
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';
import { ExportGitHubService } from './services/github/export-github.service';
import { CollaboratorService } from './services/collaborator.service';
import { CloudStorageService } from './services/storage/cloud-storage.service';
import { UserSettingsService } from './services/user-settings.service';

@Component({
  selector: 'aida-root',
  imports: [CommonModule, RouterOutlet, RouterModule, TranslateModule, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  CustomTitle = inject(CustomTitleStrategy);
  titleService = inject(Title);
  private primeng = inject(PrimeNG);
  router = inject(Router);
  route = inject(ActivatedRoute);
  private projectStorageService = inject(ProjectStorageService);
  private cloudStorageService = inject(CloudStorageService)
  private projectState = inject(ProjectStateService);
  private exportGitHubService = inject(ExportGitHubService);
  private collaboratorService = inject(CollaboratorService);
  private settingsService = inject(UserSettingsService);

  constructor() {
    // Auto-add current user as collaborator when they sign in
    effect(() => {
      const user = this.exportGitHubService.user();
      if (user) {
        localStorage.setItem('userId', user.login);
        this.collaboratorService.addCurrentUserToLocalProjects(user).then(() => {
          this.loadProject();
        });
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.primeng.ripple.set(true);

    // Update settings from url parameter (if present) then remove the param
    this.route.queryParams.subscribe(params => {
      const allParams = { ...params }

      // Handle org parameter
      if (params['org'] !== undefined) {
        this.handleStorageParam('myOrg', params['org']);
        delete allParams['org']
        this.cloudStorageService.loadProjects();
      }

      // Handle toolbox parameter
      if (params['toolbox'] !== undefined) {
        this.handleStorageParam('myToolbox', params['toolbox']);
        delete allParams['toolbox']
        this.settingsService.toolbox.set(localStorage.getItem('myToolbox'));
      }

      // Remove processed parameters
      if (Object.keys(params).length !== Object.keys(allParams).length) {
        this.router.navigate([], {
          queryParams: allParams,
          replaceUrl: true,
        });
      }
    });

    await this.loadProject(); // Loads previously active project
  }

  // Saves/Removes param from local storage
  private handleStorageParam(key: string, value: string): void {
    if (value === '' || value.trim() === '') {
      localStorage.removeItem(key);
    } else {
      const cleanValue = value.replace(/^["']|["']$/g, '').toUpperCase();
      localStorage.setItem(key, cleanValue);
    }
  }

  // Load previously active project
  async loadProject() {
    const active = this.projectStorageService.getActiveProject();
    if (!active) return;
    console.log(`Attempting to load active project: ${active.key} from ${active.storageType}`);
    try {
      const project = await this.projectStorageService.loadProject(active.key, active.storageType);
      if (project) {
        this.projectState.setProject(project); // Update the project state
        console.log(`Project loaded successfully: ${active.key}`)
      } else {
        console.error(`Failed to load project: ${active.key}`); // Show error message
        this.projectStorageService.clearActiveProject();
      }
    }
    catch (error) {
      console.error(`Error loading active project: ${active.key}`, error)
      this.projectStorageService.clearActiveProject();
    }
  }
}