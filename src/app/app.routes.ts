import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';
// Project files
import { DashboardComponent } from './views/project-assistant/dashboard.component';
import { SwitchProjectComponent } from './views/project-assistant/switch-project.component';
import { EditProjectComponent } from './views/project-assistant/edit-project.component';
// Authentication
import { GithubConnectComponent } from './components/sign-in/github-connect.component';
import { AuthCallbackComponent } from './components/sign-in/auth-callback.component';
//Export & Share
import { ExportGithubComponent } from './views/github-assistant/export-github.component';
//import { ShareComponent } from './views/page-assistant/components/share.component';
//Add & Find Pages
import { AddPagesComponent } from './components/add-pages/add-pages.component';
//import { FindPagesComponent } from './views/find-pages/find-pages.component';
// Tools
//import { PageUploadComponent } from './views/page-assistant/components/upload.component';
//import { UploadStateService } from './views/page-assistant/services/upload-state.service';
//import { ImageAssistantComponent } from './views/standalone/image-assistant/image-assistant.component';
//import { TranslationAssistantComponent } from './views/standalone/translation-assistant/translation-assistant.component';
import { InventoryComponent } from './views/inventory-assistant/inventory.component';
//import { MetadataAssistantComponent } from './views/metadata-assistant/metadata-assistant.component';
//import { LlmEvaluationComponent } from './views/standalone/llm-evaluation/llm-evaluation.component';
//import { IaAssistantComponent } from './views/ia-assistant/ia-assistant.component';
import { IaDiagramComponent } from './components/ia-diagram/ia-diagram.component';
// Static pages
import { NotFoundComponent } from './views/404/not-found.component';
import { AboutComponent } from './views/about-us/about.component';
//import { ExampleComponent } from './views/examples/example.component';
import { GetTaskUrlsComponent } from './components/find-pages/get-task-urls.component';

export const routes: Routes = [
    {
        path: '',
        component: DashboardComponent,
        title: (environment.production ? 'title.landing' : 'title.landing.dev'),
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'title.dashboard',
    },
    {
        path: 'switch-project',
        component: SwitchProjectComponent,
        title: 'title.saved',
    },
    {
        path: 'new-project',
        component: EditProjectComponent,
        title: 'title.new-project',
    },
    {
        path: 'edit-project',
        component: EditProjectComponent,
        title: 'title.edit-project',
    },
    {
        path: 'auth/login',
        component: GithubConnectComponent,
        title: 'title.ia',
    },
    {
        path: 'auth/callback',
        component: AuthCallbackComponent,
        title: 'title.ia',
    },
    {
        path: 'export-github',
        component: ExportGithubComponent,
        title: 'title.ia',
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
        title: 'title.inventory',
    },
    {
        path: 'airtable',
        component: GetTaskUrlsComponent,
        title: 'title.inventory',
    },/*
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
        title: 'title.about',
    },
    {
        path: 'ia-diagram',
        component: IaDiagramComponent,
        title: 'title.ia',
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'title.404',
    },
];
export default routes;
