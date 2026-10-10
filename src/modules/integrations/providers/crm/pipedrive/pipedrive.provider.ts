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
  PIPEDRIVE_MAX_PAGE_SIZE,
  PIPEDRIVE_MAX_PAGES,
  PIPEDRIVE_TOKEN_REFRESH_BUFFER_MS,
} from './constants';
import {
  PipedriveApiError,
  isPipedriveApiError,
  isPipedriveNotFound,
  parseRetryAfter,
} from './errors';
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
// PAGINATION TYPES
// ============================================

interface PipedrivePagination {
  start?: number;
  limit?: number;
  more_items_in_collection?: boolean;
  next_start?: number;
}

/**
 * Result of a full-collection read. `complete` is true only when Pipedrive
 * explicitly reported the end of the collection; only then may callers treat
 * records missing from `items` as deleted.
 */
export interface PipedriveListResult<T> {
  items: T[];
  complete: boolean;
}

/**
 * Wraps each page request, letting callers apply rate limiting and retries
 * per request rather than around a whole multi-page read.
 */
export type PageRequestRunner = <R>(request: () => Promise<R>) => Promise<R>;

/**
 * Access token plus the connection it belongs to, so a request that gets a 401
 * can refresh that connection's token and retry.
 */
/** Pipedrive REST API generation used for a request */
export type PipedriveApiVersion = 'v1' | 'v2';

