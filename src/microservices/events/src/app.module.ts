import { Module } from '@nestjs/common'
import { EventsController } from './events/events.controller'
import { EventsService } from './events/events.service'
import { KafkaService } from './events/kafka.service'

@Module({
    controllers: [EventsController],
    providers: [EventsService, KafkaService],
})
export class AppModule {}