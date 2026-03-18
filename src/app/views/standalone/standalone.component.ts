import { Component, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UserSettingsService } from '../../services/user-settings.service';
import { DevToolsComponent } from './components/dev-tools/dev-tools.component';


@Component({
    selector: 'aida-standalone',
    imports: [TranslateModule, RouterLink, DevToolsComponent],
    templateUrl: 'standalone.component.html',
    styles: ``
})
export class StandaloneComponent {
    private sanitizer = inject(DomSanitizer)
    private settingsService = inject(UserSettingsService);
    aidaBookmarklet: SafeUrl;

    constructor() {
        const origin = window.location.origin;
        const js = `javascript:(function(){` +
            `const url=encodeURIComponent(window.location.href);` +
            `const title=encodeURIComponent(document.title);` +
            `window.open('${origin}/import-page?org=CRA&url='+url+'&title='+title,'_blank');` +
            `})();`;

        this.aidaBookmarklet = this.sanitizer.bypassSecurityTrustUrl(js);
    }

    githubToggleBookmarklet: SafeUrl = this.sanitizer.bypassSecurityTrustUrl(
        `javascript:(function(){if(window.location.href.indexOf("github.com")>-1){window.location=window.location.toString().replace(/^https:\\/\\/github.com\\/(.*?)\\/(.*?)\\/(blob|tree|edit)\\/.*?\\/(.*?)(\\/)?(\\.\\w+)?$/,"https://$1.github.io/$2/$4$6");}else{var i = "index.html"; if(window.location.href.indexOf(".html")>-1){i = ""};window.location=window.location.toString().replace(/^https:\\/\\/(.*?).github.io\\/(.*?)\\/(.*?)(\\/)?(\\.\\w+)?$/,"https://github.com/$1/$2/tree/main/$3$5/"+i).replace(/^https:\\/\\/test.canada.ca\\/(.*?)\\/(.*?)(\\/)?(\\.\\w+)?$/,"https://github.com/gc-proto/$1/tree/master/$2$4/"+i);}})();`
    );

    // For group-specific tools
    myToolbox = this.settingsService.toolbox;
}
