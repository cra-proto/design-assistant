import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';

// Project views
import { DashboardComponent } from './views/project-assistant/dashboard.component';
import { SwitchProjectComponent } from './views/project-assistant/switch-project.component';
import { EditProjectComponent } from './views/project-assistant/edit-project.component';
import { ImportPageComponent } from './views/project-assistant/import-page.component';

// Task Views
import { IaDiagramComponent } from './components/ia-diagram/ia-diagram.component';
import { InventoryComponent } from './views/inventory-assistant/inventory.component';
import { ExportGithubComponent } from './views/github-assistant/export-github.component';

// Static pages
import { NotFoundComponent } from './views/404/not-found.component';
import { AboutComponent } from './views/about-us/about.component';

// Authentication
import { GithubConnectComponent } from './components/sign-in/github-connect.component';
import { AuthCallbackComponent } from './components/sign-in/auth-callback.component';

// Dev tools & standalone - LAZY LOAD THESE!

// Project Storage (for route guards)
import { ProjectStorageService } from './services/storage/project-storage.service';
import { ProjectStateService } from './services/project-state.service';

//Route guards
export const landingGuard = () => {
    const router = inject(Router);
    const projectStorage = inject(ProjectStorageService);
    if (projectStorage.hasActiveProject()) {
        return router.createUrlTree(['/dashboard']);
    } else {
        return router.createUrlTree(['/new-project']);
    }
};

export const editProjectGuard = () => {
    const router = inject(Router);
    const projectState = inject(ProjectStateService);
    const name = projectState.getProject().projectName
    if (!name) {
        return router.createUrlTree(['/new-project']);
    }
    return true;
};

export const routes: Routes = [
    {
        path: '',
        canActivate: [landingGuard],
        children: []
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        title: (environment.production ? '_app._title' : environment.sandbox ? '_app._title.sandbox' : '_app._title.dev'),
    },
    {
        path: 'switch-project',
        component: SwitchProjectComponent,
        title: 'switch._title',
    },
    {
        path: 'new-project',
        component: EditProjectComponent,
        title: 'newProject._title',
    },
    {
        path: 'edit-project',
        component: EditProjectComponent,
        canActivate: [editProjectGuard],
        title: 'editProject._title',
    },
    {
        path: 'import-page',
        component: ImportPageComponent,
        title: 'importPage._title',
    },
    {
        path: 'auth/login',
        component: GithubConnectComponent,
        title: 'app._title',
    },
    {
        path: 'auth/callback',
        component: AuthCallbackComponent,
        title: 'app._title',
    },
    {
        path: 'export-github',
        component: ExportGithubComponent,
        title: 'exportGithub._title',
    },
    {
        path: 'inventory',
        component: InventoryComponent,
        title: 'inventory._title',
    },
    {
        path: 'ia-diagram',
        component: IaDiagramComponent,
        title: 'iaDiagram._title',
    },
    /*{
         path: 'page-assistant/compare',
         title: 'title.page',
         canActivate: [() => {
             const uploadState = inject(UploadStateService);
             const router = inject(Router);
 
             if (!uploadState.getUploadData()) {
                 router.navigate(['/page-assistant']);
                 return false;
             }
 
             return true;
         }],
         loadComponent: () => import('./views/page-assistant/page-assistant.component')
             .then(m => m.PageAssistantCompareComponent)
 
     },*/
    {
        path: 'about-us',
        component: AboutComponent,
        title: 'about._title',
    },
    {
        path: 'dev',
        loadComponent: () => import('./views/dev-tools/dev-tools.component').then(m => m.DevToolsComponent),
        title: 'dev._title',
    },
    {
        path: 'dev/color-generator',
        loadComponent: () => import('./views/dev-tools/color-generator/color-generator.component').then(m => m.ColorGeneratorComponent),
        title: 'dev.colors._title',
    },
    {
        path: 'dev/design-patterns',
        loadComponent: () => import('./views/dev-tools/design-patterns/design-patterns.component').then(m => m.DesignPatternsComponent),
        title: 'dev.patterns._title',
    },
    {
        path: 'dev/prompt-editor',
        loadComponent: () => import('./views/dev-tools/prompt-editor/prompt-editor.component').then(m => m.PromptEditorComponent),
        title: 'dev.prompts._title',
    },
    {
        path: 'standalone',
        loadComponent: () => import('./views/standalone/standalone.component').then(m => m.StandaloneComponent),
        title: 'standalone._title',
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'notFound._title',
    },
];
export default routes;
