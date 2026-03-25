import { Injectable, NestMiddleware } from '@nestjs/common'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { Request, Response } from 'express'
import { MigrationService } from './migration.service'

type Route = { path: string, handler: ReturnType<typeof createProxyMiddleware> }

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
    private readonly routes: Array<Route>
    private readonly monolithProxy: ReturnType<typeof createProxyMiddleware>

    constructor(private migration: MigrationService) {
        const [monolithUrl, moviesUrl, eventsUrl] = [
            process.env.MONOLITH_URL!,
            process.env.MOVIES_SERVICE_URL!,
            process.env.EVENTS_SERVICE_URL!
        ]

        const [monolithProxy, moviesProxy, eventsProxy] =
            [monolithUrl, moviesUrl, eventsUrl].map(target =>
                createProxyMiddleware({
                    target,
                    changeOrigin: true,
                    onProxyReq: (proxyReq, req) => {
                        if (req.body) {
                            const bodyData = JSON.stringify(req.body)

                            proxyReq.setHeader('Content-Type', 'application/json')
                            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))

                            proxyReq.write(bodyData)
                        }
                    },
                })
            )

        const moviesHandler = (req: Request, res: Response, next: any) => {
            const identifier =
                req.headers['x-user-id']?.toString()
                || req.ip
                || 'anonymous'

            const useMovies =
                this.migration.shouldUseMoviesService(identifier)

            return useMovies
                ? moviesProxy(req, res, next)
                : monolithProxy(req, res, next)
        }

        this.routes = [
            {
                path: '/api/movies',
                handler: moviesHandler
            },
            {
                path: '/api/events',
                handler: eventsProxy
            }
        ]

        this.monolithProxy = monolithProxy
    }

    use(req: Request, res: Response, next: () => void) {

        if (req.path === '/api/health') {
            return res.json({ status: 'ok' })
        }

        const route = this.routes.find(r =>
            req.path.startsWith(r.path)
        )

        if (route) {
            return route.handler(req, res, next)
        }

        return this.monolithProxy(req, res, next)
    }
}