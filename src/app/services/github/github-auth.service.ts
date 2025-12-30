import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  bio: string | null;
}

interface GitHubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class GitHubAuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly BACKEND_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'github_access_token';
  private readonly USER_KEY = 'github_user';

  // Signals
  private accessToken = signal<string | null>(this.getStoredToken());
  private currentUser = signal<GitHubUser | null>(this.getStoredUser());

  // Computed signals
  public isAuthenticated = computed(() => !!this.accessToken());
  public user = computed(() => this.currentUser());

  constructor() {
    // Effect to persist token changes
    effect(() => {
      const token = this.accessToken();
      if (token) {
        localStorage.setItem(this.TOKEN_KEY, token);
      } else {
        localStorage.removeItem(this.TOKEN_KEY);
      }
    });

    // Effect to persist user changes
    effect(() => {
      const user = this.currentUser();
      if (user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(this.USER_KEY);
      }
    });

    // Fetch user info if we have a token but no user data
    if (this.accessToken() && !this.currentUser()) {
      this.fetchUserInfo();
    }
  }

  /**
   * Initiate GitHub OAuth flow by calling backend to get authorization URL
   */
  async login(scopes: string[] = ['repo', 'user']): Promise<void> {
    try {
      // Store current URL to return here after login
      const currentUrl = this.router.url;
      sessionStorage.setItem('github_oauth_return_url', currentUrl);

      // Generate and store state for CSRF protection
      const state = this.generateState();
      sessionStorage.setItem('github_oauth_state', state);

      // Call backend to get GitHub authorization URL
      const response = await firstValueFrom(
        this.http.get<{ authUrl: string }>(`${this.BACKEND_URL}/auth/github/url`)
      );

      // Append state to the auth URL
      const authUrlWithState = `${response.authUrl}&state=${state}`;

      // Redirect to GitHub
      window.location.href = authUrlWithState;
    } catch (error) {
      console.error('Failed to initiate GitHub login:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth callback from GitHub
   */
  async handleCallback(code: string, state: string): Promise<void> {
    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('github_oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }
    sessionStorage.removeItem('github_oauth_state');

    try {
      // Exchange code for access token via backend
      const response = await firstValueFrom(
        this.http.post<GitHubTokenResponse>(
          `${this.BACKEND_URL}/auth/github/callback`,
          { code }
        )
      );

      // Store the access token
      this.accessToken.set(response.access_token);

      // Fetch user information from GitHub API
      await this.fetchUserInfo();
    } catch (error) {
      console.error('Failed to handle GitHub callback:', error);
      throw error;
    }
  }

  /**
   * Fetch user information from GitHub API using the access token
   */
  private async fetchUserInfo(): Promise<void> {
    const token = this.accessToken();
    if (!token) {
      return;
    }

    try {
      const user = await firstValueFrom(
        this.http.get<GitHubUser>('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }).pipe(
          catchError(error => {
            console.error('Failed to fetch user info:', error);
            // If token is invalid, clear it
            this.logout();
            return of(null);
          })
        )
      );

      if (user) {
        this.currentUser.set(user);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }

  /**
   * Logout and clear stored data
   */
  logout(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    //this.router.navigate(['/']);
  }

  /**
   * Get current access token value (for making authenticated GitHub API calls)
   */
  getToken(): string | null {
    return this.accessToken();
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): GitHubUser | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
}