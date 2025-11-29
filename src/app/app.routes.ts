import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
// Project files
import { DashboardComponent } from './views/project-assistant/dashboard.component';
import { SwitchProjectComponent } from './views/project-assistant/switch-project.component';
// Authentication
import { GithubConnectComponent } from './components/sign-in/github-connect.component';
import { AuthCallbackComponent } from './components/sign-in/auth-callback.component';
//Export & Share
import { ExportGithubComponent } from './views/ia-assistant/components/export-github.component';
import { ShareComponent } from './views/page-assistant/components/share.component';
// Tools
import { PageUploadComponent } from './views/page-assistant/components/upload.component';
import { UploadStateService } from './views/page-assistant/services/upload-state.service';
import { ImageAssistantComponent } from './views/standalone/image-assistant/image-assistant.component';
import { TranslationAssistantComponent } from './views/standalone/translation-assistant/translation-assistant.component';
import { InventoryAssistantComponent } from './views/inventory-assistant/inventory-assistant.component';
import { MetadataAssistantComponent } from './views/metadata-assistant/metadata-assistant.component';
import { LlmEvaluationComponent } from './views/standalone/llm-evaluation/llm-evaluation.component';
import { IaAssistantComponent } from './views/ia-assistant/ia-assistant.component';
// Static pages
import { NotFoundComponent } from './views/standalone/not-found.component';
import { AboutComponent } from './views/standalone/about.component';
//Test
import { TestComponent } from './views/example/test.component';

export const routes: Routes = [
    {
        path: '',
        component: DashboardComponent,
        title: 'title.landing',
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
        path: 'ia-assistant',
        component: IaAssistantComponent,
        title: 'title.ia',
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
    },
    {
        path: 'inventory-assistant',
        component: InventoryAssistantComponent,
        title: 'title.inventory',
    },
    {
        path: 'metadata-assistant',
        component: MetadataAssistantComponent,
        title: 'title.metadata',
    },
    {
        path: 'llm-evaluation',
        component: LlmEvaluationComponent,
        title: 'title.llmEvaluation',
    },
    {
        path: 'about-us',
        component: AboutComponent,
        title: 'title.about',
    },
    {
        path: 'test',
        component: TestComponent,
        title: 'title.test',
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'title.404',
    },
];
export default routes;
