import { container } from '@baileyherbert/container';
import { CommandLineAction } from '@rushstack/ts-command-line';
import { Logger } from './Logger';

export abstract class SailorAction extends CommandLineAction {
	protected readonly logger = container.resolve(Logger);
    protected abstract override onExecuteAsync(): Promise<void>;
}
