import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslateService } from '@ngx-translate/core';

import { catchError, map, of, timeout } from 'rxjs';

import { MessageService } from 'primeng/api';

import { GitHubAuthService } from './github-auth.service';

import { environment } from '../../../environments/environment';
import { GitHubUser } from '../../common/data.model';

/*
 * Use this service to coordinate OAuth and PAT sign-in status (GitHub token & user)
 * PAT is a fallback sign-in method when OAuth is unavailable
 */
@Injectable({ providedIn: 'root' })
export class SignInService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly messageService = inject(MessageService);
  private readonly authService = inject(GitHubAuthService);

  /** OAuth or PAT token */
  public readonly token = computed(() => (this.authService.isAuthenticated() ? (this.authService.getToken() ?? '') : this.patToken()));

  /** OAuth or PAT user */
  public readonly user = computed(() => (this.authService.isAuthenticated() ? this.authService.user() : this.patUser()));

  /** Key for retrieving PAT token from session storage */
  private readonly PAT_STORAGE_KEY = 'github_pat';
  /** Key for retrieving PAT user from session storage */
  private readonly PAT_USER_STORAGE_KEY = 'github_pat_user';
  /** Signal to track PAT token */
  private readonly patToken = signal<string>(this.loadPAT());
  /** Signal to track PAT user */
  private readonly patUser = signal<GitHubUser | null>(this.loadPATUser());

  /** Public access to get PAT token */
  public get pat(): string {
    return this.patToken();
  }

  /** Public access to set PAT token (needed for chaining session storage) */
  public set pat(value: string) {
    this.patToken.set(value);
    sessionStorage.setItem(this.PAT_STORAGE_KEY, value);
  }

  /** Loads PAT token from session storage */
  private loadPAT(): string {
    return sessionStorage.getItem(this.PAT_STORAGE_KEY) ?? '';
  }

  /** Loads PAT user from session storage */
  private loadPATUser(): GitHubUser | null {
    const stored = sessionStorage.getItem(this.PAT_USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  /** Clears PAT token and user from signals and session storage */
  public clearPAT(): void {
    this.patToken.set('');
    this.patUser.set(null);
    sessionStorage.removeItem(this.PAT_STORAGE_KEY);
    sessionStorage.removeItem(this.PAT_USER_STORAGE_KEY);
  }

  /** Maps user object returned from GitHub to AIDA's GitHubUser interface (for PAT users) */
  private mapGitHubUser(patUser: unknown): GitHubUser {
    const user = patUser as Record<string, unknown>;
    return {
      login: user['login'] as string,
      id: user['id'] as number,
      avatar_url: user['avatar_url'] as string,
      name: user['name'] as string,
      email: user['email'] as string,
    };
  }

  /** Validate PAT and set PAT user */
  public async validatePAT() {
    const token = this.pat;
    try {
      // Step 1: Validate token by calling /user endpoint
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!userResponse.ok) {
        this.clearPAT();
        this.messageService.add({
          key: 'html',
          severity: 'error',
          summary: this.translate.instant('github.connect.pat.error.summary'),
          detail: this.translate.instant('github.connect.pat.error.detail') + this.translate.instant('github.connect.pat.token.link'),
          sticky: true,
        });
      } else {
        const user = await userResponse.json();
        this.patUser.set(this.mapGitHubUser(user));
        sessionStorage.setItem(this.PAT_USER_STORAGE_KEY, JSON.stringify(user));
        console.log('patUser set:', this.patUser());
        console.log('user computed:', this.user());
      }
    } catch {
      console.log('Network error validating token');
    }
  }

  /** Validate GitHub token against currently selected repo */
  public async validateToken(
    token: string,
    owner: string,
    repo: string,
  ): Promise<{ valid: boolean; repoExists?: boolean; hasRepoAccess?: boolean; canCreateRepo?: boolean; showDisclaimer?: boolean; error?: string }> {
    try {
      // Step 1: Validate token by calling /user endpoint
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!userResponse.ok) {
        const error = userResponse.status === 401 ? 'Invalid or expired token' : `GitHub API error: ${userResponse.status}`;
        return { valid: false, error };
      }

      const user = await userResponse.json();

      const tokenScopes =
        userResponse.headers
          .get('x-oauth-scopes')
          ?.split(',')
          .map((s) => s.trim()) ?? []; //Will be empty if using PAT

      // Step 2: Check if repo exists (and get permissions if it does)
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      // Step 3a: Existing repo, check permissions
      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        let hasWriteAccess = false;

        if (this.authService.isAuthenticated()) {
          hasWriteAccess = repoData.permissions?.push === true || repoData.permissions?.admin === true;
        } else {
          hasWriteAccess = await this.checkWritePermission(token, owner, repo, user.login);
        }
        return {
          valid: true,
          repoExists: true,
          hasRepoAccess: hasWriteAccess,
          showDisclaimer: false,
        };
      }
      // Step 3b: New repo, check if user can create
      else if (repoResponse.status === 404) {
        let canCreate = false;
        let showDisclaimer = false;

        if (this.authService.isAuthenticated()) {
          if (owner === user.login) {
            canCreate = tokenScopes.includes('repo') || tokenScopes.includes('public_repo');
          } else {
            const orgMemberResponse = await fetch(`https://api.github.com/orgs/${owner}/memberships/${user.login}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
              },
            });
            if (orgMemberResponse.ok) {
              const memberData = await orgMemberResponse.json();
              canCreate = memberData.role === 'admin' || memberData.state === 'active';
            }
          }
        } else {
          // For PATs
          // Check an existing repo to see if we have 'repo' scope
          const repoList = await this.getRepoList(owner);
          if (repoList.length > 0) {
            const testRepo = repoList[0].name;
            canCreate = await this.checkWritePermission(token, owner, testRepo, user.login);
          } else {
            //Assume access if an org member or personal repo but show disclaimer
            if (owner === user.login) {
              canCreate = true;
              showDisclaimer = true;
            } else {
              const orgMemberResponse = await fetch(`https://api.github.com/orgs/${owner}/memberships/${user.login}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github+json',
                },
              });
              canCreate = orgMemberResponse.ok;
              showDisclaimer = orgMemberResponse.ok;
            }
          }
        }
        return {
          valid: true,
          repoExists: false,
          canCreateRepo: canCreate,
          showDisclaimer: showDisclaimer,
        };
      }
      // Step 3c: Other errors
      else {
        return { valid: false, error: `Error checking repo: ${repoResponse.status}` };
      }
    } catch {
      return { valid: false, error: 'Network error validating token' };
    }
  }

  /** Check user's write permission for selected repo */
  private async checkWritePermission(token: string, owner: string, repo: string, userLogin: string): Promise<boolean> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/collaborators/${userLogin}/permission`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.permission === 'admin' || data.permission === 'write';
    }
    return false;
  }

  /** Get list of public repos for an owner (user or org) */
  public async getRepoList(owner: string): Promise<{ name: string }[]> {
    const type = await this.getOwnerType(owner);
    const url = type === 'Organization' ? `https://api.github.com/orgs/${owner}/repos?per_page=100&type=public` : `https://api.github.com/users/${owner}/repos?per_page=100&type=public`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to load repos: ${response.status}`);
    }
    return response.json(); // array of repos
  }

  /** Determine if owner is a user or organization */
  public async getOwnerType(owner: string): Promise<'User' | 'Organization'> {
    const response = await fetch(`https://api.github.com/users/${owner}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch owner type for ${owner}: ${response.status}`);
    }
    const data = await response.json();
    return data.type as 'User' | 'Organization';
  }

  /** Signal to track if API Gateway is accessible for OAuth */
  public readonly isApiGatewayAccessible = toSignal(this.checkApiGatewayAccess(), { initialValue: false });

  /** Checks if API gateway is available so we can surface the preferred sign-in method */
  private checkApiGatewayAccess() {
    // Skip check on localhost (gateway isn't blocked but OAuth will be blocked by CORS)
    if (window.location.hostname === 'localhost') {
      return of(false);
    }
    return this.http.get(`${environment.apiGateway}/auth/github/url`, { observe: 'response' }).pipe(
      timeout(3000),
      map(() => true),
      catchError(() => of(false)), // Any error (timeout, network, CORS, blocked) means it's inaccessible
    );
  }
}
