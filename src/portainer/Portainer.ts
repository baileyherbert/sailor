import fetch, { Headers, RequestInit } from 'node-fetch';
import { PortainerAgent } from './PortainerAgent';
import { container } from '@baileyherbert/container';
import { Logger } from '../cli/foundation/Logger';
import { PublicSettingsResponse } from './responses/PublicSettingsResponse';
import { AuthenticationMethod } from './enum/AuthenticationMethod';
import { promptLoginMethod, promptToken, promptUsernamePassword } from '../cli/support/prompts';
import { AuthenticateResponse } from './responses/AuthenticateResponse';
import { UserResponse } from './responses/UserResponse';
import { AccessTokenResponse } from './responses/AccessTokenResponse';
import { ConfigurationStore } from '../stores/ConfigurationStore';
import { randomUUID } from 'crypto';
import os from 'os';

export class Portainer {
	protected readonly logger = container.resolve(Logger);
	protected readonly configuration = container.resolve(ConfigurationStore);

	private _url: string;
	private _host: string;
	private _name?: string;
	private _agent: PortainerAgent;

	private _registration?: PortainerRegistration;
	private _username?: string;
	private _accessToken?: string;

	public constructor(url: string) {
		const parsed = new URL(url.trim());
		const formatted = parsed.toString();

		this._url = formatted.replace(/\/+$/, '');
		this._host = parsed.host;
		this._agent = new PortainerAgent();

		this._registration = this.configuration.get('servers').find((s) => s.url === this._url);

		if (this._registration) {
			this._name = this._registration.name;
			this._username = this._registration.username;
			this._accessToken = this._registration.token;

			this.logger.debug('Loaded server registration %s from configuration store', this._registration.id);
		}
	}

	/**
	 * Returns true if the instance is saved to the system.
	 */
	public get saved() {
		return !!this._registration;
	}

	/**
	 * The name for this instance.
	 */
	public get name() {
		return this._name ?? this._host;
	}

	/**
	 * Updates the name for this instance.
	 */
	public set name(value: string) {
		this._name = value;
	}

	/**
	 * The host for this instance, including the hostname and port.
	 */
	public get host() {
		return this._host;
	}

	/**
	 * Returns an absolute URL for the given API path.
	 */
	public getUrl(path: string) {
		return this._url + '/api/' + path.replace(/^\/+/, '');
	}

	/**
	 * Logs into the portainer instance. Automatically prompts the user for credentials as needed. Throws an error
	 * upon failure.
	 *
	 * @param credentials Optional user-provided credentials (e.g. from parameters or the environment).
	 * @returns
	 */
	public async login(credentials: PortainerCredentials = {}) {
		if (credentials.token) {
			return this._loginWithUserProvidedToken(credentials.token);
		}

		this.logger.spin('Connecting to portainer...');

		const method = await this.getLoginMethod();

		this.logger.debug('Portainer reported configured login method: %s', AuthenticationMethod[method]);
		this.logger.stop();

		if (method === AuthenticationMethod.Internal) {
			const method = (!!credentials.username || !!credentials.password) ? 'password' : await promptLoginMethod();

			if (method === 'password') {
				const inputs = await promptUsernamePassword(credentials.username, credentials.password);
				this.logger.spin('Logging in...');

				const jwt = await this.getJWT(inputs.username, inputs.password);
				const token = await this.createAccessToken(jwt, inputs.password);

				this.logger.info('Created an access token for %s', token.username);

				this._username = token.username;
				this._accessToken = token.token;

				if (this.saved) {
					this.save();
				}

				this.logger.stop();
			}
			else {
				const token = await promptToken();
				return this._loginWithUserProvidedToken(token);
			}
		}
	}

	/**
	 * Tests the given access token and saves it if successful.
	 */
	private async _loginWithUserProvidedToken(token: string) {
		this.logger.spin('Logging in...');

		const originalToken = this._accessToken;
		this._accessToken = token;

		try {
			const profile = await this.getUserProfile();

			this.logger.stop();
			this.logger.info('Logged in with access token for %s', profile.Username);

			this._username = profile.Username;

			if (this.saved) {
				this.save();
			}
		}
		catch (error) {
			this._accessToken = originalToken;
			throw error;
		}
		finally {
			this.logger.stop();
		}
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
		return this.get<UserResponse>('/users/me', {
			disableAuthentication: !!jwt,
			headers: (jwt ? { 'Authorization': `Bearer ${jwt}` } : undefined)
		});
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
	 * Saves configuration and credentials to the global store.
	 */
	public save() {
		if (!this._username) {
			throw new Error('Cannot save without a username');
		}

		const servers = this.configuration.get('servers');
		const match = servers.find((server) => server.id === this._registration?.id);

		if (match) {
			match.host = this.host;
			match.token = this._accessToken;
			match.username = this._username;
			match.name = this._name ?? this.host;

			this._registration = match;
			return this.configuration.set('servers', servers);
		}

		this._registration = {
			id: randomUUID(),
			name: this._name ?? this.host,
			host: this.host,
			url: this._url,
			token: this._accessToken,
			username: this._username,
			createdAt: Date.now()
		};

		servers.push(this._registration);
		return this.configuration.set('servers', servers);
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
			agent: (url) => (url.protocol === 'https:') ? this._agent : undefined
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

export interface PortainerCredentials {
	username?: string;
	password?: string;
	token?: string;
}

export interface PortainerRegistration {
	id: string;
	name: string;
	host: string;
	url: string;
	username: string;
	token?: string;
	createdAt: number;
}
