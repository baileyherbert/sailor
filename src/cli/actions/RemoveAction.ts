import { CommandLineStringParameter } from '@rushstack/ts-command-line';
import { SailorAction } from '../foundation/SailorAction';
import kleur from 'kleur';

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

		const servers = this._getServerList();

		if (servers.length === 0) {
			this.logger.info('There are no saved servers right now!');
			return;
		}

		const { selection } = await this.logger.prompt<{ selection: string }>({
			type: 'select',
			name: 'selection',
			message: 'Choose a server to remove',
			choices: [
				{
					name: 'cancel',
					message: '<cancel>'
				},
				...servers.map((server) => ({
					name: server.id,
					message: `${kleur.cyan(`${server.name} (${server.username})`)} at ${server.url}`
				}))
			]
		});

		if (selection === 'cancel') {
			throw new Error('Aborted');
		}

		const count = this._removeFromId(selection);
		this.logger.info(`Removed %d server%s`, count, count !== 1 ? 's' : '');

		return;
	}

	private _getServerList() {
		return this.configuration.get('servers');
	}

	private _removeFromName(name: string) {
		const servers = this._getServerList();
		const filtered = servers.filter((server) => server.name !== name);
		const count = servers.length - filtered.length;

		if (count > 0) {
			this.configuration.set('servers', filtered);
		}

		return count;
	}

	private _removeFromId(id: string) {
		const servers = this._getServerList();
		const filtered = servers.filter((server) => server.id !== id);
		const count = servers.length - filtered.length;

		if (count > 0) {
			this.configuration.set('servers', filtered);
		}

		return count;
	}
}
