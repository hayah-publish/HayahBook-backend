import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  const dataSource = { query: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('test-secret') };
  let service: AuthRateLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([{ hits: 1 }]);
    service = new AuthRateLimitService(dataSource as never, config as never);
  });

  it('records a shared atomic fixed-window counter without storing the identity', async () => {
    await expect(service.consume('login-ip', '203.0.113.8', 10, 900_000)).resolves.toBe(true);
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (key) DO UPDATE');
    expect(params[0]).not.toContain('203.0.113.8');
    expect(params[1]).toBe(900_000);
  });

  it('rejects a request after its configured limit', async () => {
    dataSource.query.mockResolvedValue([{ hits: 11 }]);
    await expect(service.consume('login-ip', '203.0.113.8', 10, 900_000)).resolves.toBe(false);
  });
});
