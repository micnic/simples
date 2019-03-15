import { EventEmitter } from 'events';
import { IncomingMessage, RequestOptions, ServerResponse } from 'http';
import { ServerOptions as HTTPSServerOptions } from 'https';
import { PassThrough, Transform, Writable } from 'stream';
import { Url } from 'url';
import { ZlibOptions } from 'zlib';

type CacheConfig = {
	type?: 'public' | 'private';
	maxAge?: number;
	sMaxAge?: number;
};

type Callback = () => void;

type ClientOptions = {};

type RequestCallback = (response: ServerResponse, body: Buffer) => void;

type Container<T> = {
	[key: string]: T;
};

type CookieAttributes = {
	domain?: string;
	expires?: number;
	httpOnly?: boolean;
	maxAge?: number;
	path?: string;
	secure?: boolean;
};

type DataCallback<D> = (data: D) => void;
type DataImporter<D, S, T> = (connection: HTTPConnection<D, S>, callback: DataCallback<T>) => void;
type Enabled = boolean | EnabledFunction;
type EnabledFunction = () => boolean;
type ErrorCallback = (error: Error) => void;
type FormCallback = (form: Form) => void;

type IpAddress = {
	port: number;
	family: string;
	address: string;
};

type Middleware<D, S> = (connection: HTTPConnection<D, S>, next: Callback) => void;

type MirrorCallback<D> = (mirror: Mirror<D>) => void;

type MirrorOptions = {
	port?: number;
	hostname?: string;
	backlog?: number;
	https?: HTTPSServerOptions;
};

type ParseConfig<J> = {
	limit?: number;
	plain?: FormCallback;
	json?: ResultCallback<J>;
	multipart?: FormCallback;
	urlencoded?: ResultCallback<Container<string | string[]>>;
};

type PipeOptions = {
	end?: boolean;
};

type ResultCallback<R> = (error: Error, result: R) => void;
type RouteListener<D, S> = (connection: HTTPConnection<D, S>) => void;

type RouterCompressionOptions = {
	enabled?: Enabled;
	options?: ZlibOptions;
	preferred?: 'deflate' | 'gzip';
};

type RouterCORSOptions = {
	credentials?: boolean;
	headers?: string[];
	methods?: string[];
	origins?: string[];
};

type RouterLoggerOptions = {
	enabled?: Enabled;
	format?: string;
	log?: StringCallback;
	tokens?: Tokens;
};

type RouterOptions<S> = {
	compression?: RouterCompressionOptions;
	cors?: RouterCORSOptions;
	logger?: RouterLoggerOptions;
	session?: RouterSessionOptions<S>;
	static?: RouterStaticOptions;
	timeout?: RouterTimeoutOptions;
};

type RouterSessionOptions<S> = {
	enabled?: Enabled;
	store?: Store<S>;
	timeout?: number;
};

type RouterStaticOptions = {
	enabled?: Enabled;
	index?: string[];
	location?: string;
};

type RouterTimeoutOptions = {
	enabled?: Enabled;
	value?: number;
};

type ServerCallback<T> = (server: Server<T>) => void;

type ServerOptions<S> = {
	config?: RouterOptions<S>;
} & MirrorOptions;

type SessionContainer<S> = {
	container: S;
	hash: string;
	id: string;
	timeout: number
};

type StringContainer = {
	[key: string]: string;
};

type StringCallback = DataCallback<string>;

type TemplateEngine<I> = {
	render(source: string, imports: I, callback: StringCallback): void;
};

type Tokens = {
	[key: string]: (data: string) => string;
};

type WSFilterCallback<D, S> = (connection: WSConnection<D, S>, index: number, connections: WSConnection<D, S>[]) => void;
type WSListener<D, S> = (connection: WSConnection<D, S>) => void;

type WSOptions = {
	advanced: boolean;
	limit: number;
	origins: string[];
	timeout: number;
};

interface StoreInterface<S> {

	get(id: string): Promise<SessionContainer<S>>;
	set(id: string, session: SessionContainer<S>): Promise<null>;
	unset(id: string): Promise<null>;
};

abstract class Connection<D, S> extends Transform {

	cookies: StringContainer;
	data: D;
	headers: StringContainer;
	host: string;
	hostname: string;
	href: string;
	ip: IpAddress;
	langs: string[];
	params: StringContainer;
	path: string;
	protocol: string;
	query: StringContainer;
	request: IncomingMessage;
	session: Container<S>;
	url: Url;

	destroy(): void;
	log(format: string | Buffer, tokens?: Tokens): Connection<D, S>;
	log(logger: StringCallback, tokens?: Tokens): Connection<D, S>;
	log(format?: string | Buffer, logger?: StringCallback, tokens?: Tokens): Connection<D, S>;
}

