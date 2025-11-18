import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap, of } from 'rxjs';

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
}

interface GitHubAuthResponse {
  access_token: string;
  scope: string;
  token_type: string;
  user: GitHubUser;
}

@Injectable({
  providedIn: 'root'
})
export class GitHubAuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly GITHUB_CLIENT_ID = 'your_client_id_here';
  private readonly BACKEND_URL = 'http://localhost:3000/api/auth';
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

    // Validate token on service initialization
    if (this.accessToken()) {
      this.validateToken();
    }
  }

  /**
   * Initiate GitHub OAuth flow
   */
  login(scopes: string[] = ['repo', 'user']): void {
    const scope = scopes.join(' ');
    const redirectUri = `${window.location.origin}/auth/callback`;

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', this.GITHUB_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('state', this.generateState());

    // Store state for CSRF protection
    sessionStorage.setItem('github_oauth_state', authUrl.searchParams.get('state')!);

    // Redirect to GitHub
    window.location.href = authUrl.toString();
  }

  /**
   * Handle OAuth callback
   */
  handleCallback(code: string, state: string): Promise<GitHubAuthResponse> {
    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('github_oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }
    sessionStorage.removeItem('github_oauth_state');

    return new Promise((resolve, reject) => {
      this.http.post<GitHubAuthResponse>(`${this.BACKEND_URL}/github/token`, { code })
        .pipe(
          tap(response => {
            this.accessToken.set(response.access_token);
            this.currentUser.set(response.user);
          }),
          catchError(error => {
            console.error('GitHub authentication error:', error);
            reject(error);
            return of(null);
          })
        )
        .subscribe(response => {
          if (response) {
            resolve(response);
          }
        });
    });
  }

  /**
   * Validate stored token
   */
  validateToken(): void {
    const token = this.accessToken();
    if (!token) {
      this.logout();
      return;
    }

    this.http.get(`${this.BACKEND_URL}/github/validate`, {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      catchError(() => {
        this.logout();
        return of(null);
      })
    ).subscribe();
  }

  /**
   * Logout and clear stored data
   */
  logout(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  /**
   * Get current access token value
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