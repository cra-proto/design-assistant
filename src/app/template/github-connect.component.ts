import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from "@ngx-translate/core";

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { PopoverModule } from 'primeng/popover';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

import { GitHubAuthService } from '../services/github-auth.service';
import { IaStateService } from '../views/ia-assistant/services/ia-state.service';

@Component({
  selector: 'aida-github-connect',
  imports: [CommonModule, ButtonModule, AvatarModule, PopoverModule, MenuModule],
  templateUrl: './github-connect.component.html',
  styles: ``
})
export class GithubConnectComponent {

  authService = inject(GitHubAuthService);
  iaState = inject(IaStateService)
  translate = inject(TranslateService);

  connectGitHub() {
    this.authService.login(['repo', 'user']);
  }

  get items(): MenuItem[] {
    const repoName = this.iaState.getGitHubData()?.repo || 'unsaved';

    return [
      {
        label: 'Active Project',
        items: [
          {
            label: `${repoName}`,
            icon: 'pi pi-file-edit',
            routerLink: '/project-assistant'
          },
        ]
      },
      {
        label: 'Projects',
        items: [
          {
            label: 'New',
            icon: 'pi pi-plus',
            command: () => {
              this.iaState.saveToLocalStorage();
              this.iaState.setActiveStep(1);
              this.iaState.resetIaFlow();
              this.iaState.saveToLocalStorage();
            }
          },
          {
            label: 'Search',
            icon: 'pi pi-search',
            routerLink: '/project-assistant'
          }
        ]
      },
      {
        label: 'Profile',
        items: [
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            routerLink: '/ia-assistant/github' // Create a new settings page!
          },
          {
            label: 'Sign out',
            icon: 'pi pi-sign-out',
            command: () => {
              this.authService.logout();
            }
          }
        ]
      }
    ]
  }
}