abstract class Broadcaster<D, S> extends EventEmitter {

	connections: Set<WSConnection<D, S>>;

	broadcast<T>(event: string, data: T, filter?: WSFilterCallback<D, S>): Broadcaster<D, S>;
	broadcast<T>(data: T, filter?: WSFilterCallback<D, S>): Broadcaster<D, S>;
}

declare class Client extends EventEmitter {

	delete(location: string, options: RequestOptions, callback: RequestCallback): Request;
	head(location: string, options: RequestOptions, callback: RequestCallback): Request;
	get(location: string, options: RequestOptions, callback: RequestCallback): Request;
	patch(location: string, options: RequestOptions, callback: RequestCallback): Request;
	post(location: string, options: RequestOptions, callback: RequestCallback): Request;
	put(location: string, options: RequestOptions, callback: RequestCallback): Request;
	request(method: string, location: string, options: RequestOptions, callback: RequestCallback): Request;
	ws(location: string, mode: string, options): ClientConnection;
}

declare class ClientConnection extends Transform {

	close(callback: Callback): void;
	close(code?: number, callback?: Callback): void;
	destroy(): void;
	send<D>(data: D): void;
	send<D, R>(event: string, data: D, callback?: DataCallback<R>): void;
}

declare class Request extends Transform {

	send<D>(data: D, callback: Callback): void;
	stream(destination: Writable, options?: PipeOptions): void;
}

declare class HTTPConnection<D, S> extends Connection<D, S> {

	method: string;
	response: ServerResponse;

	cache(): string;
	cache(config: CacheConfig | string): HTTPConnection<D, S>;
	close(callback?: Callback): void;
	cookie(name: string, value: string, attributes?: CookieAttributes): HTTPConnection<D, S>;
	drain(location: string, type?: string, override?: boolean): void;
	error(code: number): void;
	header(name: string): string;
	header(name: string, value: string | number | boolean | string[]): HTTPConnection<D, S>;
	keep(timeout?: number): HTTPConnection<D, S>;
	lang(): string;
	lang(value: string): HTTPConnection<D, S>;
	link(): string;
	link(links: StringContainer): HTTPConnection<D, S>;
	parse<J>(config: ParseConfig<J>): void;
	redirect(location: string, permanent?: boolean): void;
	render<I>(source: string, imports: I, callback?: Callback): void;
	send<T>(data: T, callback?: Callback): void;
	status(): number;
	status(code: number): HTTPConnection<D, S>;
	type(): string;
	type(type: string, override?: boolean): HTTPConnection<D, S>;
}

declare class Form extends PassThrough {

	type: string;
}

declare class Router<D> extends EventEmitter {

	/**
	 * Container to store user data
	 */
	data: D;

