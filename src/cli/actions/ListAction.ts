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
		const configuration = container.resolve(ConfigurationStore);
		const servers = configuration.get('servers');

		for (const server of servers) {
			this.logger.info(
				` - ${kleur.cyan('%s (%s)')} at %s`,
				server.name,
				server.username,
				server.url,
			);
		}

		if (!servers.length) {
			this.logger.info('There are no saved servers right now!');
			this.logger.info(`Add your first server with the ${kleur.cyan('sailor add')} command!`);
		}
	}
}
