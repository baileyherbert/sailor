import { container } from '@baileyherbert/container';
import { SailorAction } from '../foundation/SailorAction';
import { ConfigurationStore } from '../../stores/ConfigurationStore';
import kleur from 'kleur';

export class ListAction extends SailorAction {
	public constructor() {
		super({
			actionName: 'list',
			summary: 'Lists available servers',
			documentation: 'Lists available servers'
		});
	}

	protected override async onExecuteAsync() {
		const servers = this.configuration.getServers();

		if (servers.length) {
			this.logger.info(
				`Found ${kleur.cyan('%d')} registered server%s:`,
				servers.length,
				servers.length !== 1 ? 's' : ''
			);

			for (const server of servers) {
				this.logger.info(
					` - ${kleur.green('%s (%s)')} at ${kleur.yellow('%s')}`,
					server.name,
					server.username,
					server.url,
				);
			}
		}
		else {
			this.logger.info('There are no saved servers right now!');
			this.logger.info(`Add your first server with the ${kleur.cyan('sailor add')} command!`);
		}
	}
}
