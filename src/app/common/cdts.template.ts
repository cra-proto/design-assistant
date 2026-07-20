export const CDTS_TEMPLATE_ENG = `<!DOCTYPE html>
<html class="no-js" dir="ltr" lang="en" xmlns="https://www.w3.org/1999/xhtml">
    <head prefix="og: https://ogp.me/ns#">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta charset="utf-8">
        <!-- Web Experience Toolkit (WET) / Boîte à outils de l'expérience Web (BOEW) wet-boew.github.io/wet-boew/License-en.html / wet-boew.github.io/wet-boew/Licence-fr.html -->
        <title>{{TITLE}}</title>
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <link rel="schema.dcterms" href="https://purl.org/dc/terms/">
        <!-- Meta data -->
        <meta name="description" content="{{DESCRIPTION}}">
        <meta name="keywords" content="{{KEYWORDS}}">
        <meta name="author" content="Canada Revenue Agency">
        <meta name="dcterms.creator" content="Canada Revenue Agency">
        <meta name="robots" content="{{ROBOTS}}">
        <meta name="dcterms.language" title="ISO639-2/T" content="eng">
        <meta name="dcterms.audience" content="general public">
        <meta name="dcterms.spatial" content="Canada">
        <meta name="dcterms.type" content="service description">
        <meta name="dcterms.identifier" content="Canada_Revenue_Agency">
        <!-- Meta data -->
        <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css">
        <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2025-12-mille-iles.min.css">
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css">
        <!-- START of GitHub only testing banner CSS -->
        <link rel="stylesheet" href="https://cra-test-arc.canada.ca/core-prototype/source/css/testing-banner.css">
        <!-- END of GitHub only testing banner CSS -->
        {{STYLES}}
        <link href="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v5_0_4/wet-boew/assets/favicon.ico" rel="shortcut icon">
    </head>
    <body vocab="https://schema.org/" typeof="WebPage" resource="#wb-webpage">
        <noscript>
            <!-- Write closure fall-back static file -->
            <!-- /ROOT/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/static/refTop.html -->
            <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/refTop.html" -->
        </noscript>
        <!-- Load closure template scripts -->
        <!--<script src="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/compiled/soyutils.js"></script>-->
        <script src="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v5_0_4/cdts/compiled/wet-en.js"></script>
        <!-- START of GitHub only template section -->
        <data id="devoptions" data-loc-storage="gitCRATemplateDevOptions" value="true"></data>
        <data id="exitpage" data-exit-by-url="false" data-mod-link-file="{{DEPTH}}source/data/exclude-redirect-links.json" value="{{DEPTH}}source/exit-intent-e.html"></data>
        <data id="relextlnk" data-origin="https://www.canada.ca" value="false"></data>
        <div id="site-banner-inc" class="wb-disable-allow" data-ajax-replace="https://cra-test-arc.canada.ca/core-prototype/source/includes/site-banner-e.inc"></div>
        <!-- END of GitHub only template section -->
        <div id="def-top">
            <!-- Write closure fall-back static file -->
            <!-- /ROOT/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/static/top-en.html -->
            <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/top-en.html" -->
        </div>
        <!-- Write closure template -->
        <script>
            var defTop = document.getElementById("def-top");
            defTop.outerHTML = wet.builder.top({
                lngLinks: [{
                    lang: "fr", 
                    href: "{{FRENCH}}", 
                    text: "Français"
                }], 
                customSearch: [{
                    action: "https://www.canada.ca/en/revenue-agency/search.html", 
                    placeholder: "CRA", 
                    method: "get", 
                }], 
                auth: [{
                    type: "contextual", 
                    label: "sign in", 
                    labelExtended: "CRA sign in", 
                    link: "https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html"
                }], 
                breadcrumbs: [{{BREADCRUMBS}}]
            });
        </script>
        <!-- Write closure template -->
        <div class="container">
            <div class="row">
                <main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">
                    {{HEADER}}

                    {{CONTENT}}

                    <section class="pagedetails">
                        <h2 class="wb-inv">Page details</h2>
                        <div class="row">
                            <div class="col-sm-8 col-md-9 col-lg-9">
                                <div data-ajax-replace="https://www.canada.ca/etc/designs/canada/wet-boew/assets/feedback/page-feedback-en.html" class="wb-disable-allow" data-feedback-section="{{TITLE}}" data-feedback-theme="Taxes" data-feedback-institution="."></div>
                            </div>
                        </div>
                        <dl id="wb-dtmd">
                            <dt>Date modified:</dt>
                            <dd><time property="dateModified">{{MODIFIED}}</time></dd>
                        </dl>
                    </section>
                    <div id="def-preFooter">
                        <!-- Write closure fall-back static file -->
                        <!-- /ROOT/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/static/preFooter-en.html -->
                        <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/preFooter-en.html" -->
                    </div>
                </main>
            </div>
        </div>
        <!-- Write closure template -->
        <script>
            var defPreFooter = document.getElementById("def-preFooter");
            defPreFooter.outerHTML = wet.builder.preFooter({
                showShare: false, 
                pagedetails: false
            });
        </script>
        <div id="def-footer">
            <!-- Write closure fall-back static file -->
            <!-- /ROOT/app/cls/WET/gcweb/v4_0_43/cdts/static/footer-en.html -->
            <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/footer-en.html" -->
        </div>
        <!-- Write closure template -->
        <script>
            var defFooter = document.getElementById("def-footer");
            defFooter.outerHTML = wet.builder.footer({
                privacyLink: {
                    href: "https://www.canada.ca/en/revenue-agency/corporate/privacy-notice.html"
                }, 
                contextualFooter: {
                    title: "Canada Revenue Agency (CRA)", 
                    links: [{
                        text: "Contact the CRA", 
                        href: "https://www.canada.ca/en/revenue-agency/corporate/contact-information.html"
                    }, {
                        text: "Update your information", 
                        href: "https://www.canada.ca/en/revenue-agency/services/update-information-cra.html"
                    }, {
                        text: "About the CRA", 
                        href: "https://www.canada.ca/en/revenue-agency/corporate/about-canada-revenue-agency-cra.html"
                    }]
                }
            });
        </script>
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
        <script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/wet-boew.min.js"></script>
        <span id="wb-rsz" class="wb-init">&nbsp;</span>
        <script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/theme.min.js"></script>
        <script src="https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2025-12-mille-iles.min.js"></script>
        <script src="{{DEPTH}}source/scripts/external-link-detour.js"></script>
        {{SCRIPTS}}
    </body>
</html>`

