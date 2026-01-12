export const environment = {
    production: true,
    version: '0.1.0', //major.minor.patch
    apiGateway: 'https://k5x2fnpa93.execute-api.ca-central-1.amazonaws.com/production',
    dynamodbFunctionUrl: 'https://YOUR-FUNCTION-URL.lambda-url.ca-central-1.on.aws/',
    airtableFunctionUrl: 'https://YOUR-FUNCTION-URL.lambda-url.ca-central-1.on.aws/',
    defaultOrg: 'proto-cra',
    templateOrg: 'proto-cra', //for accessing core-prototype
};