import { container } from '@baileyherbert/container';
import { Logger } from '../foundation/Logger';

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

const LOGIN_METHOD_PASSWORD = 'Username and password';
const LOGIN_METHOD_TOKEN = 'Access token';
