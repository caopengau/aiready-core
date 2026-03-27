import { Octokit } from '@octokit/rest';
import sodium from 'libsodium-wrappers';
import {
  createManagedAccount,
  waitForAccountCreation,
  bootstrapManagedAccount,
  assumeSubAccountRole,
  findAvailableAccountInPool,
  assignAccountToOwner,
} from '../aws/vending';
import { createServerlessSCP, attachSCPToAccount } from '../aws/governance';
import {
  createManagedAccountRecord,
  ensureUserMetadata,
  updateProvisioningStatus,
} from '../db';

export interface ProvisioningOptions {
  userEmail: string;
  userName: string;
  githubToken: string;
  repoName: string;
  coEvolutionOptIn: boolean; // TRUE = Free Mutations, FALSE = $1.00 Tax
}

export class ProvisioningOrchestrator {
  private octokit: Octokit;

  constructor(githubToken: string, octokit?: Octokit) {
    this.octokit = octokit || new Octokit({ auth: githubToken });
  }

  /**
   * Performs the full one-click deployment using the "Warm Pool" strategy:
   * 1. Find/Create AWS Account
   * 2. Provision Private GitHub Repo in 'clawmost' org
   * 3. Inject AWS Secrets and Setup Mutation Tax Preference
   */
  public async provisionNode(options: ProvisioningOptions) {
    const { userEmail, userName, repoName, coEvolutionOptIn } = options;
    const githubOrg = 'clawmost';
    let accountId: string | null = null;

    try {
      console.log(
        `[Provision] Starting for ${userEmail} (Opt-in: ${coEvolutionOptIn})...`
      );

      // 1. AWS Account Management (Warm Pool Pattern)
      accountId = await findAvailableAccountInPool();

      if (accountId) {
        console.log(`[Provision] Found warm account ${accountId} in pool.`);
        await assignAccountToOwner(accountId, userEmail, repoName);
      } else {
        console.log(`[Provision] Pool empty. Creating new account...`);
        const requestId = await createManagedAccount(userEmail, userName);
        accountId = await waitForAccountCreation(requestId);
      }

      // Mark provisioning as in-progress
      await updateProvisioningStatus(accountId, 'provisioning');

      // 2. AWS Governance & Bootstrapping
      const scpId = await createServerlessSCP();
      await attachSCPToAccount(scpId, accountId);
      const bootstrapRoleArn = await bootstrapManagedAccount(accountId);

      // 3. GitHub Provisioning (Targeting 'clawmost' org)
      console.log(
        `[Provision] Provisioning private repo ${githubOrg}/${repoName}...`
      );
      const repoResponse = await this.octokit.repos.createUsingTemplate({
        template_owner: 'caopengau',
        template_repo: 'serverlessclaw',
        owner: githubOrg,
        name: repoName,
        private: true,
      });

      // 4. Secret Injection (Injecting bootstrapping credentials)
      console.log(`[Provision] Injecting AWS and Evolution secrets...`);
      const credentials = await assumeSubAccountRole(accountId);

      await this.injectSecret(
        githubOrg,
        repoName,
        'AWS_ACCESS_KEY_ID',
        credentials.accessKeyId
      );
      await this.injectSecret(
        githubOrg,
        repoName,
        'AWS_SECRET_ACCESS_KEY',
        credentials.secretAccessKey
      );
      await this.injectSecret(
        githubOrg,
        repoName,
        'AWS_ROLE_ARN',
        bootstrapRoleArn
      );
      await this.injectSecret(
        githubOrg,
        repoName,
        'EVOLUTION_OPT_IN',
        coEvolutionOptIn ? 'true' : 'false'
      );

      // 5. DynamoDB Persistence (Crucial for Dashboard and Billing)
      console.log(`[Provision] Recording managed account in DynamoDB...`);
      await createManagedAccountRecord({
        awsAccountId: accountId,
        ownerEmail: userEmail,
        repoName,
      });

      // Ensure user has metadata (for credits and global settings)
      await ensureUserMetadata(userEmail);

      // Mark provisioning as complete
      await updateProvisioningStatus(
        accountId,
        'complete',
        undefined,
        repoResponse.data.html_url
      );

      console.log(
        `[Provision] Node successfully vended under ${githubOrg} org!`
      );
      return {
        accountId,
        repoUrl: repoResponse.data.html_url,
        roleArn: bootstrapRoleArn,
        org: githubOrg,
      };
    } catch (err: any) {
      console.error(`[Provision] FAILED for ${userEmail}:`, err);
      if (accountId) {
        await updateProvisioningStatus(
          accountId,
          'failed',
          err.message || 'Unknown error'
        ).catch(console.error);
      }
      throw err;
    }
  }

  private async injectSecret(
    owner: string,
    repo: string,
    name: string,
    value: string
  ) {
    await sodium.ready;
    const { data: publicKey } = await this.octokit.actions.getRepoPublicKey({
      owner,
      repo,
    });

    const binKey = sodium.from_base64(
      publicKey.key,
      sodium.base64_variants.ORIGINAL
    );
    const binSec = sodium.from_string(value);
    const encBytes = sodium.crypto_box_seal(binSec, binKey);
    const encryptedValue = sodium.to_base64(
      encBytes,
      sodium.base64_variants.ORIGINAL
    );

    await this.octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: name,
      encrypted_value: encryptedValue,
      key_id: publicKey.key_id,
    });
  }
}
