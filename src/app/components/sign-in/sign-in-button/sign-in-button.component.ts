import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { catchError, of, timeout } from 'rxjs';

import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';

import { UserSettingsComponent } from '../../user-settings/user-settings.component';
import { PatComponent } from '../pat/pat.component';

import { ExportGitHubService } from '../../../services/github/export-github.service';
import { GitHubAuthService } from '../../../services/github/github-auth.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { ProjectStorageService } from '../../../services/storage/project-storage.service';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'aida-sign-in-button',
  imports: [TranslatePipe, AvatarModule, ButtonModule, DialogModule, MenuModule, PatComponent, UserSettingsComponent],
  templateUrl: './sign-in-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInButtonComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authService = inject(GitHubAuthService);
  protected readonly exportGitHubService = inject(ExportGitHubService);
  private readonly projectStorageService = inject(ProjectStorageService);
  private readonly projectState = inject(ProjectStateService);
  private readonly translate = inject(TranslateService);

  // Variables
  protected showPatSignIn = false;
  protected showSettings = false;

  private connectGitHub() {
    if (this.isApiGatewayAccessible()) {
      this.authService.login();
    } else {
      this.showPatSignIn = true;
    }
  }

  protected async validatePAT() {
    this.showPatSignIn = false;
    await this.exportGitHubService.validatePAT();
  }

  protected get items(): MenuItem[] {
    const dropdownOptions = [
      {
        label: this.translate.instant('common.profile'),
        items: [
          {
            label: this.translate.instant('settings._nav'),
            icon: 'pi pi-cog',
            command: () => {
              this.showSettings = true;
            },
          },
        ],
      },
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
            },
          },
          {
            label: this.translate.instant('common.search'),
            icon: 'pi pi-search',
            command: () => {
              this.router.navigate(['/switch-project']);
            },
          },
        ],
      },
    ];
    if (!this.exportGitHubService.user()) {
      dropdownOptions[0].items!.unshift({
        label: this.translate.instant('common.signin'),
        icon: 'pi pi-sign-in',
        command: () => {
          this.connectGitHub();
        },
      });
    } else {
      dropdownOptions[0].items!.unshift({
        label: this.translate.instant('common.signout'),
        icon: 'pi pi-sign-out',
        command: () => {
          console.log(this.exportGitHubService.user());
          this.authService.logout();
          this.exportGitHubService.clearPAT();
        },
      });
    }
    return dropdownOptions;
  }

  // Signal to track if API Gateway is accessible
  private readonly isApiGatewayAccessible = signal<boolean>(true);

  // Check if API gateway is available so we can surface the preferred sign-in method
  private checkApiGatewayAccess(): void {
    // Skip check on localhost (gateway isn't blocked but OAuth will be blocked by CORS)
    if (window.location.hostname === 'localhost') {
      this.isApiGatewayAccessible.set(false);
      return;
    }

    this.http
      .get(`${environment.apiGateway}/auth/github/url`, {
        observe: 'response',
      })
      .pipe(
        timeout(3000),
        catchError(() => {
          return of(null); // Any error (timeout, network, CORS, blocked) means it's inaccessible
        }),
      )
      .subscribe((response) => {
        this.isApiGatewayAccessible.set(response !== null);
      });
  }

  ngOnInit() {
    this.checkApiGatewayAccess();
  }
}
