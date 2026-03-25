import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { GatewayController } from './gateway/gateway.controller'
import { ProxyMiddleware } from './proxy/proxy.middleware'
import { MigrationService } from './proxy/migration.service'

@Module({
    controllers: [GatewayController],
    providers: [MigrationService],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(ProxyMiddleware).forRoutes('*')
    }
}