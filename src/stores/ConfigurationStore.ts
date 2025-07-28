import { Singleton } from '@baileyherbert/container';
import Configstore from 'configstore';
import { PortainerRegistration } from '../portainer/Portainer';

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
}

interface Configuration {
	'certificates': string[];
	'servers': PortainerRegistration[];
}

const defaults: Configuration = {
	certificates: [],
	servers: []
};
