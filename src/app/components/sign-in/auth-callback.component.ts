import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { GitHubAuthService } from '../../services/github/github-auth.service';

@Component({
  selector: 'aida-auth-callback',
  imports: [CommonModule, TranslateModule,
    ProgressSpinnerModule, MessageModule],
  templateUrl: './auth-callback.component.html',
  styles: ``
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(GitHubAuthService);

  error = signal<string | null>(null);

  private markForTranslation() {
    marker('github.callback.error.invalidParams');
    marker('github.callback.error.githubError');
    marker('github.callback.error.serverError');
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    const code = params['code'];
    const state = params['state'];
    const error = params['error'];

    // Handle direct navigation (no parameters)
    if (!code && !state && !error) {
      this.router.navigate(['/'], { replaceUrl: true });
      return;
    }

    // Handle OAuth error from GitHub
    if (error) {
      console.error('OAuth GitHub error:', error);
      this.error.set('github.callback.error.githubError');
      return;
    }

    // Handle missing required parameters
    if (!code || !state) {
      this.error.set('github.callback.error.invalidParams');
      return;
    }

    // Process successful callback
    this.handleCallback(code, state);
  }

  private async handleCallback(code: string, state: string) {
    try {
      await this.authService.handleCallback(code, state);
      const returnUrl = sessionStorage.getItem('github_oauth_return_url') || '/export-github'; // Return user to original location or default after login
      sessionStorage.removeItem('github_oauth_return_url');
      this.router.navigate([returnUrl], { replaceUrl: true });
    } catch (error) {
      this.error.set('github.callback.error.serverError');
      console.error('OAuth AWS server error:', error);
    }
  }
}