export const CDTS_TEMPLATE_FRA = `<!DOCTYPE html>
<html class="no-js" dir="ltr" lang="fr" xmlns="https://www.w3.org/1999/xhtml">
    <head prefix="og: https://ogp.me/ns#">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta charset="utf-8">
        <!-- Web Experience Toolkit (WET) / Boîte à outils de l'expérience Web (BOEW) wet-boew.github.io/wet-boew/License-en.html / wet-boew.github.io/wet-boew/Licence-fr.html -->
        <title>{{TITLE}}</title>
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <link rel="schema.dcterms" href="https://purl.org/dc/terms/">
        <!-- Meta data -->
        <meta name="description" content="{{DESCRIPTION}}">
        <meta name="keywords" content="{{KEYWORDS}}">
        <meta name="author" content="Agence du revenu du Canada">
        <meta name="dcterms.creator" content="Agence du revenu du Canada">
        <meta name="robots" content="{{ROBOTS}}">
        <meta name="dcterms.language" title="ISO639-2/T" content="fra">
        <meta name="dcterms.audience" content="general public">
        <meta name="dcterms.spatial" content="Canada">
        <meta name="dcterms.type" content="service description">
        <meta name="dcterms.identifier" content="Agence_du_revenu_du_Canada">
        <!-- Meta data -->
        <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css">
        <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2025-12-mille-iles.min.css">
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css">
        <!-- START of GitHub only testing banner CSS -->
        <link rel="stylesheet" href="https://cra-test-arc.canada.ca/core-prototype/source/css/testing-banner.css">
        <!-- END of GitHub only testing banner CSS -->
        {{STYLES}}
        <link href="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v5_0_4/wet-boew/assets/favicon.ico" rel="shortcut icon">
    </head>
    <body vocab="https://schema.org/" typeof="WebPage" resource="#wb-webpage">
        <noscript>
            <!-- Write closure fall-back static file -->
            <!-- /ROOT/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/static/refTop.html -->
            <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/refTop.html" -->
        </noscript>
        <!-- Load closure template scripts -->
        <!--<script src="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/compiled/soyutils.js"></script>-->
        <script src="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v5_0_4/cdts/compiled/wet-fr.js"></script>
        <!-- START of GitHub only template section -->
        <data id="devoptions" data-loc-storage="gitCRATemplateDevOptions" value="true"></data>
        <data id="exitpage" data-exit-by-url="false" data-mod-link-file="{{DEPTH}}source/data/exclude-redirect-links.json" value="{{DEPTH}}source/exit-intent-f.html"></data>
        <data id="relextlnk" data-origin="https://www.canada.ca" value="false"></data>
        <div id="site-banner-inc" class="wb-disable-allow" data-ajax-replace="https://cra-test-arc.canada.ca/core-prototype/source/includes/site-banner-f.inc"></div>
        <!-- END of GitHub only template section -->
        <div id="def-top">
            <!-- Write closure fall-back static file -->
            <!-- /ROOT/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/static/top-fr.html -->
            <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/top-fr.html" -->
        </div>
        <!-- Write closure template -->
        <script>
            var defTop = document.getElementById("def-top");
            defTop.outerHTML = wet.builder.top({
                lngLinks: [{
                    lang: "en", 
                    href: "{{ENGLISH}}", 
                    text: "English"
                }], 
                customSearch: [{
                    action: "https://www.canada.ca/fr/agence-revenu/recherche.html", 
                    placeholder: "ARC", 
                    method: "get", 
                }], 
                auth: [{
                    type: "contextual", 
                    label: "Se connecter", 
                    labelExtended: "Se connecter à l'ARC", 
                    link: "https://www.canada.ca/fr/agence-revenu/services/services-electroniques/services-ouverture-session-arc.html"
                }], 
                breadcrumbs: [{{BREADCRUMBS}}]
            });
        </script>
        <!-- Write closure template -->
        <div class="container">
            <div class="row">
                <main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">
                    {{HEADER}}

                    {{CONTENT}}

                    <section class="pagedetails">
                        <h2 class="wb-inv">Détails de la page</h2>
                        <div class="row">
                            <div class="col-sm-8 col-md-9 col-lg-9">
                                <div data-ajax-replace="https://www.canada.ca/etc/designs/canada/wet-boew/assets/feedback/page-feedback-fr.html" class="wb-disable-allow" data-feedback-section="{{TITLE}}" data-feedback-theme="Taxes" data-feedback-institution="."></div>
                            </div>
                        </div>
                        <dl id="wb-dtmd">
                            <dt>Date de modification :</dt>
                            <dd><time property="dateModified">{{MODIFIED}}</time></dd>
                        </dl>
                    </section>
                    <div id="def-preFooter">
                        <!-- Write closure fall-back static file -->
                        <!-- /ROOT/etc/designs/canada/cdts/gcweb/v4_0_43/cdts/static/preFooter-fr.html -->
                        <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/preFooter-fr.html" -->
                    </div>
                </main>
            </div>
        </div>
        <!-- Write closure template -->
        <script>
            var defPreFooter = document.getElementById("def-preFooter");
            defPreFooter.outerHTML = wet.builder.preFooter({
                showShare: false, 
                pagedetails: false
            });
        </script>
        <div id="def-footer">
            <!-- Write closure fall-back static file -->
            <!-- /ROOT/app/cls/WET/gcweb/v4_0_43/cdts/static/footer-fr.html -->
            <!--#include virtual="/app/cls/WET/gcweb/v4_0_43/cdts/static/footer-fr.html" -->
        </div>
        <!-- Write closure template -->
        <script>
            var defFooter = document.getElementById("def-footer");
            defFooter.outerHTML = wet.builder.footer({
                privacyLink: {
                    href: "https://www.canada.ca/fr/agence-revenu/organisation/avis-confidentialite.html"
                }, 
                contextualFooter: {
                    title: "Agence du revenu du Canada (ARC)", 
                    links: [{
                        text: "Contacter l'ARC", 
                        href: "https://www.canada.ca/fr/agence-revenu/organisation/coordonnees.html"
                    }, {
                        text: "Mettre à jour vos renseignements", 
                        href: "https://www.canada.ca/fr/agence-revenu/services/mettre-a-jour-renseignements-arc.html"
                    }, {
                        text: "À propos de l'ARC", 
                        href: "https://www.canada.ca/fr/agence-revenu/organisation/a-propos-agence-revenu-canada-arc.html"
                    }]
                }
            });
        </script>
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
        <script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/wet-boew.min.js"></script>
        <span id="wb-rsz" class="wb-init">&nbsp;</span>
        <script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/theme.min.js"></script>
        <script src="https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2025-12-mille-iles.min.js"></script>
        <script src="{{DEPTH}}source/scripts/external-link-detour.js"></script>
        {{SCRIPTS}}
    </body>
</html>`

