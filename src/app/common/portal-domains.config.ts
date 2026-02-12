// Portal domains extracted from Canada.ca allowlist/blocklist script
// Last updated: 2026-02-11
// Total portal domains: 49

export const PORTAL_DOMAINS: string[] = [
    //PROD
    "ams-sga.cra-arc.gc.ca",
    "ams-sga-cra-arc.fjgc-gccf.gc.ca",
    "apps.cra-arc.gc.ca",
    "apps.ams-sga.cra-arc.gc.ca",
    "apps1.ams-sga.cra-arc.gc.ca",
    "apps2.ams-sga.cra-arc.gc.ca",
    "apps3.ams-sga.cra-arc.gc.ca",
    "apps4.ams-sga.cra-arc.gc.ca",
    "apps5.ams-sga.cra-arc.gc.ca",
    "apps6.ams-sga.cra-arc.gc.ca",
    "apps7.ams-sga.cra-arc.gc.ca",
    "apps8.ams-sga.cra-arc.gc.ca",
    "benefitsfinder.services.gc.ca",
    "careers-carrieres.cra-arc.gc.ca",
    "cms-sgj.cra-arc.gc.ca",
    "covid-benefits.alpha.canada.ca",
    "cra-arc-survey-sondage.ca",
    "itools-ioutils.fcac-acfc.gc.ca",
    "live.webcastcanada.ca",
    "services.securekeyconcierge.com",
    "www.cra-arc.gc.ca/cgi-bin/",
    "www.cra-engage-arc.ca",
    "www.paysimply.ca",
    //STAGING
    "ams-sga-si.cra-arc.gc.ca",
    "ams-sga-si2.cra-arc.gc.ca",
    "ams-sga-ua.cra-arc.gc.ca",
    "ams-sga-ua2.cra-arc.gc.ca",
    "apps-ef.isvcs.net",
    "apps-ot.cra-arc.gc.ca",
    "apps-ot.isvcs.net",
    "apps-si.isvcs.net",
    "apps-si2.isvcs.net",
    "apps-ua.cra-arc.gc.ca",
    "apps-ua.isvcs.net",
    "apps-ua2.cra-arc.gc.ca",
    "apps-ua2.isvcs.net",
    "apps-ut.cra-arc.gc.ca",
    "apps-ut.isvcs.net",
    "apps-ut2.cra-arc.gc.ca",
    "apps-ut2.isvcs.net",
    "apps1.ams-sga-ot.cra-arc.gc.ca",
    "apps1.ams-sga-ot2.cra-arc.gc.ca",
    "apps2.ams-sga-ot.cra-arc.gc.ca",
    "apps2.ams-sga-ot2.cra-arc.gc.ca",
    "apps3.ams-sga-ot.cra-arc.gc.ca",
    "apps3.ams-sga-ot2.cra-arc.gc.ca",
    "apps4.ams-sga-ot.cra-arc.gc.ca",
    "apps4.ams-sga-ot2.cra-arc.gc.ca",
    "apps5.ams-sga-ot.cra-arc.gc.ca",
    "apps5.ams-sga-ot2.cra-arc.gc.ca",
    "apps6.ams-sga-ot.cra-arc.gc.ca",
    "apps6.ams-sga-ot2.cra-arc.gc.ca",
    "apps7.ams-sga-ot.cra-arc.gc.ca",
    "apps7.ams-sga-ot2.cra-arc.gc.ca",
    "apps8.ams-sga-ot.cra-arc.gc.ca",
    "apps8.ams-sga-ot2.cra-arc.gc.ca",
    "cms-sgj-ot.cra-arc.gc.ca",
    "cms-sgj-ot2.cra-arc.gc.ca",
    "cms-sgj-si.cra-arc.gc.ca",
    "cms-sgj-si2.cra-arc.gc.ca",
    "cms-sgj-ua.cra-arc.gc.ca",
    "cms-sgj-ua2.cra-arc.gc.ca",
    "cp-ea.isvcs.net",
    "cp-ef.isvcs.net",
    "cp-ut.isvcs.net",
    "cp-ut2.isvcs.net",
    "rp-ea.isvcs.net",
    "rp-ef.isvcs.net",
    "rp-ut.isvcs.net",
    "rp-ut.isvcs.net/gol-ged/mima/ngbeta/#/bus/",
    "rp-ut2.isvcs.net",
    "rp-ut4.isvcs.net"
];

// Check if a URL points to a portal domain
export function isPortalDomain(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return PORTAL_DOMAINS.some(portal =>
            urlObj.hostname === portal ||
            urlObj.hostname.endsWith('.' + portal)
        );
    } catch {
        return false;
    }
}
