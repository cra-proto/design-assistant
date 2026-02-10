import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslateModule } from "@ngx-translate/core";
import { HeaderComponent } from './template/header.component';
import { SidebarComponent } from './template/sidebar.component';
import { FooterComponent } from './template/footer.component';
import { LocalStorageService } from './services/storage/local-storage.service';
import { CustomTitleStrategy } from './common/custom-title-strategy';
import { PrimeNG } from 'primeng/config';
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';
import { ExportGitHubService } from './services/github/export-github.service';
import { CollaboratorService } from './services/collaborator.service';
import { CloudStorageService } from './services/storage/cloud-storage.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'aida-root',
  imports: [CommonModule, RouterOutlet, RouterModule, TranslateModule, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  CustomTitle = inject(CustomTitleStrategy);
  titleService = inject(Title);
  localStore = inject(LocalStorageService);
  private primeng = inject(PrimeNG);
  router = inject(Router);
  route = inject(ActivatedRoute);
  projectStorage = inject(ProjectStorageService);
  private cloudStorage = inject(CloudStorageService)
  projectState = inject(ProjectStateService);
  private exportGitHubService = inject(ExportGitHubService);
  private collaboratorService = inject(CollaboratorService);
  private themeService = inject(ThemeService);

  constructor() {
    // Auto-add current user as collaborator when they sign in
    effect(() => {
      const user = this.exportGitHubService.user();
      if (user) {
        this.collaboratorService.addCurrentUserToLocalProjects(user).then(() => {
          this.loadProject();
        });
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.primeng.ripple.set(true);

    //Update settings from url parameter (if present) then remove the param
    this.route.queryParams.subscribe(params => {
      const allParams = { ...params }

      // Handle org parameter
      if (params['org'] !== undefined) {
        this.handleStorageParam('myOrg', params['org']);
        delete allParams['org']
        this.cloudStorage.loadProjects();
      }

      // Handle toolbox parameter
      if (params['toolbox'] !== undefined) {
        this.handleStorageParam('myToolbox', params['toolbox']);
        delete allParams['toolbox']
        this.themeService.toolbox.set(localStorage.getItem('myToolbox'));
      }

      // Remove processed parameters
      if (params['org'] !== undefined || params['toolbox'] !== undefined) {
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
    const active = this.projectStorage.getActiveProject();
    if (!active) return;
    console.log(`Attempting to load active project: ${active.key} from ${active.storageType}`);
    try {
      const project = await this.projectStorage.loadProject(active.key, active.storageType);
      if (project) {
        this.projectState.setProject(project); // Update the project state
        console.log(`Project loaded successfully: ${active.key}`)
      } else {
        console.error(`Failed to load project: ${active.key}`); // Show error message
        this.projectStorage.clearActiveProject();
      }
    }
    catch (error) {
      console.error(`Error loading active project: ${active.key}`, error)
      this.projectStorage.clearActiveProject();
    }
  }
}