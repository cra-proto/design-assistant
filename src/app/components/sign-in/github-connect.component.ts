import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { timeout, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from "@ngx-translate/core";

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { PopoverModule } from 'primeng/popover';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { PasswordModule } from 'primeng/password';

import { GitHubAuthService } from '../../services/github/github-auth.service';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { ProjectStorageService } from '../../services/storage/project-storage.service';
import { ProjectStateService } from '../../services/project-state.service';
import { environment } from '../../../environments/environment';
import { PatComponent } from './pat.component';
import { UserSettingsComponent } from '../user-settings/user-settings.component';

@Component({
  selector: 'aida-github-connect',
  imports: [CommonModule, TranslateModule,
    ButtonModule, AvatarModule,
    PopoverModule, MenuModule,
    DialogModule, IftaLabelModule, PasswordModule,
    PatComponent, UserSettingsComponent],
  templateUrl: './github-connect.component.html',
  styles: ``
})
export class GithubConnectComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(GitHubAuthService);
  public exportGitHubService = inject(ExportGitHubService);
  private projectStorage = inject(ProjectStorageService);
  private projectState = inject(ProjectStateService);
  private translate = inject(TranslateService);

  // Variables
  showPatSignIn: boolean = false;
  showSettings: boolean = false;

  connectGitHub() {
    if (this.isApiGatewayAccessible()) {
      this.authService.login(['repo', 'user']);
    }
    else {
      this.showPatSignIn = true;
    }
  }

  validatePAT() {
    this.showPatSignIn = false;
    this.exportGitHubService.validatePAT();
  }

  items: MenuItem[] = [
    {
      label: 'Projects',
      items: [
        {
          label: 'New',
          icon: 'pi pi-plus',
          command: () => {
            this.projectStorage.clearActiveProject();
            this.projectState.resetProject();
            this.router.navigate(['/new-project']);
          }
        },
        {
          label: 'Search',
          icon: 'pi pi-search',
          routerLink: '/switch-project'
        }
      ]
    },
    {
      label: 'Profile',
      items: [
        {
          label: 'Settings',
          icon: 'pi pi-cog',
          command: () => {
            this.showSettings = true;
          }
        },
        {
          label: 'Sign out',
          icon: 'pi pi-sign-out',
          command: () => {
            this.authService.logout();
            this.exportGitHubService.clearPAT();
          }
        }
      ]
    }
  ]

  // Signal to track if API Gateway is accessible
  isApiGatewayAccessible = signal<boolean>(true);

  // Check if API gateway is available so we can surface the preferred sign-in method
  private checkApiGatewayAccess(): void {

    // Skip check on localhost (gateway isn't blocked but OAuth will be blocked by CORS)
    if (window.location.hostname === 'localhost') {
      this.isApiGatewayAccessible.set(false);
      return;
    }

    this.http.get(`${environment.apiGateway}/auth/github/url`, {
      observe: 'response'
    })
      .pipe(
        timeout(3000),
        catchError(() => {
          return of(null); // Any error (timeout, network, CORS, blocked) means it's inaccessible
        })
      )
      .subscribe(response => {
        this.isApiGatewayAccessible.set(response !== null);
      });
  }

  ngOnInit() {
    this.checkApiGatewayAccess();
  }
}