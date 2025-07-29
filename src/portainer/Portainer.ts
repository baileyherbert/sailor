import { randomUUID } from 'crypto';
import { PortainerClient } from './PortainerClient';

export class Portainer extends PortainerClient {

	/**
	 * The name for this instance.
	 */
	public name: string;

	/**
	 * The username for this instance.
	 */
	public readonly username: string;

	private _registration?: PortainerRegistration;

	public constructor(url: string, username: string, token?: string) {
		super(url);

		this.username = username;
		this.name = this.host;
		this._registration = this.configuration.getServerFromConfiguration(this.url, this.username);

		if (this._registration) {
			this.name = this._registration.name;
			this.setToken(this._registration.token);

			this.logger.debug('Loaded server registration %s from configuration store', this._registration.id);
		}

		if (token) {
			this.setToken(token);
		}
	}

	/**
	 * Returns true if the instance is saved to the system.
	 */
	public get saved() {
		return !!this._registration;
	}

	/**
	 * Saves configuration and credentials to the global store.
	 */
	public save() {
		if (!this._registration) {
			this._registration = {
				id: randomUUID(),
				name: this.name,
				host: this.host,
				url: this.url,
				username: this.username,
				token: this.getToken(),
				createdAt: Date.now()
			};
		}

		this.configuration.addServer(this._registration);
		return this._registration;
	}
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
