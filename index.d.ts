import { EventEmitter } from 'events';
import { IncomingHttpHeaders, IncomingMessage, RequestOptions, ServerResponse } from 'http';
import { ServerOptions as HTTPSServerOptions } from 'https';
import { Socket } from 'net';
import { PassThrough, Readable, Transform, Writable } from 'stream';
import { URL } from 'url';
import { ZlibOptions } from 'zlib';

type CacheConfig = {
	type?: CacheType;
	maxAge?: number;
	sMaxAge?: number;
};

type CacheType = 'public' | 'private';
type Callback = () => void;
type ClientConnectionOptions = {};
type ClientOptions = {};

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

type FormDataField = {
	data?: string | Buffer,
	filename?: string,
	headers?: StringContainer,
	stream?: Readable
};

type IPAddress = {
	port: number;
	family: string;
	address: string;
};

type Middleware<D, S> = (connection: HTTPConnection<D, S>, next: Callback) => void;
type MirrorCallback<D> = (mirror: Mirror<D>) => void;

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

type PreferredCompression = 'deflate' | 'gzip';
type ResultCallback<R> = (error: Error, result: R) => void;
type RouteListener<D, S> = (connection: HTTPConnection<D, S>) => void;

type RouterCompressionOptions = {
	enabled?: Enabled;
	options?: ZlibOptions;
	preferred?: PreferredCompression;
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

type ServerOptions = {
	port?: number;
	hostname?: string;
	backlog?: number;
	https?: HTTPSServerOptions;
};

type StreamConfig = {
	limit?: number
};

type StringContainer = Container<string>;
type StringCallback = DataCallback<string>;

type Tokens = {
	[key: string]: TokenFunction
};

type TokenFunction = (data: string) => string;
type WSFilterCallback<D, S> = (connection: WSConnection<D, S>, index: number, connections: WSConnection<D, S>[]) => void;
type WSListener<D, S> = (connection: WSConnection<D, S>) => void;

type WSOptions = {
	advanced: boolean;
	limit: number;
	origins: string[];
	session: Enabled;
	timeout: number;
	validation: boolean;
};

interface StoreInterface<S> {

	/**
	 * Get session data from the store
	 */
	get(id: string): Promise<Session<S>>;

	/**
	 * Remove session data from the store
	 */
	remove(id: string): Promise<void>;

	/**
	 * Save session data to the store
	 */
	set(id: string, session: Session<S>, timeout: number): Promise<void>;

	/**
	 * Update expiration time of the session data into the store
	 */
	update(id: string, timeout: number): Promise<void>;
}

interface TemplateEngine<I> {

	/**
	 * Render provided templates
	 */
	render(source: string, imports: I, callback: StringCallback): void;
}

declare abstract class Broadcaster<D, S> extends EventEmitter {

	/**
	 * Connections collection of the broadcaster
	 */
	connections: Set<WSConnection<D, S>>;

	/**
	 * Sends a message to the connections of the broadcaster
	 */
	broadcast<T>(event: string, data: T, filter?: WSFilterCallback<D, S>): this;

	/**
	 * Sends a message to the connections of the broadcaster
	 */
	broadcast<T>(data: T, filter?: WSFilterCallback<D, S>): this;
}

declare abstract class Connection<D, S> extends Transform {

	/**
	 * Container to store user data
	 */
	data: D;

	/**
	 * HTTP request headers
	 */
	headers: StringContainer;

	/**
	 * HTTP request host
	 */
	host: string;

	/**
	 * HTTP request hostname
	 */
	hostname: string;

	/**
	 * HTTP request location
	 */
	href: string;

	/**
	 * HTTP request location parameters
	 */
	params: StringContainer;

	/**
	 * HTTP request location path
	 */
	path: string;

	/**
	 * HTTP request protocol
	 */
	protocol: string;

	/**
	 * HTTP request
	 */
	request: IncomingMessage;

	/**
	 * Session container
	 */
	session: Session<S>;

	/**
	 * HTTP request serialized url
	 */
	url: URL;

	/**
	 * Cookies getter
	 */
	readonly cookies: StringContainer;

	/**
	 * IP address getter
	 */
	readonly ip: IPAddress;

	/**
	 * Languages getter in order of their importance
	 */
	readonly langs: string[];

	/**
	 * URL parsed query getter
	 */
	readonly query: StringContainer;

	/**
	 * Destroy the connection socket
	 */
	destroy(): void;

	/**
	 * Log data
	 */
	log(format: string, tokens?: Tokens): this;

	/**
	 * Log data
	 */
	log(logger: StringCallback, tokens?: Tokens): this;

	/**
	 * Log data
	 */
	log(format?: string, logger?: StringCallback, tokens?: Tokens): this;
}

declare class Body {

	/**
	 * Get request body buffer
	 */
	buffer(config?: StreamConfig): Promise<Buffer>;

	/**
	 * Parse JSON data from request body
	 */
	json<D>(config?: StreamConfig): Promise<D>;

	/**
	 * Parse query string data from request body
	 */
	qs(config?: StreamConfig): Promise<StringContainer>;

	/**
	 * Get text request body
	 */
	test(config?: StreamConfig): Promise<string>;
}

declare class Channel<D, S> extends Broadcaster<D, S> {

	/**
	 * Binds a connection to the channel
	 */
	bind(connection: WSConnection<D, S>): this;

	/**
	 * Drops all the connections from the channel and removes the channel
	 */
	close(): void;

	/**
	 * Unbinds a connection from the channel
	 */
	unbind(connection: WSConnection<D, S>): this;
}

declare class Client extends EventEmitter {

	/**
	 * Make an HTTP DELETE method request
	 */
	delete(location: string, options: RequestOptions): Request;

	/**
	 * Make an HTTP HEAD method request
	 */
	head(location: string, options: RequestOptions): Promise<Response>;

	/**
	 * Make an HTTP GET method request
	 */
	get(location: string, options: RequestOptions): Promise<Response>;

	/**
	 * Make an HTTP PATCH method request
	 */
	patch(location: string, options: RequestOptions): Request;

	/**
	 * Make an HTTP POST method request
	 */
	post(location: string, options: RequestOptions): Request;

	/**
	 * Make an HTTP PUT method request
	 */
	put(location: string, options: RequestOptions): Request;

	/**
	 * Make an HTTP request
	 */
	request(location: string, options: RequestOptions): Request;

	/**
	 * Make a WS connection
	 */
	ws(location: string, advanced: boolean, options: ClientConnectionOptions): ClientConnection;
}

declare class ClientConnection extends Transform {

	/**
	 * Close the connection and set a close status code if needed
	 */
	close(callback: Callback): void;

	/**
	 * Close the connection and set a close status code if needed
	 */
	close(code?: number, callback?: Callback): void;

	/**
	 * Destroy the connection socket
	 */
	destroy(): void;

	/**
	 * Send data to the server
	 */
	send<D>(data: D): void;

	/**
	 * Send data to the server
	 */
	send<D, R>(event: string, data: D, callback?: DataCallback<R>): void;
}

declare class Form extends EventEmitter {}

declare class HTTPConnection<D, S> extends Connection<D, S> {

	/**
	 * HTTP method
	 */
	method: string;

	/**
	 * HTTP response
	 */
	response: ServerResponse;

	/**
	 * Get received data from the request
	 */
	body(): Body;

	/**
	 * Set, get or remove Cache-Control header
	 */
	cache(): string;

	/**
	 * Set, get or remove Cache-Control header
	 */
	cache(config: null | string | CacheConfig): this;

	/**
	 * Close the connection
	 */
	close(callback?: Callback): void;

	/**
	 * Set a cookie
	 */
	cookie(name: string, value: string, attributes?: CookieAttributes): this;

	/**
	 * Write the content of a file to the response
	 */
	drain(location: string, type?: string, override?: boolean): void;

	/**
	 * Calls the error route with the provided code
	 */
	error(code: number): void;

	/**
	 * Parse multipart form data from request body
	 */
	form(): Promise<Form>;

	/**
	 * Set, get or remove a header of the response
	 */
	header(name: string): string;

	/**
	 * Set, get or remove a header of the response
	 */
	header(name: string, value: null | boolean | number | string | string[]): this;

	/**
	 * Set a timeout for inactivity on the connection socket
	 */
	keep(timeout?: number): this;

	/**
	 * Set or get the language of the content of the response
	 */
	lang(): string;

	/**
	 * Set or get the language of the content of the response
	 */
	lang(value: null | string): this;

	/**
	 * Define the relation of the current location with other locations
	 */
	link(): string;

	/**
	 * Define the relation of the current location with other locations
	 */
	link(links: StringContainer): this;

	/**
	 * Redirect the client to a specific location
	 */
	redirect(location: string, permanent?: boolean): void;

	/**
	 * Render from the template engine
	 */
	render<I>(source: string, imports: I): void;

	/**
	 * Send preformatted data to the response stream
	 */
	send<T>(data: T): void;

	/**
	 * Set or get the status code of the response
	 */
	status(): number;

	/**
	 * Set or get the status code of the response
	 */
	status(code: number): this;

	/**
	 * Get, set or remove the type of the content of the response
	 */
	type(): string;

	/**
	 * Get, set or remove the type of the content of the response
	 */
	type(type: string, override?: boolean): this;
}

declare class HTTPHost<D> extends Router<D> {}

declare class Mirror<D> extends EventEmitter {

	/**
	 * Container to store user data
	 */
	data: D;

	/**
	 * Start or restart the mirror
	 */
	start(port?: number, callback?: MirrorCallback<D>): this;

	/**
	 * Start or restart the mirror
	 */
	start(callback: MirrorCallback<D>): this;

	/**
	 * Stop the mirror
	 */
	stop(callback?: MirrorCallback<D>): this;
}

declare class Request {

	/**
	 * Abort request
	 */
	abort(): void;

	/**
	 * Drain data from a readable source stream and send it to the server
	 */
	drain(source: string | Readable, type?: string, override?: boolean): Promise<Response>;

	/**
	 * Send multipart form data to the server
	 */
	form(data: Container<FormDataField>): Promise<Response>;

	/**
	 * Set, get or remove a header of the request
	 */
	header(name: string): string;

	/**
	 * Set, get or remove a header of the request
	 */
	header(name: string, value: string): this;

	/**
	 * Send URL encoded data to the server
	 */
	qs<D>(data: D): Promise<Response>;

	/**
	 * Send data to the server
	 */
	send<D>(data: string | Buffer | Callback | D, type?: string, override?: boolean): Promise<Response>;

	/**
	 * Get, set or remove the content type of the request
	 */
	type(): string;

	/**
	 * Get, set or remove the content type of the request
	 */
	type(value: null | string, override?: boolean): this;
}

declare class Response {

	/**
	 * Getter for response body stream
	 */
	readonly body: IncomingMessage;

	/**
	 * Getter for response HTTP headers
	 */
	readonly headers: IncomingHttpHeaders;

	/**
	 * Getter for response network socket
	 */
	readonly socket: Socket;

	/**
	 * Getter for response status code
	 */
	readonly status: number;

	/**
	 * Get buffer response body
	 */
	buffer(config?: StreamConfig): Promise<Buffer>;

	/**
	 * Parse JSON data from response body
	 */
	json<D>(config?: StreamConfig): Promise<D>;

	/**
	 * Parse query string data from response body
	 */
	qs(config?: StreamConfig): Promise<StringContainer>;

	/**
	 * Get text response body
	 */
	text(config?: StreamConfig): Promise<string>;
}

declare class Router<D> extends EventEmitter {

	/**
	 * Container to store user data
	 */
	data: D;

	/**
	 * Route all types of requests
	 */
	all<A, S>(route: string, listener: RouteListener<A, S>): this;

	/**
	 * Route all types of requests
	 */
	all<T>(route: string, view: string, imports?: T): this;

	/**
	 * Route all types of requests
	 */
	all<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Configure router compression options
	 */
	compression(enabled: Enabled, config?: RouterCompressionOptions): this;

	/**
	 * Configure router compression options
	 */
	compression(preferred: PreferredCompression, config?: RouterCompressionOptions): this;

	/**
	 * Configure router compression options
	 */
	compression(config: RouterCompressionOptions): this;

	/**
	 * Set all router options
	 */
	config<S>(options: RouterOptions<S>): this;

	/**
	 * Configure router CORS options
	 */
	cors(config: RouterCORSOptions): this;

	/**
	 * Route DELETE requests
	 */
	delete<A, S>(route: string, listener: RouteListener<A, S>): this;

	/**
	 * Route DELETE requests
	 */
	delete<T>(route: string, view: string, imports?: T): this;

	/**
	 * Route DELETE requests
	 */
	delete<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Define the template engine to render the responses
	 */
	engine<I>(engine: TemplateEngine<I>): this;

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 */
	error<A, S>(code: number, listener: RouteListener<A, S>): this;

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 */
	error<T>(code: number, view: string, imports?: T): this;

	/**
	 * Route HTTP errors for 4xx and 5xx error codes
	 */
	error<A, S, T>(code: number, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Route GET requests
	 */
	get<A, S>(route: string, listener: RouteListener<A, S>): this;

	/**
	 * Route GET requests
	 */
	get<T>(route: string, view: string, imports?: T): this;

	/**
	 * Route GET requests
	 */
	get<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Configure router logger options
	 */
	logger(config: RouterLoggerOptions): this;

	/**
	 * Route PATCH requests
	 */
	patch<A, S>(route: string, listener: RouteListener<A, S>): this;

	/**
	 * Route PATCH requests
	 */
	patch<T>(route: string, view: string, imports?: T): this;

	/**
	 * Route PATCH requests
	 */
	patch<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Route POST requests
	 */
	post<A, S>(route: string, listener: RouteListener<A, S>): this;

	/**
	 * Route POST requests
	 */
	post<T>(route: string, view: string, imports?: T): this;

	/**
	 * Route POST requests
	 */
	post<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Route PUT requests
	 */
	put<A, S>(route: string, listener: RouteListener<A, S>): this;

	/**
	 * Route PUT requests
	 */
	put<T>(route: string, view: string, imports?: T): this;

	/**
	 * Route PUT requests
	 */
	put<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): this;

	/**
	 * Create a new router
	 */
	router<S>(location: string): this;

	/**
	 * Configure router session options
	 */
	session<S>(config: RouterSessionOptions<S>): this;

	/**
	 * Configure router static files options
	 */
	static(enabled: Enabled, config?: RouterStaticOptions): this;

	/**
	 * Configure router static files options
	 */
	static(location: string, config?: RouterStaticOptions): this;

	/**
	 * Configure router static files options
	 */
	static(config: RouterStaticOptions): this;

	/**
	 * Configure router HTTP timeout
	 */
	timeout(value: number): this;

	/**
	 * Add a middleware to the router
	 */
	use<A, S>(middleware: Middleware<A, S>): this;

	/**
	 * Set a new WS host
	 */
	ws<A, S>(location: string, options: WSOptions, listener: WSListener<A, S>): WSHost<A, S>;

	/**
	 * Set a new WS host
	 */
	ws<A, S>(location: string, listener?: WSListener<A, S>): WSHost<A, S>;
}

declare class Server<D> extends HTTPHost<D> {

	/**
	 * Create a new HTTP host
	 */
	host<S, H>(name: string, options?: RouterOptions<S>): HTTPHost<H>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(port?: number, options?: ServerOptions, callback?: MirrorCallback<M>): Mirror<M>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(port: number, callback?: MirrorCallback<M>): Mirror<M>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(options: ServerOptions, callback?: MirrorCallback<M>): Mirror<M>;

	/**
	 * Create a new mirror
	 */
	mirror<M>(callback: MirrorCallback<M>): Mirror<M>;

	/**
	 * Start or restart the server
	 */
	start(port?: number, callback?: ServerCallback<D>): this;

	/**
	 * Start or restart the server
	 */
	start(callback: ServerCallback<D>): this;

	/**
	 * Stop the server
	 */
	stop(callback?: ServerCallback<D>): this;
}

declare class Session<S> extends Map<string, S> {

	/**
	 * Flag to mark if the session is changed and needs to be saved to the store
	 */
	changed: boolean;

	/**
	 * Session id
	 */
	id: string;

	/**
	 * Session store
	 */
	store: Store<S>;

	/**
	 * Session timeout
	 */
	timeout: number;

	/**
	 * Remove all session entries
	 */
	clear(): void;

	/**
	 * Remove an entry of the session
	 */
	delete(key: string): boolean;

	/**
	 * Remove session from the store
	 */
	destroy(): Promise<void>;

	/**
	 * Generate new session id
	 */
	generate(): Promise<void>;

	/**
	 * Load the session from the store
	 */
	load():  Promise<void>;

	/**
	 * Save session to the store
	 */
	save(): Promise<void>;

	/**
	 * Add or update an entry of the session
	 */
	set(key: string, value: S): this;

	/**
	 * Update session expiration time
	 */
	update(): Promise<void>;
}

declare class Store<S> implements StoreInterface<S> {

	/**
	 * Get session data from the store
	 */
	get(id: string): Promise<Session<S>>;

	/**
	 * Remove session data from the store
	 */
	remove(id: string): Promise<void>;

	/**
	 * Save session data to the store
	 */
	set(id: string, session: Session<S>, timeout: number): Promise<void>;

	/**
	 * Update expiration time of the session data into the store
	 */
	update(id: string, timeout: number): Promise<void>;
}

declare class WSConnection<D, S> extends Connection<D, S> {

	/**
	 * Accepted WS protocols
	 */
	protocols: string[];

	/**
	 * Close the connection and set a close status code if needed
	 */
	close(code?: number, callback?: Callback): void;

	/**
	 * Close the connection and set a close status code if needed
	 */
	close(callback: Callback): void;

	/**
	 * Send data to the client
	 */
	send<T, R>(event: string, data: T, callback?: DataCallback<R>): void;

	/**
	 * Send data to the client
	 */
	send<T>(data: T): void;
}

declare class WSHost<D, S> extends Broadcaster<D, S> {

	/**
	 * Return a channel for grouping connections
	 */
	channel(name: string, filter?: WSFilterCallback<D, S>): Channel<D, S>;
}

/**
 * Create and start a new server
 */
declare function simples<S, D>(port?: number, options?: ServerOptions, callback?: ServerCallback<D>): Server<D>;

/**
 * Create and start a new server
 */
declare function simples<D>(port: number, callback: ServerCallback<D>): Server<D>;

/**
 * Create and start a new server
 */
declare function simples<S, D>(options: ServerOptions, callback?: ServerCallback<D>): Server<D>;

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
	function server<D>(port?: number, options?: ServerOptions, callback?: ServerCallback<D>): Server<D>;

	/**
	 * Create and start a new server
	 */
	function server<D>(port: number, callback: ServerCallback<D>): Server<D>;

	/**
	 * Create and start a new server
	 */
	function server<D>(options: ServerOptions, callback?: ServerCallback<D>): Server<D>;

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