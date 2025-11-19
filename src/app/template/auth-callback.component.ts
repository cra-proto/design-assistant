import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GitHubAuthService } from '../services/github-auth.service';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'aida-auth-callback',
  imports: [CommonModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './auth-callback.component.html',
  styles: ``
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(GitHubAuthService);

  error = signal<string | null>(null);

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];

      if (error) {
        this.error.set(`GitHub authentication failed: ${error}`);
        return;
      }

      if (!code || !state) {
        this.error.set('Invalid callback parameters');
        return;
      }

      try {
        await this.authService.handleCallback(code, state);
        // Navigate to the page where user clicked "Connect with GitHub"
        // or a default dashboard/home page
        this.router.navigate(['/ia-assistant/github']);
      } catch (err) {
        this.error.set('Failed to complete authentication');
        console.error('Auth error:', err);
      }
    });
  }
}