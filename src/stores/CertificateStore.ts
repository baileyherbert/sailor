import { Singleton } from '@baileyherbert/container';
import { ConfigurationStore } from './ConfigurationStore';

@Singleton()
export class CertificateStore {
	public constructor(protected readonly config: ConfigurationStore) {}

	/**
	 * Returns true if the given 256-bit fingerprint is trusted by the local user.
	 */
	public hasFingerprint(fingerprint: string) {
		const target = fingerprint.toUpperCase();
		const fingerprints = new Set(this.config.get('certificates').map((f) => f.toUpperCase()));

		return fingerprints.has(target);
	}

	/**
	 * Adds the given 256-bit fingerprint to the local user's trust store.
	 */
	public addFingerprint(fingerprint: string) {
		const target = fingerprint.toUpperCase();
		const fingerprints = new Set(this.config.get('certificates').map((f) => f.toUpperCase()));

		if (!fingerprints.has(target)) {
			fingerprints.add(target);
			this.config.set('certificates', Array.from(fingerprints));
		}
	}
}
