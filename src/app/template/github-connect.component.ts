import { Component, inject } from '@angular/core';
import { GitHubAuthService } from '../services/github-auth.service';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'aida-github-connect',
  imports: [CommonModule, ButtonModule, AvatarModule, CardModule],
  templateUrl: './github-connect.component.html',
  styles: ``
})
export class GithubConnectComponent {

  authService = inject(GitHubAuthService);

  connectGitHub() {
    this.authService.login(['repo', 'user']);
  }
}