export interface PipedriveTokenInfo {
  connectionId: string;
  accessToken: string;
  externalAccountId: string;
  environment: string;
}

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

  /** In-flight token refreshes, so concurrent requests share one refresh */
  private refreshInFlight = new Map<string, Promise<void>>();

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
      // Granted scopes come from the app's Developer Hub settings, not the auth URL
      grantedScopes: (tokenResponse.scope ?? '').split(/[\s,]+/).filter(Boolean),
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

  /**
   * Refresh the access token when it is close to expiry, or always with `force`
   * (used after Pipedrive answers 401 for a token we still considered valid).
   */
  async refreshTokenIfNeeded(connectionId: string, options: { force?: boolean } = {}): Promise<void> {
    // Share one refresh between concurrent callers in this instance to avoid
    // redundant token requests. (Pipedrive reissues the same refresh token, so
    // refreshes from other instances do not invalidate each other.)
    const inFlight = this.refreshInFlight.get(connectionId);
    if (inFlight) {
      return inFlight;
    }

    const refresh = this.performTokenRefresh(connectionId, options.force ?? false).finally(() => {
      this.refreshInFlight.delete(connectionId);
    });
    this.refreshInFlight.set(connectionId, refresh);
    return refresh;
  }

  private async performTokenRefresh(connectionId: string, force: boolean): Promise<void> {
    const connection = await this.getConnection(connectionId);

    if (!connection || !connection.refresh_token) {
      return;
    }

    const expiresAt = new Date(connection.token_expires_at ?? 0);
    const now = new Date();

    if (!force && expiresAt.getTime() - now.getTime() > PIPEDRIVE_TOKEN_REFRESH_BUFFER_MS) {
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
      // Pipedrive rejected the refresh token: access was revoked or the token
      // expired (unused for 60 days). Only a new OAuth connection can fix this.
      const rejected =
        isPipedriveApiError(error) && (error.status === 400 || error.status === 401);
      if (rejected) {
        console.error('[Pipedrive] Refresh token rejected; reauthorization required:', error);
        await updateConnectionStatus(connectionId, 'error', PIPEDRIVE_ERRORS.REAUTHORIZATION_REQUIRED);
        throw error;
      }

      if (!force && expiresAt.getTime() > Date.now()) {
        // Early refresh failed transiently but the current token is still valid -
        // keep using it and retry on the next request.
        console.warn('[Pipedrive] Early token refresh failed; current token still valid:', error);
        return;
      }

      // Transient failure (network, Pipedrive 5xx): surface it to the caller but
      // do not mark the connection broken - the next request retries the refresh.
      console.error('[Pipedrive] Token refresh failed (transient):', error);
      throw error;
    }
  }

  async getAccessToken(connectionId: string): Promise<PipedriveTokenInfo | null> {
    const connection = await this.getConnection(connectionId);

    if (!connection || connection.status !== 'connected' || !connection.access_token) {
      return null;
    }

    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      // Refresh ahead of expiry so a token never lapses mid-request or mid-sync
      if (expiresAt.getTime() - Date.now() <= PIPEDRIVE_TOKEN_REFRESH_BUFFER_MS) {
        await this.refreshTokenIfNeeded(connectionId);
        const updatedConnection = await this.getConnection(connectionId);
        if (!updatedConnection?.access_token) {
          return null;
        }

        const metadata = updatedConnection.metadata as PipedriveConnectionMetadata;
        return {
          connectionId,
          accessToken: decrypt(updatedConnection.access_token),
          externalAccountId: updatedConnection.external_account_id ?? '',
          environment: metadata?.apiDomain ?? '',
        };
      }
    }

    const metadata = connection.metadata as PipedriveConnectionMetadata;
    return {
      connectionId,
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
      tokenInfo,
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
        tokenInfo,
        `persons/${externalId}`
      );

      if (!response.data) {return null;}
      return this.mapPipedriveContact(response.data);
    } catch (error) {
      // Only a missing record maps to null; auth, rate-limit and server errors must surface
      if (isPipedriveNotFound(error)) {
        return null;
      }
      throw error;
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
        tokenInfo,
        `organizations/${externalId}`
      );

      if (!response.data) {return null;}
      return this.mapPipedriveOrganization(response.data);
    } catch (error) {
      // Only a missing record maps to null; auth, rate-limit and server errors must surface
      if (isPipedriveNotFound(error)) {
        return null;
      }
      throw error;
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
        tokenInfo,
        `deals/${externalId}`
      );

      if (!response.data) {return null;}
      return this.mapPipedriveDeal(response.data);
    } catch (error) {
      // Only a missing record maps to null; auth, rate-limit and server errors must surface
      if (isPipedriveNotFound(error)) {
        return null;
      }
      throw error;
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
      tokenInfo,
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
        tokenInfo,
        'pipelines'
      ),
      this.apiRequest<PipedriveStage[]>(
        tokenInfo,
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
  // GENERIC REQUESTS (used by the GDC CRM services)
  // ============================================
  // Same auth, refresh and error handling as the typed methods. Use v2 for
  // entities whose v1 endpoints are deprecated (deals, persons, organizations,
  // pipelines, stages, activities, products, fields, search).

  async request<T>(
    connectionId: string,
    method: string,
    endpoint: string,
    body?: unknown,
    version: PipedriveApiVersion = 'v2'
  ): Promise<PipedriveApiResponse<T>> {
    const tokenInfo = await this.getAccessToken(connectionId);
    if (!tokenInfo) {
      throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
    }
    return this.apiRequest<T>(tokenInfo, endpoint, method, body, version);
  }

  /**
   * Read every page of a v2 list endpoint (cursor pagination).
   * `complete` is true only when Pipedrive returned `next_cursor: null`.
   */
  async fetchAllV2<T>(
    connectionId: string,
    endpoint: string,
    params: URLSearchParams = new URLSearchParams(),
    runRequest: PageRequestRunner = (fn) => fn()
  ): Promise<PipedriveListResult<T>> {
    const items: T[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < PIPEDRIVE_MAX_PAGES; page++) {
      const pageParams = new URLSearchParams(params);
      pageParams.set('limit', String(PIPEDRIVE_MAX_PAGE_SIZE));
      if (cursor) {
        pageParams.set('cursor', cursor);
      }

      const response = await runRequest(() =>
        this.request<T[] | null>(connectionId, 'GET', `${endpoint}?${pageParams.toString()}`)
      );
      const pageItems = response.data || [];
      items.push(...pageItems);

      const additional = response.additional_data as { next_cursor?: string | null } | undefined;
      if (additional && 'next_cursor' in additional) {
        if (additional.next_cursor === null) {
          return { items, complete: true };
        }
        if (!additional.next_cursor) {
          throw new Error(`Pipedrive v2 pagination returned an empty cursor on ${endpoint}`);
        }
        cursor = additional.next_cursor;
        continue;
      }

      // No cursor metadata: usable items, but never proof of completeness
      return { items, complete: false };
    }

    throw new Error(`Pipedrive v2 pagination for ${endpoint} exceeded ${PIPEDRIVE_MAX_PAGES} pages`);
  }

  /**
   * Read every page of a v1 list endpoint (offset pagination).
   */
  async fetchAllV1<T>(
    connectionId: string,
    endpoint: string,
    params: URLSearchParams = new URLSearchParams(),
    runRequest?: PageRequestRunner
  ): Promise<PipedriveListResult<T>> {
    return this.fetchAllPages<T>(connectionId, endpoint, params, runRequest);
  }

  // ============================================
  // FULL COLLECTION READS (all pages)
  // ============================================
  // Use these whenever the result is used to detect deletions. They throw
  // instead of returning a partial list.

  async getAllContacts(
    connectionId: string,
    runRequest?: PageRequestRunner
  ): Promise<PipedriveListResult<CrmContact>> {
    const persons = await this.fetchAllPages<PipedrivePerson>(
      connectionId,
      'persons',
      new URLSearchParams(),
      runRequest
    );
    return { items: persons.items.map(this.mapPipedriveContact), complete: persons.complete };
  }

  async getAllOrganizations(
    connectionId: string,
    runRequest?: PageRequestRunner
  ): Promise<PipedriveListResult<CrmOrganization>> {
    const organizations = await this.fetchAllPages<PipedriveOrganization>(
      connectionId,
      'organizations',
      new URLSearchParams(),
      runRequest
    );
    return {
      items: organizations.items.map(this.mapPipedriveOrganization),
      complete: organizations.complete,
    };
  }

  async getAllDeals(
    connectionId: string,
    options?: { status?: string },
    runRequest?: PageRequestRunner
  ): Promise<PipedriveListResult<CrmDeal>> {
    const params = new URLSearchParams();
    if (options?.status) {
      params.set('status', options.status);
    }

    const deals = await this.fetchAllPages<PipedriveDeal>(connectionId, 'deals', params, runRequest);
    return { items: deals.items.map(this.mapPipedriveDeal), complete: deals.complete };
  }

  /**
   * Since Jul 15, 2025 GET /v1/leads ignores `archived_status` and returns only
   * not-archived leads; archived leads are listed by GET /v1/leads/archived.
   */
  async getAllLeads(
    connectionId: string,
    options?: { archived?: boolean },
    runRequest?: PageRequestRunner
  ): Promise<PipedriveListResult<PipedriveLead>> {
    if (options?.archived) {
      return this.fetchAllPages<PipedriveLead>(
        connectionId,
        'leads/archived',
        new URLSearchParams(),
        runRequest
      );
    }

    const params = new URLSearchParams({
      include: 'person,organization',
    });

    return this.fetchAllPages<PipedriveLead>(connectionId, 'leads', params, runRequest);
  }

  async getAllNotes(
    connectionId: string,
    options: { contactId?: string; dealId?: string; organizationId?: string; leadId?: string },
    runRequest?: PageRequestRunner
  ): Promise<PipedriveListResult<CrmNote>> {
    const params = new URLSearchParams();
    if (options.dealId) {
      params.set('deal_id', options.dealId);
    }
    if (options.contactId) {
      params.set('person_id', options.contactId);
    }
    if (options.organizationId) {
      params.set('org_id', options.organizationId);
    }
    if (options.leadId) {
      params.set('lead_id', options.leadId);
    }

    if ([...params.keys()].length === 0) {
      throw new Error('getAllNotes requires a deal, person, organization or lead filter');
    }

    const notes = await this.fetchAllPages<PipedriveNote>(connectionId, 'notes', params, runRequest);
    return { items: notes.items.map(this.mapPipedriveNote), complete: notes.complete };
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
      tokenInfo,
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
        tokenInfo,
        `leads/${leadId}`
      );

      return response.data || null;
    } catch (error) {
      // Only a missing record maps to null; auth, rate-limit and server errors must surface
      if (isPipedriveNotFound(error)) {
        return null;
      }
      throw error;
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
          tokenInfo,
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
          tokenInfo,
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
      tokenInfo,
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
          tokenInfo,
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
            tokenInfo,
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
            tokenInfo,
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
          tokenInfo,
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
        tokenInfo,
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

    // Errors propagate: an empty map would be indistinguishable from "no labels"
    // and callers would wipe the labels stored on leads.
    const response = await this.apiRequest<Array<{ id: string; name: string; color: string }>>(
      tokenInfo,
      'leadLabels'
    );

    const labelMap = new Map<string, string>();
    (response.data || []).forEach(label => {
      labelMap.set(label.id, label.name);
    });

    return labelMap;
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
    tokenInfo: PipedriveTokenInfo,
    endpoint: string,
    method: string = 'GET',
    body?: unknown,
    version: PipedriveApiVersion = 'v1'
  ): Promise<PipedriveApiResponse<T>> {
    const base = version === 'v2' ? `${tokenInfo.environment}/api/v2` : `${tokenInfo.environment}/v1`;
    const send = (accessToken: string) =>
      fetch(`${base}/${endpoint}`, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

    let response = await send(tokenInfo.accessToken);

    if (response.status === 401) {
      // The token may have been invalidated before its recorded expiry. Force one
      // refresh and retry; if that still fails, the access was revoked.
      response = await this.retryAfterUnauthorized(tokenInfo, send);
    }

    if (!response.ok) {
      // Log status and path only - query strings and bodies can contain customer data
      const path = `${version}/${endpoint.split('?')[0] ?? endpoint}`;
      const errorBody = await response.text();
      console.error(
        `[Pipedrive API] ${method} ${path} failed with HTTP ${response.status}:`,
        errorBody.slice(0, 500)
      );
      throw new PipedriveApiError(
        response.status,
        `${method} ${path}`,
        parseRetryAfter(response.headers.get('retry-after'))
      );
    }

    return response.json();
  }

  /**
   * Handle a 401: force a token refresh and resend once. If the refresh is
   * rejected, performTokenRefresh has already marked the connection as needing
   * reauthorization. If the fresh token is also rejected, mark it here.
   * Retrying is safe for writes too: a 401 means the request was not processed.
   */
  private async retryAfterUnauthorized(
    tokenInfo: PipedriveTokenInfo,
    send: (accessToken: string) => Promise<Response>
  ): Promise<Response> {
    await this.refreshTokenIfNeeded(tokenInfo.connectionId, { force: true });

    const refreshed = await this.getConnection(tokenInfo.connectionId);
    if (!refreshed?.access_token || refreshed.status !== 'connected') {
      throw new PipedriveApiError(401, 'token refresh');
    }

    const response = await send(decrypt(refreshed.access_token));

    if (response.status === 401) {
      console.error('[Pipedrive API] Fresh access token rejected; marking connection for reauthorization');
      await updateConnectionStatus(
        tokenInfo.connectionId,
        'error',
        PIPEDRIVE_ERRORS.REAUTHORIZATION_REQUIRED
      );
    }

    return response;
  }

  /**
   * Fetch every page of a list endpoint.
   *
   * Pipedrive reports pagination in additional_data.pagination (persons, deals,
   * organizations, notes) or directly in additional_data (leads). Throws if the
   * collection cannot be read completely, so callers never reconcile deletions
   * against a partial list.
   */
  private async fetchAllPages<T>(
    connectionId: string,
    endpoint: string,
    params: URLSearchParams,
    runRequest: PageRequestRunner = (fn) => fn()
  ): Promise<PipedriveListResult<T>> {
    const items: T[] = [];
    const limit = PIPEDRIVE_MAX_PAGE_SIZE;
    let start = 0;

    for (let page = 0; page < PIPEDRIVE_MAX_PAGES; page++) {
      const pageParams = new URLSearchParams(params);
      pageParams.set('start', String(start));
      pageParams.set('limit', String(limit));

      const response = await runRequest(async () => {
        // Re-read the token per page so long syncs survive a refresh
        const tokenInfo = await this.getAccessToken(connectionId);
        if (!tokenInfo) {
          throw new Error(PIPEDRIVE_ERRORS.NOT_CONNECTED);
        }

        return this.apiRequest<T[] | null>(
          tokenInfo,
          `${endpoint}?${pageParams.toString()}`
        );
      });

      const pageItems = response.data || [];
      items.push(...pageItems);

      const additional = response.additional_data as
        | (PipedrivePagination & { pagination?: PipedrivePagination })
        | undefined;
      const pagination = additional?.pagination ?? additional;
      const moreItems = pagination?.more_items_in_collection;

      if (moreItems === false) {
        // Pipedrive positively confirmed the end of the collection
        return { items, complete: true };
      }

      if (moreItems === undefined && pageItems.length < limit) {
        // No pagination metadata: a short page probably means the end, but the
        // API may have capped the page size. Return the items for upserts, but
        // never let callers treat this list as proof that other records were deleted.
        console.warn(
          `[Pipedrive] ${endpoint}: no pagination metadata; list marked incomplete (deletion cleanup will be skipped)`
        );
        return { items, complete: false };
      }

      if (pageItems.length === 0) {
        // Pipedrive claims more items but returned none - refuse to guess
        throw new Error(`Pipedrive pagination stalled on ${endpoint} at start=${start}`);
      }

      start = pagination?.next_start ?? start + pageItems.length;
    }

    throw new Error(
      `Pipedrive pagination for ${endpoint} exceeded ${PIPEDRIVE_MAX_PAGES} pages; aborting to avoid a partial sync`
    );
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
