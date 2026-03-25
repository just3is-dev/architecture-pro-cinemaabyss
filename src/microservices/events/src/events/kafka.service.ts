import { Injectable, OnModuleInit } from '@nestjs/common'
import { Kafka } from 'kafkajs'

@Injectable()
export class KafkaService implements OnModuleInit {
    private kafka = new Kafka({
        brokers: ['kafka:9092'],
    })

    private producer = this.kafka.producer()
    private consumer = this.kafka.consumer({ groupId: 'events-group' })

    async onModuleInit() {
        await this.producer.connect()
        await this.consumer.connect()

        await this.consumer.subscribe({ topic: 'events', fromBeginning: true })

        await this.consumer.run({
            eachMessage: async ({ message }) => {
                console.log('📥 Event received:', message.value?.toString())
            },
        })
    }

    async emit(event: any) {
        await this.producer.send({
            topic: 'events',
            messages: [
                {
                    value: JSON.stringify(event),
                },
            ],
        })
    }
}