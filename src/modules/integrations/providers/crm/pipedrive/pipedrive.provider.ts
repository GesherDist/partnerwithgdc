/**
 * Pipedrive CRM Provider
 *
 * Implementation of ICrmProvider for Pipedrive.
 */

import { encrypt, decrypt } from '@/modules/integrations/core/lib/encryption';
import {
  getIntegrationByProvider,
  getConnectionByIntegrationId,
  upsertConnection,
  updateConnectionTokens,
  updateConnectionStatus,
  hardDeleteConnection,
} from '@/modules/integrations/core/repositories';
import type {
  ProviderMetadata,
  ICrmProvider,
  OAuthInitiation,
  OAuthCallbackParams,
  IntegrationConnectionRow,
  ConnectionStatusResponse,
  SyncResult,
  SyncOptions,
  CrmContact,
  CrmOrganization,
  CrmDeal,
  CrmActivity,
  CrmNote,
  CrmPipeline,
  ContactSyncResult,
  OrganizationSyncResult,
  DealSyncResult,
} from '@/modules/integrations/core';
import {
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchUserInfo,
  revokeToken,
  calculateTokenExpiry,
} from './oauth';
import {
  PIPEDRIVE_SCOPES,
  PIPEDRIVE_ERRORS,
  PIPEDRIVE_DEFAULT_PAGE_SIZE,
} from './constants';
import type {
  PipedriveConnectionMetadata,
  PipedrivePerson,
  PipedriveOrganization,
  PipedriveDeal,
  PipedriveLead,
  PipedriveActivity,
  PipedriveNote,
  PipedrivePipeline,
  PipedriveStage,
  PipedriveApiResponse,
} from './types';

// ============================================
// PROVIDER METADATA
// ============================================

const PIPEDRIVE_METADATA: ProviderMetadata = {
  provider: 'pipedrive',
  type: 'crm',
  name: 'Pipedrive',
  description: 'Sync deals, contacts, and activities with Pipedrive CRM',
  iconUrl: '/icons/pipedrive.svg',
  documentationUrl: 'https://developers.pipedrive.com/docs/api/v1',
  scopes: [...PIPEDRIVE_SCOPES],
  supportedEntities: ['contacts', 'organizations', 'deals', 'activities', 'notes', 'pipelines'],
};

// ============================================
// PIPEDRIVE PROVIDER CLASS
// ============================================

export class PipedriveProvider implements ICrmProvider {
  readonly metadata: ProviderMetadata = PIPEDRIVE_METADATA;

  private integrationId: string | null = null;

  // ============================================
  // INITIALIZATION
  // ============================================

  private async getIntegrationId(): Promise<string> {
    if (this.integrationId) {
      return this.integrationId;
    }

    const integration = await getIntegrationByProvider('pipedrive');
    if (!integration) {
      throw new Error('Pipedrive integration not found in database');
    }

    this.integrationId = integration.id;
    return this.integrationId;
  }

  // ============================================
  // OAUTH FLOW
  // ============================================

  initiateOAuth(): OAuthInitiation {
    const state = generateState();
    const authorizationUrl = buildAuthorizationUrl(state);

    return { state, authorizationUrl };
  }

  async handleOAuthCallback(
    params: OAuthCallbackParams,
    userId?: string
  ): Promise<IntegrationConnectionRow> {
    const { code } = params;

    if (!code) {
      throw new Error('Missing code in OAuth callback');
    }

    const integrationId = await this.getIntegrationId();

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Fetch user info
    const userInfo = await fetchUserInfo(tokenResponse.access_token, tokenResponse.api_domain);

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokenResponse.access_token);
    const refreshTokenEncrypted = encrypt(tokenResponse.refresh_token);

    // Calculate expiration
    const tokenExpiresAt = calculateTokenExpiry(tokenResponse.expires_in);

    // Build metadata
    const metadata: PipedriveConnectionMetadata = {
      apiDomain: tokenResponse.api_domain,
      companyId: userInfo.company_id,
      companyName: userInfo.company_name,
      companyDomain: userInfo.company_domain,
      userId: userInfo.id,
      userName: userInfo.name,
    };

    // Store connection
    const connection = await upsertConnection({
      integration_id: integrationId,
      external_account_id: userInfo.company_id?.toString(),
      external_account_name: userInfo.company_name,
      access_token: accessTokenEncrypted,
      refresh_token: refreshTokenEncrypted,
      token_expires_at: tokenExpiresAt,
      environment: 'production',
      metadata,
      status: 'connected',
      connected_by: userId,
    });

