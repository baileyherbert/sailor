/**
 * Parses the given URL or throws an error if invalid.
 */
export function parseUrlOrFail(input: string) {
	try {
		input = input.trim();

		if (!input.match(/^https?:/i)) {
			input = 'http://' + input;
		}

		return new URL(input);
	}
	catch {
		throw new Error('Invalid URL');
	}
}
