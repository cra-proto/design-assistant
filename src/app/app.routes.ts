import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';

// Project views
import { DashboardComponent } from './views/project-assistant/dashboard.component';
import { SwitchProjectComponent } from './views/project-assistant/switch-project.component';
import { EditProjectComponent } from './views/project-assistant/edit-project.component';

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

// Examples and utility components - LAZY LOAD THESE!

// Project Storage
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
        path: 'test',
        loadComponent: () => import('./views/example/example.component').then(m => m.ExampleComponent),
        title: 'example._title',
    },
    {
        path: 'colors',
        loadComponent: () => import('./views/example/color-palette/color-test.component').then(m => m.ColorTestComponent),
        title: 'example.colors._title',
    },
    {
        path: 'patterns',
        loadComponent: () => import('./views/example/design-patterns/design-patterns.component').then(m => m.DesignPatternsComponent),
        title: 'example.patterns._title',
    },
    /* {
         path: 'page-assistant/share',
         component: ShareComponent,
         title: 'title.page',
     },
     {
         path: 'export-github',
         component: ExportGithubComponent,
         title: 'title.ia',
     },
     {
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
 
     },
     {
         path: 'page-assistant',
         component: PageUploadComponent,
         title: 'title.page',
     },
     {
         path: 'add-pages',
         component: AddPagesComponent,
         title: 'menu.add-pages',
     },
     {
         path: 'find-pages',
         component: IaAssistantComponent,
         title: 'menu.find-pages',
     },
     {
         path: 'image-assistant',
         component: ImageAssistantComponent,
         title: 'title.image',
     },
     {
         path: 'translation-assistant',
         component: TranslationAssistantComponent,
         title: 'title.translation',
     },*/
    {
        path: 'inventory',
        component: InventoryComponent,
        title: 'inventory._title',
    },
    /*
     {
         path: 'metadata-assistant',
         component: MetadataAssistantComponent,
         title: 'title.metadata',
     },
     {
         path: 'llm-evaluation',
         component: LlmEvaluationComponent,
         title: 'title.llmEvaluation',
     },*/
    {
        path: 'about-us',
        component: AboutComponent,
        title: 'about._title',
    },
    {
        path: 'ia-diagram',
        component: IaDiagramComponent,
        title: 'iaDiagram._title',
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'notFound._title',
    },
];
export default routes;