    return connection;
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);

    if (!connection) {
      return;
    }

    // Try to revoke token (best effort)
    if (connection.refresh_token) {
      try {
        const refreshToken = decrypt(connection.refresh_token);
        await revokeToken(refreshToken);
      } catch (error) {
        console.warn('Token revocation failed, continuing with disconnect:', error);
      }
    }

    await hardDeleteConnection(connectionId);
  }

  async getConnectionStatus(connectionId?: string): Promise<ConnectionStatusResponse> {
    const connection = connectionId
      ? await this.getConnection(connectionId)
      : await this.getCurrentConnection();

    if (!connection) {
      return {
        connected: false,
        provider: 'pipedrive',
      };
    }

    const metadata = connection.metadata as PipedriveConnectionMetadata;

    return {
      connected: connection.status === 'connected',
      provider: 'pipedrive',
      accountId: connection.external_account_id ?? undefined,
      accountName: connection.external_account_name ?? undefined,
      environment: metadata?.companyDomain,
      connectedAt: connection.connected_at ?? undefined,
      tokenExpiresAt: connection.token_expires_at ?? undefined,
      status: connection.status,
      errorMessage: connection.error_message ?? undefined,
      lastSyncAt: connection.last_sync_at ?? undefined,
    };
  }

  async isConnected(connectionId?: string): Promise<boolean> {
    const status = await this.getConnectionStatus(connectionId);
    return status.connected;
  }

  async refreshTokenIfNeeded(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);

    if (!connection || !connection.token_expires_at || !connection.refresh_token) {
      return;
    }

    const expiresAt = new Date(connection.token_expires_at);
    const buffer = 5 * 60 * 1000;
    const now = new Date();

    if (expiresAt.getTime() - now.getTime() > buffer) {
      return;
    }

    try {
      const refreshToken = decrypt(connection.refresh_token);
      const tokenResponse = await refreshAccessToken(refreshToken);

      const accessTokenEncrypted = encrypt(tokenResponse.access_token);
      const refreshTokenEncrypted = encrypt(tokenResponse.refresh_token);
      const tokenExpiresAt = calculateTokenExpiry(tokenResponse.expires_in);

      await updateConnectionTokens(
        connectionId,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt
      );
    } catch (error) {
      console.error('Token refresh failed:', error);
      await updateConnectionStatus(connectionId, 'error', 'Token refresh failed');
      throw error;
    }
  }

  async getAccessToken(
    connectionId: string
  ): Promise<{ accessToken: string; externalAccountId: string; environment: string } | null> {
    const connection = await this.getConnection(connectionId);

    if (!connection || connection.status !== 'connected' || !connection.access_token) {
      return null;
    }

    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      if (expiresAt <= new Date()) {
        await this.refreshTokenIfNeeded(connectionId);
        const updatedConnection = await this.getConnection(connectionId);
        if (!updatedConnection?.access_token) {
          return null;
        }

        const metadata = updatedConnection.metadata as PipedriveConnectionMetadata;
        return {
          accessToken: decrypt(updatedConnection.access_token),
          externalAccountId: updatedConnection.external_account_id ?? '',
          environment: metadata?.apiDomain ?? '',
        };
      }
    }

    const metadata = connection.metadata as PipedriveConnectionMetadata;
    return {
      accessToken: decrypt(connection.access_token),
      externalAccountId: connection.external_account_id ?? '',
      environment: metadata?.apiDomain ?? '',
    };
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  async sync(connectionId: string, options?: SyncOptions): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const entityTypes = options?.entityTypes || ['contacts', 'organizations', 'deals'];

    for (const entityType of entityTypes) {
      try {
        let result: SyncResult;

        switch (entityType) {
          case 'contacts':
            const contacts = await this.getContacts(connectionId, {
              sinceDate: options?.sinceDate,
            });
            result = {
              success: true,
              entityType: 'contacts',
              direction: 'inbound',
              recordsProcessed: contacts.length,
            };
            break;

          case 'organizations':
            const orgs = await this.getOrganizations(connectionId, {
              sinceDate: options?.sinceDate,
            });
            result = {
              success: true,
              entityType: 'organizations',
              direction: 'inbound',
              recordsProcessed: orgs.length,
            };
            break;

          case 'deals':
            const deals = await this.getDeals(connectionId, {
              sinceDate: options?.sinceDate,
            });
            result = {
              success: true,
              entityType: 'deals',
              direction: 'inbound',
              recordsProcessed: deals.length,
            };
            break;

          default:
            continue;
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          entityType,
          direction: 'inbound',
          errors: [
            {
              code: 'SYNC_FAILED',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
        });
      }
    }

    return results;
  }

  async getSyncHistory(_connectionId: string, _limit?: number): Promise<unknown[]> {
    return [];
  }

  // ============================================
  // CONTACTS
  // ============================================

  async getContacts(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<CrmContact[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const params = new URLSearchParams({
      limit: String(options?.limit || PIPEDRIVE_DEFAULT_PAGE_SIZE),
      start: String(options?.offset || 0),
    });

    if (options?.sinceDate) {
      params.set('since', options.sinceDate.toISOString());
    }

    const response = await this.apiRequest<PipedrivePerson[]>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `persons?${params.toString()}`
    );

    return (response.data || []).map(this.mapPipedriveContact);
  }

  async getContact(connectionId: string, externalId: string): Promise<CrmContact | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    try {
      const response = await this.apiRequest<PipedrivePerson>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        `persons/${externalId}`
      );

      if (!response.data) {return null;}
      return this.mapPipedriveContact(response.data);
    } catch {
      return null;
    }
  }

  async createContact(connectionId: string, contact: CrmContact): Promise<CrmContact> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveContact: Partial<PipedrivePerson> = {
      name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unknown',
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email ? [{ value: contact.email, primary: true }] : undefined,
      phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined,
      org_id: contact.organizationExternalId ? parseInt(contact.organizationExternalId) : undefined,
    };

    const response = await this.apiRequest<PipedrivePerson>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      'persons',
      'POST',
      pipedriveContact
    );

    return this.mapPipedriveContact(response.data);
  }

  async updateContact(
    connectionId: string,
    externalId: string,
    contact: Partial<CrmContact>
  ): Promise<CrmContact> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveContact: Partial<PipedrivePerson> = {};
    if (contact.firstName || contact.lastName) {
      pipedriveContact.name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    }
    if (contact.email) {
      pipedriveContact.email = [{ value: contact.email, primary: true }];
    }
    if (contact.phone) {
      pipedriveContact.phone = [{ value: contact.phone, primary: true }];
    }

    const response = await this.apiRequest<PipedrivePerson>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `persons/${externalId}`,
      'PUT',
      pipedriveContact
    );

    return this.mapPipedriveContact(response.data);
  }

  async deleteContact(connectionId: string, externalId: string): Promise<void> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    await this.apiRequest(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `persons/${externalId}`,
      'DELETE'
    );
  }

  async syncContacts(connectionId: string, contacts: CrmContact[]): Promise<ContactSyncResult> {
    const result: ContactSyncResult = { created: [], updated: [], failed: [] };

    for (const contact of contacts) {
      try {
        if (contact.externalId) {
          const updated = await this.updateContact(connectionId, contact.externalId, contact);
          result.updated.push(updated);
        } else {
          const created = await this.createContact(connectionId, contact);
          result.created.push(created);
        }
      } catch (error) {
        result.failed.push({
          contact,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  // ============================================
  // ORGANIZATIONS
  // ============================================

  async getOrganizations(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<CrmOrganization[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const params = new URLSearchParams({
      limit: String(options?.limit || PIPEDRIVE_DEFAULT_PAGE_SIZE),
      start: String(options?.offset || 0),
    });

    const response = await this.apiRequest<PipedriveOrganization[]>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `organizations?${params.toString()}`
    );

    return (response.data || []).map(this.mapPipedriveOrganization);
  }

  async getOrganization(connectionId: string, externalId: string): Promise<CrmOrganization | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    try {
      const response = await this.apiRequest<PipedriveOrganization>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        `organizations/${externalId}`
      );

      if (!response.data) {return null;}
      return this.mapPipedriveOrganization(response.data);
    } catch {
      return null;
    }
  }

  async createOrganization(connectionId: string, organization: CrmOrganization): Promise<CrmOrganization> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveOrg: Partial<PipedriveOrganization> = {
      name: organization.name,
    };

    // Map address fields separately for proper Pipedrive format
    if (organization.address) {
      // Build full address string for display
      const addressParts: string[] = [];
      if (organization.address.street) {
        addressParts.push(organization.address.street);
        pipedriveOrg.address_route = organization.address.street;
      }
      if (organization.address.city) {
        addressParts.push(organization.address.city);
        pipedriveOrg.address_locality = organization.address.city;
      }
      if (organization.address.state) {
        addressParts.push(organization.address.state);
        pipedriveOrg.address_admin_area_level_1 = organization.address.state;
      }
      if (organization.address.postalCode) {
        addressParts.push(organization.address.postalCode);
        pipedriveOrg.address_postal_code = organization.address.postalCode;
      }
      if (organization.address.country) {
        addressParts.push(organization.address.country);
        pipedriveOrg.address_country = organization.address.country;
      }

      // Set the main address field with full address
      if (addressParts.length > 0) {
        pipedriveOrg.address = addressParts.join(', ');
      }
    }

    const response = await this.apiRequest<PipedriveOrganization>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      'organizations',
      'POST',
      pipedriveOrg
    );

    return this.mapPipedriveOrganization(response.data);
  }

  async updateOrganization(
    connectionId: string,
    externalId: string,
    organization: Partial<CrmOrganization>
  ): Promise<CrmOrganization> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveOrg: Partial<PipedriveOrganization> = {};
    if (organization.name) {pipedriveOrg.name = organization.name;}

    // Map address fields separately for proper Pipedrive format
    if (organization.address) {
      // Build full address string for display
      const addressParts: string[] = [];
      if (organization.address.street) {
        addressParts.push(organization.address.street);
        pipedriveOrg.address_route = organization.address.street;
      }
      if (organization.address.city) {
        addressParts.push(organization.address.city);
        pipedriveOrg.address_locality = organization.address.city;
      }
      if (organization.address.state) {
        addressParts.push(organization.address.state);
        pipedriveOrg.address_admin_area_level_1 = organization.address.state;
      }
      if (organization.address.postalCode) {
        addressParts.push(organization.address.postalCode);
        pipedriveOrg.address_postal_code = organization.address.postalCode;
      }
      if (organization.address.country) {
        addressParts.push(organization.address.country);
        pipedriveOrg.address_country = organization.address.country;
      }

      // Set the main address field with full address
      if (addressParts.length > 0) {
        pipedriveOrg.address = addressParts.join(', ');
      }
    }

    const response = await this.apiRequest<PipedriveOrganization>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `organizations/${externalId}`,
      'PUT',
      pipedriveOrg
    );

    return this.mapPipedriveOrganization(response.data);
  }

  async deleteOrganization(connectionId: string, externalId: string): Promise<void> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    await this.apiRequest(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `organizations/${externalId}`,
      'DELETE'
    );
  }

  async syncOrganizations(
    connectionId: string,
    organizations: CrmOrganization[]
  ): Promise<OrganizationSyncResult> {
    const result: OrganizationSyncResult = { created: [], updated: [], failed: [] };

    for (const org of organizations) {
      try {
        if (org.externalId) {
          const updated = await this.updateOrganization(connectionId, org.externalId, org);
          result.updated.push(updated);
        } else {
          const created = await this.createOrganization(connectionId, org);
          result.created.push(created);
        }
      } catch (error) {
        result.failed.push({
          organization: org,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  // ============================================
  // DEALS
  // ============================================

  async getDeals(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; status?: string }
  ): Promise<CrmDeal[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const params = new URLSearchParams({
      limit: String(options?.limit || PIPEDRIVE_DEFAULT_PAGE_SIZE),
      start: String(options?.offset || 0),
    });

    if (options?.status) {
      params.set('status', options.status);
    }

    const response = await this.apiRequest<PipedriveDeal[]>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `deals?${params.toString()}`
    );

    return (response.data || []).map(this.mapPipedriveDeal);
  }

  async getDeal(connectionId: string, externalId: string): Promise<CrmDeal | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    try {
      const response = await this.apiRequest<PipedriveDeal>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        `deals/${externalId}`
      );

      if (!response.data) {return null;}
      return this.mapPipedriveDeal(response.data);
    } catch {
      return null;
    }
  }

  async createDeal(connectionId: string, deal: CrmDeal): Promise<CrmDeal> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveDeal: Partial<PipedriveDeal> = {
      title: deal.title,
      value: deal.value,
      currency: deal.currency || 'USD',
      status: deal.status || 'open', // open, won, lost
      person_id: deal.contactExternalId ? parseInt(deal.contactExternalId) : undefined,
      org_id: deal.organizationExternalId ? parseInt(deal.organizationExternalId) : undefined,
      pipeline_id: deal.pipelineId ? parseInt(deal.pipelineId) : undefined,
      stage_id: deal.stageId ? parseInt(deal.stageId) : undefined,
      expected_close_date: deal.expectedCloseDate,
      probability: deal.probability,
    };

    const response = await this.apiRequest<PipedriveDeal>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      'deals',
      'POST',
      pipedriveDeal
    );

    return this.mapPipedriveDeal(response.data);
  }

  async updateDeal(connectionId: string, externalId: string, deal: Partial<CrmDeal>): Promise<CrmDeal> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveDeal: Partial<PipedriveDeal> = {};
    if (deal.title) {pipedriveDeal.title = deal.title;}
    if (deal.value !== undefined) {pipedriveDeal.value = deal.value;}
    if (deal.currency) {pipedriveDeal.currency = deal.currency;}
    if (deal.stageId) {pipedriveDeal.stage_id = parseInt(deal.stageId);}
    if (deal.status) {pipedriveDeal.status = deal.status;}
    if (deal.expectedCloseDate) {pipedriveDeal.expected_close_date = deal.expectedCloseDate;}

    const response = await this.apiRequest<PipedriveDeal>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `deals/${externalId}`,
      'PUT',
      pipedriveDeal
    );

    return this.mapPipedriveDeal(response.data);
  }

  async deleteDeal(connectionId: string, externalId: string): Promise<void> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    await this.apiRequest(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `deals/${externalId}`,
      'DELETE'
    );
  }

  async syncDeals(connectionId: string, deals: CrmDeal[]): Promise<DealSyncResult> {
    const result: DealSyncResult = { created: [], updated: [], failed: [] };

    for (const deal of deals) {
      try {
        if (deal.externalId) {
          const updated = await this.updateDeal(connectionId, deal.externalId, deal);
          result.updated.push(updated);
        } else {
          const created = await this.createDeal(connectionId, deal);
          result.created.push(created);
        }
      } catch (error) {
        result.failed.push({
          deal,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  // ============================================
  // ACTIVITIES
  // ============================================

  async getActivities(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; type?: string }
  ): Promise<CrmActivity[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const params = new URLSearchParams({
      limit: String(options?.limit || PIPEDRIVE_DEFAULT_PAGE_SIZE),
      start: String(options?.offset || 0),
    });

    if (options?.type) {
      params.set('type', options.type);
    }

    const response = await this.apiRequest<PipedriveActivity[]>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `activities?${params.toString()}`
    );

    return (response.data || []).map(this.mapPipedriveActivity);
  }

  async createActivity(connectionId: string, activity: CrmActivity): Promise<CrmActivity> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveActivity: Partial<PipedriveActivity> = {
      type: activity.type,
      subject: activity.subject,
      note: activity.description,
      done: activity.done,
      due_date: activity.dueDate,
      deal_id: activity.dealExternalId ? parseInt(activity.dealExternalId) : undefined,
      person_id: activity.contactExternalId ? parseInt(activity.contactExternalId) : undefined,
      org_id: activity.organizationExternalId ? parseInt(activity.organizationExternalId) : undefined,
    };

    const response = await this.apiRequest<PipedriveActivity>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      'activities',
      'POST',
      pipedriveActivity
    );

    return this.mapPipedriveActivity(response.data);
  }

  async updateActivity(
    connectionId: string,
    externalId: string,
    activity: Partial<CrmActivity>
  ): Promise<CrmActivity> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveActivity: Partial<PipedriveActivity> = {};
    if (activity.subject) {pipedriveActivity.subject = activity.subject;}
    if (activity.description) {pipedriveActivity.note = activity.description;}
    if (activity.done !== undefined) {pipedriveActivity.done = activity.done;}

    const response = await this.apiRequest<PipedriveActivity>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `activities/${externalId}`,
      'PUT',
      pipedriveActivity
    );

    return this.mapPipedriveActivity(response.data);
  }

  async deleteActivity(connectionId: string, externalId: string): Promise<void> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    await this.apiRequest(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `activities/${externalId}`,
      'DELETE'
    );
  }

  // ============================================
  // NOTES
  // ============================================

  async getNotes(
    connectionId: string,
    options?: { contactId?: string; dealId?: string; organizationId?: string; leadId?: string; limit?: number }
  ): Promise<CrmNote[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const params = new URLSearchParams({
      limit: String(options?.limit || PIPEDRIVE_DEFAULT_PAGE_SIZE),
    });

    if (options?.dealId) {
      params.set('deal_id', options.dealId);
    }
    if (options?.contactId) {
      params.set('person_id', options.contactId);
    }
    if (options?.organizationId) {
      params.set('org_id', options.organizationId);
    }
    if (options?.leadId) {
      params.set('lead_id', options.leadId);
    }

    const response = await this.apiRequest<PipedriveNote[]>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `notes?${params.toString()}`
    );

    return (response.data || []).map(this.mapPipedriveNote);
  }

  async createNote(connectionId: string, note: CrmNote): Promise<CrmNote> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveNote: Partial<PipedriveNote> = {
      content: note.content,
      deal_id: note.dealId ? parseInt(note.dealId) : undefined,
      person_id: note.contactId ? parseInt(note.contactId) : undefined,
      org_id: note.organizationId ? parseInt(note.organizationId) : undefined,
      lead_id: note.leadId || undefined, // Pipedrive Leads Inbox lead UUID
      pinned_to_deal_flag: note.pinnedToTop,
    };

    const response = await this.apiRequest<PipedriveNote>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      'notes',
      'POST',
      pipedriveNote
    );

    return this.mapPipedriveNote(response.data);
  }

  async updateNote(connectionId: string, externalId: string, note: Partial<CrmNote>): Promise<CrmNote> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const pipedriveNote: Partial<PipedriveNote> = {};
    if (note.content) {pipedriveNote.content = note.content;}
    if (note.pinnedToTop !== undefined) {pipedriveNote.pinned_to_deal_flag = note.pinnedToTop;}

    const response = await this.apiRequest<PipedriveNote>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `notes/${externalId}`,
      'PUT',
      pipedriveNote
    );

    return this.mapPipedriveNote(response.data);
  }

  async deleteNote(connectionId: string, externalId: string): Promise<void> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    await this.apiRequest(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `notes/${externalId}`,
      'DELETE'
    );
  }

  // ============================================
  // PIPELINES
  // ============================================

  async getPipelines(connectionId: string): Promise<CrmPipeline[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const [pipelinesResponse, stagesResponse] = await Promise.all([
      this.apiRequest<PipedrivePipeline[]>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        'pipelines'
      ),
      this.apiRequest<PipedriveStage[]>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        'stages'
      ),
    ]);

    const pipelines = pipelinesResponse.data || [];
    const stages = stagesResponse.data || [];

    return pipelines.map((pipeline) => ({
      id: pipeline.id.toString(),
      externalId: pipeline.id.toString(),
      name: pipeline.name,
      active: pipeline.active,
      stages: stages
        .filter((s) => s.pipeline_id === pipeline.id)
        .sort((a, b) => a.order_nr - b.order_nr)
        .map((stage) => ({
          id: stage.id.toString(),
          externalId: stage.id.toString(),
          name: stage.name,
          order: stage.order_nr,
          probability: stage.deal_probability,
        })),
    }));
  }

  async getPipeline(connectionId: string, externalId: string): Promise<CrmPipeline | null> {
    const pipelines = await this.getPipelines(connectionId);
    return pipelines.find((p) => p.id === externalId) || null;
  }

  // ============================================
  // LEADS (Leads Inbox - different from Persons)
  // ============================================

  /**
   * Get leads from Pipedrive Leads Inbox
   * Note: Leads Inbox is separate from Persons/Contacts
   */
  async getLeads(
    connectionId: string,
    options?: { limit?: number; offset?: number; archivedStatus?: 'archived' | 'not_archived' | 'all' }
  ): Promise<PipedriveLead[]> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    const params = new URLSearchParams({
      limit: String(options?.limit || PIPEDRIVE_DEFAULT_PAGE_SIZE),
      start: String(options?.offset || 0),
      archived_status: options?.archivedStatus || 'not_archived',
      // Include embedded person and organization data to get email, phone, address etc.
      include: 'person,organization',
    });

    const response = await this.apiRequest<PipedriveLead[]>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      `leads?${params.toString()}`
    );

    return response.data || [];
  }

  /**
   * Get a single lead by ID
   */
  async getLead(connectionId: string, leadId: string): Promise<PipedriveLead | null> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    try {
      const response = await this.apiRequest<PipedriveLead>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        `leads/${leadId}`
      );

      return response.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new lead in Pipedrive Leads Inbox
   * If contact info is provided, creates a Person first and links it
   */
  async createLead(
    connectionId: string,
    leadData: {
      title: string;
      personName?: string;
      email?: string;
      phone?: string;
      company?: string;
      // Address fields
      addressStreet?: string;
      addressCity?: string;
      addressState?: string;
      addressPostalCode?: string;
      addressCountry?: string;
      // Deal info
      value?: number;
      currency?: string;
      expectedCloseDate?: string;
      notes?: string;
      // Labels
      labelIds?: string[];
    }
  ): Promise<{ leadId: string; personId?: number; orgId?: number }> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    let personId: number | undefined;
    let orgId: number | undefined;

    // Build full address string for Organization
    const addressParts = [
      leadData.addressStreet,
      leadData.addressCity,
      leadData.addressState,
      leadData.addressPostalCode,
      leadData.addressCountry,
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

    // Create organization if company name provided
    if (leadData.company) {
      try {
        const orgData: Record<string, unknown> = {
          name: leadData.company,
        };
        // Add address to organization
        if (fullAddress) {
          orgData.address = fullAddress;
        }

        const orgResponse = await this.apiRequest<PipedriveOrganization>(
          tokenInfo.environment,
          tokenInfo.accessToken,
          'organizations',
          'POST',
          orgData
        );
        orgId = orgResponse.data?.id;
      } catch (error) {
        console.warn('Failed to create organization in Pipedrive:', error);
      }
    }

    // Create person if contact info provided
    if (leadData.personName || leadData.email || leadData.phone) {
      try {
        const personData: Record<string, unknown> = {
          name: leadData.personName || leadData.title || 'Unknown',
        };
        if (leadData.email) {
          personData.email = [{ value: leadData.email, primary: true }];
        }
        if (leadData.phone) {
          personData.phone = [{ value: leadData.phone, primary: true }];
        }
        if (orgId) {
          personData.org_id = orgId;
        }

        const personResponse = await this.apiRequest<PipedrivePerson>(
          tokenInfo.environment,
          tokenInfo.accessToken,
          'persons',
          'POST',
          personData
        );
        personId = personResponse.data?.id;
      } catch (error) {
        console.warn('Failed to create person in Pipedrive:', error);
      }
    }

    // Create the lead
    const leadPayload: Record<string, unknown> = {
      title: leadData.title,
    };

    if (personId) {
      leadPayload.person_id = personId;
    }
    if (orgId) {
      leadPayload.organization_id = orgId;
    }
    if (leadData.value) {
      leadPayload.value = {
        amount: leadData.value,
        currency: leadData.currency || 'USD',
      };
    }
    if (leadData.expectedCloseDate) {
      leadPayload.expected_close_date = leadData.expectedCloseDate;
    }
    if (leadData.labelIds && leadData.labelIds.length > 0) {
      leadPayload.label_ids = leadData.labelIds;
    }

    const response = await this.apiRequest<PipedriveLead>(
      tokenInfo.environment,
      tokenInfo.accessToken,
      'leads',
      'POST',
      leadPayload
    );

    if (!response.data?.id) {
      throw new Error('Failed to create lead in Pipedrive');
    }

    const leadId = response.data.id;

    // Create a note with additional details if notes provided
    if (leadData.notes && personId) {
      try {
        await this.apiRequest<PipedriveNote>(
          tokenInfo.environment,
          tokenInfo.accessToken,
          'notes',
          'POST',
          {
            content: leadData.notes,
            person_id: personId,
            org_id: orgId,
          }
        );
      } catch (error) {
        console.warn('Failed to create note in Pipedrive:', error);
      }
    }

    return {
      leadId,
      personId,
      orgId,
    };
  }

  /**
   * Update an existing lead in Pipedrive
   * Also updates the linked person and organization if provided
   */
  async updateLead(
    connectionId: string,
    leadId: string,
    leadData: {
      title?: string;
      personId?: number;
      orgId?: number;
      // Contact info (updates person)
      personName?: string;
      email?: string | null;
      phone?: string | null;
      // Company info (updates org)
      company?: string | null;
      // Address fields (updates org)
      addressStreet?: string | null;
      addressCity?: string | null;
      addressState?: string | null;
      addressPostalCode?: string | null;
      addressCountry?: string | null;
      // Deal info
      value?: number | null;
      currency?: string;
      expectedCloseDate?: string | null;
      // Labels
      labelIds?: string[];
    }
  ): Promise<{ success: boolean; error?: string }> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    // Update person if contact info provided and personId exists
    if (leadData.personId && (leadData.personName || leadData.email !== undefined || leadData.phone !== undefined)) {
      try {
        const personData: Record<string, unknown> = {};
        if (leadData.personName) {
          personData.name = leadData.personName;
        }
        if (leadData.email !== undefined) {
          personData.email = leadData.email ? [{ value: leadData.email, primary: true }] : [];
        }
        if (leadData.phone !== undefined) {
          personData.phone = leadData.phone ? [{ value: leadData.phone, primary: true }] : [];
        }

        if (Object.keys(personData).length > 0) {
          await this.apiRequest<PipedrivePerson>(
            tokenInfo.environment,
            tokenInfo.accessToken,
            `persons/${leadData.personId}`,
            'PUT',
            personData
          );
        }
      } catch (error) {
        console.warn('Failed to update person in Pipedrive:', error);
      }
    }

    // Update organization if company/address info provided and orgId exists
    if (leadData.orgId && (leadData.company !== undefined || leadData.addressStreet !== undefined)) {
      try {
        const orgData: Record<string, unknown> = {};
        if (leadData.company !== undefined) {
          orgData.name = leadData.company;
        }

        // Build address
        const addressParts = [
          leadData.addressStreet,
          leadData.addressCity,
          leadData.addressState,
          leadData.addressPostalCode,
          leadData.addressCountry,
        ].filter(Boolean);
        if (addressParts.length > 0) {
          orgData.address = addressParts.join(', ');
        }

        if (Object.keys(orgData).length > 0) {
          await this.apiRequest<PipedriveOrganization>(
            tokenInfo.environment,
            tokenInfo.accessToken,
            `organizations/${leadData.orgId}`,
            'PUT',
            orgData
          );
        }
      } catch (error) {
        console.warn('Failed to update organization in Pipedrive:', error);
      }
    }

    // Update the lead itself
    try {
      const leadPayload: Record<string, unknown> = {};

      if (leadData.title) {
        leadPayload.title = leadData.title;
      }
      if (leadData.value !== undefined) {
        leadPayload.value = leadData.value !== null ? {
          amount: leadData.value,
          currency: leadData.currency || 'USD',
        } : null;
      }
      if (leadData.expectedCloseDate !== undefined) {
        leadPayload.expected_close_date = leadData.expectedCloseDate;
      }
      if (leadData.labelIds !== undefined) {
        leadPayload.label_ids = leadData.labelIds;
      }

      if (Object.keys(leadPayload).length > 0) {
        await this.apiRequest<PipedriveLead>(
          tokenInfo.environment,
          tokenInfo.accessToken,
          `leads/${leadId}`,
          'PATCH',
          leadPayload
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update lead in Pipedrive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lead',
      };
    }
  }

  /**
   * Delete (archive) a lead from Pipedrive Leads Inbox
   * Called after converting a lead to deal
   */
  async deleteLead(connectionId: string, leadId: string): Promise<{ success: boolean; error?: string }> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    try {
      await this.apiRequest(
        tokenInfo.environment,
        tokenInfo.accessToken,
        `leads/${leadId}`,
        'DELETE'
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to delete lead from Pipedrive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete lead',
      };
    }
  }

  /**
   * Get all lead labels from Pipedrive
   * Returns a map of label ID to label name
   */
  async getLeadLabels(connectionId: string): Promise<Map<string, string>> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }

    try {
      const response = await this.apiRequest<Array<{ id: string; name: string; color: string }>>(
        tokenInfo.environment,
        tokenInfo.accessToken,
        'leadLabels'
      );

      const labelMap = new Map<string, string>();
      (response.data || []).forEach(label => {
        labelMap.set(label.id, label.name);
      });

      return labelMap;
    } catch (error) {
      console.error('Error fetching lead labels:', error);
      return new Map();
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getConnection(connectionId: string): Promise<IntegrationConnectionRow | null> {
    const { getConnectionById } = await import('@/modules/integrations/core/repositories');
    return getConnectionById(connectionId);
  }

  private async getCurrentConnection(): Promise<IntegrationConnectionRow | null> {
    const integrationId = await this.getIntegrationId();
    return getConnectionByIntegrationId(integrationId);
  }

  private async apiRequest<T>(
    apiDomain: string,
    accessToken: string,
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<PipedriveApiResponse<T>> {
    const url = `${apiDomain}/v1/${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Pipedrive API error:', errorBody);
      throw new Error(PIPEDRIVE_ERRORS.API_ERROR);
    }

    return response.json();
  }

  private mapPipedriveContact(person: PipedrivePerson): CrmContact {
    const primaryEmail = person.email?.find((e) => e.primary)?.value || person.email?.[0]?.value;
    const primaryPhone = person.phone?.find((p) => p.primary)?.value || person.phone?.[0]?.value;

    return {
      externalId: person.id?.toString(),
      firstName: person.first_name,
      lastName: person.last_name,
      email: primaryEmail,
      phone: primaryPhone,
      organizationExternalId: typeof person.org_id === 'number'
        ? person.org_id.toString()
        : person.org_id?.value?.toString(),
      metadata: {
        active: person.active_flag,
        label: person.label,
      },
    };
  }

  private mapPipedriveOrganization(org: PipedriveOrganization): CrmOrganization {
    // Construct street address from available fields
    // Prefer org.address, but fall back to street_number + route if needed
    let street = org.address;
    let city = org.address_locality;
    let state = org.address_admin_area_level_1;
    let postalCode = org.address_postal_code;
    let country = org.address_country;

    // If street is empty but we have street_number + route, combine them
    if (!street && (org.address_street_number || org.address_route)) {
      street = [org.address_street_number, org.address_route]
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    // Parse comma-separated address if we have a full address string
    // but separate fields are missing
    if (street && street.includes(',') && (!city || !state || !postalCode || !country)) {
      // Format: "Street, City, State, Postal, Country"
      const parts = street.split(',').map(p => p.trim());

      if (parts.length >= 2) {
        // Only override if the current field is empty
        if (!city && parts.length > 1) city = parts[1];
        if (!state && parts.length > 2) state = parts[2];
        if (!postalCode && parts.length > 3) postalCode = parts[3];
        if (!country && parts.length > 4) country = parts[4];

        // First part is always the street
        street = parts[0];
      }
    }

    // Create address object if any address field is present
    const hasAnyAddressField = street || city || state || postalCode || country;

    return {
      externalId: org.id?.toString(),
      name: org.name,
      address: hasAnyAddressField
        ? {
            street: street || undefined,
            city: city || undefined,
            state: state || undefined,
            postalCode: postalCode || undefined,
            country: country || undefined,
          }
        : undefined,
      metadata: {
        active: org.active_flag,
        peopleCount: org.people_count,
      },
    };
  }

  private mapPipedriveDeal(deal: PipedriveDeal): CrmDeal {
    return {
      externalId: deal.id?.toString(),
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      status: deal.status === 'deleted' ? 'lost' : deal.status,
      stageId: deal.stage_id?.toString(),
      pipelineId: deal.pipeline_id?.toString(),
      probability: deal.probability,
      expectedCloseDate: deal.expected_close_date,
      contactExternalId: typeof deal.person_id === 'number'
        ? deal.person_id.toString()
        : deal.person_id?.value?.toString(),
      organizationExternalId: typeof deal.org_id === 'number'
        ? deal.org_id.toString()
        : deal.org_id?.value?.toString(),
      metadata: {
        lostReason: deal.lost_reason,
        wonTime: deal.won_time,
        lostTime: deal.lost_time,
      },
    };
  }

  private mapPipedriveActivity(activity: PipedriveActivity): CrmActivity {
    return {
      externalId: activity.id?.toString(),
      type: activity.type as CrmActivity['type'],
      subject: activity.subject,
      description: activity.note,
      done: activity.done,
      dueDate: activity.due_date,
      completedDate: activity.marked_as_done_time,
      dealExternalId: activity.deal_id?.toString(),
      contactExternalId: activity.person_id?.toString(),
      organizationExternalId: activity.org_id?.toString(),
      metadata: {
        location: activity.location,
        busyFlag: activity.busy_flag,
      },
    };
  }

  private mapPipedriveNote(note: PipedriveNote): CrmNote {
    return {
      externalId: note.id?.toString(),
      content: note.content,
      dealId: note.deal_id?.toString(),
      contactId: note.person_id?.toString(),
      organizationId: note.org_id?.toString(),
      pinnedToTop: note.pinned_to_deal_flag || note.pinned_to_person_flag || note.pinned_to_organization_flag,
      createdAt: note.add_time,
      updatedAt: note.update_time,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const pipedriveProvider = new PipedriveProvider();
