/**
 * Shared AWS Infrastructure Constants
 */
export const AWS_CONSTANTS = {
  REGIONS: {
    DEFAULT: 'ap-southeast-2',
  },
  IAM: {
    ROLES: {
      ORG_ACCESS: 'OrganizationAccountAccessRole',
      GITHUB_ACTIONS: 'ClawMore-GitHub-Actions-Role',
    },
    POLICIES: {
      VERSION: '2012-10-17',
      DEPLOY_NAME: 'ClawMore-Serverless-Deploy-Policy',
    },
    ACTIONS: {
      ASSUME_ROLE: 'sts:AssumeRole',
      ASSUME_ROLE_WEB: 'sts:AssumeRoleWithWebIdentity',
      GET_CALLER_IDENTITY: 'sts:GetCallerIdentity',
    },
  },
  OIDC: {
    GITHUB_URL: 'https://token.actions.githubusercontent.com',
    GITHUB_PROVIDER: 'token.actions.githubusercontent.com',
    AUDIENCE: 'sts.amazonaws.com',
    THUMBPRINTS: [
      '6938fd4d98bab03faadb97b34396831e3780aea1',
      '1c58a3a8518e8759bf075b76b750d4f2df264fcd',
    ],
  },
} as const;

export type AwsRegion = typeof AWS_CONSTANTS.REGIONS.DEFAULT;
