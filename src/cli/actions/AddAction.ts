import { CommandLineAction } from '@rushstack/ts-command-line';

export class AddAction extends CommandLineAction {
	public constructor() {
		super({
			actionName: 'add',
			summary: 'Add a new server for deployments',
			documentation: 'Add a new server for deployments'
		});
	}

	protected override async onExecuteAsync() {}
}
