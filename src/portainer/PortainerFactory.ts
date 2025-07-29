import { container } from '@baileyherbert/container';
import { Logger } from '../cli/foundation/Logger';
import { PortainerClient } from './PortainerClient';
import { AuthenticationMethod } from './enum/AuthenticationMethod';
import { promptLoginMethod, promptToken, promptUsernamePassword } from '../cli/support/prompts';
import { ConfigurationStore } from '../stores/ConfigurationStore';
import { Portainer } from './Portainer';

export class PortainerFactory {
	private static logger = container.resolve(Logger);
	private static configuration = container.resolve(ConfigurationStore);

	/**
	 * Logs into a portainer server and returns an instance. Automatically prompts the user for credentials as needed.
	 * Throws an error upon failure.
	 *
	 * @param credentials Optional user-provided credentials (e.g. from parameters or the environment).
	 * @returns
	 */
	public static async createFromLogin(url: string, credentials: PortainerLoginCredentials = {}) {
		const client = new PortainerClient(url);

		if (credentials.token) {
			return this._loginWithUserProvidedToken(client, credentials.token);
		}

		this.logger.spin('Connecting to portainer...');

		const method = await client.getLoginMethod();

		this.logger.debug('Portainer reported configured login method: %s', AuthenticationMethod[method]);
		this.logger.stop();

		if (method === AuthenticationMethod.Internal) {
			const method = (!!credentials.username || !!credentials.password) ? 'password' : await promptLoginMethod();

			if (method === 'password') {
				const inputs = await promptUsernamePassword(credentials.username, credentials.password);
				const existing = this.configuration.getServerFromConfiguration(url, inputs.username);

				if (existing) {
					throw new Error('A server with that configuration already exists');
				}

				this.logger.spin('Logging in...');

				const jwt = await client.getJWT(inputs.username, inputs.password);
				const token = await client.createAccessToken(jwt, inputs.password);

				this.logger.info('Created an access token for %s', token.username);
				this.logger.stop();

				const instance = new Portainer(url, token.username, token.token);

				if (instance.saved) {
					throw new Error('A server with that configuration already exists');
				}

				return instance;
			}
		}

		const token = await promptToken();
		return this._loginWithUserProvidedToken(client, token);
	}

	/**
	 * Tests the given access token and saves it if successful.
	 */
	private static async _loginWithUserProvidedToken(client: PortainerClient, token: string) {
		try {
			this.logger.spin('Logging in...');
			client.setToken(token);

			const profile = await client.getUserProfile();

			this.logger.stop();
			this.logger.info('Logged in with access token for %s', profile.Username);

			return new Portainer(client.url, profile.Username, token);
		}
		finally {
			this.logger.stop();
		}
	}
}

export interface PortainerLoginCredentials {
	username?: string;
	password?: string;
	token?: string;
}
