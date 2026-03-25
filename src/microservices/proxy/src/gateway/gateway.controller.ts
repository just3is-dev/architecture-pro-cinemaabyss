import { Controller, Get } from '@nestjs/common'

@Controller('/api')
export class GatewayController {
    @Get('/health')
    health() {
        return {
            status: 'ok',
            service: 'api-gateway',
        }
    }
}