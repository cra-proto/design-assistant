export const environment = { // Same infrastructure as development, only difference is sandbox flag
    production: false,
    sandbox: true,
    version: '0.4.1', //major.minor.patch
    apiGateway: 'https://nappswkoie.execute-api.ca-central-1.amazonaws.com/dev',
    dynamodbFunctionUrl: 'https://chi2rsccsm5tsbq3dzqez735gu0pxnlj.lambda-url.ca-central-1.on.aws/',
    airtableFunctionUrl: 'https://i7vbe2ntgsh26rvibknsi4zuia0rmpyn.lambda-url.ca-central-1.on.aws/',
    defaultOrg: 'cra-proto',
    templateOrg: 'proto-cra', //for accessing core-prototype
};
