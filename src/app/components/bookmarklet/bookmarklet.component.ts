import { Component, inject, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

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

    projectData = this.projectState.getProject

    projectBookmarklet = computed(() => {
        const owner = this.projectData().github.owner;
        const repo = this.projectData().github.repo;

        if (!owner || !repo) {
            return this.sanitizer.bypassSecurityTrustUrl('javascript:void(0)');
        }

        const js = `javascript:(function(){` +
            `const owner='${owner}';` +
            `const repo='${repo}';` +
            `const currentUrl=window.location.href;` +
            `const isInMyRepo=currentUrl.includes(owner+'/'+repo)||currentUrl.includes(owner+'.github.io/'+repo);` +
            `const isGitHubEdit=currentUrl.includes('github.com');` +
            `const isGitHubPreview=currentUrl.includes('.github.io')||currentUrl.includes('test.canada.ca');` +
            `const isCanadaCa=currentUrl.includes('canada.ca');` +
            // GitHub edit → GitHub preview (works for any repo)
            `if(isGitHubEdit){` +
            `const isRoot=currentUrl.match(/^https:\\/\\/github\\.com\\/([^\\/]+)\\/([^\\/]+)\\/?$/);` +
            `const isGcProto=currentUrl.includes('github.com/gc-proto/');` +
            `if(isGcProto){` +
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
            // GitHub preview → GitHub edit (if NOT in my repo)
            `}else if(isGitHubPreview){` +
            `var i='index.html';if(currentUrl.includes('.html')){i=''};` +
            `if(currentUrl.includes('test.canada.ca')){` +
            `window.location.href=currentUrl.replace(/^https:\\/\\/test\\.canada\\.ca\\/(.*?)\\/(.*?)(\\/)?(\\.\\w+)?$/,'https://github.com/gc-proto/$1/blob/master/$2$4/'+i);` +
            `}else{` +
            `window.location.href=currentUrl.replace(/^https:\\/\\/(.*?)\\.github\\.io\\/(.*?)\\/(.*?)(\\/)?(\\.\\w+)?$/,'https://github.com/$1/$2/blob/main/$3$5/'+i);` +
            `}` +
            // Canada.ca → GitHub edit (assumes page exists in my repo)
            `}else if(isCanadaCa){` +
            `const path=currentUrl.replace(/^https:\\/\\/.*?canada\\.ca/,'');` +
            `window.location.href='https://github.com/'+owner+'/'+repo+'/blob/main'+path;` +
            // Fallback → root of my repo
            `}else{` +
            `window.location.href='https://github.com/'+owner+'/'+repo;` +
            `}` +
            `})();`;
        return this.sanitizer.bypassSecurityTrustUrl(js);
    });

}