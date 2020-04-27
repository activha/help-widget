import axios, { AxiosError, AxiosInstance } from 'axios';
import { FaqModel, FormModel, WidgetApi } from '../models';

interface ApiClientOptions {
    baseUrl: string;
    authTokenFactory?: () => Promise<string | undefined>;
    debug?: boolean;
}

interface ApiRequest<TRequest = any> {
    readonly url: string;
    readonly method?: 'GET' | 'DELETE' | 'POST' | 'PUT';
    readonly requestData?: TRequest;
}

export class ApiClient implements WidgetApi {
    private readonly client: AxiosInstance;

    constructor(options: ApiClientOptions) {
        if (!options?.baseUrl) {
            throw new Error('baseUrl is required');
        }

        this.client = axios.create({
            baseURL: options.baseUrl,
        });

        this.client.interceptors.response.use(
            undefined,
            (error: AxiosError) => {
                console.log(`Failed to call API`, error.response?.status, error.response?.data);
                return Promise.reject(error);
            });
        if (options.debug) {
            this.useDebugLogs();
        }

        if (options.authTokenFactory) {
            this.useAuth(options.authTokenFactory, options.debug);
        }
    }

    public getFaq = async () => await this.callApi<FaqModel[]>({ url: `/faq` });

    public sendForm = async (requestData: FormModel) =>
        await this.callApi<void>({ url: `/contact`, method: 'POST', requestData });

    private callApi<TResponse = any, TRequest = any>(request: ApiRequest<TRequest>): Promise<TResponse> {
        return new Promise((resolve, reject) => {
            this.client
                .request<TResponse>({
                    url: request.url,
                    method: request.method ?? 'GET',
                    data: request.requestData,
                    responseType: 'json'
                })
                .then((response) =>
                    response?.status && response.status >= 200 && response.status < 400
                        ? resolve(response?.data)
                        : reject(response?.data)
                )
                .catch((error: AxiosError) => reject(error.response ?? error.message));
        });
    }

    private useDebugLogs() {
        this.client.interceptors.request.use((config) => {
            console.info('Calling API', config.url, config.params);
            return config;
        });

        this.client.interceptors.response.use(
            (response) => {
                console.info('Got response from API', response.config.url, response.data);
                return response;
            },
            (error: AxiosError) => {
                console.info('There was an error calling API',
                    error.request?.url, error.response?.status, error.message);
                return Promise.reject(error);
            });
    }

    private useAuth(tokenFactory: () => Promise<string | undefined>, debug?: boolean) {
        this.client.interceptors.request.use(async (config) => {
            const token = await tokenFactory();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            } else if (debug) {
                console.log('No token returned by factory, skipping Authorization header');
            }

            return config;
        });
    }
}