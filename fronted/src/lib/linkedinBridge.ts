/**
 * Outlify LinkedIn Companion Extension Bridge for Frontend
 */

export interface LinkedInProfileData {
  username?: string;
  idUser?: string;
  dashEntityUrn?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  pictureUrl?: string;
  cookie_li_at?: string;
  cookie_JSESSIONID?: string;
  userAgent?: string;
  hasCookie?: boolean;
}

export interface LinkedInConnectionRecord {
  profile_url: string;
  public_identifier: string;
  status: string;
  verification_method: string;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  picture_url?: string | null;
  dash_entity_urn?: string | null;
  member_urn?: string | null;
  has_session: boolean;
  connected_at: string;
  last_confirmed_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18000';

/**
 * Checks if the Outlify companion extension's API bridge is present in the DOM
 */
export function isExtensionInstalled(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.getElementById('api-bridge-loaded') ||
    document.getElementById('outlify-bridge-loaded')
  );
}

/**
 * Requests LinkedIn session and Voyager profile from the Chrome extension
 */
export function fetchLinkedInFromExtension(timeoutMs = 15000): Promise<LinkedInProfileData> {
  return new Promise((resolve, reject) => {
    if (!isExtensionInstalled()) {
      return reject(new Error('Outlify companion extension is not installed or enabled'));
    }

    const replyCallFnName = `li_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const returnMessage = 'outlify_app_api_call_response_fetchMe';
    const legacyReturnMessage = 'taplio_app_api_call_response_fetchMe';

    let timeoutId: NodeJS.Timeout;

    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (_) {
          return;
        }
      }

      if (
        data?.replyCallFnName === replyCallFnName ||
        data?.returnMessage === returnMessage ||
        data?.returnMessage === legacyReturnMessage
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', listener);

        const payload = data.payload || {};
        if (payload.error) {
          reject(new Error(typeof payload.error === 'string' ? payload.error : 'Failed to fetch LinkedIn session'));
        } else {
          resolve(payload);
        }
      }
    };

    timeoutId = setTimeout(() => {
      window.removeEventListener('message', listener);
      reject(new Error('Extension request timed out. Make sure you are logged into LinkedIn.'));
    }, timeoutMs);

    window.addEventListener('message', listener);

    window.postMessage(
      JSON.stringify({
        message: 'outlify_app_api_call',
        callName: 'fetchMe',
        returnMessage,
        replyCallFnName,
      }),
      window.location.origin
    );
  });
}

/**
 * Connects the extracted LinkedIn session directly to the backend workspace
 */
export async function connectLinkedInToBackend(
  profile: LinkedInProfileData,
  accessToken: string
): Promise<LinkedInConnectionRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/extension/linkedin/connect-web`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      public_identifier: profile.username,
      username: profile.username,
      first_name: profile.firstName,
      last_name: profile.lastName,
      headline: profile.headline,
      picture_url: profile.pictureUrl,
      dash_entity_urn: profile.dashEntityUrn,
      member_urn: profile.idUser,
      cookie_li_at: profile.cookie_li_at,
      cookie_jsessionid: profile.cookie_JSESSIONID,
      user_agent: profile.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      confirmed_ownership: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to connect account (${response.status})`);
  }

  return await response.json();
}

/**
 * Full 1-Click LinkedIn connect workflow from the Web App
 */
export async function connectLinkedInOneClick(accessToken: string): Promise<LinkedInConnectionRecord> {
  const profile = await fetchLinkedInFromExtension();
  return await connectLinkedInToBackend(profile, accessToken);
}

/**
 * Fetches the currently connected LinkedIn account from the backend
 */
export async function getConnectedLinkedInAccount(
  accessToken: string
): Promise<LinkedInConnectionRecord | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/extension/linkedin/connection`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to load connection (${response.status})`);
  }

  return await response.json();
}

/**
 * Disconnects the current LinkedIn account from the backend workspace
 */
export async function disconnectLinkedIn(accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/extension/linkedin/connection-web`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to disconnect (${response.status})`);
  }
}
