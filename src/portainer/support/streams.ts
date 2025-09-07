export function splitStream(stream: StreamSource, delimiter: string, options?: SplitStreamOptions): AsyncIterable<string>;
export function splitStream(stream: StreamSource, delimiter: RegExp, options?: SplitStreamOptions): AsyncIterable<string>;
export function splitStream(stream: StreamSource, delimiter: Uint8Array, options?: SplitStreamOptions): AsyncIterable<Uint8Array>;
export function splitStream(stream: StreamSource, delimiter: Buffer, options?: SplitStreamOptions): AsyncIterable<Uint8Array>;
export function splitStream(stream: StreamSource, delimiter: Delimiter, options: SplitStreamOptions = {}) {
	if (typeof delimiter === 'string' || delimiter instanceof RegExp) {
		return splitText(stream, delimiter, options);
	}

	return splitBytes(stream, toU8(delimiter), options);
}

async function* splitText(source: StreamSource, delimiter: string | RegExp, options: SplitStreamOptions): AsyncIterable<string> {
	const td = options.decoder ?? new TextDecoder('utf-8');
	const iter = toAsyncIterable(source);
	const abortPromise = getAbortPromise(options, iter.cancel);
	const isStringDelimiter = typeof delimiter === 'string';

	try {
		let carry = '';
		let rx: RegExp | null = null;

		if (delimiter instanceof RegExp) {
			const flags = new Set(delimiter.flags.split(''));

			flags.add('g');
			flags.add('u');

			const keep = (f: string) => ['i', 'u', 'g'].includes(f);
			const built = Array.from(flags).filter(keep);

			rx = new RegExp(delimiter.source, built.join(''));
		}

		for await (const chunk of abortable(iter.iterable, abortPromise)) {
			carry += td.decode(chunk, { stream: true });

			if (isStringDelimiter) {
				let idx: number;

				while ((idx = carry.indexOf(delimiter)) !== -1) {
					yield carry.slice(0, idx);
					carry = carry.slice(idx + delimiter.length);
				}
			}
			else {
				rx!.lastIndex = 0;

				let match: RegExpExecArray | null;
				let lastPos = 0;

				while ((match = rx!.exec(carry)) !== null) {
					yield carry.slice(lastPos, match.index);
					lastPos = rx!.lastIndex;

					if (match[0].length === 0) {
						rx!.lastIndex++;
						lastPos = rx!.lastIndex;
					}
				}

				carry = carry.slice(lastPos);
			}
		}

		carry += td.decode();
		yield carry;
	}
	catch (error) {
		await iter.cancel(error);
		throw error;
	}
}

async function* splitBytes(source: StreamSource, delimiter: Uint8Array, options: SplitStreamOptions): AsyncIterable<Uint8Array> {
	const iter = toAsyncIterable(source);
	const abortPromise = getAbortPromise(options, iter.cancel);

	try {
		let carry = new Uint8Array<any>(0);

		for await (const chunk of abortable(iter.iterable, abortPromise)) {
			carry = concatU8(carry, chunk);

			let idx: number;

			while ((idx = indexOfBytes(carry, delimiter)) !== -1) {
				yield carry.subarray(0, idx);
				carry = carry.subarray(idx + delimiter.length);
			}
		}

		yield carry;
	}
	catch (error) {
		await iter.cancel(error);
		throw error;
	}
}

function getAbortPromise(options: SplitStreamOptions, cancel: (reason: unknown) => Promise<void>) {
	try {
		options.signal?.throwIfAborted();
	}
	catch (error) {
		cancel(error);
		throw error;
	}

	return new Promise<never>((_, reject) => {
		options.signal?.addEventListener('abort', () => {
			try {
				options.signal?.throwIfAborted();
				throw new DOMException('The operation was aborted', 'AbortError'); // this should never happen but JIC
			}
			catch (error) {
				cancel(error);
				return reject(error);
			}
		}, { once: true });
	});;
}

function toAsyncIterable(source: StreamSource): AsyncSource {
	if (isNodeReadable(source)) {
		return {
			iterable: source as AsyncIterable<Uint8Array>,
			cancel: async (reason) => {
				try {
					(source as any).destroy?.(reason instanceof Error ? reason : undefined);
				}
				catch {}
			}
		};
	}

	if (isWebReadable(source)) {
		const reader = source.getReader();

		return {
			iterable: (async function* () {
				try {
					while (true) {
						const { value, done } = await reader.read();

						if (done) {
							break;
						}

						if (value) {
							yield value;
						}
					}
				}
				finally {
					reader.releaseLock();
				}
			})(),
			cancel: async (reason?: unknown) => {
				try {
					await reader.cancel(reason);
				}
				catch {}
			}
		};
	}

	throw new TypeError('Unsupported stream type');
}

async function* abortable<T>(source: AsyncIterable<T>, abortPromise: Promise<never>): AsyncIterable<T> {
	for await (const chunk of source) {
		yield Promise.race([Promise.resolve(chunk), abortPromise]);
	}
}

function isNodeReadable(x: any): x is NodeJS.ReadableStream {
	return x && typeof x.on === 'function' && typeof x.read === 'function' && typeof x[Symbol.asyncIterator] === 'function';
}

function isWebReadable(x: any): x is ReadableStream<Uint8Array> {
	return typeof ReadableStream !== 'undefined' && x instanceof ReadableStream;
}

function toU8(b: Uint8Array | Buffer): Uint8Array {
	return b instanceof Uint8Array ? b : new Uint8Array(b);
}

function concatU8(a: Uint8Array, b: Uint8Array): Uint8Array {
	if (a.length === 0) {
		return b;
	}

	if (b.length === 0) {
		return a;
	}

	const out = new Uint8Array(a.length + b.length);

	out.set(a, 0);
	out.set(b, a.length);

	return out;
}

function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
	if (needle.length > hay.length) {
		return -1;
	}

	outer: for (let i = 0; i <= hay.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (hay[i + j] !== needle[j]) {
				continue outer;
			}
		}

		return i;
	}

	return -1;
}

type Delimiter = string | RegExp | Uint8Array | Buffer;
type StreamSource = NodeJS.ReadableStream | ReadableStream<Uint8Array>;

interface AsyncSource {
	iterable: AsyncIterable<Uint8Array>;
	cancel: (reason?: any) => Promise<void>;
}

export interface SplitStreamOptions {
	decoder?: TextDecoder;
	signal?: AbortSignal;
}
