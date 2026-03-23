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

    linkCheckerBookmarklet: SafeUrl = this.sanitizer.bypassSecurityTrustUrl(
        `javascript:(function(){if(document.getElementById('link-check-summary')){document.getElementById('link-check-summary').remove(); document.getElementById('link-check-results').remove(); document.querySelectorAll('a[data-link-checked]').forEach(a=>{a.style.backgroundColor=''; a.style.padding=''; a.style.display=''; a.removeAttribute('data-link-checked')}); return;} var i,c,x,h,q,l,m,statusChecks=[],totalLinks=0,unknownCount=0,errorCount=0,broken=[],preview=[],canadasite=[],empty=[],utm=[],wrongLang=[],unknown=[]; q=0; l=$("html").attr("lang"); if(l=="en"){m="canada.ca/|preview.adobecqms.net/|canadasite|null link|utm|/fr/|lang=fr"};if(l=="fr"){m="canada.ca/|preview.adobecqms.net/|canadasite|null link|utm|/en/|lang=en"}; const summary=document.createElement("div"); summary.id="link-check-summary"; summary.style.cssText="background:#f0f0f0;border:2px solid #333;padding:10px;margin-bottom:10px;font-weight:bold;"; const summaryInner=document.createElement("div"); summaryInner.className="container"; summary.appendChild(summaryInner); document.body.prepend(summary); const resultsContainer=document.createElement("div"); resultsContainer.id="link-check-results"; resultsContainer.className="container"; document.body.prepend(resultsContainer); async function checkLink(href,linkElem){if(!href||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return null; let fullUrl=href.startsWith('http')?href:new URL(href,window.location.href).href; let isSameOrigin=new URL(fullUrl).origin===window.location.origin; try{let resp=await fetch(fullUrl,{method:'HEAD',mode:'no-cors',cache:'no-cache',redirect:'follow'}); if(resp.type==='opaque'&&!isSameOrigin){unknownCount++; return'unknown'}; return resp.status}catch(e){if(!isSameOrigin){unknownCount++}; return isSameOrigin?404:'unknown'}}; function markLink(x,originalHref,color){x.setAttribute('data-link-checked','true'); x.title+=x.innerHTML; while(c=x.firstChild)x.removeChild(c); x.appendChild(document.createTextNode(originalHref)); x.style.backgroundColor=color; x.style.padding='2px 6px'; x.style.display='inline-block';}; function displayResults(){let html=''; if(errorCount>0||unknownCount>0){html+='<div class="alert alert-danger mt-4"><h2 class="h3">Link problems found</h2><p>The problems are listed below and highlighted in the content.</p><ul><li><span style="background:red;padding:2px 6px;">Red highlight</span> - 404\\'s (broken links)</li><li><span style="background:orange;padding:2px 6px;">Orange highlight</span> - 50X\\'s (blocked links)</li><li><span style="background:yellow;padding:2px 6px;">Yellow highlight</span> - pattern issues (hard-coded preview links, wrong language links, duplicate canadasite, empty links, or utm codes)</li><li><span style="background:cyan;padding:2px 6px;">Cyan highlight</span> - external links (unable to verify)</li></ul></div>'}; if(broken.length>0){html+='<h3>Broken links:</h3><ul>'; broken.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(preview.length>0){html+='<h3>Hard-coded preview links:</h3><ul>'; preview.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(canadasite.length>0){html+='<h3>Duplicate canadasite links:</h3><ul>'; canadasite.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(empty.length>0){html+='<h3>Empty links:</h3><ul>'; empty.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(utm.length>0){html+='<h3>UTM codes to remove:</h3><ul>'; utm.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(wrongLang.length>0){html+='<h3>Wrong language:</h3><ul>'; wrongLang.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(unknown.length>0){html+='<h3>External links (unable to verify):</h3><ul>'; unknown.forEach(url=>html+='<li>'+url+'</li>'); html+='</ul>'}; if(errorCount==0&&unknownCount==0){html='<div class="alert alert-success mt-4"><h2 class="h3">No problems found</h2><p>No broken links, hard-coded preview links, wrong language links, duplicate canadasite, empty links, or utm codes were detected on this page.</p></div>'}; resultsContainer.innerHTML=html}; var allLinks=[]; for(i=0;x=document.body.querySelector("#wb-bc")?.querySelectorAll("a")[i];++i){allLinks.push(x)}; for(i=0;x=document.body.querySelector("main")?.querySelectorAll("a")[i];++i){allLinks.push(x)}; totalLinks=allLinks.length; allLinks.forEach(x=>{h=x.getAttribute("href"); if(!h||h=="null link"){empty.push("null link"); markLink(x,"null link",'yellow'); errorCount++}else if(h.match(/preview.adobecqms.net/)){preview.push(h); markLink(x,h,'yellow'); errorCount++}else if(h.match(/canadasite/)){canadasite.push(h); markLink(x,h,'yellow'); errorCount++}else if(h.match(/utm/)){utm.push(h); markLink(x,h,'yellow'); errorCount++}else if((l=="en"&&h.match(/\\/fr\\/|lang=fr/))||(l=="fr"&&h.match(/\\/en\\/|lang=en/))){wrongLang.push(h); markLink(x,h,'yellow'); errorCount++}else{let originalUrl=h; statusChecks.push(checkLink(h,x).then(status=>{if(status===404){broken.push(originalUrl); markLink(x,originalUrl,'red'); errorCount++}else if(status>=400&&status<600){broken.push(originalUrl+' (Error '+status+')'); markLink(x,originalUrl,'orange'); errorCount++}else if(status==='unknown'){unknown.push(originalUrl); markLink(x,originalUrl,'cyan')}}))}});Promise.all(statusChecks).then(()=>{let cleanCount=totalLinks-errorCount-unknownCount; summaryInner.innerHTML="Checked "+totalLinks+" links: "+errorCount+" problems, "+unknownCount+" unknown, "+cleanCount+" ok"; displayResults();});})()`
    );

    // For group-specific tools
    myToolbox = this.settingsService.toolbox;
}