export const EXIT_PAGE_TEMPLATE_ENG = `<!DOCTYPE html>
<html class="no-js" lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<title>The page you have requested is outside this CRA testing environment - Canada.ca</title>
<meta content="width=device-width, initial-scale=1" name="viewport">
<meta name="dcterms.language" content="eng">
<meta name="robots" content="noindex, nofollow">
<link rel="shortcut icon" href="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v5_0_4/wet-boew/assets/favicon.ico" >
<link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css">
<link rel="stylesheet" href="https://cra-test-arc.canada.ca/core-prototype/source/css/testing-banner.css">
</head>
<body vocab="http://schema.org/" typeof="WebPage">
<nav><ul id="wb-tphp">
    <li class="wb-slc"><a class="wb-sl" href="#wb-cont">Skip to main content</a></li>
</ul></nav>
<data id="devoptions" data-loc-storage="gitCRATemplateDevOptions" value="false"></data>
<data id="exitpage" data-exit-by-url="false" data-mod-link-file="{{DEPTH}}source/data/exclude-redirect-links.json" value="{{DEPTH}}source/exit-intent-e.html"></data>
<data id="relextlnk" data-origin="https://www.canada.ca" value="false"></data>
<header>
    <div id="wb-bnr" class="container"><div class="row">
        <div class="brand col-xs-9 col-sm-5 col-md-4" property="publisher" typeof="GovernmentOrganization">
            <a href="https://www.canada.ca/en.html" property="url">
                <img src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/sig-blk-en.svg" alt="Government of Canada" property="logo">
            </a>
        </div>
    </div></div>
</header>
<main class="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
    <h1 property="name" id="wb-cont">The page you have requested is outside this CRA testing environment</h1>
    <p>Please press the back button to return to the previous page.</p>
    <ul class="list-inline">
        <li><button id="back" class="btn btn-call-to-action btn-lg" type="button">Go Back!</button></li>
        <li id="exitLink" class="hidden"><button id="leavesitelnk" class="btn btn-link btn-lg" type="button">Leave the test site</button></li>
        <li id="exitWETLink" class="hidden"><span class="wb-exitscript wb-exitscript-urlparam"></span></li>
    </ul>
    <section class="pagedetails">
        <h2 class="wb-inv">Page details</h2>
        <dl id="wb-dtmd"><dt>Date modified:&#160;</dt><dd><time property="dateModified">{{MODIFIED}}</time></dd></dl>
    </section>
</main>
<footer id="wb-info">
    <div class="gc-sub-footer"><div class="container d-flex align-items-center">
        <nav><ul>
            <li><a href="https://www.canada.ca/en/transparency/terms.html">Terms and conditions</a></li>
            <li><a href="https://www.canada.ca/en/revenue-agency/corporate/privacy-notice.html">Privacy</a></li>
        </ul></nav>
        <div class="wtrmrk align-self-end">
            <img src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/wmms-blk.svg" alt="Symbol of the Government of Canada">
        </div>
    </div></div>
</footer>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js" integrity="sha384-rY/jv8mMhqDabXSo+UCggqKtdmBfd3qC2/KvyTDNQ6PcUJXaxK1tMepoQda4g5vB" crossorigin="anonymous"></script>
<script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/wet-boew.min.js"></script>
<script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/theme.min.js"></script>
<script src="{{DEPTH}}source/scripts/external-link-detour.js"></script>
<script src="https://cra-test-arc.canada.ca/core-prototype/source/scripts/exit-page.js"></script>
</body>
</html>`;

