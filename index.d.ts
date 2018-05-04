import { EventEmitter } from 'events';
import { IncomingMessage, RequestOptions, ServerResponse } from 'http';
import { ServerOptions as HttpsServerOptions } from 'https';
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

type ClientRequestCallback = (response: ServerResponse, body: Buffer) => void;

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

type DataCallback<T> = (data: T) => void;
type DataImporter<D, S, T> = (connection: HttpConnection<D, S>, callback: DataCallback<T>) => void;
type Enabled = boolean | EnabledFunction;
type EnabledFunction = () => boolean;
type ErrorCallback = (error: Error) => void;
type FormCallback = (form: HttpForm) => void;

type IpAddress = {
	port: number;
	family: string;
	address: string;
};

type JSONReplacer<V, R> = (key: string, value: V) => R;

type Middleware<D, S> = (connection: HttpConnection<D, S>, next: Callback) => void;

type MirrorCallback<D> = (mirror: Mirror<D>) => void;

type MirrorOptions = {
	port?: number;
	hostname?: string;
	backlog?: number;
	https?: HttpsServerOptions;
};

type ParseConfig<J, U> = {
	limit?: number;
	plain?: FormCallback;
	json?: ResultCallback<J>;
	multipart?: FormCallback;
	urlencoded?: ResultCallback<U>;
};

type PipeOptions = {
	end?: boolean;
};

type ResultCallback<T> = (error: Error, result: Container<T>) => void;
type RouteListener<D, S> = (connection: HttpConnection<D, S>) => void;

type RouterOptions<S> = {
	compression?: {
		enabled?: Enabled;
		options?: ZlibOptions;
		preferred?: 'deflate' | 'gzip';
	};
	cors?: {
		credentials?: boolean;
		headers?: string[];
		methods?: string[];
		origins?: string[];
	};
	logger?: {
		enabled?: Enabled;
		format?: string;
		log?: StringCallback;
		tokens?: Tokens;
	};
	session?: {
		enabled?: Enabled;
		store?: Store<S>;
	};
	static?: {
		enabled?: Enabled;
		index?: string[];
		location?: string;
	};
	timeout?: number;
};

type ServerCallback<T> = (server: Server<T>) => void;

type ServerOptions<S> = {
	config?: RouterOptions<S>;
} & MirrorOptions;

type StoreGetCallback<T> = (error: Error, session: T) => void;

