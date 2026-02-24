import { Component, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
    selector: 'aida-dev-tools',
    imports: [TranslateModule, RouterLink],
    templateUrl: 'standalone.component.html',
    styles: ``
})
export class StandaloneComponent {
    private sanitizer = inject(DomSanitizer)
    bookmarklet: SafeUrl;

    constructor() {
        const origin = window.location.origin;
        const js = `javascript:(function(){` +
            `const url=encodeURIComponent(window.location.href);` +
            `const title=encodeURIComponent(document.title);` +
            `window.open('${origin}/import-page?org=CRA&url='+url+'&title='+title,'_blank');` +
            `})();`;

        this.bookmarklet = this.sanitizer.bypassSecurityTrustUrl(js);
    }
}