export const EXIT_PAGE_TEMPLATE_FRA = `<!DOCTYPE html>
<html class="no-js" lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<title>La page que vous avez demandée est à l'extérieur de cet environnement de test de l'ARC - Canada.ca</title>
<meta content="width=device-width, initial-scale=1" name="viewport">
<meta name="dcterms.language" content="fra">
<meta name="robots" content="noindex, nofollow">
<link rel="shortcut icon" href="https://www.canada.ca/etc/designs/canada/cdts/gcweb/v5_0_4/wet-boew/assets/favicon.ico">
<link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css">
<link rel="stylesheet" href="https://cra-test-arc.canada.ca/core-prototype/source/css/testing-banner.css">
</head>
<body vocab="http://schema.org/" typeof="WebPage">
<nav><ul id="wb-tphp">
    <li class="wb-slc"><a class="wb-sl" href="#wb-cont">Passer au contenu principal</a></li>
</ul></nav>
<data id="devoptions" data-loc-storage="gitCRATemplateDevOptions" value="false"></data>
<data id="exitpage" data-exit-by-url="false" data-mod-link-file="{{DEPTH}}source/data/exclude-redirect-links.json" value="{{DEPTH}}source/exit-intent-f.html"></data>
<data id="relextlnk" data-origin="https://www.canada.ca" value="false"></data>
<header>
    <div id="wb-bnr" class="container"><div class="row">
        <div class="brand col-xs-9 col-sm-5 col-md-4" property="publisher" typeof="GovernmentOrganization">
            <a href="https://www.canada.ca/fr.html" property="url">
                <img src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/sig-blk-fr.svg" alt="Gouvernement du Canada" property="logo">
            </a>
        </div>
    </div></div>
</header>
<main class="container" property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
    <h1 property="name" id="wb-cont">La page que vous avez demandée est à l'extérieur de cet environnement de test de l'ARC</h1>
    <p>Veuillez appuyer sur le bouton de retour pour revenir à la page précédente.</p>
    <ul class="list-inline">
        <li><button id="back" class="btn btn-call-to-action btn-lg" type="button">Retour!</button></li>
        <li id="exitLink" class="hidden"><button id="leavesitelnk" class="btn btn-link btn-lg" type="button">Quitter le site de test</button></li>
        <li id="exitWETLink" class="hidden"><span class="wb-exitscript wb-exitscript-urlparam"></span></li>
    </ul>
    <section class="pagedetails">
        <h2 class="wb-inv">Détails de la page</h2>
        <dl id="wb-dtmd"><dt>Date de modification&#160;:&#160;</dt><dd><time property="dateModified">{{MODIFIED}}</time></dd></dl>
    </section>
</main>
<footer id="wb-info">
    <div class="gc-sub-footer"><div class="container d-flex align-items-center">
        <nav><ul>
            <li><a href="https://www.canada.ca/fr/transparence/avis.html">Avis</a></li>
            <li><a href="https://www.canada.ca/fr/agence-revenu/organisation/avis-confidentialite.html">Confidentialité</a></li>
        </ul></nav>
        <div class="wtrmrk align-self-end">
            <img src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/wmms-blk.svg" alt="Symbole du gouvernement du Canada">
        </div>
    </div></div>
</footer>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js" integrity="sha384-rY/jv8mMhqDabXSo+UCggqKtdmBfd3qC2/KvyTDNQ6PcUJXaxK1tMepoQda4g5vB" crossorigin="anonymous"></script>
<script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/wet-boew.min.js"></script>
<script src="https://www.canada.ca/etc/designs/canada/wet-boew/js/theme.min.js"></script>
<script src="{{DEPTH}}source/scripts/external-link-detour.js"></script>
<script src="https://cra-test-arc.canada.ca/core-prototype/source/scripts/exit-page.js"></script>
</body>
</html>`;

