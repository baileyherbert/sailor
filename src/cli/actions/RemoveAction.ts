import { CommandLineAction } from '@rushstack/ts-command-line';

export class RemoveAction extends CommandLineAction {
	public constructor() {
		super({
			actionName: 'remove',
			summary: 'Remove a server and saved credentials',
			documentation: 'Remove a server and saved credentials'
		});
	}

	protected override async onExecuteAsync() {}
}
