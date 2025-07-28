import { Agent } from 'https';
import { connect, ConnectionOptions, checkServerIdentity, TLSSocket, PeerCertificate } from 'tls';
import { container } from '@baileyherbert/container';
import { Logger } from '../cli/foundation/Logger';
import { CertificateStore } from '../stores/CertificateStore';
import kleur from 'kleur';

export class PortainerAgent extends Agent {
	protected readonly logger = container.resolve(Logger);
	protected readonly certificates = container.resolve(CertificateStore);

	public constructor() {
		super({
			rejectUnauthorized: false
		});
	}

	public override createConnection(options: ConnectionOptions, callback?: any): any {
		this.logger.debug('Connecting to %s using TLS...', options.host);

		const socket = connect(options, async () => {
			this.logger.debug('Connected to %s at %s:%s', options.host, socket.remoteAddress, socket.remotePort);

			const certificate = socket.getPeerCertificate();
			const error = this._getCertificateError(socket, certificate, options.host);

			if (error) {
				if (this.certificates.hasFingerprint(certificate.fingerprint256)) {
					this.logger.debug('Erroneous certificate is marked as trusted by the local user');

					return callback(null, socket);
				}

				this.logger.error(
					kleur.red('Host %s returned a TLS certificate that is invalid, expired, or self-signed.'),
					options.host
				);

				this.logger.error(kleur.red('Authorization error: %s'), error);

				this.logger.error(kleur.red(kleur.bold('  Fingerprint:') + ' %s'), certificate.fingerprint);
				this.logger.error(kleur.red(kleur.bold('  Subject:') + ' %s'), certificate.subjectaltname ?? '<unknown>');
				this.logger.error(kleur.red(kleur.bold('  Issuer:') + ' %s'), this._getCertificateIssuer(certificate));
				this.logger.error(kleur.red(kleur.bold('  Expiration:') + ' %s'), certificate.valid_to);

				this.logger.error(kleur.red(`This could indicate that you've connected to the wrong server or possibly something more nefarious.`));
				this.logger.error(kleur.red(`Only proceed if you're certain that this error is expected!`));

				try {
					const { confirm } = await this.logger.prompt<{ confirm: boolean }>({
						type: 'confirm',
						name: 'confirm',
						message: 'Permanently trust this certificate?',
					});

					if (confirm) {
						this.certificates.addFingerprint(certificate.fingerprint256);
						this.logger.debug('Added certificate to the local list of trusted fingerprints');

						return callback(null, socket);
					}
				}
				catch (error) {
					return callback(error);
				}

				return callback(new Error('Rejected TLS certificate: ' + error));
			}

			callback(null, socket);
		});

		return;
	}

	private _getCertificateError(socket: TLSSocket, certificate: PeerCertificate, host?: string) {
		if (typeof host !== 'string') {
			return 'No host was available on the socket';
		}

		if (!socket.authorized) {
			const error = (typeof socket.authorizationError === 'string' ? socket.authorizationError : socket.authorizationError.message);
			return error;
		}

		const error = checkServerIdentity(host, certificate);

		if (error) {
			return error.message;
		}

		return;
	}

	private _getCertificateIssuer(certificate: PeerCertificate) {
		const segments = [
			certificate.issuer.CN,
			certificate.issuer.O,
			certificate.issuer.L,
			certificate.issuer.ST,
			certificate.issuer.C
		];

		const issuer = segments.map((s) => s.trim()).filter((s) => s.length);

		if (issuer.length > 0) {
			return issuer.join(', ');
		}

		return '<unknown>';
	}
}
