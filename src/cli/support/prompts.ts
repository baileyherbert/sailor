import { container } from '@baileyherbert/container';
import { Logger } from '../foundation/Logger';
import { BranchSummary } from 'simple-git';
import { PortainerRegistration } from '../../portainer/Portainer';
import kleur from 'kleur';
import { Endpoint } from '../../portainer/models/Endpoint';
import { PortainerService } from '../../portainer/PortainerClient';

const logger = container.resolve(Logger);

/**
 * Prompts the user to choose a login method (username/password or access token).
 */
export async function promptLoginMethod(): Promise<'password' | 'token'> {
	const { choice } = await logger.prompt<{ choice: string }>({
		type: 'select',
		name: 'choice',
		message: 'Login method',
		required: true,
		choices: [LOGIN_METHOD_PASSWORD, LOGIN_METHOD_TOKEN],
	});

	switch (choice) {
		case LOGIN_METHOD_PASSWORD: return 'password';
		case LOGIN_METHOD_TOKEN: return 'token';
		default: throw new Error(`Unknown login method ${choice}`);
	}
}

/**
 * Prompts the user for a username and password.
 */
export async function promptUsernamePassword(username?: string, password?: string) {
	if (username && password) {
		return {
			username,
			password
		};
	}

	const response = await logger.prompt<{ username: string; password: string }>([
		{
			type: 'text',
			message: 'Username',
			name: 'username',
			required: true,
			skip: !!username,
			result(input) {
				return input.trim();
			},
			validate(input) {
				input = input.trim();

				if (input.length === 0) {
					return 'Cannot be blank';
				}

				return true;
			}
		},
		{
			type: 'password',
			message: 'Password',
			name: 'password',
			required: true,
			skip: !!password,
			validate(input) {
				if (input.length === 0) {
					return 'Cannot be blank';
				}

				return true;
			}
		},
	]);

	return response;
}

/**
 * Prompts the user for a token.
 */
export async function promptToken() {
	const response = await logger.prompt<{ token: string }>({
		type: 'password',
		message: 'Token',
		name: 'token',
		required: true,
		result(input) {
			return input.trim();
		},
		validate(input) {
			input = input.trim();

			if (input.length === 0) {
				return 'Cannot be blank';
			}

			return true;
		}
	});

	return response.token;
}

/**
 * Prompts the user to select a server.
 */
export async function promptServer(servers: PortainerRegistration[]) {
	const serverMap = new Map(servers.map((server) => [`${server.name} (${server.username})`, server]));
	const { selection } = await logger.prompt<{ selection: string }>({
		type: 'select',
		name: 'selection',
		message: 'Choose a server',
		choices: [
			{
				name: 'cancel',
				message: '-- CANCEL --'
			},
			...servers.map((server) => ({
				name: `${server.name} (${server.username})`,
				message: `${kleur.green(`${server.name} (${server.username})`)} at ${kleur.yellow(server.url)}`
			}))
		]
	});

	if (selection === 'cancel') {
		throw new Error('Aborted');
	}

	const match = serverMap.get(selection);

	if (!match) {
		throw new Error('Selection not found');
	}

	return match;
}

/**
 * Prompts the user to select an endpoint.
 */
export async function promptEndpoint(endpoints: Endpoint[]) {
	const endpointMap = new Map(endpoints.map((endpoint) => [`${endpoint.Name} (${endpoint.Id})`, endpoint]));
	const { selection } = await logger.prompt<{ selection: string }>({
		type: 'select',
		name: 'selection',
		message: 'Choose an endpoint',
		choices: [
			{
				name: 'cancel',
				message: '(CANCEL)'
			},
			...endpoints.map((endpoint) => ({
				name: `${endpoint.Name} (${endpoint.Id})`,
				message: `${kleur.green(`${endpoint.Name}`)} (${endpoint.Id})`
			}))
		]
	});

	if (selection === 'cancel') {
		throw new Error('Aborted');
	}

	const match = endpointMap.get(selection);

	if (!match) {
		throw new Error('Selection not found');
	}

	return match;
}

/**
 * Prompts the user to select a service.
 */
export async function promptService(services: PortainerService[]) {
	const serviceMap = new Map(services.map(
		(service) => [`${service.name} in ${service.stack.Name} (${service.image ?? 'no image'})`, service])
	);

	const { selection } = await logger.prompt<{ selection: string }>({
		type: 'select',
		name: 'selection',
		message: 'Choose which service to deploy to',
		choices: [
			{
				name: 'cancel',
				message: '-- CANCEL --'
			},
			...services.map((service) => ({
				name: `${service.name} in ${service.stack.Name} (${service.image ?? 'no image'})`,
				message: `${kleur.green(`${service.name}`)} in ${kleur.yellow(service.stack.Name)} (${service.image ?? 'no image'})`
			}))
		]
	});

	if (selection === 'cancel') {
		throw new Error('Aborted');
	}

	const match = serviceMap.get(selection);

	if (!match) {
		throw new Error('Selection not found');
	}

	return match;
}

/**
 * Prompts the user to enter a branch name.
 */
export async function promptBranch(branches: BranchSummary) {
	const response = await logger.prompt<{ branch: string }>({
		type: 'text',
		name: 'branch',
		initial: branches.current,
		message: 'Choose which git branch to deploy',
		required: true,
		result(input) {
			return input.trim();
		},
	});

	return response.branch;
}

const LOGIN_METHOD_PASSWORD = 'Username and password';
const LOGIN_METHOD_TOKEN = 'Access token';
