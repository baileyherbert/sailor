import { Singleton } from '@baileyherbert/container';
import { PortainerRegistration } from '../portainer/Portainer';
import Configstore from 'configstore';

@Singleton()
export class ConfigurationStore {
	private _store: Configstore;

	public constructor() {
		this._store = new Configstore('sailor');
	}

	/**
	 * Retrieves the value of the specified configuration.
	 */
	public get<K extends keyof Configuration>(key: K): Configuration[K] {
		return this._store.get(key) ?? defaults[key];
	}

	/**
	 * Sets the value of the specified configuration.
	 */
	public set<K extends keyof Configuration>(key: K, value: Configuration[K]) {
		return this._store.set(key, value);
	}

	/**
	 * Returns an array of saved servers.
	 */
	public getServers() {
		return this.get('servers');
	}

	/**
	 * Returns the server matching the given name (case-insensitive).
	 */
	public getServerFromName(name: string) {
		name = name.trim().toLowerCase();
		return this.getServers().find((server) => server.name.toLowerCase() === name);
	}

	/**
	 * Returns the server matching the given ID.
	 */
	public getServerFromId(id: string) {
		return this.getServers().find((server) => server.id === id);
	}

	/**
	 * Returns the server matching the given ID.
	 */
	public getServerFromConfiguration(url: string, username: string) {
		url = url.trim().toLowerCase().replace(/\/+$/, '');
		username = username.trim().toLowerCase();

		return this.getServers().find(
			(server) => server.username.toLowerCase() === username && server.url.toLowerCase() === url
		);
	}

	/**
	 * Adds or updates a server.
	 */
	public addServer(server: PortainerRegistration) {
		const servers = this.getServers();
		const existing = this.getServerFromConfiguration(server.url, server.username);

		if (existing) {
			const match = servers.find((server) => server.id === existing.id)!;
			Object.assign(match, server);
		}
		else {
			servers.push(server);
		}

		this.set('servers', servers);
	}

	/**
	 * Removes the given server. Returns true if found and removed.
	 */
	public removeServer(server: PortainerRegistration) {
		if (!server.id) {
			return false;
		}

		const servers = this.getServers();
		const filtered = servers.filter((e) => e.id !== server.id);

		this.set('servers', filtered);
		return filtered.length !== servers.length;
	}

	/**
	 * Returns true if the given name is available.
	 */
	public getNameAvailable(name: string) {
		name = name.trim().toLowerCase();
		return !this.getServers().some((server) => server.name.toLowerCase() === name);
	}
}

interface Configuration {
	'certificates': string[];
	'servers': PortainerRegistration[];
}

const defaults: Configuration = {
	certificates: [],
	servers: []
};
