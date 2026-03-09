import { describe, it, expect } from 'vitest'

describe('S3 URI parsing', () => {
  it('should parse http URI with credentials', () => {
    const uri = 'http://minioadmin:minioadmin@localhost:9000'
    const url = new URL(uri)

    expect(url.hostname).toBe('localhost')
    expect(Number(url.port)).toBe(9000)
    expect(url.protocol).toBe('http:')
    expect(decodeURIComponent(url.username)).toBe('minioadmin')
    expect(decodeURIComponent(url.password)).toBe('minioadmin')
  })

  it('should parse https URI', () => {
    const uri = 'https://access:secret@s3.example.com:443'
    const url = new URL(uri)

    expect(url.hostname).toBe('s3.example.com')
    expect(url.protocol).toBe('https:')
    expect(decodeURIComponent(url.username)).toBe('access')
    expect(decodeURIComponent(url.password)).toBe('secret')
  })
})
