import { createHash } from 'crypto'

export function stableHash(value: string): number {
    const hash = createHash('md5').update(value).digest('hex')
    const int = parseInt(hash.substring(0, 8), 16)

    return int % 100
}