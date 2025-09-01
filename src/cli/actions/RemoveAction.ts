import { CommandLineStringParameter } from '@rushstack/ts-command-line';
import { SailorAction } from '../foundation/SailorAction';
import { promptServer } from '../support/prompts';

export class RemoveAction extends SailorAction {
	private _nameParam: CommandLineStringParameter;

	public constructor() {
		super({
			actionName: 'remove',
			summary: 'Remove a server and saved credentials',
			documentation: 'Remove a server and saved credentials'
		});

		this._nameParam = this.defineStringParameter({
			parameterLongName: '--name',
			parameterShortName: '-n',
			argumentName: 'VALUE',
			description: 'The name of the server to remove.'
		});
	}

	protected override async onExecuteAsync() {
		if (this._nameParam.value) {
			const count = this._removeFromName(this._nameParam.value);

			if (count === 0) {
				this.logger.info('No servers matched the given name');
			}

			this.logger.info(`Removed %d server%s`, count, count !== 1 ? 's' : '');
			return;
		}

		const servers = this.configuration.getServers();

		if (servers.length === 0) {
			this.logger.info('There are no saved servers right now!');
			return;
		}

		const server = await promptServer(servers);
		const count = this._removeFromId(server.id);

		this.logger.info(`Removed %d server%s`, count, count !== 1 ? 's' : '');

		return;
	}

	private _removeFromName(name: string) {
		const server = this.configuration.getServerFromName(name);

		if (server) {
			this.configuration.removeServer(server);
			return 1;
		}

		return 0;
	}

	private _removeFromId(id: string) {
		const server = this.configuration.getServerFromId(id);

		if (server) {
			this.configuration.removeServer(server);
			return 1;
		}

		return 0;
	}
}
