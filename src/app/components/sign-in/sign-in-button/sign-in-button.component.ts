import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from "@ngx-translate/core";

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { PopoverModule } from 'primeng/popover';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { PasswordModule } from 'primeng/password';

import { GitHubAuthService } from '../../../services/github/github-auth.service';
import { ExportGitHubService } from '../../../services/github/export-github.service';
import { ProjectStorageService } from '../../../services/storage/project-storage.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { environment } from '../../../../environments/environment';
import { PatComponent } from '../pat/pat.component';
import { UserSettingsComponent } from '../../user-settings/user-settings.component';
import { GitHubUser } from '../../../common/data.model';

@Component({
  selector: 'aida-sign-in-button',
  imports: [TranslatePipe,
    ButtonModule, AvatarModule, PopoverModule, MenuModule, DialogModule, IftaLabelModule, PasswordModule,
    PatComponent, UserSettingsComponent
  ],
  templateUrl: './sign-in-button.component.html',
  styles: ``
})
export class SignInButtonComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(GitHubAuthService);
  public exportGitHubService = inject(ExportGitHubService);
  private projectStorageService = inject(ProjectStorageService);
  private projectState = inject(ProjectStateService);
  private translate = inject(TranslateService);

  user = signal<GitHubUser | null>(this.exportGitHubService.user());

  // Variables
  showPatSignIn = false;
  showSettings = false;

  connectGitHub() {
    if (this.isApiGatewayAccessible()) {
      this.authService.login();
    }
    else {
      this.showPatSignIn = true;
    }
  }

  async validatePAT() {
    this.showPatSignIn = false;
    await this.exportGitHubService.validatePAT();
  }

  get items(): MenuItem[] {
    return [
      {
        label: this.translate.instant('common.projects'),
        items: [
          {
            label: this.translate.instant('common.new'),
            icon: 'pi pi-plus',
            command: () => {
              this.projectStorageService.clearActiveProject();
              this.projectState.resetProject();
              this.router.navigate(['/new-project']);
            }
          },
          {
            label: this.translate.instant('common.search'),
            icon: 'pi pi-search',
            command: () => {
              this.router.navigate(['/switch-project']);
            }
          }
        ]
      },
      {
        label: this.translate.instant('common.profile'),
        items: [
          {
            label: this.translate.instant('settings._nav'),
            icon: 'pi pi-cog',
            command: () => {
              this.showSettings = true;
            }
          },
          {
            label: this.translate.instant('common.signout'),
            icon: 'pi pi-sign-out',
            command: () => {
              this.authService.logout();
              this.exportGitHubService.clearPAT();
            }
          }
        ]
      }
    ]
  }

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