// Based on: https://cra-test-arc.canada.ca/core-prototype/source/scripts/external-link-detour.js
// Adapted for local prototype use
export const LINK_DETOUR_JS = `
"use strict";

(function () {
  var exitPage = document.getElementById("exitpage");
  var relExternalLnk = document.getElementById("relextlnk");
  var redirectMap = [];

  if (!exitPage) return;

  function findRedirect(originUrl) {
    return redirectMap.find(function (entry) {
      return entry.origin && entry.origin.toLowerCase() === originUrl.toLowerCase();
    });
  }

  // protocol + hostname + pathname only (no query/hash), for matching against the JSON file
  function originOf(rawUrl) {
    var a = document.createElement("a");
    a.href = rawUrl;
    return a.protocol + "//" + a.hostname + a.pathname;
  }

  function updateLink(el, attr) {
    var raw = el.getAttribute(attr);
    if (!raw || el.dataset.exit === "false" || el.classList.contains("wb-exitscript")) return;

    var isAbsolute = /^https?:\\/\\//i.test(raw);
    var relativeEnabled = relExternalLnk && relExternalLnk.value.toLowerCase() === "true";
    var isRootRelative = raw.charAt(0) === "/";

    if (!isAbsolute && !(isRootRelative && relativeEnabled)) return; // leave internal prototype links alone

    var lookupUrl = isRootRelative && relExternalLnk.dataset.origin
      ? originOf(relExternalLnk.dataset.origin + raw)
      : originOf(raw);

    var match = findRedirect(lookupUrl);
    var destination;

    if (match && match.destination) {
      var queryHash = raw.substring(match.origin.length);
      destination = match.destination + queryHash;
    } else {
      destination = exitPage.value + "?uri=" + encodeURIComponent(
        isRootRelative ? relExternalLnk.dataset.origin + raw : raw
      );
    }

    el.setAttribute(attr, destination);
  }

  function processLinks(root) {
    root.querySelectorAll("a[href], area[href]").forEach(function (el) { updateLink(el, "href"); });
    root.querySelectorAll("form[action]").forEach(function (el) { updateLink(el, "action"); });
    root.querySelectorAll("[formaction]").forEach(function (el) { updateLink(el, "formaction"); });
  }

  function init() {
    processLinks(document);

    // Re-process links inserted by AJAX content replacement (site-banner, includes, etc.)
    $(document).on("wb-contentupdated", "[data-ajax-after], [data-ajax-append], [data-ajax-before], [data-ajax-prepend], [data-ajax-replace]", function () {
      processLinks(this);
    });
  }

  if (exitPage.dataset.modLinkFile) {
    $.getJSON(exitPage.dataset.modLinkFile).done(function (data) {
      redirectMap = data || [];
    }).always(init);
  } else {
    init();
  }
})();
`;