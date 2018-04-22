import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';
import { ServerOptions as HttpsServerOptions } from 'https';
import { PassThrough, Transform } from 'stream';
import { Url } from 'url';
import { ZlibOptions } from 'zlib';

type CacheConfig = {
	type?: 'public' | 'private',
	maxAge?: number,
	sMaxAge?: number
};

type Callback = () => void;

type ClientOptions = {};

type Container<T> = {
	[key: string]: T;
};

type CookieAttributes = {
	domain?: string,
	expires?: number,
	httpOnly?: boolean,
	maxAge?: number,
	path?: string,
	secure?: boolean
};

type DataCallback<T> = (data: T) => void;
type DataImporter<T> = (connection: HttpConnection<D, S>, callback: DataCallback<T>) => void;
type Enabled = boolean | EnabledFunction;
type EnabledFunction = () => boolean;
type ErrorCallback = (error: Error) => void;
type FormCallback = (form: HttpForm) => void;

type IpAddress = {
	port: number,
	family: string,
	address: string
};

type Logger = (data: string) => void;
type Middleware = (connection: HttpConnection<D, S>, next: Callback) => void;

type MirrorCallback = (mirror: Mirror) => void;

type MirrorOptions = {
	port?: number,
	hostname?: string,
	backlog?: number,
	https?: HttpsServerOptions
};

type ResultCallback<T> = (error: Error, result: Container<T>) => void;
type RouteListener = (connection: HttpConnection<D, S>) => void;

type ParseConfig<J, U> = {
	limit?: number;
	plain?: FormCallback;
	json?: ResultCallback<J>;
	multipart?: FormCallback;
	urlencoded?: ResultCallback<U>;
};

type JSONReplacer<V, R> = (key: string, value: V) => R;

type RouterOptions = {
	compression?: {
		enabled?: Enabled,
		options?: ZlibOptions,
		preferred?: 'deflate' | 'gzip'
	},
	cors?: {
		credentials?: boolean,
		headers?: string[],
		methods?: string[],
		origins?: string[]
	},
	logger?: {
		enabled?: Enabled,
		format?: string,
		log?: Logger,
		tokens?: Tokens
	},
	session?: {
		enabled?: Enabled,
		store?: Store
	}
	static?: {
		enabled?: Enabled,
		index?: string[],
		location?: string
	},
	timeout?: number
};

type ServerCallback<T> = (server: Server<T>) => void;

type ServerOptions = {
	config?: RouterOptions
} & MirrorOptions;

type StoreGetCallback<T> = (error: Error, session: T) => void;

type StoreOptions<S> = {
	get(id: string, callback: StoreGetCallback<S>): void,
	set(id: string, session: S, callback: ErrorCallback): void,
	unset(id: string, callback: ErrorCallback): void
};

type StringContainer = {
	[key: string]: string
};

type TemplateEngine<I> = {
	render(source: string, imports: I, callback: DataCallback<string>): void;
};

type Tokens = {
	[key: string]: (data: string) => string
};

type WsFilterCallback = (connection: WsConnection, index: number, connections: WsConnection[]) => void;
type WsListener = (connection: WsConnection) => void;

type WsOptions = {
	advanced: boolean,
	limit: number,
	origins: string[],
	timeout: number
};

declare abstract class Connection<D, S> extends Transform {

	data: Container<D>;
	headers: StringContainer;
	host: string;
	hostname: string;
	href: string;
	params: StringContainer;
	path: string;
	protocol: string;
	request: IncomingMessage;
	session: Container<S>;
	url: Url;

	get cookies(): StringContainer;
	get ip(): IpAddress;
	get langs(): string[];
	get query(): StringContainer;
	destroy(): void;
	log(data: string | Buffer, tokens?: Tokens): Connection<D, S>;
	log(logger: Logger, tokens?: Tokens): Connection<D, S>;
	log(data?: string | Buffer, logger?: Logger, tokens?: Tokens): Connection<D, S>;
}

declare class Client extends EventEmitter {