type StoreOptions<S> = {

	get(id: string, callback: StoreGetCallback<S>): void;
	set(id: string, session: S, callback: ErrorCallback): void;
	unset(id: string, callback: ErrorCallback): void;
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

type WsFilterCallback<D, S> = (connection: WsConnection<D, S>, index: number, connections: WsConnection<D, S>[]) => void;
type WsListener<D, S> = (connection: WsConnection<D, S>) => void;

type WsOptions = {
	advanced: boolean;
	limit: number;
	origins: string[];
	timeout: number;
};

declare abstract class Connection<D, S> extends Transform {

	cookies: StringContainer;
	data: Container<D>;
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
	log(data: string | Buffer, tokens?: Tokens): Connection<D, S>;
	log(logger: StringCallback, tokens?: Tokens): Connection<D, S>;
	log(data?: string | Buffer, logger?: StringCallback, tokens?: Tokens): Connection<D, S>;
}

declare class Client extends EventEmitter {

	delete(location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	head(location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	get(location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	patch(location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	post(location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	put(location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	request(method: string, location: string, options: RequestOptions, callback: ClientRequestCallback): ClientRequest;
	ws(location: string, mode: string, options): ClientConnection;
}

declare class ClientConnection extends Transform {

	close(callback: Callback): void;
	close(code?: number, callback?: Callback): void;
	destroy(): void;
	send<T>(data: T): void;
	send<D, R>(event: string, data: D, callback?: DataCallback<R>): void;
}

declare class ClientRequest extends Transform {

	send<T, V, R>(data: T, replacer?: (string | number)[] | JSONReplacer<V, R>, space?: string | number): void;
	stream(destination: Writable, options?: PipeOptions): void;
}

declare class HttpConnection<D, S> extends Connection<D, S> {

	method: string;
	response: ServerResponse;

	cache(): string;
	cache(config: CacheConfig | string): HttpConnection<D, S>;
	close(callback?: Callback): void;
	cookie(name: string, value: string, attributes?: CookieAttributes): HttpConnection<D, S>;
	drain(location: string, type?: string, override?: boolean): void;
	error(code: number): void;
	header(name: string): string;
	header(name: string, value: string | number | boolean | string[]): HttpConnection<D, S>;
	keep(timeout?: number): HttpConnection<D, S>;
	lang(): string;
	lang(value: string): HttpConnection<D, S>;
	link(): string;
	link(links: StringContainer): HttpConnection<D, S>;
	parse<J, U>(config: ParseConfig<J, U>): void;
	redirect(location: string, permanent?: boolean): void;
	render<T>(source: string, imports: T): void;
	send<T, V, R>(data: T, replacer?: (string | number)[] | JSONReplacer<V, R>, space?: string | number): void;
	status(): number;
	status(code: number): HttpConnection<D, S>;
	type(): string;
	type(type: string, override?: boolean): HttpConnection<D, S>;
}

declare class HttpForm extends PassThrough {

	type: string;
}

declare class HttpRouter<D> extends EventEmitter {

	data: Container<D>;

	all<A, S>(route: string, listener: RouteListener<A, S>): HttpRouter<D>;
	all<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	all<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	delete<A, S>(route: string, listener: RouteListener<A, S>): HttpRouter<D>;
	delete<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	delete<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	engine<I>(engine: TemplateEngine<I>): HttpRouter<D>;
	error<A, S>(code: number, listener: RouteListener<A, S>): HttpRouter<D>;
	error<T>(code: number, view: string, imports: Container<T>): HttpRouter<D>;
	error<A, S, T>(code: number, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	get<A, S>(route: string, listener: RouteListener<A, S>): HttpRouter<D>;
	get<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	get<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	patch<A, S>(route: string, listener: RouteListener<A, S>): HttpRouter<D>;
	patch<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	patch<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	post<A, S>(route: string, listener: RouteListener<A, S>): HttpRouter<D>;
	post<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	post<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	put<A, S>(route: string, listener: RouteListener<A, S>): HttpRouter<D>;
	put<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	put<A, S, T>(route: string, view: string, importer?: DataImporter<A, S, T>): HttpRouter<D>;
	router<S>(location: string, options?: RouterOptions<S>): HttpRouter<D>;
	use<A, S>(middleware: Middleware<A, S>): HttpRouter<D>;
	ws<A, S>(location: string, options: WsOptions, listener: WsListener<A, S>): WsHost<A, S>;
	ws<A, S>(location: string, listener?: WsListener<A, S>): WsHost<A, S>;
}

declare class HttpHost<D> extends HttpRouter<D> {}

declare class Mirror<D> extends EventEmitter {

	data: D;

	start(port?: number, callback?: MirrorCallback<D>): Mirror<D>;
	start(callback: MirrorCallback<D>): Mirror<D>;
	stop(callback?: MirrorCallback<D>): Mirror<D>;
}

declare class Server<D> extends HttpHost<D> {

	host<S, H>(name: string, options?: RouterOptions<S>): HttpHost<H>;
	mirror<M>(port?: number, options?: MirrorOptions, callback?: MirrorCallback<M>): Mirror<M>;
	mirror<M>(port: number, callback?: MirrorCallback<M>): Mirror<M>;
	mirror<M>(options: MirrorOptions, callback?: MirrorCallback<M>): Mirror<M>;
	mirror<M>(callback: MirrorCallback<M>): Mirror<M>;
	start(port?: number, callback?: ServerCallback<D>): Server<D>;
	start(callback: ServerCallback<D>): Server<D>;
	stop(callback?: ServerCallback<D>): Server<D>;
}

declare class Store<S> {

	get(id: string, callback: StoreGetCallback<S>): void;
	set(id: string, session: S, callback: ErrorCallback): void;
	unset(id: string, callback: ErrorCallback): void;
}

declare class WsChannel<D, S> extends EventEmitter {

	connections: Set<WsConnection<D, S>>;

	bind(connection: WsConnection<D, S>): WsChannel<D, S>;
	broadcast<T>(event: string, data: T, filter?: WsFilterCallback<D, S>): WsChannel<D, S>;
	broadcast<T>(data: T, filter?: WsFilterCallback<D, S>): WsChannel<D, S>;
	close(): void;
	unbind(connection: WsConnection<D, S>): WsChannel<D, S>;
}

declare class WsConnection<D, S> extends Connection<D, S> {

	protocols: string[];

	close(code?: number, callback?: Callback): void;
	close(callback: Callback): void;
	send<A, R>(event: string, data: A, callback?: DataCallback<R>): void;
	send<T>(data: T): void;
}

declare class WsHost<D, S> extends EventEmitter {

	connections: Set<WsConnection<D, S>>;

	broadcast<T>(event: string, data: T, filter?: WsFilterCallback<D, S>): WsHost<D, S>;
	broadcast<T>(data: T, filter?: WsFilterCallback<D, S>): WsHost<D, S>;
	channel(name: string, filter?: WsFilterCallback<D, S>): WsChannel<D, S>;
}

/**
 * Create a server with the provided port, options and callback
 */
declare function simples<S, D>(port?: number, options?: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

/**
 * Create a server with the provided port and callback
 */
declare function simples<D>(port: number, callback: ServerCallback<D>): Server<D>;

/**
 * Create a server with the provided options or callback
 */
declare function simples<S, D>(options: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

/**
 * Create a server with the provided callback
 */
declare function simples<D>(callback: ServerCallback<D>): Server<D>;

declare namespace simples {

	/**
	 * Create a client with the provided options
	 */
	function client(options?: ClientOptions): Client;

	/**
	 * Create a server with the provided port, options and callback
	 */
	function server<S, D>(port?: number, options?: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

	/**
	 * Create a server with the provided port and callback
	 */
	function server<D>(port: number, callback: ServerCallback<D>): Server<D>;

	/**
	 * Create a server with the provided options or callback
	 */
	function server<S, D>(options: ServerOptions<S>, callback?: ServerCallback<D>): Server<D>;

	/**
	 * Create a server with the provided callback
	 */
	function server<D>(callback: ServerCallback<D>): Server<D>;

	/**
	 * Create a session store with the provided options, if the options are not
	 * provided it will return a memcached session store
	 */
	function store<S>(options?: StoreOptions<S>): Store<S>;
}

export = simples;