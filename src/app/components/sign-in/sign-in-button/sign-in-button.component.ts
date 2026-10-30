import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';

import { UserSettingsComponent } from '../../user-settings/user-settings.component';
import { PatComponent } from '../pat/pat.component';

import { GitHubAuthService } from '../../../services/github/github-auth.service';
import { SignInService } from '../../../services/github/sign-in.service';

import { AidaLinks } from '../../../common/aidaLinks.config';

@Component({
  selector: 'aida-sign-in-button',
  imports: [TranslatePipe, AvatarModule, ButtonModule, DialogModule, MenuModule, PatComponent, UserSettingsComponent],
  templateUrl: './sign-in-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInButtonComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(GitHubAuthService);
  protected readonly signInService = inject(SignInService);
  private readonly translate = inject(TranslateService);

  public readonly customText = input<string | undefined>(undefined);
  public readonly customContent = input<boolean>(false);
  public readonly handleSignInRequests = input<boolean>(false);

  // Variables
  protected readonly showPatSignIn = signal(false);
  protected readonly showSettings = signal(false);

  constructor() {
    effect(() => {
      if (this.signInService.signInRequest() > 0 && this.handleSignInRequests()) {
        untracked(() => this.connectGitHub());
      }
    });
  }

  public connectGitHub() {
    if (this.signInService.isApiGatewayAccessible()) {
      this.authService.login();
    } else {
      this.showPatSignIn.set(true);
    }
  }

  protected onPatVisibleChange(visible: boolean) {
    this.showPatSignIn.set(visible);
    if (!visible) this.signInService.completeSignIn();
  }

  protected async validatePAT() {
    this.showPatSignIn.set(false);
    await this.signInService.validatePAT();
    this.signInService.completeSignIn();
  }

  protected get items(): MenuItem[] {
    const dropdownOptions = [
      {
        label: this.translate.instant('common.profile'),
        items: [
          {
            label: this.translate.instant('settings._title'),
            icon: 'pi pi-cog',
            command: () => {
              this.showSettings.set(true);
            },
          },
        ],
      },
      {
        label: this.translate.instant('common.projects'),
        items: [
          {
            label: this.translate.instant('project._nav.new'),
            icon: 'pi pi-plus',
            command: () => {
              this.router.navigate([AidaLinks.NewProject]);
            },
          },
          {
            label: this.translate.instant('switch._title'),
            icon: 'pi pi-folder-open',
            command: () => {
              this.router.navigate([AidaLinks.AllProjects]);
            },
          },
        ],
      },
    ];
    if (!this.signInService.user()) {
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
          console.log(this.signInService.user());
          this.authService.logout();
          this.signInService.clearPAT();
        },
      });
    }
    return dropdownOptions;
  }
}
