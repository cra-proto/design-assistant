# AIDA (AI Design Assistant)

AIDA is an internal web application for Government of Canada departments to manage content design projects and export prototypes to GitHub repositories for user testing.


This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.14.

## Prerequisites

- **Node.js**: v22.22.0 (recommended to use [nvm](https://github.com/nvm-sh/nvm) for version management)
- **Angular CLI**: v19.2.14 [Angular CLI](https://github.com/angular/angular-cli)
- **Git**: Latest version

## First-Time Setup

### 1. Install Node.js

If using nvm:
```bash
nvm install 22.22.0
nvm use 22.22.0
```

### 2. Install Angular CLI
```bash
npm install -g @angular/cli@19.2.14
```

### 3. Fork and Clone the Repository

1. Fork this repository to your personal GitHub account
2. Clone your fork:
```bash
git clone https://github.com/YOUR-USERNAME/ai-design-assistant.git
cd ai-design-assistant
```
3. Add the upstream remote:
```bash
git remote add upstream https://github.com/proto-cra/ai-design-assistant.git
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Environment Configuration

The application uses environment files located in `src/environments/`:
- `environment.development.ts` - Local, sandbox, and dev development
- `environment.ts` - Production

These files contain Lambda function URLs and are already configured. No additional setup required.

## Development Workflow

### Branch Strategy

- **Personal forks**: Do all development work in your fork, branching from `dev`
- **feature/*** branches: All development happens in feature branches
- **sandbox**: Testing ground for features requiring authentication (deploys to AWS dev)
- **dev**: Staging for the next release (deploys to AWS dev)
- **main**: Production branch (deploys to AWS production) - **Amber merges only**

**Important**: `sandbox` is a space for testing and experimentation. PRs should go from `feature/*` branches directly to `dev`, never from `sandbox` to `dev`.

### Development Process

1. **Keep your fork up to date:**
```bash
git checkout dev
git pull upstream dev
```

2. **Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

3. **Develop and test locally:**
```bash
ng serve
```
Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

4. **Push to your fork:**
```bash
git push origin feature/your-feature-name
```

5. **If your feature needs authentication testing:**
```bash
git checkout sandbox
git pull upstream sandbox
git merge feature/your-feature-name
git push origin sandbox
```
Then open a PR to merge your fork's `sandbox` into upstream `sandbox`. Once merged, test in the deployed AWS dev environment.

6. **When your feature is complete and tested:**
   - Run `npm run lint` to check for code quality issues
   - Open PR from `feature/your-feature-name` directly to `dev`
   - **Do NOT merge `sandbox` to `dev`**
   - After your feature merges to `dev`, you may want to rebase `sandbox` on `dev` to clean it up

### Why This Workflow?

This approach allows multiple incomplete features to coexist in `sandbox` for authentication testing without blocking each other. Only finished, tested features get merged to `dev`, so you never have to "pick apart" what's ready for release.

### Cleaning Up Sandbox

After features merge to `dev`, you can clean up `sandbox` by rebasing it:
```bash
git checkout sandbox
git pull upstream dev
git rebase dev
git push --force origin sandbox
```

## Deployment & Environments

All deployments are automated via GitHub Actions:

| Branch | Environment | Trigger | Purpose |
|--------|-------------|---------|---------|
| `sandbox` | AWS Dev | Push to `sandbox` | Testing features requiring authentication |
| `dev` | AWS Dev | Push to `dev` | Staging the next release |
| `main` | AWS Production | Push to `main` | Live application |

**Note**: `sandbox` and `dev` both deploy to the same AWS dev infrastructure. They can't be deployed simultaneously - whichever branch pushes last is what's currently deployed.

## Tech Stack

### Frontend
- **Angular**: v19
- **PrimeNG**: v19 (UI component library)
- **PrimeFlex**: v4 (CSS utility library)
- **ngx-translate**: Internationalization (English, Canadian French)
- **Additional libraries**: Document processing (mammoth, pdfjs), diff visualization, file handling

### Backend
- **Infrastructure**: Terraform
- **Compute**: AWS Lambda
- **API**: API Gateway
- **Authentication**: GitHub OAuth
- **Storage**: DynamoDB

### Architecture Highlights
- Multi-tenant architecture using URL parameters and localStorage
- GitHub OAuth and PAT integration for authentication
- Content inventory and validation for Canada.ca
- Export functionality for GitHub repositories

## Common Development Tasks

### Generate a new component
```bash
ng generate component components/component-name
```

### Generate a new service
```bash
ng generate service services/service-name
```

### Run linting
```bash
npm run lint
```
**Run this before opening a PR to `dev`** to catch any code style or quality issues.

### Check for available schematics
```bash
ng generate --help
```

## VS Code Setup

Recommended extensions:
- Angular Language Service
- Prettier - Code formatter
- ESLint

## Troubleshooting

### Port already in use
If `ng serve` fails because port 4200 is in use:
```bash
ng serve --port 4201
```

### Node version issues
Ensure you're using Node v22.22.0:
```bash
node --version
```

### Environment file issues
Verify that `src/environments/environment.development.ts` exists and contains the correct Lambda URLs.

### Merge conflicts in sandbox
If `sandbox` has conflicts when trying to merge your feature:
1. Don't worry - `sandbox` is just a testing ground
2. You can force-push your feature to your fork's `sandbox` if needed
3. Coordinate with your team if multiple people are testing

## Questions or Issues?

Contact Amber or open an issue in this repository.