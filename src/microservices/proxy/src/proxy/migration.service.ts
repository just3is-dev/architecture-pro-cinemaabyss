import { Injectable } from '@nestjs/common'
import { stableHash } from '../common/hash.util'

@Injectable()
export class MigrationService {
    private migrationPercent = Number(
        process.env.MOVIES_MIGRATION_PERCENT ?? 0,
    )

    shouldUseMoviesService(identifier: string): boolean {
        const bucket = stableHash(identifier)

        return bucket < this.migrationPercent
    }
}