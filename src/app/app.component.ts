import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslateModule } from "@ngx-translate/core";
import { HeaderComponent } from './template/header.component';
import { SidebarComponent } from './template/sidebar.component';
import { FooterComponent } from './template/footer.component';
import { ApiKeyComponent } from './components/ai-api/api-key.component';
import { LocalStorageService } from './services/storage/local-storage.service';
import { CustomTitleStrategy } from './common/custom-title-strategy';
import { PrimeNG } from 'primeng/config';
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';
import { ExportGitHubService } from './services/github/export-github.service';
import { CollaboratorService } from './services/collaborator.service';

@Component({
  selector: 'aida-root',
  imports: [CommonModule, RouterOutlet, RouterModule, TranslateModule, HeaderComponent, SidebarComponent, FooterComponent, ApiKeyComponent],
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
  projectState = inject(ProjectStateService);
  private exportGitHubService = inject(ExportGitHubService);
  private collaboratorService = inject(CollaboratorService);

  constructor() {
    // Auto-add current user as collaborator when they sign in
    effect(() => {
      const user = this.exportGitHubService.user();
      if (user) {
        this.collaboratorService.addCurrentUserToLocalProjects(user);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.primeng.ripple.set(true);
    //Set api key from url parameter if present then remove the param
    this.route.queryParams.subscribe(params => {
      const apiKey = params['key'];
      if (apiKey) {
        this.localStore.saveData('apiKey', apiKey);
        const allParams = { ...params };
        delete allParams['key']; //only removes key from the params
        this.router.navigate([], {
          queryParams: allParams,
          replaceUrl: true, // replaces the current history entry
        });
      }
    });
    //Set org from url parameter if present then remove the param
    this.route.queryParams.subscribe(params => {
      const orgKey = params['org'];
      if (orgKey !== undefined) {
        if (orgKey === '' || orgKey.trim() === '') { //remove key if param is blank
          localStorage.removeItem('myOrg');
        }
        else { //otherwise save it
          const cleanOrgKey = orgKey.replace(/^["']|["']$/g, '').toUpperCase();
          localStorage.setItem('myOrg', cleanOrgKey);
        }
        const allParams = { ...params };
        delete allParams['org']; //only removes org from the url params
        this.router.navigate([], {
          queryParams: allParams,
          replaceUrl: true, // replaces the current history entry
        });
      }
    });
    await this.loadProject();
    console.log('The initial API key is: ', this.localStore.getData('apiKey'));
  }

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