import fetch, { Headers, RequestInit } from 'node-fetch';
import { PublicSettingsResponse } from './responses/PublicSettingsResponse';
import { AuthenticationMethod } from './enum/AuthenticationMethod';
import { AuthenticateResponse } from './responses/AuthenticateResponse';
import { UserResponse } from './responses/UserResponse';
import { AccessTokenResponse } from './responses/AccessTokenResponse';
import { parseUrlOrFail } from '../cli/support/parsers';
import { container } from '@baileyherbert/container';
import { Logger } from '../cli/foundation/Logger';
import { ConfigurationStore } from '../stores/ConfigurationStore';
import { PortainerAgent } from './PortainerAgent';
import { MINIMUM_PORTAINER_VERSION } from '../constants';
import os from 'os';

export class PortainerClient {
	public readonly host: string;

	protected readonly logger = container.resolve(Logger);
	protected readonly configuration = container.resolve(ConfigurationStore);
	protected readonly agent: PortainerAgent;

	private _accessToken?: string;

	public constructor(public readonly url: string) {
		const parsed = parseUrlOrFail(url);
		const formatted = parsed.toString().replace(/\/+$/, '');

		this.url = formatted;
		this.host = parsed.host.toLowerCase();
		this.agent = new PortainerAgent();
	}

	/**
	 * Returns an absolute URL for the given API path.
	 */
	public getUrl(path: string) {
		return this.url + '/api/' + path.replace(/^\/+/, '');
	}

	/**
	 * Updates the access token for the client.
	 */
	public setToken(token?: string) {
		this._accessToken = token;
	}

	/**
	 * Returns the current access token, or `undefined` if not set.
	 */
	protected getToken() {
		return this._accessToken;
	}

	/**
	 * Returns the authentication method that the portainer instance is configured for.
	 */
	public async getLoginMethod() {
		const response = await this._request<PublicSettingsResponse>('GET', '/settings/public', {
			disableAuthentication: true
		});

		switch (response.AuthenticationMethod) {
			case 1: return AuthenticationMethod.Internal;
			case 2: return AuthenticationMethod.LDAP;
			case 3: return AuthenticationMethod.OAuth;
			default: throw new Error(`Unrecognized authentication method ${response.AuthenticationMethod}`);
		}
	}

	/**
	 * Retrieves information about the current user.
	 *
	 * @param jwt Optional JWT to authenticate with.
	 * @returns
	 */
	public async getUserProfile(jwt?: string) {
		try {
			return await this.get<UserResponse>('/users/me', {
				disableAuthentication: !!jwt,
				headers: (jwt ? { 'Authorization': `Bearer ${jwt}` } : undefined)
			});
		}
		catch (error) {
			if (error instanceof Error && error.message.includes('Invalid user identifier')) {
				throw new Error(`Sailor requires a portainer version of at least ${MINIMUM_PORTAINER_VERSION}`);
			}

			throw error;
		}
	}

	/**
	 * Resolves a session JWT from the given username and password.
	 *
	 * @param username
	 * @param password
	 * @returns
	 */
	public async getJWT(username: string, password: string) {
		const response = await this.post<AuthenticateResponse>(
			'/auth',
			{ username, password },
			{ disableAuthentication: true }
		);

		this.logger.debug('Logged in with username and password (JWT)');
		return response.jwt;
	}

	/**
	 * Creates a persistent access token using the given credentials.
	 *
	 * @param jwt
	 * @param password
	 * @returns
	 */
	public async createAccessToken(jwt: string, password: string) {
		const profile = await this.getUserProfile(jwt);
		const osUserName = os.userInfo().username;
		const osHostName = os.hostname();
		const description = `Sailor CLI for ${osUserName}@${osHostName} (auto-created)`;

		this.logger.debug('Creating access token:', description);

		const response = await this.post<AccessTokenResponse>(
			`/users/${profile.Id}/tokens`,
			{
				description,
				password
			},
			{
				disableAuthentication: true,
				headers: {
					Authorization: `Bearer ${jwt}`
				}
			}
		);

		return {
			username: profile.Username,
			token: response.rawAPIKey
		};
	}

	/**
	 * Sends a GET request to the Portainer API with automatic authentication, and returns the parsed response.
	 *
	 * @param path The path to call.
	 * @param init Optional object with additional fetch configuration.
	 */
	public async get<T = unknown>(path: string, init?: PortainerRequestInit) {
		return this._request<T>('GET', path, init);
	}

	/**
	 * Sends a POST request to the Portainer API with automatic authentication, and returns the parsed response.
	 *
	 * @param path The path to call.
	 * @param body The JSON payload to send.
	 * @param init Optional object with additional fetch configuration.
	 */
	public async post<T = unknown, B = any>(path: string, body: B, init?: PortainerRequestInit) {
		return this._request<T>('POST', path, {
			...init,
			headers: {
				...init?.headers,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
	}

	/**
	 * Sends a PUT request to the Portainer API with automatic authentication, and returns the parsed response.
	 *
	 * @param path The path to call.
	 * @param body The JSON payload to send.
	 * @param init Optional object with additional fetch configuration.
	 */
	public async put<T = unknown, B = any>(path: string, body: B, init?: PortainerRequestInit) {
		return this._request<T>('PUT', path, {
			...init,
			headers: {
				...init?.headers,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
	}

	/**
	 * Sends a PATCH request to the Portainer API with automatic authentication, and returns the parsed response.
	 *
	 * @param path The path to call.
	 * @param body The JSON payload to send.
	 * @param init Optional object with additional fetch configuration.
	 */
	public async patch<T = unknown, B = any>(path: string, body: B, init?: PortainerRequestInit) {
		return this._request<T>('PATCH', path, {
			...init,
			headers: {
				...init?.headers,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
	}

	/**
	 * Sends a DELETE request to the Portainer API with automatic authentication, and returns the parsed response.
	 *
	 * @param path The path to call.
	 * @param init Optional object with additional fetch configuration.
	 */
	public async delete<T = unknown>(path: string, init?: PortainerRequestInit) {
		return this._request<T>('DELETE', path, init);
	}

	/**
	 * Sends an HTTP request to the Portainer API with automatic authentication, and returns the parsed response.
	 */
	private async _request<T = unknown>(method: string, path: string, init?: PortainerRequestInit) {
		const url = this.getUrl(path);

		this.logger.debug('Request: %s %s', method, url);

		const headers = new Headers({
			...init?.headers,
			'User-Agent': 'Mozilla/5.0 (compatible; Sailor; +https://github.com/baileyherbert/sailor)'
		});

		if (!init?.disableAuthentication && this._accessToken) {
			headers.set('X-API-Key', this._accessToken);
		}

		const response = await fetch(url, {
			...init,
			headers,
			method,
			agent: (url) => (url.protocol === 'https:') ? this.agent : undefined
		});

		this.logger.debug('Response: %s %s - %d %s', method, url, response.status, response.statusText);

		if (!response.ok) {
			const text = await response.text();
			this.logger.debug(text);

			if (text.startsWith('{')) {
				let error: Error | undefined = undefined;

				try {
					const body = JSON.parse(text);

					if (typeof body.message === 'string') {
						error = new Error(body.message);
					}
				}
				catch {}

				if (error) {
					throw error;
				}
			}

			throw new Error(`Received erroneous status code ${response.status} from the server`);
		}

		return response.json() as T;
	}
}

export interface PortainerRequestInit extends RequestInit {
	disableAuthentication?: boolean;
}
