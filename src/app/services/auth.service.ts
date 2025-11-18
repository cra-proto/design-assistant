import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'https://YOUR_API_ID.execute-api.ca-central-1.amazonaws.com/prod'; // Get this from Terraform output

    constructor(private http: HttpClient) { }

    async initiateGitHubLogin(): Promise<void> {
        const response = await firstValueFrom(
            this.http.get<{ authUrl: string }>(`${this.apiUrl}/auth/github/url`)
        );

        window.location.href = response.authUrl;
    }

    async handleGitHubCallback(code: string): Promise<any> {
        return firstValueFrom(
            this.http.post(`${this.apiUrl}/auth/github/callback`, { code })
        );
    }
}