	/**
	 * Route all types of requests
	 */
	all<A, S>(route: string, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route all types of requests
	 */
	all<T>(route: string, view: string, imports?: T): Router<D>;

	/**
	 * Route all types of requests
	 */
	all<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Configure router compression options
	 */
	compression(config: RouterCompressionOptions): Router<D>;

	/**
	 * Configure router CORS options
	 */
	cors(config: RouterCORSOptions): Router<D>;

	/**
	 * Route DELETE requests
	 */
	delete<A, S>(route: string, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route DELETE requests
	 */
	delete<T>(route: string, view: string, imports?: T): Router<D>;

	/**
	 * Route DELETE requests
	 */
	delete<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Define the template engine to render the responses
	 */
	engine<I>(engine: TemplateEngine<I>): Router<D>;

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 */
	error<A, S>(code: number, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 */
	error<T>(code: number, view: string, imports?: T): Router<D>;

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 */
	error<A, S, T>(code: number, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Route GET requests
	 */
	get<A, S>(route: string, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route GET requests
	 */
	get<T>(route: string, view: string, imports?: T): Router<D>;

	/**
	 * Route GET requests
	 */
	get<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Configure router logger options
	 */
	logger(format: string, config: RouterLoggerOptions): Router<D>;

	/**
	 * Configure router logger options
	 */
	logger(config: RouterLoggerOptions): Router<D>;

	/**
	 * Route PATCH requests
	 */
	patch<A, S>(route: string, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route PATCH requests
	 */
	patch<T>(route: string, view: string, imports?: T): Router<D>;

	/**
	 * Route PATCH requests
	 */
	patch<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Route POST requests
	 */
	post<A, S>(route: string, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route POST requests
	 */
	post<T>(route: string, view: string, imports?: T): Router<D>;

	/**
	 * Route POST requests
	 */
	post<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Route PUT requests
	 */
	put<A, S>(route: string, listener: RouteListener<A, S>): Router<D>;

	/**
	 * Route PUT requests
	 */
	put<T>(route: string, view: string, imports?: T): Router<D>;

	/**
	 * Route PUT requests
	 */
	put<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): Router<D>;

	/**
	 * Create a new router
	 */
	router<S>(location: string, options?: RouterOptions<S>): Router<D>;

	/**
	 * Configure router session options
	 */
	session(config: RouterSessionOptions): Router<D>;

	/**
	 * Configure router static files options
	 */
	static(location: string, config: RouterStaticOptions): Router<D>;

	/**
	 * Configure router static files options
	 */
	static(config: RouterStaticOptions): Router<D>;

	/**
	 * Configure router HTTP timeout
	 */
	timeout(value: number): Router<D>;

	/**
	 * Add a middleware to the router
	 */
	use<A, S>(middleware: Middleware<A, S>): Router<D>;

	/**
	 * Set a new WS host
	 */
	ws<A, S>(location: string, options: WSOptions, listener: WSListener<A, S>): WSHost<A, S>;

	/**
	 * Set a new WS host
	 */
	ws<A, S>(location: string, listener?: WSListener<A, S>): WSHost<A, S>;
}

declare class HTTPHost<D> extends Router<D> {}

declare class Mirror<D> extends EventEmitter {

	data: D;

	/**
	 * Start or restart the mirror
	 */
	start(port?: number, callback?: MirrorCallback<D>): Mirror<D>;

	/**
	 * Start or restart the mirror
	 */
	start(callback: MirrorCallback<D>): Mirror<D>;

	/**
	 * Stop the mirror
	 */
	stop(callback?: MirrorCallback<D>): Mirror<D>;
}

declare class Server<D> extends HTTPHost<D> {

	/**
	 * Create a new HTTP host
	 */
	host<S, H>(name: string, options?: RouterOptions<S>): HTTPHost<H>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(port?: number, options?: MirrorOptions, callback?: MirrorCallback<M>): Mirror<M>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(port: number, callback?: MirrorCallback<M>): Mirror<M>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(options: MirrorOptions, callback?: MirrorCallback<M>): Mirror<M>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(callback: MirrorCallback<M>): Mirror<M>;

	/**
	 * Start or restart the server
	 */
	start(port?: number, callback?: ServerCallback<D>): Server<D>;

	/**
	 * Start or restart the server
	 */
	start(callback: ServerCallback<D>): Server<D>;

	/**
	 * Stop the server
	 */
	stop(callback?: ServerCallback<D>): Server<D>;
}

declare class Store<S> implements StoreInterface<S> {

	get(id: string): Promise<SessionContainer<S>>;
	set(id: string, session: SessionContainer<S>): Promise<null>;
	unset(id: string): Promise<null>;
}

declare class Channel<D, S> extends Broadcaster<D, S> {

	bind(connection: WSConnection<D, S>): Channel<D, S>;
	close(): void;
	unbind(connection: WSConnection<D, S>): Channel<D, S>;
}

declare class WSConnection<D, S> extends Connection<D, S> {

	protocols: string[];

	close(code?: number, callback?: Callback): void;
	close(callback: Callback): void;
	send<T, R>(event: string, data: T, callback?: DataCallback<R>): void;
	send<T>(data: T): void;
}

declare class WSHost<D, S> extends Broadcaster<D, S> {

	channel(name: string, filter?: WSFilterCallback<D, S>): Channel<D, S>;
}

/**
 * Create and start a new server
 */
declare function simples<S, D>(port?: number, options?: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

/**
 * Create and start a new server
 */
declare function simples<D>(port: number, callback: ServerCallback<D>): Server<D>;

/**
 * Create and start a new server
 */
declare function simples<S, D>(options: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

/**
 * Create and start a new server
 */
declare function simples<D>(callback: ServerCallback<D>): Server<D>;

declare namespace simples {

	/**
	 * Create a new client
	 */
	function client(options?: ClientOptions): Client;

	/**
	 * Create and start a new server
	 */
	function server<S, D>(port?: number, options?: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

	/**
	 * Create and start a new server
	 */
	function server<D>(port: number, callback: ServerCallback<D>): Server<D>;

	/**
	 * Create and start a new server
	 */
	function server<S, D>(options: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

	/**
	 * Create and start a new server
	 */
	function server<D>(callback: ServerCallback<D>): Server<D>;

	/**
	 * Create a new session store
	 */
	function store<S>(options?: StoreInterface<S>): Store<S>;
}

export = simples;