	delete(location: string, options): ClientRequest;
	head(location: string, options): ClientRequest;
	get(location: string, options): ClientRequest;
	patch(location: string, options): ClientRequest;
	post(location: string, options): ClientRequest;
	put(location: string, options): ClientRequest;
	request(method: string, location: string, options): ClientRequest;
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

	response: PassThrough;

	send<T, V, R>(data: T, replacer?: (string | number)[] | JSONReplacer<V, R>, space?: string | number): void;
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
	parse(config: ParseConfig): void;
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

	all(route: string, listener: RouteListener): HttpRouter<D>;
	all<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	all<T>(route: string, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	delete(route: string, listener: RouteListener): HttpRouter<D>;
	delete<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	delete<T>(route: string, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	engine<I>(engine: TemplateEngine<I>): HttpRouter<D>;
	error(code: number, listener: RouteListener): HttpRouter<D>;
	error<T>(code: number, view: string, imports: Container<T>): HttpRouter<D>;
	error<T>(code: number, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	get(route: string, listener: RouteListener): HttpRouter<D>;
	get<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	get<T>(route: string, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	patch(route: string, listener: RouteListener): HttpRouter<D>;
	patch<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	patch<T>(route: string, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	post(route: string, listener: RouteListener): HttpRouter<D>;
	post<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	post<T>(route: string, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	put(route: string, listener: RouteListener): HttpRouter<D>;
	put<T>(route: string, view: string, imports: Container<T>): HttpRouter<D>;
	put<T>(route: string, view: string, importer?: DataImporter<T>): HttpRouter<D>;
	router(location: string, options?: RouterOptions): HttpRouter<D>;
	use(middleware: Middleware): HttpRouter<D>;
	ws(location: string, options: WsOptions, listener: WsListener): WsHost;
	ws(location: string, listener?: WsListener): WsHost;
}

declare class HttpHost<D> extends HttpRouter<D> {}

declare class Mirror<D> extends EventEmitter {

	data: D;

	start(port?: number, callback?: MirrorCallback): Mirror;
	start(callback: MirrorCallback): Mirror;
	stop(callback?: MirrorCallback): Mirror;
}

declare class Server<D> extends HttpHost<D> {

	host<H>(name: string, options?: RouterOptions): HttpHost<H>;
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

declare class WsChannel extends EventEmitter {

	connections: Set<WsConnection>;

	bind(connection: WsConnection): WsChannel;
	broadcast<T>(event: string, data: T, filter?: WsFilterCallback): WsHost;
	broadcast<T>(data: T, filter?: WsFilterCallback): WsHost;
	close(): void;
	unbind(connection: WsConnection): WsChannel;
}

declare class WsConnection extends Connection<D, S> {

	protocols: string[];

	close(code?: number, callback?: Callback): void;
	close(callback: Callback): void;
	send<D, R>(event: string, data: D, callback?: DataCallback<R>): void;
	send<T>(data: T): void;
}

declare class WsHost extends EventEmitter {

	connections: Set<WsConnection>;

	broadcast<T>(event: string, data: T, filter?: WsFilterCallback): WsHost;
	broadcast<T>(data: T, filter?: WsFilterCallback): WsHost;
	channel(name: string, filter?: WsFilterCallback): WsChannel;
}

declare function simples<D>(port: number, options: ServerOptions, callback: ServerCallback<D>): Server<D>;
declare function simples<D>(port: number, callback: ServerCallback<D>): Server<D>;
declare function simples<D>(options: ServerOptions, callback?: ServerCallback<D>): Server<D>;
declare function simples<D>(callback: ServerCallback<D>): Server<D>;

declare namespace simples {

	export function client(options: ClientOptions): Client;
	export function server<D>(port?: number, options?: ServerOptions, callback?: ServerCallback<D>): Server<D>;
	export function server<D>(port: number, callback: ServerCallback<D>): Server<D>;
	export function server<D>(options: ServerOptions, callback?: ServerCallback<D>): Server<D>;
	export function server<D>(callback: ServerCallback<D>): Server<D>;
	export function store<S>(options?: StoreOptions<S>): Store<S>;
}

export = simples;