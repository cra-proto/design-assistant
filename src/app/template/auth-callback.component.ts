import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GitHubAuthService } from '../services/github-auth.service';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';


// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface GitHubOAuthSecret {
  client_id: string;
  client_secret: string;
}

const secret_name = "prod/design-assistant/GitHub-OAuth";

const client = new SecretsManagerClient({
  region: "ca-central-1",
});

let response;

try {
  response = await client.send(
    new GetSecretValueCommand({
      SecretId: secret_name,
      VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
    })
  );
} catch (error) {
  // For a list of exceptions thrown, see
  // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
  throw error;
}

const secret = response.SecretString;

// Your code goes here

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
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];

      if (error) {
        this.error.set(`GitHub authentication failed: ${error}`);
        return;
      }

      if (code && state) {
        this.authService.handleCallback(code, state)
          .then(() => {
            this.router.navigate(['/dashboard']);
          })
          .catch((err) => {
            this.error.set('Failed to complete authentication');
            console.error('Auth error:', err);
          });
      } else {
        this.error.set('Invalid callback parameters');
      }
    });
  }
}