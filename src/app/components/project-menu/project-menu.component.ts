import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService, MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { Menu, MenuModule } from 'primeng/menu';

import { AddCollaboratorsComponent } from '../../components/add-collaborators/add-collaborators.component';
import { AddPagesComponent } from '../../components/add-pages/add-pages.component';
import { SetupProjectComponent } from '../../components/setup-project/setup-project.component';
import { SetupRepoComponent } from '../../components/setup-repo/setup-repo.component';
import { PatComponent } from '../sign-in/pat/pat.component';
import { UserSettingsComponent } from '../user-settings/user-settings.component';

import { CollaboratorService } from '../../services/github/collaborator.service';
import { ExportGitHubService } from '../../services/github/export-github.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { SignInService } from '../../services/github/sign-in.service';
import { ProjectStateService } from '../../services/project-state.service';

export type DialogMode = 'PAT' | 'userSettings' | 'setupProject' | 'setupRepo' | 'addPages' | 'addCollabs';

@Component({
  selector: 'aida-project-menu',
  imports: [
    TranslatePipe,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    MenuModule,
    AddCollaboratorsComponent,
    AddPagesComponent,
    PatComponent,
    SetupProjectComponent,
    SetupRepoComponent,
    UserSettingsComponent,
  ],
  templateUrl: './project-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectMenuComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly projectState = inject(ProjectStateService);
  private readonly collaboratorService = inject(CollaboratorService);
  private readonly authService = inject(GitHubAuthService);
  protected readonly exportGitHubService = inject(ExportGitHubService);
  protected readonly signInService = inject(SignInService);

  // Menu
  protected readonly menu = viewChild.required<Menu>('menu');
  public toggle(event: Event) {
    this.menu().toggle(event);
  }

  // Sign in
  private connectGitHub() {
    if (this.signInService.isApiGatewayAccessible()) {
      this.authService.login();
    } else {
      this.showDialog('PAT');
    }
  }

  protected async validatePAT() {
    this.visible.set(false);
    await this.signInService.validatePAT();
  }

  protected get items(): MenuItem[] {
    const { isSignedIn, isCollaborator, isLocked } = this.collaboratorService.getUploadAccessInfo(this.projectState.getProject());

    //Profile: sign in/out, user settings
    //Active project: setup project, setup repo, add pages, manage collabs, lock/unlock
    //Project: all, new

    const dropdownOptions = [
      {
        label: this.translate.instant('common.profile'),
        items: [
          {
            label: this.translate.instant('settings._title'),
            icon: 'manage_accounts',
            command: () => {
              this.showDialog('userSettings');
            },
          },
        ],
      },
      {
        label: this.translate.instant('home.header.settingsDoormats'),
        items: [
          {
            label: this.translate.instant('project.setup._title'),
            icon: 'settings',
            command: () => {
              this.showDialog('setupProject');
            },
          },
          {
            label: this.translate.instant('project.repo._title'),
            icon: 'folder_zip',
            command: () => {
              this.showDialog('setupRepo');
            },
          },
          {
            label: this.translate.instant('findPages._title'),
            icon: 'note_add',
            command: () => {
              this.showDialog('addPages');
            },
          },
          {
            label: this.translate.instant('collaborators._title'),
            icon: 'group_add',
            command: () => {
              this.showDialog('addCollabs');
            },
          },
        ],
      },
    ];
    //Profile: sign in/out
    if (!this.signInService.user()) {
      dropdownOptions[0].items!.unshift({
        label: this.translate.instant('common.signin'),
        icon: 'login',
        command: () => {
          this.connectGitHub();
        },
      });
    } else {
      dropdownOptions[1].items!.unshift({
        label: this.translate.instant('common.signout'),
        icon: 'logout',
        command: () => {
          console.log(this.signInService.user());
          this.authService.logout();
          this.signInService.clearPAT();
        },
      });
    }
    //Active project lock/unlock
    if (isSignedIn && isCollaborator) {
      if (!isLocked && this.projectState.getProject().storageType === 'cloud') {
        dropdownOptions[1].items.push({
          label: this.translate.instant('project.global.lockProject'),
          icon: 'pi pi-lock',
          command: () => {
            this.projectState.setLockedBy();
          },
        });
      } else if (isLocked) {
        dropdownOptions[1].items.push({
          label: this.translate.instant('project.global.unlockProject'),
          icon: 'pi pi-unlock',
          command: () => {
            this.unlockProject(isLocked);
          },
        });
      }
    }

    return dropdownOptions;
  }

  /** Unlock a project () */
  private unlockProject(user: string) {
    if (user === 'byMe') {
      this.projectState.removeLockedBy();
    } else {
      this.confirmationService.confirm({
        key: 'unlock',
        message: this.translate.instant('project.global.unlockMessage', { user: user }),
        header: this.translate.instant('project.global.unlockHeader'),
        icon: 'pi pi-exclamation-circle text-red-500',
        rejectButtonProps: {
          label: this.translate.instant('common.cancel'),
          severity: 'secondary',
          outlined: true,
          styleClass: 'secondary-outline',
        },
        acceptButtonProps: {
          label: this.translate.instant('common.unlock'),
          severity: 'danger',
        },
        accept: () => {
          this.projectState.removeLockedBy();
        },
      });
    }
  }

  //Dialog
  protected readonly visible = signal<boolean>(false);
  protected readonly mode = signal<DialogMode | undefined>(undefined);

  public showDialog(mode: DialogMode) {
    this.mode.set(mode);
    this.visible.set(true);
  }
}
