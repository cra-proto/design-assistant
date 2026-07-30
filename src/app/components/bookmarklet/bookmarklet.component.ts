import { Component, inject, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { DomSanitizer } from '@angular/platform-browser';

//Services
import { ProjectStateService } from '../../services/project-state.service';

@Component({
    selector: 'aida-bookmarklet',
    imports: [
        TranslateModule,
    ],
    templateUrl: './bookmarklet.component.html',
    styles: ``
})
export class BookmarkletComponent {
    private projectState = inject(ProjectStateService);
    private sanitizer = inject(DomSanitizer)

    mode = input<'github' | 'local'>('github');

    modified: Record<'github' | 'local', string> = {
        github: "2026-07-28",
        local: "2026-07-29"
    }

    markForTranslation() {
        marker('project.bookmarklet.github._title');
        marker('project.bookmarklet.github.description');
        marker('project.bookmarklet.local._title');
        marker('project.bookmarklet.local.description');
    }

    projectData = this.projectState.getProject

    projectBookmarklet = computed(() => {
        return this.mode() === 'github' ? this.ghBookmarklet() : this.utBookmarklet()
    });

    ghBookmarklet = computed(() => {
        const owner = this.projectData().github.owner;
        const repo = this.projectData().github.repo;

        if (!owner || !repo) {
            return this.sanitizer.bypassSecurityTrustUrl('javascript:void(0)');
        }

        const js = `javascript:(function(){` +
            `const owner='${owner}';` +
            `const repo='${repo}';` +
            `const currentUrl=window.location.href;` +
            `const isInMyRepo=currentUrl.includes(owner+'/'+repo)||currentUrl.includes(owner+'.github.io/'+repo)||currentUrl.includes('cra-test-arc.canada.ca/'+repo);` +
            `const isGitHubEdit=currentUrl.includes('github.com');` +
            `const isGitHubPreview=currentUrl.includes('.github.io')||currentUrl.includes('test.canada.ca')||currentUrl.includes('cra-test-arc.canada.ca');` +
            `const isCanadaCa=currentUrl.includes('canada.ca')&&!isGitHubPreview;` +
            // GitHub edit → GitHub preview (works for any repo)
            `if(isGitHubEdit){` +
            `const isRoot=currentUrl.match(/^https:\\/\\/github\\.com\\/([^\\/]+)\\/([^\\/]+)\\/?$/);` +
            `const isGcProto=currentUrl.includes('github.com/gc-proto/');` +
            `const isCraProto=currentUrl.includes('github.com/cra-proto/');` +
            `if(isCraProto){` +
            `if(isRoot){window.location.href='https://cra-test-arc.canada.ca/'+isRoot[2]+'/'}` +
            `else{window.location.href=currentUrl.replace(/^https:\\/\\/github\\.com\\/cra-proto\\/(.*?)\\/(blob|tree|edit)\\/.*?\\/(.*?)(\\/)?(\\.\\w+)?$/,'https://cra-test-arc.canada.ca/$1/$3$5');}` +
            `}else if(isGcProto){` +
            `if(isRoot){window.location.href='https://test.canada.ca/'+isRoot[2]+'/'}` +
            `else{window.location.href=currentUrl.replace(/^https:\\/\\/github\\.com\\/gc-proto\\/(.*?)\\/(blob|tree|edit)\\/.*?\\/(.*?)(\\/)?(\\.\\w+)?$/,'https://test.canada.ca/$1/$3$5');}` +
            `}else{` +
            `if(isRoot){window.location.href='https://'+isRoot[1]+'.github.io/'+isRoot[2]+'/'}` +
            `else{window.location.href=currentUrl.replace(/^https:\\/\\/github\\.com\\/(.*?)\\/(.*?)\\/(blob|tree|edit)\\/.*?\\/(.*?)(\\/)?(\\.\\w+)?$/,'https://$1.github.io/$2/$4$6');}` +
            `}` +
            // GitHub preview → Canada.ca (ONLY if in my repo)
            `}else if(isGitHubPreview&&isInMyRepo){` +
            `const path=currentUrl.split(repo)[1];` +
            `window.location.href='https://www.canada.ca'+path;` +
            // Canada.ca → GitHub preview (assumes page exists)
            `}else if(isCanadaCa){` +
            `const path=currentUrl.replace(/^https:\\/\\/(www\\.)?canada\\.ca/,'');` +
            `if(owner==='cra-proto'){window.location.href='https://cra-test-arc.canada.ca/'+repo+path}` +
            `else if(owner==='gc-proto'){window.location.href='https://test.canada.ca/'+repo+path}` +
            `else{window.location.href='https://'+owner+'.github.io/'+repo+path}` +
            // Fallback → index of my repo
            `}else{` +
            `if(owner==='cra-proto'){window.location.href='https://cra-test-arc.canada.ca/'+repo}` +
            `else if(owner==='gc-proto'){window.location.href='https://test.canada.ca/'+repo}` +
            `else{window.location.href='https://'+owner+'.github.io/'+repo}` +
            `}` +
            `})();`;
        return this.sanitizer.bypassSecurityTrustUrl(js);
    });

    utBookmarklet = computed(() => {
        const repo = this.projectData().github.repo;

        if (!repo) {
            return this.sanitizer.bypassSecurityTrustUrl('javascript:void(0)');
        }

        const js = `javascript:(function(){` +
            `const repo='${repo}';` +
            `const currentUrl=window.location.href;` +
            `const isUTPreview=currentUrl.includes('test/AIDA/'+repo);` +
            `const isGitHubPreview=currentUrl.includes('.github.io')||currentUrl.includes('test.canada.ca')||currentUrl.includes('cra-test-arc.canada.ca');` +
            `const isCanadaCa=currentUrl.includes('canada.ca');` +
            // UT preview → Canada.ca (ONLY if in my repo)
            `if(isUTPreview){` +
            `const path=currentUrl.split(repo)[1];` +
            `window.location.href='https://www.canada.ca'+path;` +
            // Canada.ca → UT preview (assumes page exists)
            `}else if(isCanadaCa&&!isGitHubPreview){` +
            `const path=currentUrl.replace(/^https:\\/\\/(www\\.)?canada\\.ca/,'');` +
            `window.location.href='http://cra-ut.isvcs.net/test/AIDA/'+repo+path;` +
            // Fallback → index of my repo
            `}else{` +
            `window.location.href='http://cra-ut.isvcs.net/test/AIDA/'+repo;` +
            `}` +
            `})();`;
        return this.sanitizer.bypassSecurityTrustUrl(js);
    });
}