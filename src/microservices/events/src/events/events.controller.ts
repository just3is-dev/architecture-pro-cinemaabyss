import { Body, Controller, Get, Post } from '@nestjs/common'
import { EventsService } from './events.service'

@Controller('api/events')
export class EventsController {
    constructor(private readonly service: EventsService) {}

    @Get('health')
    getHealth() {
        return { status: true }
    }

    @Post('user')
    async createUserEvent(@Body() body: any) {
        const event = await this.service.createEvent('UserEvent', body)

        return {
            status: 'success',
            event,
        }
    }

    @Post('payment')
    async createPaymentEvent(@Body() body: any) {
        const event = await this.service.createEvent('PaymentEvent', body)

        return {
            status: 'success',
            event,
        }
    }

    @Post('movie')
    async createMovieEvent(@Body() body: any) {
        const event = await this.service.createEvent('MovieEvent', body)

        return {
            status: 'success',
            event,
        }
    }
}