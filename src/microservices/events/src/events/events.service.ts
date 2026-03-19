import { Injectable } from '@nestjs/common'
import { KafkaService } from './kafka.service'

@Injectable()
export class EventsService {
    constructor(private kafka: KafkaService) {}

    async createEvent(type: string, payload: any) {
        const event = {
            type,
            payload,
            createdAt: new Date().toISOString(),
        }

        await this.kafka.emit(event)

        return { status: 'ok', event }
    }
}